use std::collections::HashSet;

use swc_core::common::{DUMMY_SP, SyntaxContext};
use swc_core::ecma::ast::*;

use crate::emit::{call_ident, const_decl, ident, ident_name, string_expr};
use crate::utils::unwrap_expr;

use super::super::VaporTransform;

fn member_expr(object: Expr, property: &str) -> Expr {
    Expr::Member(MemberExpr {
        span: DUMMY_SP,
        obj: Box::new(object),
        prop: MemberProp::Ident(ident_name(property)),
    })
}

fn call_expr(callee: Expr, args: Vec<Expr>) -> Expr {
    Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(callee)),
        args: args
            .into_iter()
            .map(|expr| ExprOrSpread { spread: None, expr: Box::new(expr) })
            .collect(),
        type_args: None,
        ctxt: SyntaxContext::empty(),
    })
}

fn call_member(object: Expr, property: &str, args: Vec<Expr>) -> Expr {
    call_expr(member_expr(object, property), args)
}

fn let_decl(name: Ident) -> Stmt {
    Stmt::Decl(Decl::Var(Box::new(VarDecl {
        span: DUMMY_SP,
        ctxt: SyntaxContext::empty(),
        kind: VarDeclKind::Let,
        declare: false,
        decls: vec![VarDeclarator {
            span: DUMMY_SP,
            name: Pat::Ident(BindingIdent { id: name, type_ann: None }),
            init: None,
            definite: false,
        }],
    })))
}

fn assign_ident_stmt(name: Ident, value: Expr) -> Stmt {
    Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(Expr::Assign(AssignExpr {
            span: DUMMY_SP,
            op: AssignOp::Assign,
            left: AssignTarget::Simple(SimpleAssignTarget::Ident(BindingIdent {
                id: name,
                type_ann: None,
            })),
            right: Box::new(value),
        })),
    })
}

fn assign_member_stmt(object: Ident, property: &str, value: Expr) -> Stmt {
    Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(Expr::Assign(AssignExpr {
            span: DUMMY_SP,
            op: AssignOp::Assign,
            left: AssignTarget::Simple(SimpleAssignTarget::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(Expr::Ident(object)),
                prop: MemberProp::Ident(ident_name(property)),
            })),
            right: Box::new(value),
        })),
    })
}

fn is_scalar_accessor_call(call: &CallExpr, shadowed_names: &HashSet<String>) -> bool {
    if call.args.is_empty()
        && let Callee::Expr(callee) = &call.callee
        && let Expr::Member(member) = unwrap_expr(callee.as_ref())
        && let MemberProp::Ident(property) = &member.prop
        && property.sym.as_ref() == "get"
    {
        return matches!(unwrap_expr(member.obj.as_ref()), Expr::Ident(_) | Expr::Member(_));
    }

    let Callee::Expr(callee) = &call.callee else {
        return false;
    };
    let Expr::Ident(callee) = unwrap_expr(callee.as_ref()) else {
        return false;
    };
    matches!(callee.sym.as_ref(), "String" | "Number" | "Boolean")
        && !shadowed_names.contains(callee.sym.as_ref())
        && call.args.len() == 1
        && call.args[0].spread.is_none()
        && is_compiled_scalar_expr_with_shadows(call.args[0].expr.as_ref(), shadowed_names)
}

