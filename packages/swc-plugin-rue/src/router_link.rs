use swc_core::common::{DUMMY_SP, SyntaxContext};
use swc_core::ecma::ast::*;

use crate::emit::{ident, ident_name, string_expr};

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

pub fn rewrite_router_link_fast_path(jsx_el: &JSXElement) -> Option<JSXElement> {
    let JSXElementName::Ident(name) = &jsx_el.opening.name else {
        return None;
    };
    if name.sym.as_ref() != "RouterLink" {
        return None;
    }

    let mut to_expr = string_expr("");
    let mut replace_expr = Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: false }));
    let mut new_attrs: Vec<JSXAttrOrSpread> = Vec::new();

    for attr in &jsx_el.opening.attrs {
        match attr {
            JSXAttrOrSpread::SpreadElement(_) => {
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
                    "onClick" | "children" => {
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
    new_attrs.insert(1, jsx_expr_attr("onClick", router_link_click_expr(to_expr, replace_expr)));

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
mod tests {
    use super::*;
    use std::sync::Arc;
    use swc_core::common::{FileName, SourceMap};
    use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
    use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

    fn parse_jsx_element(src: &str) -> JSXElement {
        let cm = Arc::new(SourceMap::default());
        let fm = cm.new_source_file(
            FileName::Custom("router-link-test.tsx".into()).into(),
            src.to_string(),
        );
        let mut parser = Parser::new(
            Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
            StringInput::from(&*fm),
            None,
        );
        match *parser.parse_expr().expect("parse jsx element") {
            Expr::JSXElement(el) => *el,
            other => panic!("expected JSXElement, got {other:?}"),
        }
    }

    fn emit_expr(expr: Expr) -> String {
        let cm = Arc::new(SourceMap::default());
        let module = Module {
            span: DUMMY_SP,
            body: vec![ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(expr),
            }))],
            shebang: None,
        };
        let mut buf = Vec::new();
        let mut emitter = Emitter {
            cfg: Default::default(),
            comments: None,
            cm: cm.clone(),
            wr: JsWriter::new(cm, "\n", &mut buf, None),
        };
        emitter.emit_program(&Program::Module(module)).expect("emit expr");
        String::from_utf8(buf).expect("utf8")
    }

    fn normalize(src: &str) -> String {
        let mut out = String::new();
        let mut prev_space = false;
        for ch in src.chars() {
            if ch.is_whitespace() {
                if !prev_space {
                    out.push(' ');
                    prev_space = true;
                }
            } else {
                out.push(ch);
                prev_space = false;
            }
        }
        out.trim().to_string()
    }

    #[test]
    fn rejects_non_router_link_spread_onclick_and_children_attrs() {
        let div_el = parse_jsx_element("<div to=\"/docs\" />");
        assert!(rewrite_router_link_fast_path(&div_el).is_none());

        let spread_el = parse_jsx_element("<RouterLink {...props} to=\"/docs\" />");
        assert!(rewrite_router_link_fast_path(&spread_el).is_none());

        let onclick_el = parse_jsx_element("<RouterLink to=\"/docs\" onClick={handleClick} />");
        assert!(rewrite_router_link_fast_path(&onclick_el).is_none());

        let children_attr_el = parse_jsx_element("<RouterLink to=\"/docs\" children={slot} />");
        assert!(rewrite_router_link_fast_path(&children_attr_el).is_none());
    }

    #[test]
    fn rewrites_router_link_with_static_attrs_and_children_to_anchor() {
        let router_link = parse_jsx_element(
            "<RouterLink to=\"/docs\" replace className=\"active\">Docs</RouterLink>",
        );
        let rewritten = rewrite_router_link_fast_path(&router_link).expect("router link rewrite");

        assert!(
            matches!(&rewritten.opening.name, JSXElementName::Ident(id) if id.sym.as_ref() == "a")
        );
        assert_eq!(rewritten.children.len(), 1);
        assert!(rewritten.closing.is_some());
        assert!(!rewritten.opening.self_closing);

        let rendered = normalize(&emit_expr(Expr::JSXElement(Box::new(rewritten))));
        assert!(rendered.contains(&normalize("href={RouterLink.__rueHref(\"/docs\")}")));
        assert!(
            rendered
                .contains(&normalize("onClick={(e)=>RouterLink.__rueOnClick(e, \"/docs\", true)}"))
        );
        assert!(rendered.contains(&normalize("className=\"active\"")));
        assert!(rendered.contains(">Docs</a>"));
    }

    #[test]
    fn rewrites_dynamic_to_and_defaults_replace_for_self_closing_links() {
        let router_link = parse_jsx_element("<RouterLink to={target.href} aria-label=\"docs\" />");
        let rewritten = rewrite_router_link_fast_path(&router_link).expect("dynamic rewrite");

        assert!(rewritten.children.is_empty());
        assert!(rewritten.closing.is_none());
        assert!(rewritten.opening.self_closing);

        let rendered = normalize(&emit_expr(Expr::JSXElement(Box::new(rewritten))));
        assert!(rendered.contains(&normalize("href={RouterLink.__rueHref(target.href)}")));
        assert!(
            rendered.contains(&normalize(
                "onClick={(e)=>RouterLink.__rueOnClick(e, target.href, false)}"
            ))
        );
        assert!(rendered.contains(&normalize("aria-label=\"docs\"")));
    }
}
