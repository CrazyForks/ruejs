use swc_core::common::{DUMMY_SP, SyntaxContext};
use swc_core::ecma::ast::*;
use swc_core::ecma::atoms::Atom;

use crate::emit::*;
use crate::vapor::VaporTransform;

const COMPONENT_NATIVE_EVENT_PREFIX: &str = "__rueNativeOn";

/*
元素级组件编译：
- 目标：在父元素下以注释锚点占位，结合 renderBetween 将组件输出插入其间；
- children 处理：默认编译为 props.children 的 DocumentFragment；对于默认需要原始 keyed JSX children 的内建组件（如 TransitionGroup），保留原始 JSX children；
- 内建 Fragment：若 children 已被改写为独立可挂载值，则直接渲染该值，不再额外包一层 <Fragment children={...}/>；
- 静态优化：无动态 props/children 的组件直接一次性渲染；其它包裹 watchEffect 以支持更新。
*/
pub(crate) struct ComponentChildrenRewrite {
    pub(crate) stmts: Vec<Stmt>,
    pub(crate) direct_render_expr: Option<Expr>,
}

fn jsx_name_to_expr(name: &JSXElementName) -> Option<Expr> {
    fn jsx_object_to_expr(obj: &JSXObject) -> Option<Expr> {
        match obj {
            JSXObject::Ident(id) => Some(Expr::Ident(id.clone())),
            JSXObject::JSXMemberExpr(member) => Some(Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(jsx_object_to_expr(&member.obj)?),
                prop: MemberProp::Ident(member.prop.clone()),
            })),
        }
    }

    match name {
        JSXElementName::Ident(id) => Some(Expr::Ident(id.clone())),
        JSXElementName::JSXMemberExpr(member) => Some(Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: Box::new(jsx_object_to_expr(&member.obj)?),
            prop: MemberProp::Ident(member.prop.clone()),
        })),
        JSXElementName::JSXNamespacedName(_) => None,
    }
}

fn jsx_attr_value_to_expr(value: &JSXAttrValue) -> Option<Expr> {
    match value {
        JSXAttrValue::Str(s) => {
            Some(Expr::Lit(Lit::Str(Str { span: DUMMY_SP, value: s.value.clone(), raw: None })))
        }
        JSXAttrValue::JSXExprContainer(ec) => match &ec.expr {
            JSXExpr::Expr(expr) => Some(crate::utils::unwrap_expr(expr.as_ref()).clone()),
            JSXExpr::JSXEmptyExpr(_) => None,
        },
        JSXAttrValue::JSXElement(el) => Some(Expr::JSXElement(el.clone())),
        JSXAttrValue::JSXFragment(frag) => Some(Expr::JSXFragment(frag.clone())),
    }
}

fn is_safe_prop_ident(name: &str) -> bool {
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return false;
    };

    let is_ident_start = |ch: char| ch == '$' || ch == '_' || ch.is_ascii_alphabetic();
    let is_ident_continue = |ch: char| is_ident_start(ch) || ch.is_ascii_digit();

    is_ident_start(first) && chars.all(is_ident_continue)
}

fn jsx_attr_name_to_prop_name(name: &JSXAttrName) -> Option<PropName> {
    match name {
        JSXAttrName::Ident(id) => {
            let raw = id.sym.as_ref();
            if is_safe_prop_ident(raw) {
                Some(PropName::Ident(id.clone()))
            } else {
                Some(PropName::Str(str_lit(raw)))
            }
        }
        JSXAttrName::JSXNamespacedName(_) => None,
    }
}

fn jsx_attrs_has_ident(attrs: &[JSXAttrOrSpread], name: &str) -> bool {
    attrs.iter().any(|attr| {
        matches!(attr, JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::Ident(id),
            ..
        }) if id.sym.as_ref() == name)
    })
}

fn remove_jsx_attr_ident(attrs: &mut Vec<JSXAttrOrSpread>, name: &str) {
    attrs.retain(|attr| {
        !matches!(attr, JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::Ident(id),
            ..
        }) if id.sym.as_ref() == name)
    });
}

fn extract_slot_name_expr(attrs: &[JSXAttrOrSpread]) -> Option<Expr> {
    for attr in attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            continue;
        };
        let JSXAttrName::Ident(name) = &attr.name else {
            continue;
        };
        if name.sym.as_ref() != "slot" {
            continue;
        }
        return attr.value.as_ref().and_then(jsx_attr_value_to_expr);
    }
    None
}

fn is_slot_component(el: &JSXElement) -> bool {
    match &el.opening.name {
        JSXElementName::Ident(id) => id.sym.as_ref() == "Slot",
        JSXElementName::JSXMemberExpr(expr) => expr.prop.sym.as_ref() == "Slot",
        _ => false,
    }
}

fn is_template_component(el: &JSXElement) -> bool {
    match &el.opening.name {
        JSXElementName::Ident(id) => id.sym.as_ref() == "Template",
        JSXElementName::JSXMemberExpr(expr) => expr.prop.sym.as_ref() == "Template",
        _ => false,
    }
}