/// Syntactic proof used by the compiled DOM tier. Calls that can return Nodes,
/// collections, promises, or arbitrary user values stay on the Vapor path.
pub(crate) fn is_compiled_scalar_expr_with_shadows(
    expr: &Expr,
    shadowed_names: &HashSet<String>,
) -> bool {
    match unwrap_expr(expr) {
        Expr::Lit(Lit::Str(_) | Lit::Bool(_) | Lit::Null(_) | Lit::Num(_) | Lit::BigInt(_)) => true,
        Expr::Ident(ident) => ident.sym.as_ref() == "undefined",
        // `.value` belongs to the Vapor ref facade and therefore cannot share the
        // lightweight compiled owner. Compiled signals use the explicit `.get()` contract.
        Expr::Member(_) => false,
        Expr::Call(call) => is_scalar_accessor_call(call, shadowed_names),
        Expr::Unary(unary) => {
            !matches!(unary.op, UnaryOp::Delete)
                && is_compiled_scalar_expr_with_shadows(unary.arg.as_ref(), shadowed_names)
        }
        Expr::Bin(binary) => {
            is_compiled_scalar_expr_with_shadows(binary.left.as_ref(), shadowed_names)
                && is_compiled_scalar_expr_with_shadows(binary.right.as_ref(), shadowed_names)
        }
        Expr::Cond(cond) => {
            is_compiled_scalar_expr_with_shadows(cond.test.as_ref(), shadowed_names)
                && is_compiled_scalar_expr_with_shadows(cond.cons.as_ref(), shadowed_names)
                && is_compiled_scalar_expr_with_shadows(cond.alt.as_ref(), shadowed_names)
        }
        Expr::Tpl(template) => template
            .exprs
            .iter()
            .all(|expr| is_compiled_scalar_expr_with_shadows(expr.as_ref(), shadowed_names)),
        Expr::Seq(sequence) => sequence
            .exprs
            .iter()
            .all(|expr| is_compiled_scalar_expr_with_shadows(expr.as_ref(), shadowed_names)),
        _ => false,
    }
}

#[cfg(test)]
pub(crate) fn is_compiled_scalar_expr(expr: &Expr) -> bool {
    is_compiled_scalar_expr_with_shadows(expr, &HashSet::new())
}

fn normalized_text_expr(value: Expr) -> Expr {
    let nullish = Expr::Bin(BinExpr {
        span: DUMMY_SP,
        op: BinaryOp::EqEq,
        left: Box::new(value.clone()),
        right: Box::new(Expr::Lit(Lit::Null(Null { span: DUMMY_SP }))),
    });
    let boolean = Expr::Bin(BinExpr {
        span: DUMMY_SP,
        op: BinaryOp::EqEqEq,
        left: Box::new(Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::TypeOf,
            arg: Box::new(value.clone()),
        })),
        right: Box::new(string_expr("boolean")),
    });
    Expr::Cond(CondExpr {
        span: DUMMY_SP,
        test: Box::new(Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::LogicalOr,
            left: Box::new(nullish),
            right: Box::new(boolean),
        })),
        cons: Box::new(string_expr("")),
        alt: Box::new(call_ident("String", vec![value])),
    })
}

/// Emit a text node whose data is updated by an owner-captured compiled effect.
/// Returns `None` without mutating `stmts` when the expression is not proven scalar.
pub(crate) fn emit_compiled_text_binding(
    vt: &mut VaporTransform,
    parent: &Ident,
    container: &JSXExprContainer,
    stmts: &mut Vec<Stmt>,
) -> Option<Ident> {
    let JSXExpr::Expr(expr) = &container.expr else {
        return None;
    };
    let inner = unwrap_expr(expr.as_ref());
    if !is_compiled_scalar_expr_with_shadows(inner, &vt.current_scalar_constructor_shadows()) {
        return None;
    }

    let node = vt.next_el_ident();
    let binding = vt.next_child_ident();
    let raw = ident(&format!("{}_raw", binding.sym));
    let next = ident(&format!("{}_next", binding.sym));
    let create_text = call_ident("_$compiledCreateTextNode", vec![string_expr("")]);
    stmts.push(const_decl(node.clone(), create_text));
    stmts.push(Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(call_ident(
            "_$compiledAppendChild",
            vec![Expr::Ident(parent.clone()), Expr::Ident(node.clone())],
        )),
    }));
    stmts.push(let_decl(binding.clone()));

    let changed = Expr::Unary(UnaryExpr {
        span: DUMMY_SP,
        op: UnaryOp::Bang,
        arg: Box::new(call_member(
            Expr::Ident(ident("Object")),
            "is",
            vec![Expr::Ident(binding.clone()), Expr::Ident(next.clone())],
        )),
    });
    let effect_body = vec![
        const_decl(raw.clone(), inner.clone()),
        const_decl(next.clone(), normalized_text_expr(Expr::Ident(raw))),
        Stmt::If(IfStmt {
            span: DUMMY_SP,
            test: Box::new(changed),
            cons: Box::new(Stmt::Block(BlockStmt {
                span: DUMMY_SP,
                ctxt: SyntaxContext::empty(),
                stmts: vec![
                    assign_ident_stmt(binding, Expr::Ident(next.clone())),
                    assign_member_stmt(node.clone(), "textContent", Expr::Ident(next)),
                ],
            })),
            alt: None,
        }),
    ];
    let arrow = Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![],
        body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts: effect_body,
        })),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: SyntaxContext::empty(),
    });
    stmts.push(Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(call_ident("effect", vec![arrow])),
    }));
    Some(node)
}

