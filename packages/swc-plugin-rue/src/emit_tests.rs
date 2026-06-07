use super::*;
use std::sync::Arc;
use swc_core::common::{DUMMY_SP, SourceMap};
use swc_core::ecma::ast::{Module, ModuleItem, Program};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};

fn emit_expr(expr: Expr) -> String {
    let cm = Arc::new(SourceMap::default());
    let module = Module {
        span: DUMMY_SP,
        body: vec![ModuleItem::Stmt(Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(expr) }))],
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

fn compact(src: &str) -> String {
    src.chars().filter(|ch| !ch.is_whitespace()).collect()
}

#[test]
fn builds_member_calls_with_arguments() {
    let out = compact(&emit_expr(call_member(
        ident("node"),
        "appendChild",
        vec![Expr::Ident(ident("child"))],
    )));

    assert_eq!(out, "node.appendChild(child);");
}
