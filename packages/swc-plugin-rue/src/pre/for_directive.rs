use std::sync::Arc;

use swc_core::common::{DUMMY_SP, FileName, SourceMap, SyntaxContext};
use swc_core::ecma::ast::*;
use swc_core::ecma::parser::{Parser, StringInput, Syntax, TsSyntax};

use crate::emit;

/*
v-for/r-for 预处理：
- 输入形态：`<li v-for="(item, key, index) in source">...</li>`。
- 输出形态：把该子元素替换为 `{ normalized(source).map(([item, key, index]) => <li>...</li>) }`。
- source 归一化：数组、数字和对象统一转成 `[value, key, index]` 三元组，后续列表编译只处理 map。
- 设计取舍：这里只做浅层语法改写，不直接生成 DOM；真正的 keyed diff 与锚点插入交给 Vapor 列表模块。
*/
const FOR_DIRECTIVE_NAMES: &[&str] = &["v-for", "r-for"];

struct ForDirectiveSpec {
    aliases: Vec<Pat>,
    source: Expr,
}

fn get_directive_attr<'a>(el: &'a JSXElement, names: &[&str]) -> Option<&'a JSXAttr> {
    for a in &el.opening.attrs {
        if let JSXAttrOrSpread::JSXAttr(attr) = a
            && let JSXAttrName::Ident(n) = &attr.name
        {
            let name = n.sym.as_ref();
            if names.contains(&name) {
                return Some(attr);
            }
        }
    }
    None
}

fn remove_directives(el: &mut JSXElement) {
    el.opening.attrs.retain(|a| match a {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(n) => {
                let name = n.sym.as_ref();
                !(name == "v-for" || name == "r-for")
            }
            _ => true,
        },
        _ => true,
    });
}

fn parse_expr(src: &str) -> Option<Expr> {
    let cm = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(FileName::Custom("v-for-expr.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    let expr = parser.parse_expr().ok()?;
    Some(*expr)
}

fn find_top_level_separator(input: &str) -> Option<(usize, usize)> {
    let mut paren_depth = 0usize;
    let mut bracket_depth = 0usize;
    let mut brace_depth = 0usize;
    let mut quote: Option<char> = None;
    let mut escaped = false;

    for (idx, ch) in input.char_indices() {
        // 只在顶层寻找 ` in ` / ` of `，避免误切到回调、对象字面量或字符串内部。
        if let Some(active_quote) = quote {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == active_quote {
                quote = None;
            }
            continue;
        }

        match ch {
            '\'' | '"' | '`' => {
                quote = Some(ch);
                continue;
            }
            '(' => {
                paren_depth += 1;
                continue;
            }
            ')' => {
                paren_depth = paren_depth.saturating_sub(1);
                continue;
            }
            '[' => {
                bracket_depth += 1;
                continue;
            }
            ']' => {
                bracket_depth = bracket_depth.saturating_sub(1);
                continue;
            }
            '{' => {
                brace_depth += 1;
                continue;
            }
            '}' => {
                brace_depth = brace_depth.saturating_sub(1);
                continue;
            }
            _ => {}
        }

        if paren_depth == 0 && bracket_depth == 0 && brace_depth == 0 {
            let tail = &input[idx..];
            if tail.starts_with(" in ") || tail.starts_with(" of ") {
                return Some((idx + 1, 2));
            }
        }
    }

    None
}

fn parse_aliases(src: &str) -> Option<Vec<Pat>> {
    let trimmed = src.trim();
    if trimmed.is_empty() {
        return None;
    }
    let inner = if trimmed.starts_with('(') && trimmed.ends_with(')') && trimmed.len() >= 2 {
        trimmed[1..trimmed.len() - 1].trim()
    } else {
        trimmed
    };
    if inner.is_empty() {
        return None;
    }

    // 借助 SWC 自己解析箭头函数参数，直接复用对解构、默认值等 pattern 的支持。
    let arrow_src = format!("({}) => null", inner);
    let expr = parse_expr(&arrow_src)?;
    if let Expr::Arrow(arrow) = expr {
        if arrow.params.is_empty() || arrow.params.len() > 3 {
            return None;
        }
        return Some(arrow.params);
    }
    None
}

fn parse_directive_attr(attr: &JSXAttr) -> Option<ForDirectiveSpec> {
    // 指令值只接受字符串形态，便于写成接近模板语法的 `item in list`。
    // 若用户传入普通表达式对象，这里不猜测语义，直接放弃改写。
    let raw = match &attr.value {
        Some(JSXAttrValue::Str(s)) => s.value.as_str().unwrap_or("").to_owned(),
        Some(JSXAttrValue::JSXExprContainer(ec)) => match &ec.expr {
            JSXExpr::Expr(expr) => match expr.as_ref() {
                Expr::Lit(Lit::Str(s)) => s.value.as_str().unwrap_or("").to_owned(),
                _ => return None,
            },
            _ => return None,
        },
        _ => return None,
    };

    // 先切出左侧别名与右侧数据源，再分别交给 SWC 解析：
    // - 左侧：解析成 callback 参数 pattern，支持解构；
    // - 右侧：解析成普通表达式，允许调用链、三元等复杂 source。
    let (sep_idx, sep_len) = find_top_level_separator(&raw)?;
    let aliases = parse_aliases(raw[..sep_idx].trim())?;
    let source = parse_expr(raw[sep_idx + sep_len..].trim())?;
    Some(ForDirectiveSpec { aliases, source })
}

fn call_member_expr(obj: Expr, prop: &str, args: Vec<Expr>) -> Expr {
    Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: Box::new(obj),
            prop: MemberProp::Ident(emit::ident_name(prop)),
        }))),
        args: args
            .into_iter()
            .map(|expr| ExprOrSpread { spread: None, expr: Box::new(expr) })
            .collect(),
        type_args: None,
        ctxt: SyntaxContext::empty(),
    })
}