fn is_slot_carrier_wrapper(el: &JSXElement) -> bool {
    crate::utils::is_builtin_fragment_element(el) || is_template_component(el)
}

fn current_instance_props_ro_expr() -> Expr {
    let current_instance_call = Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(Expr::Ident(ident("getCurrentInstance")))),
        args: vec![],
        type_args: None,
        ctxt: SyntaxContext::empty(),
    });

    Expr::Bin(BinExpr {
        span: DUMMY_SP,
        op: BinaryOp::LogicalAnd,
        left: Box::new(current_instance_call.clone()),
        right: Box::new(Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: Box::new(current_instance_call),
            prop: MemberProp::Ident(ident_name("propsRO")),
        })),
    })
}

fn make_source_attr() -> JSXAttrOrSpread {
    JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(IdentName { span: DUMMY_SP, sym: Atom::from("source") }),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
            span: DUMMY_SP,
            expr: JSXExpr::Expr(Box::new(current_instance_props_ro_expr())),
        })),
    })
}

fn is_function_literal_expr(expr: &Expr) -> bool {
    matches!(crate::utils::unwrap_expr(expr), Expr::Arrow(_) | Expr::Fn(_))
}

struct LoweredSlotValue {
    stmts: Vec<Stmt>,
    expr: Expr,
    is_function: bool,
}

fn undefined_expr() -> Expr {
    Expr::Ident(ident("undefined"))
}

fn is_substantive_slot_child(child: &JSXElementChild) -> bool {
    match child {
        JSXElementChild::JSXText(text) => {
            !crate::text::normalize_text(&text.value).trim().is_empty()
        }
        JSXElementChild::JSXExprContainer(ec) => match &ec.expr {
            JSXExpr::JSXEmptyExpr(_) => false,
            JSXExpr::Expr(expr) => {
                !crate::utils::is_static_empty_like(crate::utils::unwrap_expr(expr.as_ref()))
            }
        },
        _ => true,
    }
}

fn lower_expr_slot_value(vt: &mut VaporTransform, expr: &Expr) -> Option<LoweredSlotValue> {
    match crate::utils::unwrap_expr(expr) {
        Expr::JSXElement(jsx_el) => {
            // 表达式本身就是 JSX：把它临时当成一个 child 交给统一 slot lowering。
            let wrapped = vec![JSXElementChild::JSXElement(jsx_el.clone())];
            lower_slot_value(vt, &wrapped)
        }
        Expr::JSXFragment(jsx_frag) => {
            // Fragment 与 JSXElement 一样，最终都要变成可挂载的 slot 值。
            let wrapped = vec![JSXElementChild::JSXFragment(jsx_frag.clone())];
            lower_slot_value(vt, &wrapped)
        }
        Expr::Cond(CondExpr { test, cons, alt, .. }) => {
            let cons_inner = crate::utils::unwrap_expr(cons.as_ref());
            let alt_inner = crate::utils::unwrap_expr(alt.as_ref());

            // 只在“一边是 slot，一边是静态空值”的情况下折叠。
            // 两边都复杂时交给上层插槽表达式编译，避免丢失分支语义。
            if let Some(lowered_cons) = lower_expr_slot_value(vt, cons_inner)
                && crate::utils::is_static_empty_like(alt_inner)
            {
                return Some(LoweredSlotValue {
                    stmts: lowered_cons.stmts,
                    expr: Expr::Cond(CondExpr {
                        span: DUMMY_SP,
                        test: test.clone(),
                        cons: Box::new(lowered_cons.expr),
                        alt: Box::new(undefined_expr()),
                    }),
                    is_function: false,
                });
            }

            if let Some(lowered_alt) = lower_expr_slot_value(vt, alt_inner)
                && crate::utils::is_static_empty_like(cons_inner)
            {
                return Some(LoweredSlotValue {
                    stmts: lowered_alt.stmts,
                    expr: Expr::Cond(CondExpr {
                        span: DUMMY_SP,
                        test: test.clone(),
                        cons: Box::new(undefined_expr()),
                        alt: Box::new(lowered_alt.expr),
                    }),
                    is_function: false,
                });
            }

            None
        }
        Expr::Bin(BinExpr { op: BinaryOp::LogicalAnd, left, right, .. }) => {
            // `ok && <Slot/>` 转成 `ok ? loweredSlot : undefined`，
            // 让 slot bag 不渲染空分支，而不是塞入布尔值。
            let lowered_right =
                lower_expr_slot_value(vt, crate::utils::unwrap_expr(right.as_ref()))?;

            Some(LoweredSlotValue {
                stmts: lowered_right.stmts,
                expr: Expr::Cond(CondExpr {
                    span: DUMMY_SP,
                    test: left.clone(),
                    cons: Box::new(lowered_right.expr),
                    alt: Box::new(undefined_expr()),
                }),
                is_function: false,
            })
        }
        Expr::Call(call)
            if crate::element_expr::contains_jsx_in_expr(&Expr::Call(call.clone())) =>
        {
            // useMemo/map/自定义 render helper 若返回 JSX，统一转成可挂载 slot 表达式。
            Some(LoweredSlotValue {
                stmts: vec![],
                expr: crate::element_expr::make_expr_for_slot(vt, expr),
                is_function: false,
            })
        }
        _ => None,
    }
}

