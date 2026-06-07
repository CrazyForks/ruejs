use super::*;
use std::sync::Arc;
use swc_core::common::{DUMMY_SP, FileName, SourceMap};
use swc_core::ecma::ast::{Module, ModuleItem, Program};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_stmts(src: &str) -> Vec<Stmt> {
    let cm = Arc::new(SourceMap::default());
    let fm =
        cm.new_source_file(FileName::Custom("vapor-mod-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    parser
        .parse_module()
        .expect("parse module")
        .body
        .into_iter()
        .map(|item| match item {
            ModuleItem::Stmt(stmt) => stmt,
            _ => panic!("expected statement"),
        })
        .collect()
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

fn compact(src: &str) -> String {
    src.chars().filter(|ch| !ch.is_whitespace()).collect()
}

#[test]
fn flatten_once_watch_effects_handles_expr_bodies_and_non_watch_shapes() {
    let mut stmts = parse_stmts(
        "watchEffect(() => setOnce()); watchEffect(() => { watchEffect(() => nested()); }); watchEffect(); watchEffect(value); obj.watchEffect(() => ignored()); new Foo(); plain();",
    );

    flatten_once_watch_effects(&mut stmts);
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("{setOnce();}"));
    assert!(out.contains("{{nested();}}"));
    assert!(out.contains("watchEffect();"));
    assert!(out.contains("watchEffect(value);"));
    assert!(out.contains("obj.watchEffect(()=>ignored());"));
    assert!(out.contains("newFoo();"));
    assert!(out.contains("plain();"));
}

#[test]
fn flatten_once_watch_effects_leaves_non_expr_callees_alone() {
    let mut stmts = vec![Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(Expr::Call(CallExpr {
            span: DUMMY_SP,
            callee: Callee::Super(Super { span: DUMMY_SP }),
            args: vec![],
            type_args: None,
            ctxt: swc_core::common::SyntaxContext::empty(),
        })),
    })];

    flatten_once_watch_effects(&mut stmts);

    let Some(Stmt::Expr(ExprStmt { expr, .. })) = stmts.first() else {
        panic!("expected expr stmt");
    };
    let Expr::Call(call) = expr.as_ref() else {
        panic!("expected call");
    };
    assert!(matches!(call.callee, Callee::Super(_)));
}
