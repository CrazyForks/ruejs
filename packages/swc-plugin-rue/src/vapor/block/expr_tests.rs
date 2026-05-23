use super::*;
use std::collections::HashMap;
use std::sync::Arc;
use swc_core::common::{DUMMY_SP, FileName, SourceMap};
use swc_core::ecma::ast::{Module, ModuleItem, Program};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn new_vt() -> crate::vapor::VaporTransform {
    crate::vapor::VaporTransform {
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
        FileName::Custom("vapor-block-expr-test.tsx".into()).into(),
        src.to_string(),
    );
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    *parser.parse_expr().expect("parse expr")
}

fn parse_call(src: &str, tsx: bool) -> CallExpr {
    match parse_expr(src, tsx) {
        Expr::Call(call) => call,
        other => panic!("expected CallExpr, got {other:?}"),
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
    emitter.emit_program(&Program::Module(module)).expect("emit stmts");
    String::from_utf8(buf).expect("utf8")
}

fn emit_expr(expr: Expr) -> String {
    emit_stmts(vec![Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(expr) })])
}

fn compact(src: &str) -> String {
    src.chars().filter(|ch| !ch.is_whitespace()).collect()
}

fn parse_jsx_element(src: &str) -> JSXElement {
    match parse_expr(src, true) {
        Expr::JSXElement(el) => *el,
        other => panic!("expected JSXElement, got {other:?}"),
    }
}

fn parse_jsx_fragment(src: &str) -> JSXFragment {
    match parse_expr(src, true) {
        Expr::JSXFragment(fragment) => fragment,
        other => panic!("expected JSXFragment, got {other:?}"),
    }
}

#[test]
fn vapor_block_expr_detects_renderable_calls_and_empty_memo_deps() {
    assert!(call_returns_jsx_renderable(&parse_call("useMemo(() => <span />, [])", true)));
    assert!(call_returns_jsx_renderable(&parse_call(
        "_$vaporWithHookId(\"memo:0:0\", () => useMemo(() => <span />, []))",
        true,
    )));
    assert!(call_returns_jsx_renderable(&parse_call(
        "items.map(item => item.ok ? <li /> : null)",
        true,
    )));

    assert!(is_empty_deps_memoized_jsx_expr(&parse_expr("useMemo(() => <span />, [])", true)));
    assert!(is_empty_deps_memoized_jsx_expr(&parse_expr(
        "_$vaporWithHookId(\"memo:0:0\", () => useMemo(() => <span />, []))",
        true,
    )));
    assert!(!is_empty_deps_memoized_jsx_expr(&parse_expr(
        "items.map(item => item.ok ? <li /> : null)",
        true,
    )));
}

#[test]
fn vapor_block_expr_rewrites_conditional_and_logical_slots() {
    let mut cond_vt = new_vt();
    let cond_out = compact(&emit_expr(build_slot_expr(
        &mut cond_vt,
        &parse_expr("ok ? <span /> : null", true),
    )));
    assert!(cond_out.contains("ok?vapor(()=>{"));
    assert!(cond_out.contains("_$createElement(\"span\",_root)"));
    assert!(cond_out.contains(":\"\";") || cond_out.contains(":\"\""));

    let mut and_vt = new_vt();
    let and_out =
        compact(&emit_expr(build_slot_expr(&mut and_vt, &parse_expr("ok && <span />", true))));
    assert!(and_out.contains("ok?vapor(()=>{"));
    assert!(and_out.contains(":\"\""));

    let mut or_vt = new_vt();
    let or_out =
        compact(&emit_expr(build_slot_expr(&mut or_vt, &parse_expr("left || <span />", true))));
    assert!(or_out.contains("left||vapor(()=>{"));

    let mut nullish_vt = new_vt();
    let nullish_out = compact(&emit_expr(build_slot_expr(
        &mut nullish_vt,
        &parse_expr("left ?? <span />", true),
    )));
    assert!(nullish_out.contains("left??vapor(()=>{"));
}

#[test]
fn vapor_block_expr_flattens_once_slot_builds_for_elements_and_fragments() {
    let jsx_el = parse_jsx_element("<Box title={title} />");
    let mut normal_element_vt = new_vt();
    let normal_element_out =
        compact(&emit_expr(jsx_element_to_slot_value_expr(&mut normal_element_vt, &jsx_el)));

    let mut once_element_vt = new_vt();
    let once_element_expr =
        once_element_vt.with_once_context(|vt| jsx_element_to_slot_value_expr(vt, &jsx_el));
    let once_element_out = compact(&emit_expr(once_element_expr));

    assert!(
        normal_element_out.contains("watchEffect(()")
            || normal_element_out.contains("watchEffect(()=>{")
    );
    assert!(normal_element_out.contains("rue:component:anchor"));
    assert!(!once_element_out.contains("watchEffect("));
    assert!(once_element_out.contains("rue:component:anchor"));
    assert!(once_element_out.contains("renderAnchor("));

    let frag = parse_jsx_fragment("<><Box title={title} /></>");
    let mut normal_fragment_vt = new_vt();
    let normal_fragment_out =
        compact(&emit_expr(jsx_fragment_to_slot_value_expr(&mut normal_fragment_vt, &frag)));

    let mut once_fragment_vt = new_vt();
    let once_fragment_expr =
        once_fragment_vt.with_once_context(|vt| jsx_fragment_to_slot_value_expr(vt, &frag));
    let once_fragment_out = compact(&emit_expr(once_fragment_expr));

    assert!(
        normal_fragment_out.contains("watchEffect(()")
            || normal_fragment_out.contains("watchEffect(()=>{")
    );
    assert!(!once_fragment_out.contains("watchEffect("));
    assert!(once_fragment_out.contains("renderAnchor("));
}