fn lower_slot_value(
    vt: &mut VaporTransform,
    children: &[JSXElementChild],
) -> Option<LoweredSlotValue> {
    let has_substantive_child = children.iter().any(is_substantive_slot_child);

    if !has_substantive_child {
        // 纯空白、空表达式、null/false 这类 children 不生成 slot prop。
        return None;
    }

    let simple_children: Vec<&JSXElementChild> =
        children.iter().filter(|child| is_substantive_slot_child(child)).collect();

    if simple_children.len() == 1 {
        match simple_children[0] {
            JSXElementChild::JSXElement(el_box)
                if crate::utils::is_component(&el_box.opening.name) =>
            {
                // 单个组件 child 可以先创建组件实例，再把实例标识符直接作为 children。
                // 这样避免额外包一层 DocumentFragment，slot 结构更薄。
                let mut child_component = (**el_box).clone();
                let rewrite = rewrite_component_children_to_props(vt, &mut child_component);
                let mount_expr = rewrite
                    .direct_render_expr
                    .clone()
                    .unwrap_or_else(|| build_component_mount_expr(&child_component));
                let child_ident = vt.next_child_ident();
                let mut stmts = rewrite.stmts;
                stmts.push(const_decl(child_ident.clone(), mount_expr));

                return Some(LoweredSlotValue {
                    stmts,
                    expr: Expr::Ident(child_ident),
                    is_function: false,
                });
            }
            JSXElementChild::JSXText(text) => {
                // 单个文本 child 直接降为字符串 prop，组件无需再执行 vapor setup。
                let normalized = crate::text::normalize_text(&text.value);
                if let Some(content) =
                    crate::text::compute_jsx_text_content(children, 0, &normalized)
                {
                    return Some(LoweredSlotValue {
                        stmts: vec![],
                        expr: string_expr(&content),
                        is_function: false,
                    });
                }
            }
            JSXElementChild::JSXExprContainer(ec) => {
                if let JSXExpr::Expr(expr) = &ec.expr {
                    let inner = crate::utils::unwrap_expr(expr.as_ref());
                    // 表达式里如果能继续降成 slot 值，优先复用递归 lowering。
                    if let Some(lowered) = lower_expr_slot_value(vt, inner) {
                        return Some(lowered);
                    }
                    match inner {
                        Expr::Lit(Lit::Str(_)) | Expr::Lit(Lit::Num(_)) => {
                            return Some(LoweredSlotValue {
                                stmts: vec![],
                                expr: inner.clone(),
                                is_function: false,
                            });
                        }
                        _ if !crate::element_expr::contains_jsx_in_expr(inner) => {
                            // 普通表达式（含函数字面量）直接作为 children；
                            // 函数字面量会触发 slot bag，保留 scoped slot 语义。
                            return Some(LoweredSlotValue {
                                stmts: vec![],
                                expr: inner.clone(),
                                is_function: is_function_literal_expr(inner),
                            });
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }

    let child_ident = vt.next_child_ident();
    let child_root = ident("_root");
    // 多 child 或复杂 child 需要包装成独立 vapor 片段，作为可挂载 children 值传入组件。
    let mut child_body: Vec<Stmt> =
        vec![const_decl(child_root.clone(), call_ident("_$createDocumentFragment", vec![]))];
    crate::element_children::emit_element_children(vt, &child_root, children, &mut child_body);
    child_body.push(return_root(child_root.clone()));
    let arrow = Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![],
        body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts: child_body,
        })),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: SyntaxContext::empty(),
    });
    let child_vapor = call_ident("vapor", vec![arrow]);

    Some(LoweredSlotValue {
        stmts: vec![const_decl(child_ident.clone(), child_vapor)],
        expr: Expr::Ident(child_ident),
        is_function: false,
    })
}

fn lower_named_slot_element(
    vt: &mut VaporTransform,
    jsx_el: &JSXElement,
) -> Option<(Expr, LoweredSlotValue)> {
    let slot_name_expr = extract_slot_name_expr(&jsx_el.opening.attrs)?;
    let mut slot_el = jsx_el.clone();
    // slot 属性只用于编译期决定 slot 名，传给真实 child 前必须移除。
    remove_jsx_attr_ident(&mut slot_el.opening.attrs, "slot");
    let lowered = if is_slot_carrier_wrapper(&slot_el) {
        // Fragment/Template 是 slot 内容承载壳，本身不应该成为 slot 子节点。
        lower_slot_value(vt, &slot_el.children)
    } else {
        let wrapped = vec![JSXElementChild::JSXElement(Box::new(slot_el))];
        lower_slot_value(vt, &wrapped)
    }?;
    Some((slot_name_expr, lowered))
}

