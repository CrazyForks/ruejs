use super::*;
use std::collections::HashMap;
use std::sync::Arc;
use swc_core::common::{DUMMY_SP, FileName, SourceMap};
use swc_core::ecma::ast::{Module, ModuleItem, Program};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn new_vt() -> VaporTransform {
    VaporTransform {
        next_el: 0,
        next_list: 0,
        next_map: 0,
        next_child: 0,
        once_depth: 0,
        did_transform: false,
        el_tag_by_ident: HashMap::new(),
        renderable_local_scopes: Vec::new(),
    }
}

fn parse_expr(src: &str, tsx: bool) -> Expr {
    let cm = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(
        FileName::Custom("element-component-test.tsx".into()).into(),
        src.to_string(),
    );
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    *parser.parse_expr().expect("parse expr")
}

fn parse_jsx_element(src: &str) -> JSXElement {
    match parse_expr(src, true) {
        Expr::JSXElement(el) => *el,
        other => panic!("expected JSXElement, got {other:?}"),
    }
}

fn emit_stmts(stmts: Vec<Stmt>) -> String {
    let cm = Arc::new(SourceMap::default());
    let module = Module {
        span: DUMMY_SP,
        body: stmts.into_iter().map(ModuleItem::Stmt).collect(),
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

fn emit_expr(expr: Expr) -> String {
    emit_stmts(vec![Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(expr) })])
}

fn compact(src: &str) -> String {
    src.chars().filter(|ch| !ch.is_whitespace()).collect()
}

#[test]
fn lowers_single_static_text_child_to_string_expr() {
    let mut vt = new_vt();
    let el = parse_jsx_element("<Box>hello</Box>");

    let lowered = lower_slot_value(&mut vt, &el.children).expect("lowered slot value");

    assert!(lowered.stmts.is_empty());
    assert!(!lowered.is_function);
    assert_eq!(compact(&emit_expr(lowered.expr)), "\"hello\";");
}

#[test]
fn lowers_single_expr_children_for_plain_jsx_call_and_empty_cases() {
    let mut plain_vt = new_vt();
    let plain = parse_jsx_element("<Box>{value}</Box>");
    let plain_lowered = lower_slot_value(&mut plain_vt, &plain.children).expect("plain lowered");

    assert!(plain_lowered.stmts.is_empty());
    assert!(!plain_lowered.is_function);
    assert_eq!(compact(&emit_expr(plain_lowered.expr)), "value;");

    let mut call_vt = new_vt();
    let call = parse_jsx_element("<Box>{useMemo(() => <span />, [])}</Box>");
    let call_lowered = lower_slot_value(&mut call_vt, &call.children).expect("call lowered");
    let call_out = compact(&emit_expr(call_lowered.expr));

    assert!(call_lowered.stmts.is_empty());
    assert!(!call_lowered.is_function);
    assert!(call_out.contains("useMemo(()=>vapor(()=>{"));
    assert!(call_out.contains("_$createElement(\"span\",_root)"));

    let mut empty_vt = new_vt();
    let empty = parse_jsx_element("<Box>{null}</Box>");
    assert!(lower_slot_value(&mut empty_vt, &empty.children).is_none());
}

#[test]
fn rewrites_slot_carrier_wrapper_and_fragment_children_stably() {
    let mut slot_vt = new_vt();
    let mut slot_host =
        parse_jsx_element("<Box><Template slot=\"header\"><span>head</span></Template></Box>");
    let slot_rewrite = rewrite_component_children_to_props(&mut slot_vt, &mut slot_host);
    let slot_stmts = compact(&emit_stmts(slot_rewrite.stmts.clone()));
    let slot_mount = compact(&emit_expr(build_component_mount_expr(&slot_host)));

    assert!(slot_host.children.is_empty());
    assert!(slot_host.opening.self_closing);
    assert!(slot_rewrite.direct_render_expr.is_none());
    assert!(slot_stmts.contains("const__child1=vapor(()=>{"));
    assert!(slot_stmts.contains("_$createElement(\"span\",_root)"));
    assert!(!slot_stmts.contains("Template"));
    assert!(slot_mount.contains("__rue_slots:{\"header\":__child1}"));
    assert!(!slot_mount.contains("Template"));

    let mut fragment_vt = new_vt();
    let mut fragment_host = parse_jsx_element("<Fragment><span>body</span></Fragment>");
    let fragment_rewrite =
        rewrite_component_children_to_props(&mut fragment_vt, &mut fragment_host);
    let fragment_stmts = compact(&emit_stmts(fragment_rewrite.stmts.clone()));
    let fragment_direct = compact(&emit_expr(
        fragment_rewrite.direct_render_expr.clone().expect("fragment direct render expr"),
    ));

    assert!(fragment_host.children.is_empty());
    assert!(fragment_host.opening.self_closing);
    assert!(fragment_stmts.contains("const__child1=vapor(()=>{"));
    assert!(fragment_stmts.contains("_$createElement(\"span\",_root)"));
    assert_eq!(fragment_direct, "__child1;");
}

#[test]
fn builds_direct_render_and_dynamic_component_anchor_paths() {
    let mut fragment_vt = new_vt();
    let fragment = parse_jsx_element("<Fragment><span>body</span></Fragment>");
    let mut fragment_stmts = Vec::new();

    build_component_element(
        &mut fragment_vt,
        &fragment,
        &crate::emit::ident("root"),
        &mut fragment_stmts,
    );

    let fragment_out = compact(&emit_stmts(fragment_stmts));

    assert!(fragment_out.contains("_$createComment(\"rue:component:anchor\")"));
    assert!(fragment_out.contains("const__child1=vapor(()=>{"));
    assert!(fragment_out.contains("renderAnchor(__slot2,root,_list1);"));
    assert!(!fragment_out.contains("watchEffect("));
    assert!(!fragment_out.contains("_$createComponent(Fragment"));

    let mut component_vt = new_vt();
    let component = parse_jsx_element("<Box title={title} />");
    let mut component_stmts = Vec::new();

    build_component_element(
        &mut component_vt,
        &component,
        &crate::emit::ident("root"),
        &mut component_stmts,
    );

    let component_out = compact(&emit_stmts(component_stmts));

    assert!(component_out.contains("_$createComment(\"rue:component:anchor\")"));
    assert!(component_out.contains("watchEffect(()=>{"));
    assert!(component_out.contains("_$createComponent(Box,{title:title})"));
    assert!(component_out.contains("renderAnchor(__slot2,root,_list1)"));
}
