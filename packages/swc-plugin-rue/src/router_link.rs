use swc_core::common::{DUMMY_SP, SyntaxContext};
use swc_core::ecma::ast::*;

use crate::emit::{ident, ident_name, string_expr};

/*
RouterLink 快路径：
- 目标：在编译期将简单 `<RouterLink>` 降级为原生 `<a>`，减少一次组件创建与 props 分发。
- 支持范围：无 spread、无自定义导航/预取事件、无 children prop 的常见链接形态。
- 保守回退：一旦遇到可能改变语义的属性，返回 None，让普通组件路径处理。
- 生成结果：注入 `href={RouterLink.__rueHref(to)}` 与
  `onClick={(e) => RouterLink.__rueOnClick(e, to, replace)}`，并为默认 hover/tap
  预取生成事件转发；viewport/load 需要生命周期，因此保守回退组件路径。
*/
fn jsx_attr_name(attr: &JSXAttr) -> Option<&str> {
    match &attr.name {
        JSXAttrName::Ident(idn) => Some(idn.sym.as_ref()),
        _ => None,
    }
}

fn jsx_attr_value_expr(value: Option<&JSXAttrValue>, default: Expr) -> Expr {
    match value {
        Some(JSXAttrValue::Str(s)) => Expr::Lit(Lit::Str(s.clone())),
        Some(JSXAttrValue::JSXExprContainer(ec)) => match &ec.expr {
            JSXExpr::Expr(expr) => *expr.clone(),
            _ => default,
        },
        None => Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: true })),
        _ => default,
    }
}

fn router_link_member(prop: &str) -> Expr {
    Expr::Member(MemberExpr {
        span: DUMMY_SP,
        obj: Box::new(Expr::Ident(ident("RouterLink"))),
        prop: MemberProp::Ident(ident_name(prop)),
    })
}

fn jsx_expr_attr(name: &str, expr: Expr) -> JSXAttrOrSpread {
    JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(ident_name(name)),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
            span: DUMMY_SP,
            expr: JSXExpr::Expr(Box::new(expr)),
        })),
    })
}

fn router_link_click_expr(to_expr: Expr, replace_expr: Expr) -> Expr {
    let event_ident = ident("e");
    let call = Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(router_link_member("__rueOnClick"))),
        args: vec![
            ExprOrSpread { spread: None, expr: Box::new(Expr::Ident(event_ident.clone())) },
            ExprOrSpread { spread: None, expr: Box::new(to_expr) },
            ExprOrSpread { spread: None, expr: Box::new(replace_expr) },
        ],
        type_args: None,
        ctxt: SyntaxContext::empty(),
    });
    Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![Pat::Ident(BindingIdent { id: event_ident, type_ann: None })],
        body: Box::new(BlockStmtOrExpr::Expr(Box::new(call))),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: SyntaxContext::empty(),
    })
}

fn router_link_prefetch_expr(to_expr: Expr, strategy: &str) -> Expr {
    let event_ident = ident("e");
    let call = Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(router_link_member("__rueOnPrefetch"))),
        args: vec![
            ExprOrSpread { spread: None, expr: Box::new(Expr::Ident(event_ident.clone())) },
            ExprOrSpread { spread: None, expr: Box::new(to_expr) },
            ExprOrSpread { spread: None, expr: Box::new(string_expr(strategy)) },
        ],
        type_args: None,
        ctxt: SyntaxContext::empty(),
    });
    Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![Pat::Ident(BindingIdent { id: event_ident, type_ann: None })],
        body: Box::new(BlockStmtOrExpr::Expr(Box::new(call))),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: SyntaxContext::empty(),
    })
}

enum FastPrefetchStrategy {
    Disabled,
    Event(&'static str),
}

fn parse_fast_prefetch_strategy(value: Option<&JSXAttrValue>) -> Option<FastPrefetchStrategy> {
    let value = value?;
    let literal = match value {
        JSXAttrValue::Str(value) => value.value.to_string_lossy().into_owned(),
        JSXAttrValue::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => match expr.as_ref() {
                Expr::Lit(Lit::Bool(value)) if !value.value => {
                    return Some(FastPrefetchStrategy::Disabled);
                }
                Expr::Lit(Lit::Str(value)) => value.value.to_string_lossy().into_owned(),
                _ => return None,
            },
            _ => return None,
        },
        _ => return None,
    };