fn lower_named_slot_expr(vt: &mut VaporTransform, expr: &Expr) -> Option<(Expr, LoweredSlotValue)> {
    match crate::utils::unwrap_expr(expr) {
        Expr::JSXElement(jsx_el) => lower_named_slot_element(vt, jsx_el),
        Expr::Cond(CondExpr { test, cons, alt, .. }) => {
            let cons_inner = crate::utils::unwrap_expr(cons.as_ref());
            let alt_inner = crate::utils::unwrap_expr(alt.as_ref());

            if let Some((slot_name_expr, lowered_cons)) = lower_named_slot_expr(vt, cons_inner)
                && crate::utils::is_static_empty_like(alt_inner)
            {
                return Some((
                    slot_name_expr,
                    LoweredSlotValue {
                        stmts: lowered_cons.stmts,
                        expr: Expr::Cond(CondExpr {
                            span: DUMMY_SP,
                            test: test.clone(),
                            cons: Box::new(lowered_cons.expr),
                            alt: Box::new(undefined_expr()),
                        }),
                        is_function: false,
                    },
                ));
            }

            if let Some((slot_name_expr, lowered_alt)) = lower_named_slot_expr(vt, alt_inner)
                && crate::utils::is_static_empty_like(cons_inner)
            {
                return Some((
                    slot_name_expr,
                    LoweredSlotValue {
                        stmts: lowered_alt.stmts,
                        expr: Expr::Cond(CondExpr {
                            span: DUMMY_SP,
                            test: test.clone(),
                            cons: Box::new(undefined_expr()),
                            alt: Box::new(lowered_alt.expr),
                        }),
                        is_function: false,
                    },
                ));
            }

            None
        }
        Expr::Bin(BinExpr { op: BinaryOp::LogicalAnd, left, right, .. }) => {
            let (slot_name_expr, lowered_right) =
                lower_named_slot_expr(vt, crate::utils::unwrap_expr(right.as_ref()))?;

            Some((
                slot_name_expr,
                LoweredSlotValue {
                    stmts: lowered_right.stmts,
                    expr: Expr::Cond(CondExpr {
                        span: DUMMY_SP,
                        test: left.clone(),
                        cons: Box::new(lowered_right.expr),
                        alt: Box::new(undefined_expr()),
                    }),
                    is_function: false,
                },
            ))
        }
        _ => None,
    }
}

fn slot_prop_name(name_expr: Expr) -> PropName {
    match crate::utils::unwrap_expr(&name_expr) {
        Expr::Lit(Lit::Str(str_lit)) => PropName::Str(str_lit.clone()),
        _ => PropName::Computed(ComputedPropName { span: DUMMY_SP, expr: Box::new(name_expr) }),
    }
}

pub(crate) fn build_component_mount_expr(comp_el: &JSXElement) -> Expr {
    let type_expr = jsx_name_to_expr(&comp_el.opening.name).unwrap_or_else(|| string_expr("div"));
    let mut native_events: Vec<(String, Expr)> = Vec::new();
    let mut attrs = comp_el.opening.attrs.clone();
    if is_slot_component(comp_el) && !jsx_attrs_has_ident(&attrs, "source") {
        // <Slot> 默认从当前实例的只读 props 上取 slot source，调用方未传时自动补齐。
        attrs.push(make_source_attr());
    }
    let props = attrs
        .iter()
        .filter_map(|attr| match attr {
            JSXAttrOrSpread::SpreadElement(spread) => Some(PropOrSpread::Spread(SpreadElement {
                dot3_token: DUMMY_SP,
                expr: spread.expr.clone(),
            })),
            JSXAttrOrSpread::JSXAttr(attr) => {
                // 无值属性按 JSX 约定视为 true；其它值统一转成 JS 表达式进入 props 对象。
                let value = match &attr.value {
                    Some(value) => jsx_attr_value_to_expr(value)?,
                    None => Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: true })),
                };

                if let JSXAttrName::Ident(name) = &attr.name
                    && let Some(event_name) =
                        name.sym.as_ref().strip_prefix(COMPONENT_NATIVE_EVENT_PREFIX)
                {
                    // `.native` 事件不放进组件 props，而是在创建后绑定到组件根节点。
                    native_events.push((event_name.to_ascii_lowercase(), value));
                    return None;
                }

                let key = jsx_attr_name_to_prop_name(&attr.name)?;
                Some(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key,
                    value: Box::new(value),
                }))))
            }
        })
        .collect();
    let props_expr = Expr::Object(ObjectLit { span: DUMMY_SP, props });
    let mount_expr = call_ident("_$createComponent", vec![type_expr, props_expr]);

    if native_events.is_empty() {
        return mount_expr;
    }

    // 组件根原生事件需要在组件创建结果外再包一层运行时 helper。
    let native_events_expr = Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: native_events
            .into_iter()
            .map(|(event_name, handler)| {
                PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: PropName::Str(Str {
                        span: DUMMY_SP,
                        value: Atom::from(event_name.as_str()).into(),
                        raw: None,
                    }),
                    value: Box::new(handler),
                })))
            })
            .collect(),
    });

    call_ident("_$vaporWithNativeEvents", vec![mount_expr, native_events_expr])
}

