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

fn parse_module_stmt(src: &str, tsx: bool) -> Stmt {
    let cm = Arc::new(SourceMap::default());
    let fm = cm
        .new_source_file(FileName::Custom("element-list-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    let module = parser.parse_module().expect("parse module");
    match module.body.into_iter().next().expect("stmt") {
        ModuleItem::Stmt(stmt) => stmt,
        _ => panic!("expected statement"),
    }
}

fn parse_arrow_block(src: &str) -> BlockStmt {
    match parse_expr(src, true) {
        Expr::Arrow(arrow) => match *arrow.body {
            BlockStmtOrExpr::BlockStmt(block) => block,
            _ => panic!("expected block body"),
        },
        _ => panic!("expected arrow expr"),
    }
}

fn parse_arrow_param(src: &str) -> Pat {
    match parse_expr(src, true) {
        Expr::Arrow(arrow) => arrow.params.into_iter().next().expect("first param"),
        _ => panic!("expected arrow expr"),
    }
}

fn parse_fragment(src: &str) -> JSXFragment {
    match parse_expr(src, true) {
        Expr::JSXFragment(fragment) => fragment,
        _ => panic!("expected jsx fragment"),
    }
}

fn emit_expr(expr: Expr) -> String {
    let stmt = Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(expr) });
    emit_stmts(vec![stmt])
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
fn collects_decl_prefixes_and_nested_return_exprs() {
    let simple_block = parse_arrow_block(
        "() => { const rowKey = row.id; function format() { return row.id; } return <li key={rowKey}>{rowKey}</li>; }",
    );
    let (prefix, ret_expr) =
        collect_decl_prefix_and_final_return(&simple_block).expect("simple block");

    assert_eq!(prefix.len(), 2);
    assert!(matches!(ret_expr, Expr::JSXElement(_)));

    let complex_block = parse_arrow_block(
        "() => { const rowKey = row.id; console.log(rowKey); return <li>{rowKey}</li>; }",
    );
    assert!(collect_decl_prefix_and_final_return(&complex_block).is_none());

    let nested_returns = parse_arrow_block(
        "() => { if (hot) { return <li key={a}>A</li>; } switch (kind) { case 'b': return <li key={b}>B</li>; default: break; } try { return <li key={c}>C</li>; } catch (err) { return <li key={d}>D</li>; } }",
    );
    let mut return_exprs = Vec::new();
    collect_return_exprs_in_block(&nested_returns, &mut return_exprs);

    assert_eq!(return_exprs.len(), 4);
}

#[test]
fn collects_and_rewrites_alias_exprs_for_destructured_patterns() {
    let pat = parse_arrow_param("({ id: rowId, meta: { tags }, ...rest }) => rowId");
    let mut alias_exprs = HashMap::new();
    collect_alias_exprs_from_pat(&pat, ident("item").into(), &mut alias_exprs);

    assert_eq!(
        normalize(&emit_expr(alias_exprs.get("rowId").expect("rowId").clone())),
        normalize("item.id;")
    );
    assert_eq!(
        normalize(&emit_expr(alias_exprs.get("tags").expect("tags").clone())),
        normalize("item.meta.tags;")
    );
    assert_eq!(
        normalize(&emit_expr(alias_exprs.get("rest").expect("rest").clone())),
        normalize("item;")
    );

    let mut expr = parse_expr("rowId + rest.count", false);
    rewrite_alias_exprs_in_expr(&mut expr, &alias_exprs);
    assert_eq!(normalize(&emit_expr(expr)), normalize("item.id + item.count;"));

    let mut stmt = parse_module_stmt("const out = { rowId, tags, rest };", false);
    rewrite_alias_exprs_in_stmt(&mut stmt, &alias_exprs);
    let rendered = normalize(&emit_stmts(vec![stmt]));
    assert!(rendered.contains(&normalize("rowId: item.id")));
    assert!(rendered.contains(&normalize("tags: item.meta.tags")));
    assert!(rendered.contains(&normalize("rest: item")));
}

#[test]
fn detects_prefix_dependencies_and_external_reactive_reads() {
    let prefix_block = parse_arrow_block(
        "() => { const rowKey = item.id; const label = rowKey + '-x'; const isEditing = editingId.value === item.id; return label; }",
    );
    let prefix = prefix_block.stmts[..3].to_vec();

    assert!(expr_uses_declared_prefix(&parse_expr("label", false), &prefix));
    assert!(!expr_uses_declared_prefix(&parse_expr("item.id", false), &prefix));

    let mut local_names = collect_declared_idents_in_stmts(&prefix);
    local_names.insert("item".to_string());
    assert!(prefix_reads_external_reactive_values(&prefix, &local_names));

    let inline_block = parse_arrow_block(
        "() => { const rowKey = item.id; const label = rowKey + '-x'; return label; }",
    );
    let inline_aliases =
        collect_inline_alias_exprs_from_prefix(&inline_block.stmts[..2]).expect("inline aliases");
    assert_eq!(
        normalize(&emit_expr(inline_aliases.get("label").expect("label").clone())),
        normalize("item.id + '-x';"),
    );
}

#[test]
fn extracts_key_exprs_from_wrapped_renders_and_native_fragments() {
    let jsx_expr = parse_expr("<li key={row.id}>A</li>", true);
    let Expr::JSXElement(jsx_el) = jsx_expr else {
        panic!("expected jsx element");
    };
    assert_eq!(
        normalize(&emit_expr(extract_jsx_element_key_expr(&jsx_el).expect("jsx key"))),
        normalize("row.id;"),
    );

    assert!(is_single_root_native_jsx_fragment(&parse_fragment("<><span>A</span></>")));
    assert!(!is_single_root_native_jsx_fragment(&parse_fragment("<><Comp /></>")));

    let vapor_wrapped = parse_expr("vapor(() => <li key={row.id}>A</li>)", true);
    assert_eq!(
        normalize(&emit_expr(extract_render_root_key_expr(&vapor_wrapped).expect("vapor key"))),
        normalize("row.id;"),
    );

    let hook_wrapped =
        parse_expr("_$vaporWithHookId('slot', () => vapor(() => <li key={row.id}>A</li>))", true);
    assert_eq!(
        normalize(&emit_expr(extract_render_root_key_expr(&hook_wrapped).expect("hook key"))),
        normalize("row.id;"),
    );

    let generated_root_block = parse_arrow_block(
        "() => { const _root = _$createElement('li'); watchEffect(() => { _$setAttribute(_root, 'key', String(row.id)); }); return _root; }",
    );
    assert_eq!(
        normalize(&emit_expr(
            extract_returned_root_key_expr_from_block(&generated_root_block.stmts)
                .expect("generated key"),
        ),),
        normalize("row.id;"),
    );
}
