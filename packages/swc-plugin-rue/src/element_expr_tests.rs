use super::*;
use std::collections::{HashMap, HashSet};
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
    let fm = cm
        .new_source_file(FileName::Custom("element-expr-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    *parser.parse_expr().expect("parse expr")
}

fn parse_module_stmts(src: &str, tsx: bool) -> Vec<Stmt> {
    let cm = Arc::new(SourceMap::default());
    let fm = cm
        .new_source_file(FileName::Custom("element-expr-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    let module = parser.parse_module().expect("parse module");
    module
        .body
        .into_iter()
        .filter_map(|item| match item {
            ModuleItem::Stmt(stmt) => Some(stmt),
            _ => None,
        })
        .collect()
}

fn expr_container(src: &str, tsx: bool) -> JSXExprContainer {
    JSXExprContainer { span: DUMMY_SP, expr: JSXExpr::Expr(Box::new(parse_expr(src, tsx))) }
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

#[test]
fn detects_renderable_calls_empty_memos_and_local_aliases() {
    assert!(contains_jsx_in_expr(&parse_expr("useMemo(() => ok ? <span /> : null, [])", true)));
    assert!(contains_jsx_in_expr(&parse_expr(
        "_$vaporWithHookId(\"memo:0:0\", () => useMemo(() => <span />, []))",
        true,
    )));
    assert!(contains_jsx_in_expr(&parse_expr(
        "items.map(item => { if (item.ok) { return <li />; } return null; })",
        true,
    )));
    assert!(!contains_jsx_in_expr(&parse_expr("useMemo(() => value, [])", false)));
    assert!(!contains_jsx_in_expr(&parse_expr("String(value)", false)));

    assert!(is_empty_deps_memoized_jsx_expr(&parse_expr("useMemo(() => <span />, [])", true)));
    assert!(is_empty_deps_memoized_jsx_expr(&parse_expr(
        "_$vaporWithHookId(\"memo:0:0\", () => useMemo(() => <span />, []))",
        true,
    )));
    assert!(!is_empty_deps_memoized_jsx_expr(&parse_expr("useMemo(() => <span />, deps)", true,)));

    let stmts = parse_module_stmts(
        "
const fromOuter = slotSeed;
const fromJsx = <div />;
const fromCond = ok ? fromJsx : null;
const fromCall = renderThing();
const fromWrapped = (fromCond as any);
const textified = String(fromJsx);
let mutableAlias = fromJsx;
const empty = null;
",
        true,
    );
    let outer = HashSet::from(["slotSeed".to_string()]);
    let aliases = collect_renderable_local_alias_names(stmts.iter(), &outer);

    assert!(aliases.contains("fromOuter"));
    assert!(aliases.contains("fromJsx"));
    assert!(aliases.contains("fromCond"));
    assert!(aliases.contains("fromCall"));
    assert!(aliases.contains("fromWrapped"));
    assert!(!aliases.contains("textified"));
    assert!(!aliases.contains("mutableAlias"));
    assert!(!aliases.contains("empty"));
}

#[test]
fn rewrites_hook_wrapped_memo_calls_for_slot_with_empty_fallbacks() {
    let mut vt = new_vt();
    let expr = parse_expr(
        "_$vaporWithHookId(\"memo:0:0\", () => useMemo(() => ok ? <span /> : null, []))",
        true,
    );

    let out = compact(&emit_expr(make_expr_for_slot(&mut vt, &expr)));

    assert!(out.contains("_$vaporWithHookId(\"memo:0:0\",()=>useMemo(()"));
    assert!(out.contains("vapor(()=>{"));
    assert!(out.contains("_$createDocumentFragment()"));
    assert!(out.contains(":\"\""));
}

#[test]
fn emits_slot_render_once_and_style_text_paths_for_expr_children() {
    let mut slot_vt = new_vt();
    slot_vt.el_tag_by_ident.insert("root".to_string(), "div".to_string());
    slot_vt.push_renderable_local_scope(HashSet::from(["slotView".to_string()]));
    let mut slot_stmts = Vec::new();

    emit_element_expr_container_child(
        &mut slot_vt,
        &ident("root"),
        &expr_container("slotView", false),
        &mut slot_stmts,
    );

    let slot_out = compact(&emit_stmts(slot_stmts));
    assert!(slot_out.contains("_$createComment(\"rue:slot:anchor\")"));
    assert!(slot_out.contains(
        "watchEffect(()=>{const__slot=(slotView);untrack(()=>renderAnchor(__slot,root,_list1));});"
    ));

    let mut memo_vt = new_vt();
    memo_vt.el_tag_by_ident.insert("root".to_string(), "div".to_string());
    let mut memo_stmts = Vec::new();

    emit_element_expr_container_child(
        &mut memo_vt,
        &ident("root"),
        &expr_container("useMemo(() => <span />, [])", true),
        &mut memo_stmts,
    );

    let memo_out = compact(&emit_stmts(memo_stmts));
    assert!(memo_out.contains("_$createComment(\"rue:slot:anchor\")"));
    assert!(memo_out.contains("renderAnchor(_list2,root,_list1);"));
    assert!(!memo_out.contains("watchEffect("));

    let mut style_vt = new_vt();
    style_vt.once_depth = 1;
    style_vt.el_tag_by_ident.insert("styleEl".to_string(), "style".to_string());
    let mut style_stmts = Vec::new();

    emit_element_expr_container_child(
        &mut style_vt,
        &ident("styleEl"),
        &expr_container("colorValue", false),
        &mut style_stmts,
    );

    let style_out = compact(&emit_stmts(style_stmts));
    assert!(style_out.contains("_$settextContent(styleEl,colorValue);"));
    assert!(!style_out.contains("watchEffect("));
}
