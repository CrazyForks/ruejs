use super::*;
use std::sync::Arc;
use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_jsx_element(src: &str) -> JSXElement {
    let cm = Arc::new(SourceMap::default());
    let fm =
        cm.new_source_file(FileName::Custom("router-link-test.tsx".into()).into(), src.to_string());
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
        body: vec![ModuleItem::Stmt(Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(expr) }))],
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

    assert!(matches!(&rewritten.opening.name, JSXElementName::Ident(id) if id.sym.as_ref() == "a"));
    assert_eq!(rewritten.children.len(), 1);
    assert!(rewritten.closing.is_some());
    assert!(!rewritten.opening.self_closing);

    let rendered = normalize(&emit_expr(Expr::JSXElement(Box::new(rewritten))));
    assert!(rendered.contains(&normalize("href={RouterLink.__rueHref(\"/docs\")}")));
    assert!(
        rendered.contains(&normalize("onClick={(e)=>RouterLink.__rueOnClick(e, \"/docs\", true)}"))
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
        rendered
            .contains(&normalize("onClick={(e)=>RouterLink.__rueOnClick(e, target.href, false)}"))
    );
    assert!(rendered.contains(&normalize("aria-label=\"docs\"")));
}

#[test]
fn preserves_namespaced_attrs_and_defaults_empty_directive_values() {
    let mut router_link = parse_jsx_element(r#"<RouterLink to={target} data:track="yes" />"#);
    for attr in &mut router_link.opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            continue;
        };
        if matches!(&attr.name, JSXAttrName::Ident(id) if id.sym.as_ref() == "to") {
            attr.value = Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::JSXEmptyExpr(JSXEmptyExpr { span: DUMMY_SP }),
            }));
        }
    }
    let rewritten = rewrite_router_link_fast_path(&router_link).expect("default rewrite");

    let rendered = normalize(&emit_expr(Expr::JSXElement(Box::new(rewritten))));
    assert!(rendered.contains(&normalize("href={RouterLink.__rueHref(\"\")}")));
    assert!(
        rendered.contains(&normalize("onClick={(e)=>RouterLink.__rueOnClick(e, \"\", false)}"))
    );
    assert!(rendered.contains(&normalize("data:track=\"yes\"")));
}

#[test]
fn defaults_unsupported_jsx_attr_values_in_router_link_fast_path() {
    let mut router_link = parse_jsx_element(r#"<RouterLink to="/docs" replace />"#);
    let span_value = parse_jsx_element("<span />");
    for attr in &mut router_link.opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            continue;
        };
        if matches!(&attr.name, JSXAttrName::Ident(id) if id.sym.as_ref() == "replace") {
            attr.value = Some(JSXAttrValue::JSXElement(Box::new(span_value.clone())));
        }
    }

    let rewritten = rewrite_router_link_fast_path(&router_link).expect("default replace rewrite");
    let rendered = normalize(&emit_expr(Expr::JSXElement(Box::new(rewritten))));
    assert!(
        rendered
            .contains(&normalize("onClick={(e)=>RouterLink.__rueOnClick(e, \"/docs\", false)}"))
    );
}

#[test]
fn hardens_router_link_attr_defaults_and_dynamic_replace_values() {
    let dynamic_replace = parse_jsx_element(
        r#"<RouterLink to={route.href} replace={route.replace} target="_blank" />"#,
    );
    let dynamic_rewritten =
        rewrite_router_link_fast_path(&dynamic_replace).expect("dynamic replace rewrite");
    let dynamic_rendered = normalize(&emit_expr(Expr::JSXElement(Box::new(dynamic_rewritten))));

    assert!(dynamic_rendered.contains(&normalize("href={RouterLink.__rueHref(route.href)}")));
    assert!(dynamic_rendered.contains(&normalize(
        "onClick={(e)=>RouterLink.__rueOnClick(e, route.href, route.replace)}"
    )));
    assert!(dynamic_rendered.contains(r#"target="_blank""#));

    let mut unsupported_to = parse_jsx_element(r#"<RouterLink to="/docs" replace={true} />"#);
    let span_value = parse_jsx_element("<span />");
    for attr in &mut unsupported_to.opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            continue;
        };
        if matches!(&attr.name, JSXAttrName::Ident(id) if id.sym.as_ref() == "to") {
            attr.value = Some(JSXAttrValue::JSXElement(Box::new(span_value.clone())));
        }
    }

    let unsupported_rewritten =
        rewrite_router_link_fast_path(&unsupported_to).expect("unsupported to default rewrite");
    let unsupported_rendered =
        normalize(&emit_expr(Expr::JSXElement(Box::new(unsupported_rewritten))));

    assert!(unsupported_rendered.contains(&normalize("href={RouterLink.__rueHref(\"\")}")));
    assert!(
        unsupported_rendered
            .contains(&normalize("onClick={(e)=>RouterLink.__rueOnClick(e, \"\", true)}"))
    );
}

#[test]
fn rejects_member_router_link_names_and_preserves_plain_component_path() {
    let member_link = parse_jsx_element("<Router.Link to=\"/docs\" />");
    assert!(rewrite_router_link_fast_path(&member_link).is_none());

    let lowercase = parse_jsx_element("<router-link to=\"/docs\" />");
    assert!(rewrite_router_link_fast_path(&lowercase).is_none());
}
