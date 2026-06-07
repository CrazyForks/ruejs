use swc_core::ecma::ast::*;

/*
template 指令预处理：
- 小写 `<template>` 本身不是运行时组件，也不会生成真实 DOM。
- 当它携带 `v-if/v-for/slot` 等结构性指令时，将标签名改成内建 `Template` 组件。
- 这样后续 Vapor 编译可以复用组件、slot、条件和列表的既有 lowering 逻辑，
  不需要为小写 template 单独维护一套渲染分支。
*/
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

    // 同步改写 opening/closing，保证后续 AST 打印仍是合法配对标签。
    rewrite_to_template_component(&mut el.opening.name);
    if let Some(closing) = &mut el.closing {
        rewrite_to_template_component(&mut closing.name);
    }
}

#[cfg(test)]
#[path = "template_directive_tests.rs"]
mod tests;
