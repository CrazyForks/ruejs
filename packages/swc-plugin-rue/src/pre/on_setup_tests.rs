use super::*;
use std::sync::Arc;
use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::ast::{Module, ModuleItem, Program, Stmt};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_module_stmts(src: &str) -> Vec<Stmt> {
    let cm = Arc::new(SourceMap::default());
    let fm =
        cm.new_source_file(FileName::Custom("on-setup-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    let module = parser.parse_module().expect("parse module");
    module
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
fn builds_setup_wrapper_and_binds_nested_names() {
    let collected = parse_module_stmts(
        "
        const { foo = 1, nested: { bar }, ...rest } = props;
        let [first, second] = list;
        function helper() { return first + bar + rest.count; }
        ",
    );

    let rendered = normalize(&emit_stmts(build_setup_with_binds(
        vec!["foo".into(), "bar".into(), "rest".into(), "helper".into()],
        vec!["first".into(), "second".into()],
        collected,
    )));

    assert!(rendered.contains(&normalize(
        r#"const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{"#,
    )));
    assert!(rendered.contains(&normalize(
        r#"return {
            foo: foo,
            bar: bar,
            rest: rest,
            helper: helper,
            first: first,
            second: second
        };"#,
    )));
    assert!(rendered.contains(&normalize(
        r#"const { foo: foo, bar: bar, rest: rest, helper: helper } = _$useSetup;"#,
    )));
    assert!(
        rendered.contains(&normalize(r#"let { first: first, second: second } = _$useSetup;"#,))
    );
}

#[test]
fn omits_extra_bindings_when_no_names_are_requested() {
    let collected = parse_module_stmts("const state = ref(0);");
    let stmts = build_setup_with_binds(Vec::new(), Vec::new(), collected);
    let rendered = normalize(&emit_stmts(stmts.clone()));

    assert_eq!(stmts.len(), 1);
    assert!(rendered.contains(&normalize(
        r#"const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{"#
    )));
    assert!(rendered.contains(&normalize("return {};")));
    assert!(!rendered.contains(&normalize("const {")));
    assert!(!rendered.contains(&normalize("let {")));
}
