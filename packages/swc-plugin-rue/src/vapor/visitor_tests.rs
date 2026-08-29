use super::*;
use std::collections::HashMap;
use std::sync::Arc;
use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_core::ecma::visit::VisitMutWith;
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn new_vt() -> VaporTransform {
    VaporTransform {
        next_el: 0,
        next_list: 0,
        next_map: 0,
        next_child: 0,
        once_depth: 0,
        did_transform: false,
        static_templates: true,
        el_tag_by_ident: HashMap::new(),
        renderable_local_scopes: Vec::new(),
        plain_local_scopes: Vec::new(),
    }
}

fn transform_module(src: &str) -> String {
    let cm = Arc::new(SourceMap::default());
    let fm =
        cm.new_source_file(FileName::Custom("visitor-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    let mut module = parser.parse_module().expect("parse module");
    module.visit_mut_with(&mut new_vt());

    let mut buf = Vec::new();
    let mut emitter = Emitter {
        cfg: Default::default(),
        comments: None,
        cm: cm.clone(),
        wr: JsWriter::new(cm, "\n", &mut buf, None),
    };
    emitter.emit_module(&module).expect("emit module");
    String::from_utf8(buf).expect("utf8")
}

fn compact(src: &str) -> String {
    src.chars().filter(|ch| !ch.is_whitespace()).collect()
}

#[test]
fn transforms_static_arrow_expr_body_with_shared_template_helper() {
    let out = compact(&transform_module("const View = () => <div className=\"a\" />;"));

    assert!(out.contains("import{_$template}from\"@rue-js/rue/compiled\""));
    assert!(out.contains("const_$getTemplate1=_$template('<divclass=\"a\"></div>')"));
    assert!(out.contains("constView=()=>(()=>{"));
    assert!(out.contains("__rue_vapor_setup:(__rue_parent_context)=>{"));
    assert!(out.contains("_$getTemplate1().content.cloneNode(true)"));
}

#[test]
fn transforms_arrow_fragment_expr_body_and_ignores_bare_returns() {
    let out = compact(&transform_module(
        "const Frag = () => <><i>A</i><b>B</b></>; function noop() { return; }",
    ));

    assert!(out.contains("from\"@rue-js/rue/vapor\""));
    assert!(out.contains("constFrag=()=>vapor((__rue_parent_context)=>{"));
    assert!(out.contains("_$createDocumentFragment()"));
    assert!(out.contains("const_$getTemplate1=_$template(\"<i>A</i>\")"));
    assert!(out.contains("const_$getTemplate2=_$template(\"<b>B</b>\")"));
    assert!(out.contains("_root.appendChild(_$getTemplate1().content.cloneNode(true))"));
    assert!(out.contains("_root.appendChild(_$getTemplate2().content.cloneNode(true))"));
    assert!(out.contains("functionnoop(){return;}"));
}

#[test]
fn transforms_block_returns_fragments_and_nested_arrow_returns() {
    let out = compact(&transform_module(
        "function View() { return <><span>A</span></>; } const outer = () => () => <em>B</em>;",
    ));

    assert!(out.contains("returnvapor((__rue_parent_context)=>{"));
    assert!(out.contains("_$createDocumentFragment()"));
    assert!(out.contains("const_$getTemplate1=_$template(\"<span>A</span>\")"));
    assert!(out.contains("_root.appendChild(_$getTemplate1().content.cloneNode(true))"));
    assert!(out.contains("const_$getTemplate2=_$template(\"<em>B</em>\")"));
    assert!(out.contains("()=>()=>(()=>{"), "{out}");
    assert!(out.contains("__rue_vapor_setup:(__rue_parent_context)=>{"));
}

#[test]
fn leaves_non_jsx_modules_without_runtime_imports() {
    let out = transform_module("const value = () => count + 1;");

    assert!(!out.contains("@rue-js/rue"));
    assert!(!out.contains("vapor("));
    assert!(out.contains("count + 1"));
}