fn extract_jsx_key_expr(jsx_el: &JSXElement) -> Option<Expr> {
    for attr in &jsx_el.opening.attrs {
        if let JSXAttrOrSpread::JSXAttr(attr) = attr
            && let JSXAttrName::Ident(name) = &attr.name
        {
            if name.sym.as_ref() != "key" {
                continue;
            }
            match &attr.value {
                Some(JSXAttrValue::Str(s)) => {
                    return Some(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: s.value.clone(),
                        raw: None,
                    })));
                }
                Some(JSXAttrValue::JSXExprContainer(ec)) => {
                    if let JSXExpr::Expr(expr) = &ec.expr {
                        return Some(crate::utils::unwrap_expr(expr.as_ref()).clone());
                    }
                }
                _ => {}
            }
        }
    }
    None
}

fn wrap_transition_group_child_expr(expr: Expr, key_expr: Option<Expr>) -> Expr {
    if let Some(key_expr) = key_expr {
        call_ident("_$vaporWithKey", vec![expr, key_expr])
    } else {
        expr
    }
}

fn rewrite_transition_group_render_expr(vt: &mut VaporTransform, expr: &Expr) -> Expr {
    let inner = crate::utils::unwrap_expr(expr);
    if let Expr::Call(call) = inner
        && let Some(mapped) = rewrite_transition_group_map_expr(vt, call)
    {
        return mapped;
    }

    match inner {
        Expr::JSXElement(jsx_el) => wrap_transition_group_child_expr(
            crate::element_expr::make_expr_for_slot(vt, inner),
            extract_jsx_key_expr(jsx_el),
        ),
        Expr::JSXFragment(_) => crate::element_expr::make_expr_for_slot(vt, inner),
        Expr::Cond(CondExpr { test, cons, alt, .. }) => Expr::Cond(CondExpr {
            span: DUMMY_SP,
            test: test.clone(),
            cons: Box::new(rewrite_transition_group_render_expr(vt, cons.as_ref())),
            alt: Box::new(rewrite_transition_group_render_expr(vt, alt.as_ref())),
        }),
        Expr::Bin(BinExpr { op: BinaryOp::LogicalAnd, left, right, .. }) => Expr::Cond(CondExpr {
            span: DUMMY_SP,
            test: left.clone(),
            cons: Box::new(rewrite_transition_group_render_expr(vt, right.as_ref())),
            alt: Box::new(string_expr("")),
        }),
        _ => inner.clone(),
    }
}

fn rewrite_transition_group_map_callback_body(
    vt: &mut VaporTransform,
    body: &BlockStmtOrExpr,
) -> BlockStmtOrExpr {
    match body {
        BlockStmtOrExpr::Expr(expr) => {
            Box::new(rewrite_transition_group_render_expr(vt, expr.as_ref())).into()
        }
        BlockStmtOrExpr::BlockStmt(block) => {
            let mut next_block = block.clone();
            rewrite_transition_group_returns_in_block(vt, &mut next_block);
            BlockStmtOrExpr::BlockStmt(next_block)
        }
    }
}

fn collect_transition_group_callback_plain_locals(
    params: &[Pat],
) -> std::collections::HashSet<String> {
    fn collect_from_pat(pat: &Pat, out: &mut std::collections::HashSet<String>) {
        match pat {
            Pat::Ident(binding) => {
                out.insert(binding.id.sym.to_string());
            }
            Pat::Array(arr) => {
                for elem in arr.elems.iter().flatten() {
                    collect_from_pat(elem, out);
                }
            }
            Pat::Object(obj) => {
                for prop in &obj.props {
                    match prop {
                        ObjectPatProp::KeyValue(kv) => collect_from_pat(&kv.value, out),
                        ObjectPatProp::Assign(assign) => {
                            out.insert(assign.key.sym.to_string());
                        }
                        ObjectPatProp::Rest(rest) => collect_from_pat(&rest.arg, out),
                    }
                }
            }
            Pat::Assign(assign) => collect_from_pat(&assign.left, out),
            Pat::Rest(rest) => collect_from_pat(&rest.arg, out),
            _ => {}
        }
    }

    let mut out = std::collections::HashSet::new();
    for param in params {
        collect_from_pat(param, &mut out);
    }
    out
}

fn rewrite_transition_group_returns_in_block(vt: &mut VaporTransform, block: &mut BlockStmt) {
    for stmt in &mut block.stmts {
        rewrite_transition_group_returns_in_stmt(vt, stmt);
    }
}