    match literal.as_str() {
        "hover" => Some(FastPrefetchStrategy::Event("hover")),
        "tap" => Some(FastPrefetchStrategy::Event("tap")),
        // viewport/load 依赖 ref、观察器和卸载清理，必须走 RouterLink 组件路径。
        "viewport" | "load" => None,
        _ => None,
    }
}

pub fn rewrite_router_link_fast_path(jsx_el: &JSXElement) -> Option<JSXElement> {
    let JSXElementName::Ident(name) = &jsx_el.opening.name else {
        return None;
    };
    if name.sym.as_ref() != "RouterLink" {
        return None;
    }

    let mut to_expr = string_expr("");
    let mut replace_expr = Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: false }));
    let mut prefetch_strategy = FastPrefetchStrategy::Event("hover");
    let mut new_attrs: Vec<JSXAttrOrSpread> = Vec::new();

    for attr in &jsx_el.opening.attrs {
        match attr {
            JSXAttrOrSpread::SpreadElement(_) => {
                // spread 可能覆盖 to/replace/onClick，编译期无法可靠排序合并，直接走组件路径。
                return None;
            }
            JSXAttrOrSpread::JSXAttr(attr) => {
                let Some(name) = jsx_attr_name(attr) else {
                    new_attrs.push(JSXAttrOrSpread::JSXAttr(attr.clone()));
                    continue;
                };
                match name {
                    "to" => {
                        to_expr = jsx_attr_value_expr(attr.value.as_ref(), string_expr(""));
                    }
                    "replace" => {
                        replace_expr = jsx_attr_value_expr(
                            attr.value.as_ref(),
                            Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: false })),
                        );
                    }
                    "prefetch" => {
                        prefetch_strategy = parse_fast_prefetch_strategy(attr.value.as_ref())?;
                    }
                    "onClick" | "onPointerEnter" | "onFocus" | "onPointerDown" | "onTouchStart"
                    | "ref" | "children" => {
                        // 用户显式接管点击或 children prop 时，快路径可能改变语义，保持保守。
                        return None;
                    }
                    _ => {
                        new_attrs.push(JSXAttrOrSpread::JSXAttr(attr.clone()));
                    }
                }
            }
        }
    }

    let href_expr = Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(router_link_member("__rueHref"))),
        args: vec![ExprOrSpread { spread: None, expr: Box::new(to_expr.clone()) }],
        type_args: None,
        ctxt: SyntaxContext::empty(),
    });
    new_attrs.insert(0, jsx_expr_attr("href", href_expr));
    new_attrs
        .insert(1, jsx_expr_attr("onClick", router_link_click_expr(to_expr.clone(), replace_expr)));
    if let FastPrefetchStrategy::Event(strategy) = prefetch_strategy {
        for (offset, event_name) in
            ["onPointerEnter", "onFocus", "onPointerDown", "onTouchStart"].iter().enumerate()
        {
            new_attrs.insert(
                2 + offset,
                jsx_expr_attr(event_name, router_link_prefetch_expr(to_expr.clone(), strategy)),
            );
        }
    }

    Some(JSXElement {
        span: jsx_el.span,
        opening: JSXOpeningElement {
            name: JSXElementName::Ident(ident("a")),
            span: jsx_el.opening.span,
            attrs: new_attrs,
            self_closing: jsx_el.children.is_empty(),
            type_args: None,
        },
        children: jsx_el.children.clone(),
        closing: if jsx_el.children.is_empty() {
            None
        } else {
            Some(JSXClosingElement {
                span: jsx_el.closing.as_ref().map(|c| c.span).unwrap_or(DUMMY_SP),
                name: JSXElementName::Ident(ident("a")),
            })
        },
    })
}

#[cfg(test)]
#[path = "router_link_tests.rs"]
mod tests;
