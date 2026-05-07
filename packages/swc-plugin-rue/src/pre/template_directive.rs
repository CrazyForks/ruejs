use swc_core::ecma::ast::*;

const TEMPLATE_DIRECTIVE_NAMES: &[&str] =
    &["slot", "v-if", "r-if", "v-else-if", "r-else-if", "v-else", "r-else", "v-for", "r-for"];

fn is_lowercase_template_element(el: &JSXElement) -> bool {
    matches!(&el.opening.name, JSXElementName::Ident(id) if id.sym.as_ref() == "template")
}

fn has_template_directive(attrs: &[JSXAttrOrSpread]) -> bool {
    attrs.iter().any(|attr| {
        matches!(attr, JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::Ident(name),
            ..
        }) if TEMPLATE_DIRECTIVE_NAMES.contains(&name.sym.as_ref()))
    })
}

fn rewrite_to_template_component(name: &mut JSXElementName) {
    *name = JSXElementName::Ident(crate::emit::ident("Template"));
}

pub fn transform_element(el: &mut JSXElement) {
    if !is_lowercase_template_element(el) || !has_template_directive(&el.opening.attrs) {
        return;
    }

    rewrite_to_template_component(&mut el.opening.name);
    if let Some(closing) = &mut el.closing {
        rewrite_to_template_component(&mut closing.name);
    }
}
