use super::*;
use std::sync::Arc;
use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::ast::Expr;
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_element(src: &str) -> JSXElement {
    let cm = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(
        FileName::Custom("template-directive-test.tsx".into()).into(),
        src.to_string(),
    );
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );

    match *parser.parse_expr().expect("parse jsx element") {
        Expr::JSXElement(element) => *element,
        _ => panic!("expected jsx element"),
    }
}

fn element_name(name: &JSXElementName) -> &str {
    match name {
        JSXElementName::Ident(ident) => ident.sym.as_ref(),
        _ => panic!("expected ident name"),
    }
}

#[test]
fn rewrites_lowercase_template_with_supported_directive() {
    let mut element = parse_element("<template slot=\"header\"><div /></template>");

    transform_element(&mut element);

    assert_eq!(element_name(&element.opening.name), "Template");
    assert_eq!(element_name(&element.closing.as_ref().expect("closing").name), "Template");
    assert!(matches!(
        element.opening.attrs.first(),
        Some(JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::Ident(name),
            ..
        })) if name.sym.as_ref() == "slot"
    ));
}

#[test]
fn keeps_non_matching_template_names_unchanged() {
    let mut plain_template = parse_element("<template data-id=\"x\"><div /></template>");
    transform_element(&mut plain_template);
    assert_eq!(element_name(&plain_template.opening.name), "template");
    assert_eq!(element_name(&plain_template.closing.as_ref().expect("closing").name), "template");

    let mut component_template = parse_element("<Template v-if={ok}><div /></Template>");
    transform_element(&mut component_template);
    assert_eq!(element_name(&component_template.opening.name), "Template");
    assert_eq!(
        element_name(&component_template.closing.as_ref().expect("closing").name),
        "Template"
    );
}

#[test]
fn handles_self_closing_templates_and_non_ident_attrs() {
    let mut self_closing = parse_element("<template v-if={ok} />");
    transform_element(&mut self_closing);
    assert_eq!(element_name(&self_closing.opening.name), "Template");
    assert!(self_closing.closing.is_none());

    let mut unsupported_attrs = parse_element("<template ns:slot=\"header\" {...props} />");
    transform_element(&mut unsupported_attrs);
    assert_eq!(element_name(&unsupported_attrs.opening.name), "template");
    assert!(unsupported_attrs.closing.is_none());
}
