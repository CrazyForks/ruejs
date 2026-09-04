use super::*;
use std::collections::HashMap;
use std::sync::Arc;
use swc_core::common::{DUMMY_SP, FileName, SourceMap};
use swc_core::ecma::ast::{Module, ModuleItem, Program};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_expr(src: &str, tsx: bool) -> Expr {
    let cm = Arc::new(SourceMap::default());
    let fm = cm
        .new_source_file(FileName::Custom("element-list-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    *parser.parse_expr().expect("parse expr")
}

fn parse_call(src: &str) -> CallExpr {
    match parse_expr(src, true) {
        Expr::Call(call) => call,
        other => panic!("expected call expr, got {other:?}"),
    }
}

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
    emitter.emit_program(&Program::Module(module)).expect("emit");
    String::from_utf8(buf).expect("utf8")
}

fn compact(src: &str) -> String {
    src.chars().filter(|ch| !ch.is_whitespace()).collect()
}

fn compile_list(source: &str) -> Option<String> {
    let mut vt = new_vt();
    let call = parse_call(source);
    let mut stmts = Vec::new();
    try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts)
        .then(|| compact(&emit_stmts(stmts)))
}

#[test]
fn compiles_keyed_native_rows_to_closed_factories() {
    let out =
        compile_list("items.map((item, index) => <li key={item.id}>{index}:{item.name}</li>)")
            .expect("compiled list");

    assert!(out.contains("_$reconcileKeyed("), "{out}");
    assert!(out.contains("(item,index)=>item.id"), "{out}");
    assert!(out.contains("_$mountCompiledKeyedRow("), "{out}");
    assert!(out.contains("_$rowItem.set(_$rowNextItem)"), "{out}");
    assert!(out.contains("_$rowIndex.set(_$rowNextIndex)"), "{out}");
    assert!(!out.contains("_$compiledKeyedList"), "{out}");
    assert!(!out.contains("renderBetween("), "{out}");
    assert!(!out.contains("renderAnchor("), "{out}");
}

#[test]
fn compiles_fragment_and_block_branch_rows() {
    for source in [
        "items.map(item => <><span key={item.id}>{item.a}</span><em>{item.b}</em></>)",
        "items.map(item => { if (item.ok) return <li key={item.id}>{item.name}</li>; return <li key={item.id}>off</li>; })",
        "items.map(item => <li key={item.id} ref={item.ref}>{item.name}</li>)",
    ] {
        let out = compile_list(source).unwrap_or_else(|| panic!("expected compiled row: {source}"));
        assert!(out.contains("_$reconcileKeyed("), "{source}: {out}");
        assert!(out.contains("_$mountCompiledKeyedRow("), "{source}: {out}");
        assert!(!out.contains("_$compiledKeyedList"), "{source}: {out}");
    }
}

#[test]
fn compiles_rows_with_derived_members_and_formatter_calls() {
    let out = compile_list(
        "items.map(item => { const isEditing = editingId.value === item.id; const editingValue = isEditing ? editingTitle.value : item.title; const meta = STATUS_META[item.status]; return <li key={`${item.id}-${isEditing}`}><span>{meta.label}</span><time>{formatCreatedAt(item.createdAt)}</time><input value={editingValue} /></li>; })",
    )
    .expect("compiled list");

    assert!(out.contains("_$reconcileKeyed("), "{out}");
    assert!(out.contains("_$mountCompiledKeyedRow("), "{out}");
    assert!(!out.contains("items.map("), "{out}");
}

#[test]
fn keeps_unrelated_row_reads_out_of_key_getter() {
    let out = compile_list(
        "items.map(item => { const isEditing = editingId.value === item.id; const editingValue = isEditing ? editingTitle.value : item.title; return <li key={`${item.id}-${isEditing}`}><input value={editingValue} /></li>; })",
    )
    .expect("compiled list");

    assert!(out.contains("(item,idx)=>`${item.id}-${(editingId.value===item.id)}`"), "{out}",);
}

#[test]
fn compiles_index_keyed_rows_at_a_precomputed_anchor() {
    let mut vt = new_vt();
    let call = parse_call("rows.map(row => <li>{row.label}</li>)");
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map_at(
        &mut vt,
        &ident("parent"),
        &ident("hole"),
        &call,
        &mut stmts,
    ));
    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("_$reconcileKeyed(parent,hole"), "{out}");
    assert!(out.contains("(row,idx)=>idx"), "{out}");
    assert!(!out.contains("rue:list:end"), "{out}");
    assert!(!out.contains("_$compiledKeyedList"), "{out}");
}

#[test]
fn diagnoses_rows_without_a_closed_factory_and_emits_no_legacy_output() {
    for source in [
        "rows.map(row => <Row key={row.id} row={row} />)",
        "rows.map(row => <li key={row.id} {...row.attrs}>{row.label}</li>)",
        "rows.map(row => opaqueRow(row))",
        "rows.map(async row => <li key={row.id}>{row.label}</li>)",
        "rows.map(row => <svg:path key={row.id}>{row.label}</svg:path>)",
    ] {
        let mut vt = new_vt();
        let call = parse_call(source);
        let mut stmts = Vec::new();

        let handled = try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts);
        assert_eq!(handled, !source.contains("async row"), "{source}");
        assert!(stmts.is_empty(), "{source}: {}", emit_stmts(stmts));
    }
}

#[test]
fn rejects_non_map_calls_without_output() {
    let mut vt = new_vt();
    let call = parse_call("items.filter(item => item.ok)");
    let mut stmts = Vec::new();

    assert!(!try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    assert!(stmts.is_empty());
}