fn rewrite_transition_group_returns_in_stmt(vt: &mut VaporTransform, stmt: &mut Stmt) {
    match stmt {
        Stmt::Return(ret) => {
            if let Some(arg) = &ret.arg {
                ret.arg = Some(Box::new(rewrite_transition_group_render_expr(vt, arg.as_ref())));
            }
        }
        Stmt::Block(block) => rewrite_transition_group_returns_in_block(vt, block),
        Stmt::If(if_stmt) => {
            rewrite_transition_group_returns_in_stmt(vt, &mut if_stmt.cons);
            if let Some(alt) = &mut if_stmt.alt {
                rewrite_transition_group_returns_in_stmt(vt, alt);
            }
        }
        Stmt::Switch(switch_stmt) => {
            for case in &mut switch_stmt.cases {
                for cons in &mut case.cons {
                    rewrite_transition_group_returns_in_stmt(vt, cons);
                }
            }
        }
        Stmt::Try(try_stmt) => {
            rewrite_transition_group_returns_in_block(vt, &mut try_stmt.block);
            if let Some(handler) = &mut try_stmt.handler {
                rewrite_transition_group_returns_in_block(vt, &mut handler.body);
            }
            if let Some(finalizer) = &mut try_stmt.finalizer {
                rewrite_transition_group_returns_in_block(vt, finalizer);
            }
        }
        _ => {}
    }
}

fn rewrite_transition_group_map_expr(vt: &mut VaporTransform, call: &CallExpr) -> Option<Expr> {
    let Callee::Expr(callee) = &call.callee else {
        return None;
    };
    let Expr::Member(MemberExpr { obj, prop: MemberProp::Ident(prop_ident), .. }) = &**callee
    else {
        return None;
    };
    if prop_ident.sym.as_ref() != "map" || call.args.len() != 1 {
        return None;
    }
    let callback_expr = crate::utils::unwrap_expr(call.args[0].expr.as_ref());
    let Expr::Arrow(arrow) = callback_expr else {
        return None;
    };
    let plain_locals = collect_transition_group_callback_plain_locals(&arrow.params);
    vt.push_plain_local_scope(plain_locals);
    let rewritten_body = rewrite_transition_group_map_callback_body(vt, arrow.body.as_ref());
    vt.pop_plain_local_scope();
    let rewritten_arrow = Expr::Arrow(ArrowExpr {
        span: arrow.span,
        params: arrow.params.clone(),
        body: Box::new(rewritten_body),
        is_async: arrow.is_async,
        is_generator: arrow.is_generator,
        type_params: arrow.type_params.clone(),
        return_type: arrow.return_type.clone(),
        ctxt: arrow.ctxt,
    });
    Some(Expr::Call(CallExpr {
        span: call.span,
        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: obj.clone(),
            prop: MemberProp::Ident(prop_ident.clone()),
        }))),
        args: vec![ExprOrSpread { spread: None, expr: Box::new(rewritten_arrow) }],
        type_args: call.type_args.clone(),
        ctxt: call.ctxt,
    }))
}

fn build_transition_group_children_expr(
    vt: &mut VaporTransform,
    children: &[JSXElementChild],
) -> Option<Expr> {
    let mut out: Vec<Option<Expr>> = Vec::new();
    for child in children {
        let expr = match child {
            JSXElementChild::JSXText(text) => {
                let normalized = crate::text::normalize_text(&text.value);
                if normalized.trim().is_empty() { None } else { Some(string_expr(&normalized)) }
            }
            JSXElementChild::JSXElement(el) => {
                Some(rewrite_transition_group_render_expr(vt, &Expr::JSXElement(el.clone())))
            }
            JSXElementChild::JSXFragment(frag) => {
                Some(rewrite_transition_group_render_expr(vt, &Expr::JSXFragment(frag.clone())))
            }
            JSXElementChild::JSXExprContainer(ec) => match &ec.expr {
                JSXExpr::JSXEmptyExpr(_) => None,
                JSXExpr::Expr(expr) => {
                    Some(rewrite_transition_group_render_expr(vt, expr.as_ref()))
                }
            },
            JSXElementChild::JSXSpreadChild(_) => None,
        };
        out.push(expr);
    }

    let mut exprs: Vec<Expr> = out.into_iter().flatten().collect();
    if exprs.is_empty() {
        return None;
    }
    if exprs.len() == 1 {
        return exprs.pop();
    }
    Some(Expr::Array(ArrayLit {
        span: DUMMY_SP,
        elems: exprs
            .into_iter()
            .map(|expr| Some(ExprOrSpread { spread: None, expr: Box::new(expr) }))
            .collect(),
    }))
}

