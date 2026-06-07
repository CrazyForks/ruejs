use super::*;
use std::sync::Arc;
use swc_core::common::{DUMMY_SP, FileName, SourceMap};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_expr(src: &str) -> Expr {
    let cm = Arc::new(SourceMap::default());
    let fm =
        cm.new_source_file(FileName::Custom("side-effect-test.ts".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: false, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    *parser.parse_expr().expect("parse expression")
}

fn locals(names: &[&str]) -> HashSet<String> {
    names.iter().map(|name| (*name).to_string()).collect()
}

#[test]
fn collects_identifiers_from_nested_arrow_and_function_bodies() {
    let arrow_expr = parse_expr(
        "(() => { foo; const bar = baz; function inner() { qux; const deep = nested; } })",
    );
    let mut arrow_idents = HashSet::new();
    collect_idents_in_expr(&arrow_expr, &mut arrow_idents);

    for name in ["foo", "baz", "qux", "nested"] {
        assert!(arrow_idents.contains(name), "missing identifier: {name}");
    }
    for name in ["bar", "deep", "inner"] {
        assert!(!arrow_idents.contains(name), "unexpected binding: {name}");
    }

    let fn_expr = parse_expr("(function () { alpha; const beta = gamma; })");
    let mut fn_idents = HashSet::new();
    collect_idents_in_expr(&fn_expr, &mut fn_idents);

    assert!(fn_idents.contains("alpha"));
    assert!(fn_idents.contains("gamma"));
    assert!(!fn_idents.contains("beta"));
}

#[test]
fn collects_identifiers_from_objects_templates_and_type_wrappers() {
    let object_expr = parse_expr(
        "({ ...spreadSource, value: props.children, method() { methodExpr; const local = methodInit; }, get read() { getterExpr; }, set write(v) { setterExpr; } })",
    );
    let mut object_idents = HashSet::new();
    collect_idents_in_expr(&object_expr, &mut object_idents);

    for name in ["spreadSource", "props", "methodExpr", "methodInit", "getterExpr", "setterExpr"] {
        assert!(object_idents.contains(name), "missing identifier: {name}");
    }
    assert!(!object_idents.contains("local"));
    assert!(!object_idents.contains("v"));

    let mixed_expr = parse_expr(
        "`prefix ${call(arg)} ${new Factory(service)} ${condition ? left + right : updateTarget++} ${(assign = value)} ${(receiver.method(other))} ${[first, second]} ${(count as number)} ${(<string>label)}`",
    );
    let mut mixed_idents = HashSet::new();
    collect_idents_in_expr(&mixed_expr, &mut mixed_idents);

    for name in [
        "call",
        "arg",
        "Factory",
        "service",
        "condition",
        "left",
        "right",
        "updateTarget",
        "value",
        "receiver",
        "other",
        "first",
        "second",
        "count",
        "label",
    ] {
        assert!(mixed_idents.contains(name), "missing identifier: {name}");
    }
    assert!(!mixed_idents.contains("assign"));
}

#[test]
fn collects_identifiers_from_non_ident_members_and_object_shorthands() {
    let expr = parse_expr("({ shorthand, nested: (makeBox(service)).value, emptyNew: new Empty })");
    let mut idents = HashSet::new();
    collect_idents_in_expr(&expr, &mut idents);

    for name in ["makeBox", "service", "Empty"] {
        assert!(idents.contains(name), "missing identifier: {name}");
    }
    assert!(!idents.contains("shorthand"));
}

#[test]
fn tolerates_bodyless_object_methods_and_accessors() {
    let bodyless_function = || Function {
        params: Vec::new(),
        decorators: Vec::new(),
        span: DUMMY_SP,
        ctxt: Default::default(),
        body: None,
        is_generator: false,
        is_async: false,
        type_params: None,
        return_type: None,
    };
    let expr = Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: vec![
            PropOrSpread::Prop(Box::new(Prop::Method(MethodProp {
                key: PropName::Ident(IdentName::new("method".into(), DUMMY_SP)),
                function: Box::new(bodyless_function()),
            }))),
            PropOrSpread::Prop(Box::new(Prop::Getter(GetterProp {
                span: DUMMY_SP,
                key: PropName::Ident(IdentName::new("value".into(), DUMMY_SP)),
                type_ann: None,
                body: None,
            }))),
            PropOrSpread::Prop(Box::new(Prop::Setter(SetterProp {
                span: DUMMY_SP,
                key: PropName::Ident(IdentName::new("value".into(), DUMMY_SP)),
                this_param: None,
                param: Box::new(Pat::Ident(BindingIdent {
                    id: Ident::new("next".into(), DUMMY_SP, Default::default()),
                    type_ann: None,
                })),
                body: None,
            }))),
        ],
    });
    let mut idents = HashSet::new();

    collect_idents_in_expr(&expr, &mut idents);

    assert!(idents.is_empty());
}