/// JSX 表达式容器改写（细节详解）：
/// - emit_markers：生成单锚点注释并插入到根；children 插槽锚点采用独立标识，便于调试与区分。
/// - build_slot_expr：仅对需要保留 compat 结构的 slot 表达式做局部改写，最终仍把原始值交给 runtime 新协议入口。
/// - watchEffect：在箭头函数中调用 renderAnchor，保证动态更新合并到微任务批处理。
/// - 静态组件优化：检测纯静态组件场景，直接一次性渲染（renderAnchor），无需 watch 包裹。
pub(crate) fn handle_expr_container(
    vt: &mut VaporTransform,
    root: &Ident,
    ec: &JSXExprContainer,
    stmts: &mut Vec<Stmt>,
) {
    match &ec.expr {
        JSXExpr::JSXEmptyExpr(_) => {}
        JSXExpr::Expr(expr) => {
            let inner = unwrap_expr(expr.as_ref());
            // 优先识别 Array.map(JSX) 并走键控复用列表路径
            if let Expr::Call(call) = inner.clone()
                && crate::element_list::try_build_list_from_map(vt, root, &call, stmts)
            {
                return;
            }
            let is_children = crate::utils::is_children_member_expr(inner);

            let maybe_static = match inner {
                Expr::JSXElement(el) => {
                    !crate::utils::is_transition_group_component(el)
                        && (crate::utils::is_static_component_without_props(el)
                            || crate::utils::is_static_component_children_ident(el)
                            || crate::utils::component_has_no_dynamic_props_excluding_children(el))
                }
                _ => false,
            };

            // 生成单锚点注释并附加到 root
            let anchor = super::utils::emit_markers(vt, root, is_children, stmts);
            let expr_for_slot =
                if is_children { inner.clone() } else { super::expr::build_slot_expr(vt, inner) };
            let render_once = super::expr::is_empty_deps_memoized_jsx_expr(inner)
                || super::expr::is_empty_deps_memoized_jsx_expr(&expr_for_slot);

            if maybe_static || render_once {
                // 静态插槽：直接 renderAnchor，无需 watchEffect 包裹
                let slot_ident = vt.next_slot_ident();
                let decl_slot = const_decl(slot_ident.clone(), expr_for_slot.clone());
                let render_call = Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    callee: Callee::Expr(Box::new(Expr::Ident(ident("renderAnchor")))),
                    args: vec![
                        ExprOrSpread {
                            spread: None,
                            expr: Box::new(Expr::Ident(slot_ident.clone())),
                        },
                        ExprOrSpread { spread: None, expr: Box::new(Expr::Ident(root.clone())) },
                        ExprOrSpread { spread: None, expr: Box::new(Expr::Ident(anchor.clone())) },
                    ],
                    type_args: None,
                    ctxt: SyntaxContext::empty(),
                });
                stmts.push(decl_slot);
                stmts.push(Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(render_call) }));
            } else {
                // 动态插槽：包裹在 watchEffect 中，按注释锚点进行批处理渲染与更新
                let arrow = super::utils::watch_render_slot(expr_for_slot, root.clone(), anchor);
                let watch_expr = call_ident("watchEffect", vec![arrow]);
                stmts.push(Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(watch_expr) }));
            }
        }
    }
}

#[cfg(test)]
#[path = "expr_container_tests.rs"]
mod tests;