/// 处理 JSX 组件元素：
/// - 在父节点下插入占位注释（start/end）
/// - 若组件存在内联 children，将其改写为 children 属性传入一个原生 DocumentFragment，
///   并在调用处直接编译这些子节点为原生 DOM 以便递归渲染
/// - 使用 `renderBetween` + `watchEffect` 在占位之间进行渲染
///   示例（参考 `tests/spec11.rs` 等）：
/// - 插入占位：`const _list1 = _$createComment("rue:slot:start"); const _list2 = _$createComment("rue:slot:end");`
/// - 包裹 children：`children={vapor(()=>{ const _root = _$createDocumentFragment(); ... return _root })}`
/// - 渲染：`watchEffect(()=>{ renderBetween(<Comp {...props} />, parent, start, end) })`
///
/// 组件 children 默认会被改写为 `children` 属性传入；
/// `TransitionGroup` 这类依赖原始 keyed JSX children 的组件在此处保留原始 children。
pub(crate) fn rewrite_component_children_to_props(
    vt: &mut VaporTransform,
    comp_el: &mut JSXElement,
) -> ComponentChildrenRewrite {
    let mut child_stmts: Vec<Stmt> = vec![];
    let mut direct_render_expr: Option<Expr> = None;

    let is_transition_group = crate::utils::is_transition_group_component(comp_el);

    if !comp_el.children.is_empty() && is_transition_group {
        // TransitionGroup 需要直接看原始 keyed children 做过渡编排；
        // 因此这里只把 children 整体表达式塞进 prop，不走普通 slot bag lowering。
        if let Some(children_expr) = build_transition_group_children_expr(vt, &comp_el.children) {
            let mut new_attrs = comp_el.opening.attrs.clone();
            new_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
                span: DUMMY_SP,
                name: JSXAttrName::Ident(IdentName { span: DUMMY_SP, sym: Atom::from("children") }),
                value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                    span: DUMMY_SP,
                    expr: JSXExpr::Expr(Box::new(children_expr)),
                })),
            }));
            comp_el.opening.attrs = new_attrs;
            comp_el.children = vec![];
            comp_el.opening.self_closing = true;
            comp_el.closing = None;
        }
        return ComponentChildrenRewrite { stmts: child_stmts, direct_render_expr };
    }

    if !comp_el.children.is_empty() {
        let mut default_children: Vec<JSXElementChild> = Vec::new();
        let mut named_slots: Vec<(Expr, LoweredSlotValue)> = Vec::new();

        for child in comp_el.children.iter().cloned() {
            match child {
                JSXElementChild::JSXElement(el_box) => {
                    let slot_name = extract_slot_name_expr(&el_box.opening.attrs);
                    if let Some(slot_name_expr) = slot_name {
                        // 带 `slot="name"` 的元素从默认 children 中分流到具名 slot。
                        let mut slot_el = (*el_box).clone();
                        remove_jsx_attr_ident(&mut slot_el.opening.attrs, "slot");
                        let lowered = if is_slot_carrier_wrapper(&slot_el) {
                            lower_slot_value(vt, &slot_el.children)
                        } else {
                            let wrapped = vec![JSXElementChild::JSXElement(Box::new(slot_el))];
                            lower_slot_value(vt, &wrapped)
                        };
                        if let Some(lowered) = lowered {
                            named_slots.push((slot_name_expr, lowered));
                        }
                        continue;
                    }
                    default_children.push(JSXElementChild::JSXElement(el_box));
                }
                JSXElementChild::JSXExprContainer(ec) => {
                    if let JSXExpr::Expr(expr) = &ec.expr
                        && let Some((slot_name_expr, lowered)) =
                            lower_named_slot_expr(vt, expr.as_ref())
                    {
                        // 条件/逻辑表达式包着具名 slot 时，同样保留 slot 名并 lowering 分支内容。
                        named_slots.push((slot_name_expr, lowered));
                        continue;
                    }
                    default_children.push(JSXElementChild::JSXExprContainer(ec));
                }
                other => default_children.push(other),
            }
        }

        let default_slot = lower_slot_value(vt, &default_children);
        let has_named_slots = !named_slots.is_empty();
        let default_requires_slot_bag =
            default_slot.as_ref().map(|slot| slot.is_function).unwrap_or(false);

        let mut new_attrs = comp_el.opening.attrs.clone();

        let default_in_slot_bag = has_named_slots || default_requires_slot_bag;

        if default_in_slot_bag {
            // 只要存在具名 slot，或者默认 slot 本身是函数，就统一走 __rue_slots 对象。
            // 这样组件内部拿到的 slot 结构保持一致。
            let mut slot_props: Vec<PropOrSpread> = Vec::new();

            if let Some(default_slot_value) = &default_slot {
                child_stmts.extend(default_slot_value.stmts.iter().cloned());
                slot_props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: PropName::Str(Str {
                        span: DUMMY_SP,
                        value: Atom::from("default").into(),
                        raw: None,
                    }),
                    value: Box::new(default_slot_value.expr.clone()),
                }))));
            }

            for (slot_name_expr, lowered) in named_slots {
                child_stmts.extend(lowered.stmts);
                slot_props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: slot_prop_name(slot_name_expr),
                    value: Box::new(lowered.expr),
                }))));
            }

            new_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
                span: DUMMY_SP,
                name: JSXAttrName::Ident(IdentName {
                    span: DUMMY_SP,
                    sym: Atom::from("__rue_slots"),
                }),
                value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                    span: DUMMY_SP,
                    expr: JSXExpr::Expr(Box::new(Expr::Object(ObjectLit {
                        span: DUMMY_SP,
                        props: slot_props,
                    }))),
                })),
            }));
        }

        if let Some(default_slot_value) = default_slot
            && !default_slot_value.is_function
        {
            if !default_in_slot_bag {
                child_stmts.extend(default_slot_value.stmts.iter().cloned());
            }
            if crate::utils::is_builtin_fragment_element(comp_el) {
                // 内建 Fragment 只是透明容器，可直接渲染 children，避免再创建组件实例。
                direct_render_expr = Some(default_slot_value.expr.clone());
            }
            new_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
                span: DUMMY_SP,
                name: JSXAttrName::Ident(IdentName { span: DUMMY_SP, sym: Atom::from("children") }),
                value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                    span: DUMMY_SP,
                    expr: JSXExpr::Expr(Box::new(default_slot_value.expr)),
                })),
            }));
        }

        // children 已经全部改写进 props/slot bag，原 JSX children 清空，避免后续重复编译。
        comp_el.opening.attrs = new_attrs;
        comp_el.children = vec![];
        comp_el.opening.self_closing = true;
        comp_el.closing = None;
    }

    ComponentChildrenRewrite { stmts: child_stmts, direct_render_expr }
}