fn arrow_expr(params: Vec<Pat>, body_expr: Expr) -> Expr {
    Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params,
        body: Box::new(BlockStmtOrExpr::Expr(Box::new(body_expr))),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: SyntaxContext::empty(),
    })
}

fn array_expr(items: Vec<Expr>) -> Expr {
    Expr::Array(ArrayLit {
        span: DUMMY_SP,
        elems: items
            .into_iter()
            .map(|expr| Some(ExprOrSpread { spread: None, expr: Box::new(expr) }))
            .collect(),
    })
}

fn alias_array_pat(aliases: &[Pat]) -> Pat {
    Pat::Array(ArrayPat {
        span: DUMMY_SP,
        elems: aliases.iter().cloned().map(Some).collect(),
        optional: false,
        type_ann: None,
    })
}

fn build_safe_object_source_expr(source_ident: &Ident) -> Expr {
    Expr::Cond(CondExpr {
        span: DUMMY_SP,
        test: Box::new(Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::EqEq,
            left: Box::new(Expr::Ident(source_ident.clone())),
            right: Box::new(Expr::Lit(Lit::Null(Null { span: DUMMY_SP }))),
        })),
        cons: Box::new(Expr::Object(ObjectLit { span: DUMMY_SP, props: vec![] })),
        alt: Box::new(Expr::Ident(source_ident.clone())),
    })
}

fn build_array_normalized_expr(source_ident: &Ident) -> Expr {
    let value_ident = emit::ident("value");
    let index_ident = emit::ident("index");
    // 数组本身已有稳定索引：value/key/index 分别使用 item、index、index。
    let tuple = array_expr(vec![
        Expr::Ident(value_ident.clone()),
        Expr::Ident(index_ident.clone()),
        Expr::Ident(index_ident.clone()),
    ]);
    call_member_expr(
        Expr::Ident(source_ident.clone()),
        "map",
        vec![arrow_expr(
            vec![
                Pat::Ident(BindingIdent { id: value_ident, type_ann: None }),
                Pat::Ident(BindingIdent { id: index_ident, type_ann: None }),
            ],
            tuple,
        )],
    )
}

fn build_number_normalized_expr(source_ident: &Ident) -> Expr {
    let unused_ident = emit::ident("__rue_v_for_unused");
    let index_ident = emit::ident("index");
    // 数字循环遵循模板直觉：`n in 3` 产出 1、2、3；
    // key/index 仍使用从 0 开始的索引，方便后续列表复用。
    let tuple = array_expr(vec![
        Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::Add,
            left: Box::new(Expr::Ident(index_ident.clone())),
            right: Box::new(Expr::Lit(Lit::Num(Number { span: DUMMY_SP, value: 1.0, raw: None }))),
        }),
        Expr::Ident(index_ident.clone()),
        Expr::Ident(index_ident.clone()),
    ]);
    call_member_expr(
        Expr::Ident(emit::ident("Array")),
        "from",
        vec![
            Expr::Object(ObjectLit {
                span: DUMMY_SP,
                props: vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: PropName::Ident(emit::ident_name("length")),
                    value: Box::new(Expr::Ident(source_ident.clone())),
                })))],
            }),
            arrow_expr(
                vec![
                    Pat::Ident(BindingIdent { id: unused_ident, type_ann: None }),
                    Pat::Ident(BindingIdent { id: index_ident, type_ann: None }),
                ],
                tuple,
            ),
        ],
    )
}

