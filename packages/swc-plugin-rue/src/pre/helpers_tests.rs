use super::*;
use std::collections::HashSet;
use std::sync::Arc;
use swc_core::common::{DUMMY_SP, FileName, SourceMap};
use swc_core::ecma::ast::{Module, ModuleItem, Program};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_expr(src: &str, tsx: bool) -> Expr {
    let cm = Arc::new(SourceMap::default());
    let fm =
        cm.new_source_file(FileName::Custom("helpers-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    *parser.parse_expr().expect("parse expr")
}

fn parse_module_stmt(src: &str, tsx: bool) -> Stmt {
    let cm = Arc::new(SourceMap::default());
    let fm =
        cm.new_source_file(FileName::Custom("helpers-test.tsx".into()).into(), src.to_string());
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

fn parse_arrow(src: &str) -> ArrowExpr {
    match parse_expr(src, true) {
        Expr::Arrow(arrow) => arrow,
        _ => panic!("expected arrow expr"),
    }
}

fn parse_fn_decl(src: &str) -> FnDecl {
    match parse_module_stmt(src, true) {
        Stmt::Decl(Decl::Fn(fn_decl)) => fn_decl,
        _ => panic!("expected fn decl"),
    }
}

fn parse_var_declarator(src: &str) -> VarDeclarator {
    match parse_module_stmt(src, true) {
        Stmt::Decl(Decl::Var(var)) => var.decls.into_iter().next().expect("var decl"),
        _ => panic!("expected var decl"),
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
fn detects_component_render_shapes_and_boundaries() {
    let render_fn = parse_fn_decl("function Comp() { return h('div', null); }");
    let render_block = render_fn.function.body.clone().expect("body");
    assert!(has_component_render_return_in_block(&render_block));

    let boundary_fn = parse_fn_decl(
        "function Boundary() { const ready = true; if (ok) { return <div />; } return value; }",
    );
    let boundary_block = boundary_fn.function.body.clone().expect("body");
    assert_eq!(first_control_idx(&boundary_block, 2), 1);
    assert_eq!(find_first_return_index(&boundary_block), Some(1));

    let plain_fn = parse_fn_decl("function helper() { const value = 1; return value; }");
    let plain_block = plain_fn.function.body.clone().expect("body");
    assert!(!has_component_render_return_in_block(&plain_block));

    let typed_fn = parse_fn_decl("function View(): JSX.Element { return <div />; }");
    assert!(should_transform_fn_decl(&typed_fn));

    let untyped_arrow = parse_var_declarator("const View = (): JSX.Element => <div />;");
    assert!(is_untyped_arrow_component_decl(&untyped_arrow));
}

#[test]
fn rewrites_props_destructure_in_arrow_and_function_bodies() {
    let mut arrow =
        parse_arrow("({ foo = 1, bar: baz, ...rest }) => <div>{foo}{baz}{rest.qux}</div>");
    assert!(rewrite_component_props_destructure_in_arrow(&mut arrow));
    let arrow_rendered = normalize(&emit_stmts(vec![Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(Expr::Arrow(arrow)),
    })]));

    assert!(arrow_rendered.contains("__rue_props"));
    assert!(arrow_rendered.contains(&normalize(
        "const { foo: __rue_rest_omit_0, bar: __rue_rest_omit_1, ...rest } = __rue_props;",
    )));
    assert!(
        arrow_rendered.contains(&normalize("(__rue_props.foo === void 0 ? 1 : __rue_props.foo)",))
    );
    assert!(arrow_rendered.contains("__rue_props.bar"));
    assert!(arrow_rendered.contains("rest.qux"));

    let mut fn_decl =
        parse_fn_decl("function Comp({ foo, bar: baz }) { return <div>{foo}{baz}</div>; }");
    assert!(rewrite_component_props_destructure_in_function(&mut fn_decl.function));
    let function_rendered = normalize(&emit_stmts(vec![Stmt::Decl(Decl::Fn(fn_decl))]));

    assert!(function_rendered.contains(&normalize("function Comp(__rue_props) {")));
    assert!(function_rendered.contains("__rue_props.foo"));
    assert!(function_rendered.contains("__rue_props.bar"));
}

#[test]
fn rejects_nested_rest_props_param_rewrite() {
    let mut arrow =
        parse_arrow("({ nested: { foo, ...restInner }, ...rest }) => <div>{foo}{rest.id}</div>");
    assert!(!rewrite_component_props_destructure_in_arrow(&mut arrow));
}

#[test]
fn lowers_derived_consts_through_helper_aliases_in_functions() {
    let mut fn_decl = parse_fn_decl(
        "function Comp(props) { const total = props.count * 2; const formatTotal = () => total + 1; const alias = formatTotal; return <div>{alias()}</div>; }",
    );
    assert!(lower_props_derived_consts_in_function(&mut fn_decl.function));

    let rendered = normalize(&emit_stmts(vec![Stmt::Decl(Decl::Fn(fn_decl))]));

    assert!(rendered.contains("computed"));
    assert!(rendered.contains("props.count * 2"));
    assert!(rendered.contains("__rue_phase2_total = total"));
    assert!(rendered.contains("__rue_phase2_total.get() + 1"));
}

#[test]
fn collects_setup_and_injects_use_setup_for_hoistable_statements() {
    let fn_decl = parse_fn_decl(
        "function Comp() { const state = ref(0); const helper = () => state.value; watchEffect(() => console.log(state.value)); return <div>{state.value}</div>; }",
    );
    let mut block = fn_decl.function.body.clone().expect("body");

    let ret_idx = find_first_return_index(&block).expect("return index");
    let fci = first_control_idx(&block, ret_idx);
    let (collected, names_const, names_let, available) =
        collect_setup(&block, ret_idx, fci, false, &HashSet::new());

    assert_eq!(collected.len(), 3);
    assert_eq!(names_const, vec!["state".to_string(), "helper".to_string()]);
    assert!(names_let.is_empty());
    assert!(available.contains("state"));
    assert!(available.contains("helper"));

    inject_setup(&mut block, ret_idx, names_const, names_let, collected);
    let rendered = normalize(&emit_stmts(block.stmts.clone()));

    assert!(rendered.contains("_$vaporWithHookId(\"useSetup:0:0\""));
    assert!(rendered.contains("useSetup(()=>{"));
    assert!(rendered.contains(&normalize("const { state: state, helper: helper } = _$useSetup;")));
    assert!(rendered.contains("watchEffect"));
    assert!(rendered.contains("console.log(state.value)"));
}

#[test]
fn lowers_derived_consts_in_arrow_only_for_dynamic_live_candidates() {
    let mut arrow = parse_arrow(
        "(props) => { const total = props.count * 2; const seed = props.seed + 1; const snapshot = ref(seed); const helper = () => total + snapshot.value; const alias = helper; return <div>{alias()}</div>; }",
    );
    assert!(lower_props_derived_consts_in_arrow(&mut arrow));

    let rendered = normalize(&emit_stmts(vec![Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(Expr::Arrow(arrow)),
    })]));

    assert!(rendered.contains(&normalize("const total = computed(()=>props.count * 2);")));
    assert!(rendered.contains("__rue_phase2_total = total"));
    assert!(rendered.contains("__rue_phase2_total.get() + snapshot.value"));
    assert!(rendered.contains(&normalize("const seed = props.seed + 1;")));
    assert!(rendered.contains(&normalize("const snapshot = ref(seed);")));
    assert!(!rendered.contains(&normalize("const seed = computed(()=>props.seed + 1);")));
    assert!(!rendered.contains("__rue_phase2_seed"));
}

#[test]
fn collect_setup_hoists_wrapped_computed_and_setup_effects_until_jsx_boundary() {
    let fn_decl = parse_fn_decl(
        "function Comp() { const state = ref(0); const doubled = _$vaporWithHookId(\"computed:1:0\", () => computed(() => state.value * 2)); const helper = () => doubled.value; _$vaporWithHookId(\"onMounted:1:1\", () => onMounted(() => console.log(helper()))); const view = <aside />; return <div>{helper()}</div>; }",
    );
    let mut block = fn_decl.function.body.clone().expect("body");

    let ret_idx = find_first_return_index(&block).expect("return index");
    let fci = first_control_idx(&block, ret_idx);
    let (collected, names_const, names_let, available) =
        collect_setup(&block, ret_idx, fci, false, &HashSet::new());

    assert_eq!(collected.len(), 4);
    assert_eq!(names_const, vec!["state".to_string(), "doubled".to_string(), "helper".to_string()]);
    assert!(names_let.is_empty());
    assert!(available.contains("state"));
    assert!(available.contains("doubled"));
    assert!(available.contains("helper"));
    assert!(!available.contains("view"));

    let collected_rendered = normalize(&emit_stmts(collected.clone()));
    assert!(collected_rendered.contains("_$vaporWithHookId(\"computed:1:0\""));
    assert!(collected_rendered.contains("computed(()=>state.value * 2)"));
    assert!(collected_rendered.contains("_$vaporWithHookId(\"onMounted:1:1\""));
    assert!(!collected_rendered.contains(&normalize("const view = <aside />;")));

    inject_setup(&mut block, ret_idx, names_const, names_let, collected);
    let rendered = normalize(&emit_stmts(block.stmts.clone()));

    assert!(rendered.contains("_$vaporWithHookId(\"useSetup:0:0\""));
    assert!(rendered.contains("_$vaporWithHookId(\"computed:1:0\""));
    assert!(rendered.contains("_$vaporWithHookId(\"onMounted:1:1\""));
    assert!(rendered.contains(&normalize(
        "const { state: state, doubled: doubled, helper: helper } = _$useSetup;",
    )));
    assert!(rendered.contains("const view = <aside"));
}