pub fn build_component_element(
    vt: &mut VaporTransform,
    jsx_el: &JSXElement,
    parent: &Ident,
    stmts: &mut Vec<Stmt>,
) {
    let mut comp_el = jsx_el.clone();
    let rewrite = rewrite_component_children_to_props(vt, &mut comp_el);
    let slot_init_expr =
        rewrite.direct_render_expr.clone().unwrap_or_else(|| build_component_mount_expr(&comp_el));

    let is_static = !crate::utils::is_transition_group_component(&comp_el)
        && (crate::utils::is_static_component_without_props(&comp_el)
            || crate::utils::is_static_component_children_ident(&comp_el)
            || crate::utils::component_has_no_dynamic_props_excluding_children(&comp_el));

    let anchor = vt.next_list_ident();
    let make_anchor = call_ident("_$createComment", vec![string_expr("rue:component:anchor")]);
    stmts.push(const_decl(anchor.clone(), make_anchor));
    stmts.push(append_child(parent.clone(), Expr::Ident(anchor.clone())));

    if !rewrite.stmts.is_empty() {
        for s in rewrite.stmts {
            stmts.push(s);
        }
    }

    let slot_ident = vt.next_slot_ident();
    let decl_slot = const_decl(slot_ident.clone(), slot_init_expr.clone());
    let render_call = Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(Expr::Ident(ident("renderAnchor")))),
        args: vec![
            ExprOrSpread { spread: None, expr: Box::new(Expr::Ident(slot_ident.clone())) },
            ExprOrSpread { spread: None, expr: Box::new(Expr::Ident(parent.clone())) },
            ExprOrSpread { spread: None, expr: Box::new(Expr::Ident(anchor.clone())) },
        ],
        type_args: None,
        ctxt: SyntaxContext::empty(),
    });

    if is_static {
        stmts.push(Stmt::Decl(Decl::Var(Box::new(VarDecl {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            decls: vec![VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(BindingIdent { id: slot_ident.clone(), type_ann: None }),
                init: Some(Box::new(slot_init_expr.clone())),
                definite: false,
            }],
            kind: VarDeclKind::Const,
            declare: false,
        }))));
        stmts.push(Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(render_call) }));
    } else {
        let untrack_render = Expr::Call(CallExpr {
            span: DUMMY_SP,
            callee: Callee::Expr(Box::new(Expr::Ident(ident("untrack")))),
            args: vec![ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Arrow(ArrowExpr {
                    span: DUMMY_SP,
                    params: vec![],
                    body: Box::new(BlockStmtOrExpr::Expr(Box::new(render_call))),
                    is_async: false,
                    is_generator: false,
                    type_params: None,
                    return_type: None,
                    ctxt: SyntaxContext::empty(),
                })),
            }],
            type_args: None,
            ctxt: SyntaxContext::empty(),
        });
        let render_arrow = Expr::Arrow(ArrowExpr {
            span: DUMMY_SP,
            params: vec![],
            body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
                span: DUMMY_SP,
                ctxt: SyntaxContext::empty(),
                stmts: vec![
                    decl_slot,
                    Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(untrack_render) }),
                ],
            })),
            is_async: false,
            is_generator: false,
            type_params: None,
            return_type: None,
            ctxt: SyntaxContext::empty(),
        });
        let watch = call_ident("watchEffect", vec![render_arrow]);
        stmts.push(Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(watch) }));
    }
}

#[cfg(test)]
#[path = "element_component_tests.rs"]
mod tests;