#[test]
fn tolerates_function_like_nodes_without_bodies() {
    let mut idents = HashSet::new();
    let bodyless_fn = FnDecl {
        ident: Ident::new("inner".into(), DUMMY_SP, Default::default()),
        declare: false,
        function: Box::new(Function {
            params: Vec::new(),
            decorators: Vec::new(),
            span: DUMMY_SP,
            ctxt: Default::default(),
            body: None,
            is_generator: false,
            is_async: false,
            type_params: None,
            return_type: None,
        }),
    };
    let arrow = Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        ctxt: Default::default(),
        params: Vec::new(),
        body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
            span: DUMMY_SP,
            ctxt: Default::default(),
            stmts: vec![Stmt::Decl(Decl::Fn(bodyless_fn))],
        })),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
    });
    collect_idents_in_expr(&arrow, &mut idents);

    let fn_expr = Expr::Fn(FnExpr {
        ident: None,
        function: Box::new(Function {
            params: Vec::new(),
            decorators: Vec::new(),
            span: DUMMY_SP,
            ctxt: Default::default(),
            body: None,
            is_generator: false,
            is_async: false,
            type_params: None,
            return_type: None,
        }),
    });
    collect_idents_in_expr(&fn_expr, &mut idents);

    assert!(idents.is_empty());
}

#[test]
fn collects_identifiers_from_manual_call_and_function_body_shapes() {
    let mut idents = HashSet::new();
    let super_call = Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Super(Super { span: DUMMY_SP }),
        args: vec![ExprOrSpread { spread: None, expr: Box::new(parse_expr("argValue")) }],
        type_args: None,
        ctxt: Default::default(),
    });
    collect_idents_in_expr(&super_call, &mut idents);
    assert!(idents.contains("argValue"));

    let fn_with_var = parse_expr("(function () { const local = sourceValue; })");
    collect_idents_in_expr(&fn_with_var, &mut idents);
    assert!(idents.contains("sourceValue"));

    let object_expr = Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: vec![
            PropOrSpread::Prop(Box::new(Prop::Method(MethodProp {
                key: PropName::Ident(IdentName::new("method".into(), DUMMY_SP)),
                function: Box::new(Function {
                    params: Vec::new(),
                    decorators: Vec::new(),
                    span: DUMMY_SP,
                    ctxt: Default::default(),
                    body: Some(BlockStmt {
                        span: DUMMY_SP,
                        ctxt: Default::default(),
                        stmts: vec![Stmt::Decl(Decl::Var(Box::new(VarDecl {
                            span: DUMMY_SP,
                            ctxt: Default::default(),
                            kind: VarDeclKind::Const,
                            declare: false,
                            decls: vec![VarDeclarator {
                                span: DUMMY_SP,
                                name: Pat::Ident(BindingIdent {
                                    id: Ident::new("local".into(), DUMMY_SP, Default::default()),
                                    type_ann: None,
                                }),
                                init: Some(Box::new(parse_expr("methodInit"))),
                                definite: false,
                            }],
                        })))],
                    }),
                    is_generator: false,
                    is_async: false,
                    type_params: None,
                    return_type: None,
                }),
            }))),
            PropOrSpread::Prop(Box::new(Prop::Getter(GetterProp {
                span: DUMMY_SP,
                key: PropName::Ident(IdentName::new("value".into(), DUMMY_SP)),
                type_ann: None,
                body: Some(BlockStmt {
                    span: DUMMY_SP,
                    ctxt: Default::default(),
                    stmts: vec![Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(parse_expr("getterValue")),
                    })],
                }),
            }))),
            PropOrSpread::Prop(Box::new(Prop::Setter(SetterProp {
                span: DUMMY_SP,
                key: PropName::Ident(IdentName::new("value".into(), DUMMY_SP)),
                this_param: None,
                param: Box::new(Pat::Ident(BindingIdent {
                    id: Ident::new("next".into(), DUMMY_SP, Default::default()),
                    type_ann: None,
                })),
                body: Some(BlockStmt {
                    span: DUMMY_SP,
                    ctxt: Default::default(),
                    stmts: vec![Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(parse_expr("setterValue")),
                    })],
                }),
            }))),
        ],
    });
    collect_idents_in_expr(&object_expr, &mut idents);

    for name in ["methodInit", "getterValue", "setterValue"] {
        assert!(idents.contains(name), "missing identifier: {name}");
    }
}