fn build_object_normalized_expr(source_ident: &Ident) -> Expr {
    let key_ident = emit::ident("key");
    let value_ident = emit::ident("value");
    let index_ident = emit::ident("index");
    // 对象统一转成 Object.entries，并对 null/undefined 兜底为空对象；
    // 这样下游 map callback 始终收到 `[value, key, index]`。
    let entries_expr = call_member_expr(
        Expr::Ident(emit::ident("Object")),
        "entries",
        vec![build_safe_object_source_expr(source_ident)],
    );
    let entry_pat = Pat::Array(ArrayPat {
        span: DUMMY_SP,
        elems: vec![
            Some(Pat::Ident(BindingIdent { id: key_ident.clone(), type_ann: None })),
            Some(Pat::Ident(BindingIdent { id: value_ident.clone(), type_ann: None })),
        ],
        optional: false,
        type_ann: None,
    });
    let tuple = array_expr(vec![
        Expr::Ident(value_ident),
        Expr::Ident(key_ident),
        Expr::Ident(index_ident.clone()),
    ]);
    call_member_expr(
        entries_expr,
        "map",
        vec![arrow_expr(
            vec![entry_pat, Pat::Ident(BindingIdent { id: index_ident, type_ann: None })],
            tuple,
        )],
    )
}

fn build_normalized_iterable_expr(source: Expr) -> Expr {
    let source_ident = emit::ident("__rue_v_for_source");
    let array_check = call_member_expr(
        Expr::Ident(emit::ident("Array")),
        "isArray",
        vec![Expr::Ident(source_ident.clone())],
    );
    let number_check = Expr::Bin(BinExpr {
        span: DUMMY_SP,
        op: BinaryOp::EqEqEq,
        left: Box::new(Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::TypeOf,
            arg: Box::new(Expr::Ident(source_ident.clone())),
        })),
        right: Box::new(emit::string_expr("number")),
    });
    let normalized_body = Expr::Cond(CondExpr {
        span: DUMMY_SP,
        test: Box::new(array_check),
        cons: Box::new(build_array_normalized_expr(&source_ident)),
        alt: Box::new(Expr::Cond(CondExpr {
            span: DUMMY_SP,
            test: Box::new(number_check),
            cons: Box::new(build_number_normalized_expr(&source_ident)),
            alt: Box::new(build_object_normalized_expr(&source_ident)),
        })),
    });
    // 通过立即调用箭头函数保存 source，避免复杂表达式在多次分支判断中被重复求值。
    Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(Expr::Paren(ParenExpr {
            span: DUMMY_SP,
            expr: Box::new(arrow_expr(
                vec![Pat::Ident(BindingIdent { id: source_ident, type_ann: None })],
                normalized_body,
            )),
        }))),
        args: vec![ExprOrSpread { spread: None, expr: Box::new(source) }],
        type_args: None,
        ctxt: SyntaxContext::empty(),
    })
}

fn build_map_expr(el: JSXElement, spec: ForDirectiveSpec) -> Expr {
    let normalized_items = build_normalized_iterable_expr(spec.source);
    let callback = arrow_expr(vec![alias_array_pat(&spec.aliases)], Expr::JSXElement(Box::new(el)));
    call_member_expr(normalized_items, "map", vec![callback])
}

fn transform_directive_element(el: &JSXElement) -> Option<JSXElementChild> {
    let attr = get_directive_attr(el, FOR_DIRECTIVE_NAMES)?;
    let spec = parse_directive_attr(attr)?;
    let mut clean = el.clone();
    // map 回调里继续保留原 JSX 内容，但必须移除指令属性，避免后续阶段再次处理。
    remove_directives(&mut clean);
    let expr = build_map_expr(clean, spec);
    Some(JSXElementChild::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(expr)),
    }))
}

pub fn transform_element(el: &mut JSXElement) {
    let mut i = 0;
    while i < el.children.len() {
        // v-for 是“子节点级”结构指令：父元素保留，命中的子元素被替换为表达式容器。
        let next_child = match &el.children[i] {
            JSXElementChild::JSXElement(child) => transform_directive_element(child.as_ref()),
            _ => None,
        };
        if let Some(new_child) = next_child {
            el.children[i] = new_child;
        }
        i += 1;
    }
}

#[cfg(test)]
#[path = "for_directive_tests.rs"]
mod tests;