#[test]
fn treats_local_mutations_and_wrapped_values_as_pure() {
    let locals = locals(&["localValue", "localBox"]);

    assert!(!expr_has_impure_ops(&parse_expr("localValue = next"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("localBox.count++"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("Object.freeze(localBox)"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("(localValue as number)"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("(<number>localValue)"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("(() => remoteValue = next)"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("(function () { remoteValue = next; })"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("ok ? localValue : localBox.count"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("({ ...localBox, value: localValue })"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("[localValue, localBox.count]"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("`value:${localValue}`"), &locals));
    assert!(!expr_has_impure_ops(&parse_expr("localBox.method(localValue)"), &locals));
}

#[test]
fn flags_nonlocal_mutations_and_impure_nested_expressions() {
    let locals = locals(&["localValue", "localBox"]);

    assert!(is_nonlocal_target_expr(&Expr::This(ThisExpr { span: DUMMY_SP }), &locals));
    assert!(is_nonlocal_target_expr(
        &Expr::Lit(Lit::Num(Number { span: DUMMY_SP, value: 1.0, raw: None })),
        &locals
    ));
    assert!(expr_has_impure_ops(&parse_expr("remoteValue = next"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("remoteBox.count = next"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("(localValue as any) = next"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("remoteBox.count++"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("(makeBox()).count++"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("this.count++"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("({ value } = source)"), &locals));
    assert!(expr_has_impure_ops(
        &parse_expr("localBox.count = Object.assign(target, source)"),
        &locals
    ));
    assert!(expr_has_impure_ops(&parse_expr("({ key: remoteValue = next })"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("[localValue, remoteValue = next]"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("`value:${remoteValue = next}`"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("((remoteValue = runner))(arg)"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("localBox.method(remoteValue = next)"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("ok ? localValue : remoteValue = next"), &locals));
    assert!(expr_has_impure_ops(&parse_expr("({ ...(remoteValue = next) })"), &locals));

    assert!(!expr_has_impure_ops(&parse_expr("Object['assign'](target, source)"), &locals));
    assert!(!expr_has_impure_ops(
        &Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: Default::default(),
            callee: Callee::Super(Super { span: DUMMY_SP }),
            args: vec![],
            type_args: None,
        }),
        &locals
    ));
}

#[test]
fn hardens_identifier_collection_for_uninitialized_and_non_expr_body_stmts() {
    let arrow_expr = parse_expr(
        "(() => { let noInit; function inner() { let deepNoInit; if (ready) nestedReady; } })",
    );
    let mut arrow_idents = HashSet::new();
    collect_idents_in_expr(&arrow_expr, &mut arrow_idents);

    assert!(!arrow_idents.contains("ready"));
    assert!(!arrow_idents.contains("noInit"));
    assert!(!arrow_idents.contains("deepNoInit"));
    assert!(!arrow_idents.contains("nestedReady"));

    let fn_expr = parse_expr("(function () { let noInit; if (flag) value; })");
    let mut fn_idents = HashSet::new();
    collect_idents_in_expr(&fn_expr, &mut fn_idents);

    assert!(!fn_idents.contains("noInit"));
    assert!(!fn_idents.contains("flag"));
    assert!(!fn_idents.contains("value"));

    let object_expr = parse_expr(
        "({ method() { let noInit; if (methodFlag) methodValue; }, get value() { let getterLocal = getterInit; if (getterFlag) getterValue; }, set value(next) { let setterLocal = setterInit; if (setterFlag) setterValue; } })",
    );
    let mut object_idents = HashSet::new();
    collect_idents_in_expr(&object_expr, &mut object_idents);

    assert!(!object_idents.contains("getterInit"));
    assert!(!object_idents.contains("setterInit"));
    assert!(!object_idents.contains("methodFlag"));
    assert!(!object_idents.contains("getterFlag"));
    assert!(!object_idents.contains("setterFlag"));
    assert!(!object_idents.contains("noInit"));
    assert!(!object_idents.contains("getterLocal"));
    assert!(!object_idents.contains("setterLocal"));
}
