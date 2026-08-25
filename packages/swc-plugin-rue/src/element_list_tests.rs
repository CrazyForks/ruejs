use super::*;
use std::collections::{HashMap, HashSet};
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
        plain_local_scopes: Vec::new(),
    }
}

fn parse_call(src: &str, tsx: bool) -> CallExpr {
    match parse_expr(src, tsx) {
        Expr::Call(call) => call,
        other => panic!("expected call expr, got {other:?}"),
    }
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

fn parse_module_stmts(src: &str, tsx: bool) -> Vec<Stmt> {
    let cm = Arc::new(SourceMap::default());
    let fm = cm
        .new_source_file(FileName::Custom("element-list-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    parser
        .parse_module()
        .expect("parse module")
        .body
        .into_iter()
        .filter_map(|item| match item {
            ModuleItem::Stmt(stmt) => Some(stmt),
            _ => None,
        })
        .collect()
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

fn compact(src: &str) -> String {
    src.chars().filter(|ch| !ch.is_whitespace()).collect()
}

fn expr_arg(expr: Expr) -> ExprOrSpread {
    ExprOrSpread { spread: None, expr: Box::new(expr) }
}

fn call_expr(callee: Callee, args: Vec<Expr>) -> Expr {
    Expr::Call(CallExpr {
        span: DUMMY_SP,
        ctxt: Default::default(),
        callee,
        args: args.into_iter().map(expr_arg).collect(),
        type_args: None,
    })
}

fn ident_call_expr(name: &str, args: Vec<Expr>) -> Expr {
    call_expr(Callee::Expr(Box::new(Expr::Ident(ident(name)))), args)
}

fn expr_stmt(expr: Expr) -> Stmt {
    Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(expr) })
}

fn watch_effect_block(stmts: Vec<Stmt>) -> Stmt {
    ident_call_stmt(
        "watchEffect",
        vec![Expr::Arrow(ArrowExpr {
            span: DUMMY_SP,
            ctxt: Default::default(),
            params: Vec::new(),
            body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
                span: DUMMY_SP,
                ctxt: Default::default(),
                stmts,
            })),
            is_async: false,
            is_generator: false,
            type_params: None,
            return_type: None,
        })],
    )
}

fn ident_call_stmt(name: &str, args: Vec<Expr>) -> Stmt {
    expr_stmt(ident_call_expr(name, args))
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

#[test]
fn builds_keyed_list_for_expression_body_with_direct_mount_and_index_watcher() {
    let mut vt = new_vt();
    let call =
        parse_call("items.map((item, idx) => <li key={item.id}>{idx}:{item.name}</li>)", true);
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("const_list1=_$createComment(\"rue:list:start\")"));
    assert!(out.contains("let_map1_elements=newMap"));
    assert!(out.contains("watchEffect(()=>{"));
    assert!(out.contains("_$vaporKeyedList({"));
    assert!(out.contains("items:_map1_current"));
    assert!(out.contains("getKey:(item,idx)=>item.id"));
    assert!(out.contains("renderItem:(item,parent,start,end,idx)=>{"));
    assert!(out.contains("directRoot:true"));
    assert!(out.contains("_$createElement(\"li\",_root)"));
    assert!(out.contains("_$insertBefore(parent,_root,start);"));
    assert!(out.contains("watchEffect(()=>{"));
    assert!(!out.contains("renderAnchor(__slot,parent,start);"));
    assert!(!out.contains("renderBetween(__slot,parent,start,end);"));
}

#[test]
fn classifies_list_row_mount_capabilities_without_invalid_boolean_states() {
    let row_names = HashSet::from(["row".to_string(), "idx".to_string()]);
    let no_shadows = HashSet::new();

    let merged_leaf = classify_list_row_mount_mode(
        &parse_expr("<li>{row.label}</li>", true),
        &row_names,
        &no_shadows,
        true,
    );
    assert_eq!(merged_leaf, ListRowMountMode::DirectLeaf { effects: ListRowEffectMode::Merge });
    assert!(merged_leaf.direct_mount());
    assert!(merged_leaf.batch_build());
    assert!(merged_leaf.merge_effects());
    assert!(!merged_leaf.needs_owned_mount());

    for source in [
        "<li {...row.attrs}>{row.label}</li>",
        "<li>{String(row.label)}</li>",
        "<li>{Number(row.id)}</li>",
        "<li>{Boolean(row.active)}</li>",
    ] {
        let preserved_leaf =
            classify_list_row_mount_mode(&parse_expr(source, true), &row_names, &no_shadows, false);
        assert_eq!(
            preserved_leaf,
            ListRowMountMode::DirectLeaf { effects: ListRowEffectMode::Preserve },
            "{source}"
        );
        assert!(preserved_leaf.direct_mount(), "{source}");
        assert!(!preserved_leaf.merge_effects(), "{source}");
    }

    let string_shadow = HashSet::from(["String".to_string()]);
    let shadowed_scalar = classify_list_row_mount_mode(
        &parse_expr("<li>{String(row.label)}</li>", true),
        &row_names,
        &string_shadow,
        false,
    );
    assert_eq!(shadowed_scalar, ListRowMountMode::OwnedStructural);
    assert!(shadowed_scalar.batch_build());
    assert!(shadowed_scalar.needs_owned_mount());
    assert!(!shadowed_scalar.direct_mount());

    assert_eq!(
        classify_list_row_mount_mode(
            &parse_expr("<li ref={row.ref}>{row.label}</li>", true),
            &row_names,
            &no_shadows,
            false,
        ),
        ListRowMountMode::DirectLeaf { effects: ListRowEffectMode::Preserve },
    );
    assert_eq!(
        classify_list_row_mount_mode(
            &parse_expr("<li>{row.ok ? <b /> : <i />}</li>", true),
            &row_names,
            &no_shadows,
            false,
        ),
        ListRowMountMode::OwnedStructural,
    );

    for source in ["<Row row={row} />", "opaqueRow(row)"] {
        assert_eq!(
            classify_list_row_mount_mode(&parse_expr(source, true), &row_names, &no_shadows, false,),
            ListRowMountMode::GlobalFallback,
            "{source}"
        );
    }
}

#[test]
fn tracks_only_scope_aware_index_references_including_aliases_and_closures() {
    fn arrow_body(source: &str) -> Box<BlockStmtOrExpr> {
        let Expr::Arrow(arrow) = parse_expr(source, true) else {
            panic!("expected arrow");
        };
        arrow.body
    }

    assert!(!callback_body_uses_name(
        arrow_body("(row, idx) => <li>{row.label}</li>").as_ref(),
        "idx",
    ));
    assert!(callback_body_uses_name(arrow_body("(row, idx) => <li>{idx}</li>").as_ref(), "idx",));
    assert!(callback_body_uses_name(
        arrow_body("(row, idx) => { const position = idx; return <li>{position}</li>; }").as_ref(),
        "idx",
    ));
    assert!(callback_body_uses_name(
        arrow_body("(row, idx) => <li>{(() => idx)()}</li>").as_ref(),
        "idx",
    ));
    assert!(!callback_body_uses_name(
        arrow_body("(row, idx) => { const read = (idx) => idx; return <li>{read(row.id)}</li>; }",)
            .as_ref(),
        "idx",
    ));
}

#[test]
fn builds_keyed_list_for_destructured_block_fragments_and_complex_fallbacks() {
    let mut fragment_vt = new_vt();
    let fragment_call = parse_call(
        "rows.map(({ id, label }, idx) => { const rowKey = `${id}-${idx}`; return <><span key={rowKey}>{label}</span></>; })",
        true,
    );
    let mut fragment_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut fragment_vt,
        &ident("root"),
        &fragment_call,
        &mut fragment_stmts,
    ));

    let fragment_out = compact(&emit_stmts(fragment_stmts));
    assert!(fragment_out.contains("getKey:(item,idx)=>idx"));
    assert!(fragment_out.contains("renderItem:(item,parent,start,end,idx)=>{"));
    assert!(fragment_out.contains("const{id,label}=item;"));
    assert!(fragment_out.contains("constrowKey=`${item.id}-${idx}`;"));
    assert!(fragment_out.contains("_$createDocumentFragment()"));
    assert!(fragment_out.contains("renderAnchor(__slot,parent,start);"));

    let mut fallback_vt = new_vt();
    let fallback_call = parse_call(
        "rows.map(({ id, label }) => { const rowKey = id; console.log(label); if (label) { return <li key={id}>{label}</li>; } return renderFallback(id); })",
        true,
    );
    let mut fallback_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut fallback_vt,
        &ident("root"),
        &fallback_call,
        &mut fallback_stmts,
    ));

    let fallback_out = compact(&emit_stmts(fallback_stmts));
    assert!(fallback_out.contains("getKey:(item,idx)=>item.id"));
    assert!(fallback_out.contains("const__slot=(()=>{"));
    assert!(fallback_out.contains("constrowKey=item.id;"));
    assert!(fallback_out.contains("console.log(item.label);"));
    assert!(fallback_out.contains("if(item.label){return<likey={item.id}>{item.label}</li>;}"));
    assert!(fallback_out.contains("returnrenderFallback(item.id);"));
    assert!(fallback_out.contains("renderBetween(__slot,parent,start,end);"));
}

#[test]
fn rejects_non_map_calls_and_extracts_keys_from_wrapped_conditionals() {
    let mut vt = new_vt();
    let not_map = parse_call("items.filter(item => item.ok)", false);
    let mut stmts = Vec::new();

    assert!(!try_build_list_from_map(&mut vt, &ident("root"), &not_map, &mut stmts));
    assert!(stmts.is_empty());

    assert_eq!(
        normalize(&emit_expr(
            extract_render_root_key_expr(&parse_expr(
                "ok ? _$vaporWithKey(vapor(() => <li />), row.id) : useMemo(() => <li key={fallback.id} />, [])",
                true,
            ))
            .expect("conditional key"),
        )),
        normalize("row.id;"),
    );
    assert_eq!(
        normalize(&emit_expr(
            extract_render_root_key_expr(&parse_expr("left || <li key=\"right\" />", true))
                .expect("logical key"),
        )),
        normalize("\"right\";"),
    );
    assert_eq!(
        normalize(&emit_expr(
            extract_render_root_key_expr(&parse_expr(
                "ok ? <li /> : <li key={fallback.id} />",
                true,
            ))
            .expect("conditional alt key"),
        )),
        normalize("fallback.id;"),
    );
}

#[test]
fn covers_array_aliases_nested_decl_collection_and_reactive_get_calls() {
    let pat = parse_arrow_param("([first, { id: nestedId }, ...rest]) => first");
    let mut alias_exprs = HashMap::new();
    collect_alias_exprs_from_pat(&pat, ident("item").into(), &mut alias_exprs);

    assert_eq!(
        normalize(&emit_expr(alias_exprs.get("first").expect("first").clone())),
        normalize("item[0];"),
    );
    assert_eq!(
        normalize(&emit_expr(alias_exprs.get("nestedId").expect("nestedId").clone())),
        normalize("item[1].id;"),
    );
    assert_eq!(
        normalize(&emit_expr(alias_exprs.get("rest").expect("rest").clone())),
        normalize("item[2];"),
    );

    let decls = parse_module_stmts(
        "function helper() {} class Row {} const [first, { id }] = item;",
        false,
    );
    let names = collect_declared_idents_in_stmts(&decls);
    assert!(names.contains("helper"));
    assert!(names.contains("Row"));
    assert!(names.contains("first"));
    assert!(names.contains("id"));

    let prefix_block = parse_arrow_block(
        "() => { const label = external.get(); const local = item.get(); return label + local; }",
    );
    let prefix = prefix_block.stmts[..2].to_vec();
    let mut local_names = collect_declared_idents_in_stmts(&prefix);
    local_names.insert("item".to_string());

    assert!(prefix_reads_external_reactive_values(&prefix, &local_names));
}

#[test]
fn extracts_return_exprs_from_loops_and_builds_component_list_items() {
    let loop_block = parse_arrow_block(
        "() => { label: { return <li key={labeled}>L</li>; } while (ok) { return <li key={whileKey}>W</li>; } do { return <li key={doKey}>D</li>; } while (again); for (const x of xs) { return <li key={x.id}>X</li>; } for (const k in obj) { return <li key={k}>K</li>; } for (;;) { return <li key={forever}>F</li>; } }",
    );
    let mut return_exprs = Vec::new();
    collect_return_exprs_in_block(&loop_block, &mut return_exprs);

    assert_eq!(return_exprs.len(), 6);

    let mut vt = new_vt();
    let call = parse_call("items.map(item => <Row key={item.id}>{item.name}</Row>)", true);
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("_$createComponent(Row,{"));
    assert!(out.contains("getKey:(item,idx)=>item.id"));
    assert!(out.contains("renderBetween(__slot,parent,start,end);"));
}

#[test]
fn inlines_external_reactive_prefixes_for_direct_list_items() {
    let mut vt = new_vt();
    let call = parse_call(
        "items.map(item => { const rowKey = external.value + item.id; const label = rowKey + suffix.get(); return <li key={rowKey}>{label}</li>; })",
        true,
    );
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("getKey:(item,idx)=>external.value+item.id"));
    assert!(out.contains("directRoot:true"), "{out}");
    assert!(out.contains("compiledRowPatch:true"), "{out}");
    assert_eq!(
        out.matches("watchEffect(").count(),
        1,
        "safe external accessor reads should run through the list-level patch effect: {out}"
    );
    assert!(!out.contains("renderAnchor("), "{out}");
    assert!(!out.contains(",\"key\","));
    assert!(out.contains("const_$rowBindingNext0=(external.value+item.id)+suffix.get()"), "{out}");
    assert!(out.contains("_$settextContent(_el1,_$rowBindingNext0)"), "{out}");
    assert!(
        !out.contains("constrowKey=external.value+item.id;constlabel=rowKey+suffix.get();const_el")
    );
}

#[test]
fn builds_fragment_and_conditional_render_item_fallback_paths() {
    let mut fragment_vt = new_vt();
    let fragment_call =
        parse_call("items.map(item => <><span>{item.a}</span><em>{item.b}</em></>)", true);
    let mut fragment_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut fragment_vt,
        &ident("root"),
        &fragment_call,
        &mut fragment_stmts,
    ));
    let fragment_out = compact(&emit_stmts(fragment_stmts));
    assert!(fragment_out.contains("renderBetween(__slot,parent,start,end);"));
    assert!(fragment_out.contains("_$createElement(\"span\",_root)"));
    assert!(fragment_out.contains("_$createElement(\"em\",_root)"));

    let mut conditional_vt = new_vt();
    let conditional_call = parse_call(
        "items.map(item => { const view = item.ok ? <span key={item.id}>{item.label}</span> : renderFallback(item); return view; })",
        true,
    );
    let mut conditional_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut conditional_vt,
        &ident("root"),
        &conditional_call,
        &mut conditional_stmts,
    ));
    let conditional_out = compact(&emit_stmts(conditional_stmts));
    assert!(conditional_out.contains(
        "constview=item.ok?<spankey={item.id}>{item.label}</span>:renderFallback(item);"
    ));
    assert!(conditional_out.contains("const__slot=view;"));
    assert!(conditional_out.contains("renderBetween(__slot,parent,start,end);"));
}

#[test]
fn covers_alias_helper_edge_shapes_and_prefix_bailouts() {
    let pat = parse_arrow_param("({ \"dash-key\": dash, 0: zero, [dynamicKey]: dyn }) => dash");
    let mut alias_exprs = HashMap::new();
    collect_alias_exprs_from_pat(&pat, ident("item").into(), &mut alias_exprs);

    assert_eq!(
        normalize(&emit_expr(alias_exprs.get("dash").expect("dash").clone())),
        normalize("item[\"dash-key\"];"),
    );
    assert_eq!(
        normalize(&emit_expr(alias_exprs.get("zero").expect("zero").clone())),
        normalize("item[0];"),
    );
    assert_eq!(
        normalize(&emit_expr(alias_exprs.get("dyn").expect("dyn").clone())),
        normalize("item[dynamicKey];"),
    );

    let declared_pat = parse_arrow_param("({ id: alias = fallback, ...rest }) => alias");
    let mut declared_names = HashSet::new();
    collect_declared_idents_from_pat(&declared_pat, &mut declared_names);
    assert!(declared_names.contains("alias"));
    assert!(declared_names.contains("rest"));

    let used = HashSet::from(["item".to_string(), "__rue_item1".to_string()]);
    assert_eq!(fresh_ident_avoiding("item", &used).sym.as_ref(), "__rue_item2");

    assert!(
        collect_decl_prefix_and_final_return(&parse_arrow_block("() => { return; }")).is_none()
    );
    assert!(
        collect_inline_alias_exprs_from_prefix(&parse_module_stmts("sideEffect();", false))
            .is_none()
    );
    assert!(
        collect_inline_alias_exprs_from_prefix(&parse_module_stmts("const { id } = item;", false,))
            .is_none()
    );

    assert!(!is_single_root_native_jsx_fragment(&parse_fragment("<>label<span /></>")));

    let wrapped_assign = compact(&emit_expr(wrap_alias_expr_if_needed(parse_expr("a = b", false))));
    assert_eq!(wrapped_assign, "(a=b);");

    let nested_returns = parse_arrow_block(
        "() => { if (ok) { return <li key={a}>A</li>; } else { return <li key={b}>B</li>; } try { noop(); } finally { return <li key={finalKey}>F</li>; } }",
    );
    let mut return_exprs = Vec::new();
    collect_return_exprs_in_block(&nested_returns, &mut return_exprs);
    assert_eq!(return_exprs.len(), 3);
}

#[test]
fn covers_list_helper_false_edges_and_generated_key_scans() {
    let rest_pat = parse_arrow_param("(...rest) => rest");
    let mut declared_names = HashSet::new();
    collect_declared_idents_from_pat(&rest_pat, &mut declared_names);
    assert!(declared_names.contains("rest"));

    let mut default_aliases = HashMap::new();
    collect_alias_exprs_from_pat(
        &parse_arrow_param("(id = fallback) => id"),
        ident("item").into(),
        &mut default_aliases,
    );
    assert_eq!(
        normalize(&emit_expr(default_aliases.get("id").expect("id").clone())),
        normalize("item === undefined ? fallback : item;"),
    );

    let already_wrapped =
        compact(&emit_expr(wrap_alias_expr_if_needed(parse_expr("(a + b)", false))));
    assert_eq!(already_wrapped, "(a+b);");

    let mut no_alias_stmt = parse_module_stmt("const out = { other, rowId: rowId };", false);
    rewrite_alias_exprs_in_stmt(
        &mut no_alias_stmt,
        &HashMap::from([("rowId".to_string(), Expr::Ident(ident("item")))]),
    );
    let no_alias_out = compact(&emit_stmts(vec![no_alias_stmt]));
    assert!(no_alias_out.contains("other"));
    assert!(no_alias_out.contains("rowId:item"));

    assert!(
        collect_declared_idents_in_stmts(&parse_module_stmts("sideEffect();", false)).is_empty()
    );

    let local_prefix = parse_module_stmts(
        "const label = item.value + external.get(arg); const other = item.get();",
        false,
    );
    assert!(!prefix_reads_external_reactive_values(
        &local_prefix,
        &HashSet::from(["item".to_string(), "external".to_string()]),
    ));

    assert!(is_single_root_native_jsx_fragment(&parse_fragment("<><><span /></></>")));

    let Expr::JSXElement(keyless_el) = parse_expr("<li id=\"x\" key />", true) else {
        panic!("expected jsx element");
    };
    assert!(extract_jsx_element_key_expr(&keyless_el).is_none());

    let Expr::Arrow(block_arrow) =
        parse_expr("() => { const rowKey = row.id; return <li key={rowKey} />; }", true)
    else {
        panic!("expected arrow");
    };
    assert!(matches!(extract_arrow_body_expr(&block_arrow.body), Some(Expr::JSXElement(_))));

    let Expr::Arrow(no_return_arrow) = parse_expr("() => { const rowKey = row.id; }", false) else {
        panic!("expected arrow");
    };
    assert!(extract_arrow_body_expr(&no_return_arrow.body).is_none());

    let generated_key_block = parse_arrow_block(
        "() => { const _root = _$createElement('li'); noop(); watchEffect(handler); watchEffect(() => value); watchEffect(() => { noop(); _$setAttribute(other, 'key', String(row.id)); _$setAttribute(_root, dynamicName, row.id); _$setAttribute(_root, 'id', row.id); _$setAttribute(_root, 'key', row.id); }); return _root; }",
    );
    assert_eq!(
        normalize(&emit_expr(
            extract_key_expr_from_root_attr_effect(&generated_key_block.stmts, &ident("_root"))
                .expect("raw generated key"),
        )),
        normalize("row.id;"),
    );
    assert_eq!(
        normalize(&emit_expr(
            extract_returned_root_key_expr_from_block(&generated_key_block.stmts)
                .expect("returned root generated key"),
        )),
        normalize("row.id;"),
    );
}

#[test]
fn rejects_malformed_generated_key_watch_shapes() {
    let root = ident("_root");
    let root_expr = Expr::Ident(root.clone());

    let super_watch = expr_stmt(call_expr(Callee::Super(Super { span: DUMMY_SP }), vec![]));
    assert!(extract_key_expr_from_root_attr_effect(&[super_watch], &root).is_none());

    let expr_body_watch = ident_call_stmt(
        "watchEffect",
        vec![Expr::Arrow(ArrowExpr {
            span: DUMMY_SP,
            ctxt: Default::default(),
            params: Vec::new(),
            body: Box::new(BlockStmtOrExpr::Expr(Box::new(parse_expr("value", false)))),
            is_async: false,
            is_generator: false,
            type_params: None,
            return_type: None,
        })],
    );
    assert!(extract_key_expr_from_root_attr_effect(&[expr_body_watch], &root).is_none());

    let scan_bailouts = watch_effect_block(vec![
        parse_module_stmt("const local = 1;", false),
        expr_stmt(parse_expr("value", false)),
        expr_stmt(call_expr(Callee::Super(Super { span: DUMMY_SP }), vec![])),
        expr_stmt(parse_expr("target.method()", false)),
        ident_call_stmt("_$setAttribute", vec![]),
        ident_call_stmt(
            "_$setAttribute",
            vec![
                parse_expr("makeRoot()", false),
                parse_expr("'key'", false),
                parse_expr("row.id", false),
            ],
        ),
        ident_call_stmt(
            "_$setAttribute",
            vec![
                parse_expr("otherRoot", false),
                parse_expr("'key'", false),
                parse_expr("row.id", false),
            ],
        ),
        ident_call_stmt(
            "_$setAttribute",
            vec![root_expr.clone(), parse_expr("dynamicName", false), parse_expr("row.id", false)],
        ),
        ident_call_stmt(
            "_$setAttribute",
            vec![root_expr.clone(), parse_expr("'id'", false), parse_expr("row.id", false)],
        ),
        ident_call_stmt(
            "_$setAttribute",
            vec![
                root_expr.clone(),
                parse_expr("'key'", false),
                call_expr(Callee::Super(Super { span: DUMMY_SP }), vec![]),
            ],
        ),
    ]);
    assert!(extract_key_expr_from_root_attr_effect(&[scan_bailouts], &root).is_none());

    let non_string_call_key = watch_effect_block(vec![ident_call_stmt(
        "_$setAttribute",
        vec![
            root_expr,
            parse_expr("'key'", false),
            ident_call_expr("formatter", vec![parse_expr("row.id", false)]),
        ],
    )]);
    assert_eq!(
        normalize(&emit_expr(
            extract_key_expr_from_root_attr_effect(&[non_string_call_key], &root)
                .expect("formatter call key"),
        )),
        normalize("formatter(row.id);"),
    );
}

#[test]
fn covers_list_render_key_wrappers_rest_params_and_root_parent() {
    assert_eq!(
        normalize(&emit_expr(
            extract_render_root_key_expr(&parse_expr("ok && <li key={row.id} />", true))
                .expect("logical and key"),
        )),
        normalize("row.id;"),
    );
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "vapor(() => { const _root = _$createElement('li'); watchEffect(() => { _$setAttribute(_root, 'key', String(row.id)); }); return _root; })",
            false,
        ))
        .is_none()
    );
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "_$vaporWithHookId('slot', () => { const _root = _$createElement('li'); watchEffect(() => { _$setAttribute(_root, 'key', row.id); }); return _root; })",
            false,
        ))
        .is_none()
    );
    assert!(extract_render_root_key_expr(&parse_expr("vapor(notArrow)", false)).is_none());
    assert!(extract_render_root_key_expr(&parse_expr("vapor(() => value)", false)).is_none());
    assert!(
        extract_render_root_key_expr(&parse_expr("_$vaporWithHookId('slot', notArrow)", false))
            .is_none()
    );
    assert!(
        extract_render_root_key_expr(&parse_expr("_$vaporWithHookId('slot', () => value)", false))
            .is_none()
    );

    let mut root_vt = new_vt();
    let root_call = parse_call("rows.map(item => <li>{item.name}</li>)", true);
    let mut root_stmts = Vec::new();

    assert!(try_build_list_from_map(&mut root_vt, &ident("_root"), &root_call, &mut root_stmts));
    let root_out = compact(&emit_stmts(root_stmts));
    assert!(root_out.contains("parent:_list1.parentNode"));
    assert!(root_out.contains("directRoot:true"));
    assert!(root_out.contains("_$insertBefore(parent,_root,start);"));
    assert!(!root_out.contains("renderAnchor(__slot,parent,start);"));

    let mut rest_vt = new_vt();
    let rest_call = parse_call("rows.map((...rest) => <li>{rest.length}</li>)", true);
    let mut rest_stmts = Vec::new();

    assert!(try_build_list_from_map(&mut rest_vt, &ident("root"), &rest_call, &mut rest_stmts));
    let rest_out = compact(&emit_stmts(rest_stmts));
    assert!(rest_out.contains("getKey:(item,idx)=>idx"));
    assert!(rest_out.contains("renderItem:(item,parent,start,end,idx)=>"));
}

#[test]
fn covers_map_callback_param_fallbacks() {
    let mut assign_param_vt = new_vt();
    let assign_param_call = parse_call("rows.map((item = fallback) => <li>{item.name}</li>)", true);
    let mut assign_param_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut assign_param_vt,
        &ident("root"),
        &assign_param_call,
        &mut assign_param_stmts,
    ));

    let assign_param_out = compact(&emit_stmts(assign_param_stmts));
    assert!(assign_param_out.contains("getKey:(item,idx)=>idx"));
    assert!(assign_param_out.contains("renderItem:(item,parent,start,end,idx)=>"));
    assert!(assign_param_out.contains("(item===undefined?fallback:item).name"));

    let mut non_arrow_vt = new_vt();
    let non_arrow_call = parse_call("rows.map(renderRow)", false);
    let mut non_arrow_stmts = Vec::new();

    assert!(!try_build_list_from_map(
        &mut non_arrow_vt,
        &ident("root"),
        &non_arrow_call,
        &mut non_arrow_stmts,
    ));
    assert!(non_arrow_stmts.is_empty());

    let mut missing_cb_vt = new_vt();
    let missing_cb_call = parse_call("rows.map()", false);
    let mut missing_cb_stmts = Vec::new();

    assert!(!try_build_list_from_map(
        &mut missing_cb_vt,
        &ident("root"),
        &missing_cb_call,
        &mut missing_cb_stmts,
    ));
    assert!(missing_cb_stmts.is_empty());
}

#[test]
fn covers_remaining_list_helper_ast_edges() {
    let with_stmt = Stmt::With(WithStmt {
        span: DUMMY_SP,
        obj: Box::new(Expr::Ident(ident("ctx"))),
        body: Box::new(Stmt::Return(ReturnStmt {
            span: DUMMY_SP,
            arg: Some(Box::new(parse_expr("<li key={ctx.id} />", true))),
        })),
    });
    let mut return_exprs = Vec::new();
    collect_return_exprs_in_stmt(&with_stmt, &mut return_exprs);
    assert_eq!(return_exprs.len(), 1);

    let mut invalid_declared = HashSet::new();
    collect_declared_idents_from_pat(
        &Pat::Invalid(Invalid { span: DUMMY_SP }),
        &mut invalid_declared,
    );
    assert!(invalid_declared.is_empty());

    let mut invalid_aliases = HashMap::new();
    collect_alias_exprs_from_pat(
        &Pat::Invalid(Invalid { span: DUMMY_SP }),
        Expr::Ident(ident("item")),
        &mut invalid_aliases,
    );
    assert!(invalid_aliases.is_empty());

    let bigint_member = prop_access_expr(
        Expr::Ident(ident("item")),
        &PropName::BigInt(BigInt {
            span: DUMMY_SP,
            value: Box::new(1.into()),
            raw: Some("1n".into()),
        }),
    );
    assert_eq!(compact(&emit_expr(bigint_member)), "item[1n];");

    let super_call = CallExpr {
        span: DUMMY_SP,
        ctxt: Default::default(),
        callee: Callee::Super(Super { span: DUMMY_SP }),
        args: vec![],
        type_args: None,
    };
    assert_eq!(call_callee_ident_name(&super_call), None);
    assert_eq!(call_callee_ident_name(&parse_call("items.map()", false)), None);

    assert!(!is_single_root_native_jsx_fragment(&parse_fragment("<>{value}</>")));

    let repeated_external_reads = parse_module_stmts(
        "const label = external.value + other.value; external.get(); other.get();",
        false,
    );
    assert!(prefix_reads_external_reactive_values(
        &repeated_external_reads,
        &HashSet::from(["item".to_string()]),
    ));

    let repeated_external_gets =
        parse_module_stmts("const label = external.get() + other.get();", false);
    assert!(prefix_reads_external_reactive_values(
        &repeated_external_gets,
        &HashSet::from(["item".to_string()]),
    ));

    let computed_member_prefix = parse_module_stmts("const label = external[dynamicKey];", false);
    assert!(!prefix_reads_external_reactive_values(
        &computed_member_prefix,
        &HashSet::from(["item".to_string()]),
    ));

    let get_with_arg_prefix = parse_module_stmts("const label = external.get(item.id);", false);
    assert!(!prefix_reads_external_reactive_values(
        &get_with_arg_prefix,
        &HashSet::from(["item".to_string()]),
    ));

    let non_get_member_call = parse_module_stmts("const label = external.set();", false);
    assert!(!prefix_reads_external_reactive_values(
        &non_get_member_call,
        &HashSet::from(["item".to_string()]),
    ));

    let non_ident_member_call = parse_module_stmts("const label = factory().get();", false);
    assert!(!prefix_reads_external_reactive_values(
        &non_ident_member_call,
        &HashSet::from(["item".to_string()]),
    ));

    let plain_call_prefix = parse_module_stmts("const label = external();", false);
    assert!(!prefix_reads_external_reactive_values(
        &plain_call_prefix,
        &HashSet::from(["item".to_string()]),
    ));

    let Expr::JSXElement(namespaced_key_el) = parse_expr("<li ns:key={row.id} {...props} />", true)
    else {
        panic!("expected jsx element");
    };
    assert!(extract_jsx_element_key_expr(&namespaced_key_el).is_none());

    let mut empty_expr_key_el = namespaced_key_el.clone();
    empty_expr_key_el.opening.attrs = vec![JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(ident_name("key")),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
            span: DUMMY_SP,
            expr: JSXExpr::JSXEmptyExpr(JSXEmptyExpr { span: DUMMY_SP }),
        })),
    })];
    assert!(extract_jsx_element_key_expr(&empty_expr_key_el).is_none());

    let string_multi_arg_key = parse_arrow_block(
        "() => { const _root = _$createElement('li'); watchEffect(() => { _$setAttribute(_root, 'key', String(row.id, fallback)); }); return _root; }",
    );
    assert_eq!(
        normalize(&emit_expr(
            extract_key_expr_from_root_attr_effect(&string_multi_arg_key.stmts, &ident("_root"))
                .expect("multi arg string key"),
        )),
        normalize("String(row.id, fallback);"),
    );

    let member_callee_key = parse_arrow_block(
        "() => { const _root = _$createElement('li'); watchEffect(() => { _$setAttribute(_root, 'key', formatter.toString(row.id)); }); return _root; }",
    );
    assert!(
        extract_key_expr_from_root_attr_effect(&member_callee_key.stmts, &ident("_root")).is_none()
    );

    let loose_key_block = parse_arrow_block(
        "() => { const _root = _$createElement('li'); value; watchEffect(() => { _$setAttribute(_root, 'key', row.id); }); return _root; noop(); }",
    );
    assert_eq!(
        normalize(&emit_expr(
            extract_returned_root_key_expr_from_block(&loose_key_block.stmts)
                .expect("loose generated key"),
        )),
        normalize("row.id;"),
    );

    assert!(extract_render_root_key_expr(&parse_expr("vapor(() => <li />)", true)).is_none());
    assert!(
        extract_render_root_key_expr(&parse_expr("useMemo(() => { return <li />; })", true))
            .is_none()
    );
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "_$vaporWithHookId('slot', () => { return <li />; })",
            true,
        ))
        .is_none()
    );
}

#[test]
fn builds_get_key_block_for_local_prefix_dependencies() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(item => { const rowKey = item.id; const label = item.name; return <li key={rowKey}>{label}</li>; })",
        true,
    );
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(
        out.contains("getKey:(item,idx)=>{constrowKey=item.id;constlabel=item.name;returnrowKey;}")
    );
    assert!(out.contains("constrowKey=item.id;constlabel=item.name;"));
    assert!(out.contains("renderAnchor(__slot,parent,start);"));
}

#[test]
fn avoids_internal_param_collisions_for_destructured_items() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(({ item, idx, parent, start, end }) => <li key={item}>{idx}:{parent}:{start}:{end}</li>)",
        true,
    );
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("getKey:(__rue_item1,__rue_idx1)=>__rue_item1.item"));
    assert!(
        out.contains("renderItem:(__rue_item1,__rue_parent1,__rue_start1,__rue_end1,__rue_idx1)=>")
    );
    assert!(out.contains("__rue_item1.idx"));
    assert!(out.contains("__rue_item1.parent"));
    assert!(out.contains("__rue_item1.start"));
    assert!(out.contains("__rue_item1.end"));
}

#[test]
fn builds_builtin_fragment_component_single_anchor_path() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(item => <Fragment key={item.id}><span>{item.name}</span></Fragment>)",
        true,
    );
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("getKey:(item,idx)=>item.id"));
    assert!(out.contains("renderAnchor(__slot,parent,start);"));
    assert!(out.contains("singleRoot:true"));
    assert!(out.contains("trackIndex:false"));
}

#[test]
fn builds_render_between_for_non_ident_native_list_roots() {
    let mut vt = new_vt();
    let call = parse_call("rows.map(item => <svg:path key={item.id}>{item.name}</svg:path>)", true);
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("getKey:(item,idx)=>item.id"));
    assert!(out.contains("_$createElement(\"div\",_root)"));
    assert!(out.contains("renderBetween(__slot,parent,start,end);"));
    assert!(!out.contains("singleRoot:true"));
}

#[test]
fn hardens_direct_native_key_scan_and_wrapper_key_misses() {
    let mut vt = new_vt();
    let keyed_call = parse_call("rows.map(item => <li key={item.id}>{item.name}</li>)", true);
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &keyed_call, &mut stmts));

    let keyed_out = compact(&emit_stmts(stmts));
    assert!(keyed_out.contains("getKey:(item,idx)=>item.id"));
    assert!(keyed_out.contains("singleRoot:true"));
    assert!(keyed_out.contains("trackIndex:false"));

    let mut malformed_effects = parse_module_stmts(
        "watch.effect(() => { _root.setAttribute('key', item.id); });\nwatchEffect(() => _root.setAttribute('key', item.id));",
        true,
    );
    malformed_effects.push(Stmt::Empty(EmptyStmt { span: DUMMY_SP }));
    assert!(extract_key_expr_from_root_attr_effect(&malformed_effects, &ident("_root")).is_none());

    assert!(extract_render_root_key_expr(&parse_expr("useMemo(() => <li />)", true)).is_none());
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "_$vaporWithHookId('hook', () => { return <li />; })",
            true
        ),)
        .is_none()
    );
}

#[test]
fn hardens_rest_param_list_callback_fallbacks() {
    let mut vt = new_vt();
    let rest_call = parse_call("rows.map((...items) => <li key={items[0].id} />)", true);
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &rest_call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("getKey:(item,idx)=>items[0].id"));
    assert!(out.contains("renderItem:(item,parent,start,end,idx)=>"));
}

#[test]
fn hardens_list_prefix_alias_and_key_negative_edges() {
    let empty_block = parse_arrow_block("() => {}");
    assert!(collect_decl_prefix_and_final_return(&empty_block).is_none());

    let sparse_array_pat = parse_arrow_param("([first,, third]) => first + third");
    let mut alias_exprs = HashMap::new();
    collect_alias_exprs_from_pat(&sparse_array_pat, ident("item").into(), &mut alias_exprs);
    assert!(alias_exprs.contains_key("first"));
    assert!(alias_exprs.contains_key("third"));
    assert_eq!(alias_exprs.len(), 2);

    let local_get_prefix = parse_arrow_block(
        "() => { const local = source; const a = local.get(); const b = remote.get(item.id); const c = remote.peek(); return a; }",
    );
    let local_names = collect_declared_idents_in_stmts(&local_get_prefix.stmts);
    assert!(!prefix_reads_external_reactive_values(&local_get_prefix.stmts[..3], &local_names,));
    assert!(!prefix_reads_external_reactive_values(&local_get_prefix.stmts[..4], &local_names,));

    let no_init = parse_arrow_block("() => { let missing; return missing; }");
    assert!(collect_inline_alias_exprs_from_prefix(&no_init.stmts[..1]).is_none());

    assert!(extract_render_root_key_expr(&parse_expr("useMemo()", true)).is_none());
    assert!(extract_render_root_key_expr(&parse_expr("useMemo(helper)", true)).is_none());
    assert!(extract_render_root_key_expr(&parse_expr("_$vaporWithHookId('slot')", true)).is_none());
    assert!(
        extract_render_root_key_expr(&parse_expr("_$vaporWithHookId('slot', helper)", true))
            .is_none()
    );

    assert!(
        extract_render_root_key_expr(&parse_expr("vapor(() => { return <li />; })", true))
            .is_none()
    );
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "_$vaporWithHookId('slot', () => { return <li />; })",
            true
        ),)
        .is_none()
    );

    let fragment = parse_fragment("<> text {value}{...items}</>");
    let meaningful = collect_meaningful_fragment_children(&fragment.children);
    assert_eq!(meaningful.len(), 3);
}

#[test]
fn hardens_list_callback_param_and_block_fallback_edges() {
    let mut assign_param_vt = new_vt();
    let assign_param_call = parse_call(
        "rows.map((item = fallback, idx = fallbackIndex) => <li key={idx}>{item.name}</li>)",
        true,
    );
    let mut assign_param_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut assign_param_vt,
        &ident("root"),
        &assign_param_call,
        &mut assign_param_stmts,
    ));
    let assign_param_out = compact(&emit_stmts(assign_param_stmts));
    assert!(assign_param_out.contains("getKey:(item,idx)=>idx"));
    assert!(assign_param_out.contains("renderItem:(item,parent,start,end,idx)=>"));

    let mut conditional_vt = new_vt();
    let conditional_call = parse_call(
        "rows.map((item) => item.ok ? <Card key={item.id} /> : <span key={item.fallback}>F</span>)",
        true,
    );
    let mut conditional_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut conditional_vt,
        &ident("root"),
        &conditional_call,
        &mut conditional_stmts,
    ));
    let conditional_out = compact(&emit_stmts(conditional_stmts));
    assert!(conditional_out.contains("renderBetween(__slot,parent,start,end);"));
    assert!(conditional_out.contains("item.ok?"));
    assert!(conditional_out.contains("item.id"));
    assert!(!conditional_out.contains("item.fallback"));
}

#[test]
fn hardens_external_get_prefix_and_complex_block_key_paths() {
    let external_get_prefix =
        parse_arrow_block("() => { const value = remote.get(); return value; }");
    let local_names = collect_declared_idents_in_stmts(&external_get_prefix.stmts);
    assert!(prefix_reads_external_reactive_values(&external_get_prefix.stmts[..1], &local_names,));

    let computed_get_prefix =
        parse_arrow_block("() => { const value = remote['get'](); return value; }");
    let computed_locals = collect_declared_idents_in_stmts(&computed_get_prefix.stmts);
    assert!(!prefix_reads_external_reactive_values(
        &computed_get_prefix.stmts[..1],
        &computed_locals,
    ));

    let memo_cond_key = extract_render_root_key_expr(&parse_expr(
        "useMemo(() => { return ok ? <li key={row.a} /> : <li key={row.b} />; })",
        true,
    ))
    .expect("memo cond key");
    assert_eq!(compact(&emit_expr(memo_cond_key)), "row.a;");

    let hook_cond_key = extract_render_root_key_expr(&parse_expr(
        "_$vaporWithHookId('slot', () => ok && <li key={row.id} />)",
        true,
    ))
    .expect("hook cond key");
    assert_eq!(compact(&emit_expr(hook_cond_key)), "row.id;");

    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(({ id, label }) => { if (id) { return <li key={id}>{label}</li>; } return <li key={label}>{label}</li>; })",
        true,
    );
    let mut stmts = Vec::new();
    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("const__slot=(()=>{"));
    assert!(out.contains("key={item.id}"));
    assert!(out.contains("key={item.label}"));
}

#[test]
fn hardens_list_non_ident_params_and_keyless_wrapper_edges() {
    let mut non_ident_idx_vt = new_vt();
    let non_ident_idx_call =
        parse_call("rows.map((item, { index }) => <li key={item.id}>{index}</li>)", true);
    let mut non_ident_idx_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut non_ident_idx_vt,
        &ident("root"),
        &non_ident_idx_call,
        &mut non_ident_idx_stmts,
    ));
    let non_ident_idx_out = compact(&emit_stmts(non_ident_idx_stmts));
    assert!(non_ident_idx_out.contains("getKey:(item,idx)=>item.id"));
    assert!(non_ident_idx_out.contains("renderItem:(item,parent,start,end,idx)=>"));

    assert!(extract_render_root_key_expr(&parse_expr("useMemo(() => value)", true)).is_none());
    assert!(
        extract_render_root_key_expr(&parse_expr("_$vaporWithHookId('slot', () => value)", true,))
            .is_none()
    );
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "useMemo(() => { if (ok) return value; return <li />; })",
            true,
        ))
        .is_none()
    );
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "_$vaporWithHookId('slot', () => { if (ok) return value; return <li />; })",
            true,
        ))
        .is_none()
    );

    let fragment = parse_fragment("<> \n\t <span /> text </>");
    let meaningful = collect_meaningful_fragment_children(&fragment.children);
    assert_eq!(meaningful.len(), 2);
}

#[test]
fn hardens_assignment_params_dynamic_root_keys_and_reactive_prefix_negatives() {
    let mut assignment_vt = new_vt();
    let assignment_call =
        parse_call("rows.map((item = fallback, index) => <li key={item.id}>{index}</li>)", true);
    let mut assignment_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut assignment_vt,
        &ident("root"),
        &assignment_call,
        &mut assignment_stmts,
    ));
    let assignment_out = compact(&emit_stmts(assignment_stmts));
    assert!(assignment_out.contains("renderItem:(item,parent,start,end,index)=>"));
    assert!(assignment_out.contains("getKey:(item,index)=>"));

    let mut dynamic_key_vt = new_vt();
    let dynamic_key_call = parse_call(
        "rows.map((item) => { const rowKey = item.id; return <li key={rowKey}>{item.name}</li>; })",
        true,
    );
    let mut dynamic_key_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut dynamic_key_vt,
        &ident("root"),
        &dynamic_key_call,
        &mut dynamic_key_stmts,
    ));
    let dynamic_key_out = compact(&emit_stmts(dynamic_key_stmts));
    assert!(dynamic_key_out.contains("getKey:(item,idx)=>{constrowKey=item.id;returnrowKey;"));
    assert!(dynamic_key_out.contains("constrowKey=item.id;"));

    let get_with_arg_prefix =
        parse_arrow_block("() => { const value = remote.get(kind); return value; }");
    let get_with_arg_locals = collect_declared_idents_in_stmts(&get_with_arg_prefix.stmts);
    assert!(!prefix_reads_external_reactive_values(
        &get_with_arg_prefix.stmts[..1],
        &get_with_arg_locals,
    ));

    let local_value_prefix = parse_arrow_block(
        "() => { const remote = ref(0); const value = remote.value; return value; }",
    );
    let local_value_names = collect_declared_idents_in_stmts(&local_value_prefix.stmts);
    assert!(!prefix_reads_external_reactive_values(
        &local_value_prefix.stmts[..2],
        &local_value_names,
    ));

    assert!(
        extract_render_root_key_expr(&parse_expr("vapor(() => <li key={id} />)", true)).is_some()
    );
    assert!(extract_render_root_key_expr(&parse_expr("vapor(() => <li />)", true)).is_none());
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "_$vaporWithHookId('slot', () => <li key={id} />)",
            true,
        ))
        .is_some()
    );
    assert!(
        extract_render_root_key_expr(&parse_expr("_$vaporWithHookId('slot', () => <li />)", true,))
            .is_none()
    );
}

#[test]
fn hardens_more_map_rejection_and_wrapped_key_extraction_edges() {
    for src in [
        "rows['map'](item => <li key={item.id} />)",
        "rows.map(item => <li key={item.id} />, thisArg)",
        "rows.map(renderItem)",
    ] {
        let mut vt = new_vt();
        let call = parse_call(src, true);
        let mut stmts = Vec::new();
        assert!(!try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts), "{src}");
        assert!(stmts.is_empty(), "{src}");
    }

    let logical_or_key =
        extract_render_root_key_expr(&parse_expr("ok || <li key={row.id} />", true))
            .expect("logical or key");
    assert_eq!(compact(&emit_expr(logical_or_key)), "row.id;");

    let vapor_alt_key = extract_render_root_key_expr(&parse_expr(
        "vapor(() => ok ? null : <li key={row.alt} />)",
        true,
    ))
    .expect("vapor alt key");
    assert_eq!(compact(&emit_expr(vapor_alt_key)), "row.alt;");

    let hook_alt_key = extract_render_root_key_expr(&parse_expr(
        "_$vaporWithHookId('row', () => ok ? <li /> : <li key={fallback.id} />)",
        true,
    ))
    .expect("hook alt key");
    assert_eq!(compact(&emit_expr(hook_alt_key)), "fallback.id;");

    let memo_block_key = extract_render_root_key_expr(&parse_expr(
        "useMemo(() => { const rowKey = row.id; return <li key={rowKey} />; }, [])",
        true,
    ))
    .expect("memo block key");
    assert_eq!(compact(&emit_expr(memo_block_key)), "rowKey;");
}

#[test]
fn hardens_nested_prefix_reactive_scans_and_missing_wrapped_keys() {
    let nested_get_prefix =
        parse_arrow_block("() => { remote.set(remote.get()); const value = 1; return value; }");
    let nested_get_locals = collect_declared_idents_in_stmts(&nested_get_prefix.stmts);
    assert!(prefix_reads_external_reactive_values(
        &nested_get_prefix.stmts[..1],
        &nested_get_locals,
    ));

    let super_call_prefix =
        parse_arrow_block("() => { super.get(); const value = 1; return value; }");
    let super_call_locals = collect_declared_idents_in_stmts(&super_call_prefix.stmts);
    assert!(!prefix_reads_external_reactive_values(
        &super_call_prefix.stmts[..1],
        &super_call_locals,
    ));

    for src in [
        "useMemo(() => <li />, [])",
        "useMemo(factory, [])",
        "_$vaporWithHookId('row', () => <li />)",
        "_$vaporWithHookId('row', runner)",
        "vapor(() => { const rowKey = row.id; return <li />; })",
    ] {
        assert!(extract_render_root_key_expr(&parse_expr(src, true)).is_none(), "{src}");
    }

    let mut parenthesized_callee_vt = new_vt();
    let parenthesized_callee_call = parse_call("(rows.map)(item => <li key={item.id} />)", true);
    let mut parenthesized_callee_stmts = Vec::new();
    assert!(!try_build_list_from_map(
        &mut parenthesized_callee_vt,
        &ident("root"),
        &parenthesized_callee_call,
        &mut parenthesized_callee_stmts,
    ));
    assert!(parenthesized_callee_stmts.is_empty());
}

#[test]
fn hardens_positive_generated_key_scans_and_returned_root_blocks() {
    let stmts = parse_module_stmts(
        r#"
watchEffect(() => {
  _$setAttribute(root, "key", String(row.id));
});
return root;
"#,
        true,
    );

    let key_from_effect =
        extract_key_expr_from_root_attr_effect(&stmts[..1], &ident("root")).expect("effect key");
    assert_eq!(compact(&emit_expr(key_from_effect)), "row.id;");

    let key_from_returned_root =
        extract_returned_root_key_expr_from_block(&stmts).expect("returned root key");
    assert_eq!(compact(&emit_expr(key_from_returned_root)), "row.id;");

    let raw_value_stmts = parse_module_stmts(
        r#"
watchEffect(() => {
  _$setAttribute(root, "key", row.fallback);
});
return root;
"#,
        true,
    );
    let raw_key =
        extract_returned_root_key_expr_from_block(&raw_value_stmts).expect("raw returned key");
    assert_eq!(compact(&emit_expr(raw_key)), "row.fallback;");
}

#[test]
fn hardens_direct_native_map_with_prefixes_fragments_and_alias_keys() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(({ id, meta: { title } }, index) => { const rowKey = `${id}-${index}`; const label = title.toUpperCase(); return <li key={rowKey}>{label}</li>; })",
        true,
    );
    let mut stmts = Vec::new();
    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("getKey:(item,index)=>{"));
    assert!(out.contains("constrowKey=`${item.id}-${index}`;"), "{out}");
    assert!(out.contains("constlabel=item.meta.title.toUpperCase();"), "{out}");
    assert!(out.contains("returnrowKey;"));
    assert!(out.contains("renderAnchor(__slot,parent,start);"));

    let mut fragment_vt = new_vt();
    let fragment_call =
        parse_call("rows.map((row) => <><li key={row.id}>{row.label}</li></>)", true);
    let mut fragment_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut fragment_vt,
        &ident("root"),
        &fragment_call,
        &mut fragment_stmts,
    ));
    let fragment_out = compact(&emit_stmts(fragment_stmts));
    assert!(fragment_out.contains("_$createDocumentFragment"));
    assert!(fragment_out.contains("getKey:(row,idx)=>idx"), "{fragment_out}");
    assert!(!fragment_out.contains(",\"key\","));
    assert!(fragment_out.contains("renderAnchor(__slot,parent,start);"));
}

#[test]
fn hardens_array_destructured_list_aliases_and_index_key_fallbacks() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(([id, label], index) => { const text = label.toUpperCase(); return <li key={id}>{index}:{text}</li>; })",
        true,
    );
    let mut stmts = Vec::new();
    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("getKey:(item,index)=>item[0]"), "{out}");
    assert!(out.contains("consttext=item[1].toUpperCase();"), "{out}");
    assert!(!out.contains(",\"key\","), "{out}");
    assert!(!out.contains("directRoot:true"), "{out}");
    assert!(out.contains("renderAnchor(__slot,parent,start);"), "{out}");

    let mut nested_fragment_vt = new_vt();
    let nested_fragment_call =
        parse_call("rows.map((row) => <><><li key={row.id}>{row.label}</li></></>)", true);
    let mut nested_fragment_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut nested_fragment_vt,
        &ident("root"),
        &nested_fragment_call,
        &mut nested_fragment_stmts,
    ));
    let nested_fragment_out = compact(&emit_stmts(nested_fragment_stmts));
    assert!(nested_fragment_out.contains("_$createDocumentFragment"));
    assert!(nested_fragment_out.contains("getKey:(row,idx)=>idx"));
    assert!(!nested_fragment_out.contains(",\"key\","));
}

#[test]
fn hardens_generated_key_scan_order_and_wrong_effect_shapes() {
    let stmts = parse_module_stmts(
        r#"
watchEffect(() => {
  _$setAttribute(other, "key", String(row.wrong));
});
watchEffect(() => {
  _$setAttribute(root, "class", String(row.cls));
});
watchEffect(() => {
  _$setAttribute(root, "key", String(row.id));
});
return root;
"#,
        true,
    );
    let key = extract_key_expr_from_root_attr_effect(&stmts[..3], &ident("root"))
        .expect("find later matching key effect");
    assert_eq!(compact(&emit_expr(key)), "row.id;");

    let returned_key = extract_returned_root_key_expr_from_block(&stmts).expect("returned key");
    assert_eq!(compact(&emit_expr(returned_key)), "row.id;");

    let no_return = parse_module_stmts(
        r#"
watchEffect(() => {
  _$setAttribute(root, "key", String(row.id));
});
root;
"#,
        true,
    );
    assert!(extract_returned_root_key_expr_from_block(&no_return).is_none());
}

#[test]
fn hardens_inline_alias_chains_and_optional_reactive_prefix_edges() {
    let prefix = parse_arrow_block(
        "() => { const a = item.id; const b = a + suffix; const c = b || item.fallback; return c; }",
    );
    let aliases = collect_inline_alias_exprs_from_prefix(&prefix.stmts[..3]).expect("aliases");
    assert_eq!(compact(&emit_expr(aliases.get("a").expect("a").clone())), "item.id;");
    assert_eq!(compact(&emit_expr(aliases.get("b").expect("b").clone())), "item.id+suffix;");
    assert_eq!(
        compact(&emit_expr(aliases.get("c").expect("c").clone())),
        "(item.id+suffix)||item.fallback;"
    );

    let optional_get_prefix =
        parse_arrow_block("() => { const value = remote?.get(); return value; }");
    let optional_locals = collect_declared_idents_in_stmts(&optional_get_prefix.stmts);
    assert!(!prefix_reads_external_reactive_values(
        &optional_get_prefix.stmts[..1],
        &optional_locals,
    ));

    let optional_value_prefix =
        parse_arrow_block("() => { const value = remote?.value; return value; }");
    let optional_value_locals = collect_declared_idents_in_stmts(&optional_value_prefix.stmts);
    assert!(prefix_reads_external_reactive_values(
        &optional_value_prefix.stmts[..1],
        &optional_value_locals,
    ));
}

#[test]
fn hardens_computed_numeric_and_sparse_array_alias_rewrites() {
    let pat = parse_arrow_param(
        "({ [kind]: value, 0: first, nested: [head, , tail], ...rest }) => value",
    );
    let mut alias_exprs = HashMap::new();
    collect_alias_exprs_from_pat(&pat, ident("item").into(), &mut alias_exprs);

    assert_eq!(
        compact(&emit_expr(alias_exprs.get("value").expect("value").clone())),
        "item[kind];"
    );
    assert_eq!(compact(&emit_expr(alias_exprs.get("first").expect("first").clone())), "item[0];");
    assert_eq!(
        compact(&emit_expr(alias_exprs.get("head").expect("head").clone())),
        "item.nested[0];"
    );
    assert_eq!(
        compact(&emit_expr(alias_exprs.get("tail").expect("tail").clone())),
        "item.nested[2];"
    );
    assert_eq!(compact(&emit_expr(alias_exprs.get("rest").expect("rest").clone())), "item;");

    let mut expr = parse_expr("value ?? first ?? head ?? tail ?? rest.fallback", false);
    rewrite_alias_exprs_in_expr(&mut expr, &alias_exprs);
    let out = compact(&emit_expr(expr));
    assert!(out.contains("item[kind]??item[0]"));
    assert!(out.contains("item.nested[0]"));
    assert!(out.contains("item.nested[2]"));
    assert!(out.contains("item.fallback"));
}

#[test]
fn hardens_return_collection_across_loop_and_label_shapes() {
    let block = parse_arrow_block(
        "() => { label: for (const child of item.children) { if (child.hot) return <li key={child.id} />; } while (item.more) { return <li key={item.more} />; } do { return <li key={item.once} />; } while (again); for (const key in item.map) { return <li key={key} />; } try { return <li key={item.tryKey} />; } catch (err) { return <li key={err.id} />; } finally { return <li key={item.done} />; } }",
    );
    let mut returns = Vec::new();
    collect_return_exprs_in_block(&block, &mut returns);

    assert_eq!(returns.len(), 7);
    let rendered = compact(&returns.into_iter().map(emit_expr).collect::<Vec<_>>().join(""));
    assert!(rendered.contains("child.id"));
    assert!(rendered.contains("item.more"));
    assert!(rendered.contains("item.once"));
    assert!(rendered.contains("key"));
    assert!(rendered.contains("item.tryKey"));
    assert!(rendered.contains("err.id"));
    assert!(rendered.contains("item.done"));
}

#[test]
fn hardens_keyed_list_computed_alias_keys_and_external_prefix_blocks() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(({ [kind]: id, title }, index) => { const rowKey = id ?? external.value; const label = title || String(index); return <li key={rowKey}>{label}</li>; })",
        true,
    );
    let mut stmts = Vec::new();
    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("getKey:(item,index)=>item[kind]??external.value"), "{out}");
    assert!(!out.contains(",\"key\","), "{out}");
    assert!(out.contains("item.title||String(index)"), "{out}");
    assert!(out.contains("directRoot:true"), "{out}");
    assert!(out.contains("_$insertBefore(parent,_root,start);"), "{out}");
    assert!(out.contains("watchEffect(()=>{"), "{out}");
    assert!(!out.contains("renderAnchor(__slot,parent,start);"), "{out}");

    let non_alias_prefix = parse_arrow_block(
        "() => { const rowKey = compute(item); sideEffect(rowKey); return rowKey; }",
    );
    assert!(collect_inline_alias_exprs_from_prefix(&non_alias_prefix.stmts[..2]).is_none());
}

#[test]
fn hardens_external_reactive_get_and_wrapped_key_empty_body_edges() {
    assert!(!prefix_reads_external_reactive_values(&[], &HashSet::new()));

    let get_with_arg = parse_arrow_block("() => { const value = remote.get(id); return value; }");
    let get_with_arg_locals = collect_declared_idents_in_stmts(&get_with_arg.stmts);
    assert!(
        !prefix_reads_external_reactive_values(&get_with_arg.stmts[..1], &get_with_arg_locals,)
    );

    let get_without_arg = parse_arrow_block("() => { const value = remote.get(); return value; }");
    let get_without_arg_locals = collect_declared_idents_in_stmts(&get_without_arg.stmts);
    assert!(prefix_reads_external_reactive_values(
        &get_without_arg.stmts[..1],
        &get_without_arg_locals,
    ));

    assert!(
        extract_render_root_key_expr(&parse_expr("useMemo(() => row.render, [])", true)).is_none()
    );
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "_$vaporWithHookId('memo:0', () => row.render)",
            true,
        ))
        .is_none()
    );
}

#[test]
fn hardens_list_map_direct_render_without_generated_key_scan_match() {
    let mut vt = new_vt();
    let call = parse_call("rows.map(row => <li>{row.label}</li>)", true);
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("_$vaporKeyedList"), "{out}");
    assert!(out.contains("getKey:(row,idx)=>idx"), "{out}");
    assert!(out.contains("_$createElement(\"li\",_root)"), "{out}");
    assert!(!out.contains("_$setAttribute(_el1,\"key\""), "{out}");
}

#[test]
fn hardens_block_list_fallback_alias_rewrites_for_non_final_returns() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(({ id, label }) => { if (!id) return <span key={label}>{label}</span>; return <span key={id}>{label}</span>; })",
        true,
    );
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("getKey:(item,idx)=>item.id"), "{out}");
    assert!(out.contains("if(!item.id)return<spankey={item.label}>{item.label}</span>;"), "{out}");
    assert!(out.contains("return<spankey={item.id}>{item.label}</span>;"), "{out}");
}

#[test]
fn hardens_block_direct_native_map_generated_key_scan_and_prefixes() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(row => { const label = row.label; return <li key={row.id}>{label}</li>; })",
        true,
    );
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("_$vaporKeyedList"), "{out}");
    assert!(out.contains("getKey:(row,idx)=>row.id"), "{out}");
    assert!(out.contains("constlabel=row.label;"), "{out}");
    assert!(out.contains("_$createElement(\"li\",_root)"), "{out}");
    assert!(!out.contains(",\"key\","), "{out}");
}

#[test]
fn hardens_wrapped_key_extraction_block_bodies_and_missing_runners() {
    let memo_key = extract_render_root_key_expr(&parse_expr(
        "useMemo(() => { const label = row.label; return <li key={row.id}>{label}</li>; }, [row])",
        true,
    ))
    .expect("memo block key");
    assert_eq!(compact(&emit_expr(memo_key)), "row.id;");

    let hook_key = extract_render_root_key_expr(&parse_expr(
        "_$vaporWithHookId('memo:0', () => { if (row.hidden) return null; return <li key={row.id} />; })",
        true,
    ))
    .expect("hook block key");
    assert_eq!(compact(&emit_expr(hook_key)), "row.id;");

    assert!(
        extract_render_root_key_expr(&parse_expr("_$vaporWithHookId('memo:0')", true)).is_none()
    );
    assert!(extract_render_root_key_expr(&parse_expr("useMemo(notAnArrow, [])", true)).is_none());
}

#[test]
fn hardens_list_wrapped_fragment_keys_and_nested_alias_fallbacks() {
    let fragment_key = extract_render_root_key_expr(&parse_expr(
        "condition ? <Fragment key={row.id}><span>{row.label}</span></Fragment> : null",
        true,
    ))
    .expect("conditional fragment key");
    assert_eq!(compact(&emit_expr(fragment_key)), "row.id;");

    assert!(
        extract_render_root_key_expr(&parse_expr(
            "fallback ?? <Namespace.Row key={row.altId}>{row.label}</Namespace.Row>",
            true,
        ))
        .is_none()
    );

    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(({ meta: { id, title = fallback }, flags: [first], ...rest }, index) => { const rowKey = id || rest.key || index; const text = title ?? first; return <Row key={rowKey} data-rest={rest.kind}>{text}</Row>; })",
        true,
    );
    let mut stmts = Vec::new();
    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("_$vaporKeyedList"), "{out}");
    assert!(out.contains("getKey:(item,index)=>{"), "{out}");
    assert!(out.contains("constrowKey=item.meta.id||item.key||index;"), "{out}");
    assert!(out.contains("returnrowKey;"), "{out}");
    assert!(out.contains("item.meta.title??item.flags[0]"), "{out}");
    assert!(out.contains("_$createComponent(Row"), "{out}");
}

#[test]
fn hardens_generated_key_scan_parent_and_nested_statement_edges() {
    let stmts = parse_module_stmts(
        r#"
if (ready) {
  watchEffect(() => {
    _$setAttribute(root, "key", String(row.nested));
  });
}
watchEffect(() => {
  _$setAttribute(root, "key", String(row.direct));
});
return root;
"#,
        true,
    );

    let key = extract_returned_root_key_expr_from_block(&stmts).expect("direct key");
    assert_eq!(compact(&emit_expr(key)), "row.direct;");

    let wrong_root = extract_key_expr_from_root_attr_effect(&stmts[..2], &ident("other"));
    assert!(wrong_root.is_none());

    let block_return = parse_module_stmts(
        r#"
watchEffect(() => {
  _$setAttribute(root, "key", String(row.id));
});
return other;
"#,
        true,
    );
    assert!(extract_returned_root_key_expr_from_block(&block_return).is_none());
}

#[test]
fn hardens_list_assignment_param_fallback_alias_and_wrapped_block_key_edges() {
    let mut vt = new_vt();
    let call = parse_call("rows.map((row = fallback) => <li key={row.id}>{row.label}</li>)", true);
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let assignment_out = compact(&emit_stmts(stmts));

    assert!(assignment_out.contains("_$vaporKeyedList"), "{assignment_out}");
    assert!(
        assignment_out.contains("getKey:(item,idx)=>(item===undefined?fallback:item).id"),
        "{assignment_out}"
    );
    assert!(
        assignment_out.contains("((item===undefined?fallback:item).label)"),
        "{assignment_out}"
    );

    let mut fallback_vt = new_vt();
    let fallback_call = parse_call(
        "rows.map(({ id, title }) => { if (id) return <Row key={id}>{title}</Row>; return <Fallback key={title} />; })",
        true,
    );
    let mut fallback_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut fallback_vt,
        &ident("root"),
        &fallback_call,
        &mut fallback_stmts
    ));
    let fallback_out = compact(&emit_stmts(fallback_stmts));

    assert!(fallback_out.contains("const__slot=(()=>{"), "{fallback_out}");
    assert!(
        fallback_out.contains("if(item.id)return<Rowkey={item.id}>{item.title}</Row>;"),
        "{fallback_out}"
    );
    assert!(fallback_out.contains("return<Fallbackkey={item.title}/>;"), "{fallback_out}");

    assert!(
        extract_render_root_key_expr(&parse_expr(
            "vapor(() => { watchEffect(() => { _$setAttribute(root, \"key\", String(row.fromBlock)); }); return root; })",
            false,
        ))
        .is_none()
    );

    assert!(
        extract_render_root_key_expr(&parse_expr(
            "_$vaporWithHookId('memo:1', () => { watchEffect(() => { _$setAttribute(root, \"key\", String(row.fromHook)); }); return root; })",
            false,
        ))
        .is_none()
    );
}

#[test]
fn hardens_defaulted_destructured_params_native_key_scan_and_empty_block_slots() {
    let mut defaulted_vt = new_vt();
    let defaulted_call = parse_call(
        "rows.map(({ id, label } = fallback, index) => <li key={id}>{label}:{index}</li>)",
        true,
    );
    let mut defaulted_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut defaulted_vt,
        &ident("root"),
        &defaulted_call,
        &mut defaulted_stmts
    ));
    let defaulted_out = compact(&emit_stmts(defaulted_stmts));

    assert!(defaulted_out.contains("_$vaporKeyedList"), "{defaulted_out}");
    assert!(
        defaulted_out.contains("getKey:(item,index)=>(item===undefined?fallback:item).id"),
        "{defaulted_out}"
    );
    assert!(defaulted_out.contains("((item===undefined?fallback:item).label)"), "{defaulted_out}");
    assert!(!defaulted_out.contains(",\"key\","), "{defaulted_out}");

    let mut native_vt = new_vt();
    let native_call = parse_call(
        "rows.map(row => { const label = row.label; return <li key={row.id}>{label}</li>; })",
        true,
    );
    let mut native_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut native_vt,
        &ident("root"),
        &native_call,
        &mut native_stmts
    ));
    let native_out = compact(&emit_stmts(native_stmts));

    assert!(native_out.contains("getKey:(row,idx)=>row.id"), "{native_out}");
    assert!(native_out.contains("constlabel=row.label;"), "{native_out}");
    assert!(native_out.contains("_$createDocumentFragment"), "{native_out}");

    let mut empty_block_vt = new_vt();
    let empty_block_call = parse_call("rows.map(row => {})", true);
    let mut empty_block_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut empty_block_vt,
        &ident("root"),
        &empty_block_call,
        &mut empty_block_stmts
    ));
    let empty_block_out = compact(&emit_stmts(empty_block_stmts));

    assert!(empty_block_out.contains("const__slot=(()=>{})();"), "{empty_block_out}");
    assert!(
        empty_block_out.contains("renderBetween(__slot,parent,start,end);"),
        "{empty_block_out}"
    );

    let memo_expr_key = extract_render_root_key_expr(&parse_expr(
        "useMemo(() => _$vaporWithKey(<Row />, row.memoKey), [])",
        true,
    ))
    .expect("memo expression-body key");
    assert_eq!(compact(&emit_expr(memo_expr_key)), "row.memoKey;");

    let hook_expr_key = extract_render_root_key_expr(&parse_expr(
        "_$vaporWithHookId('memo:2', () => _$vaporWithKey(<Row />, row.hookKey))",
        true,
    ))
    .expect("hook expression-body key");
    assert_eq!(compact(&emit_expr(hook_expr_key)), "row.hookKey;");
}

#[test]
fn hardens_defaulted_array_aliases_and_complex_member_bases() {
    let mut defaulted_vt = new_vt();
    let defaulted_call = parse_call(
        "rows.map(([id, meta] = fallback, index) => <li key={id}>{meta.label}:{index}</li>)",
        true,
    );
    let mut defaulted_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut defaulted_vt,
        &ident("root"),
        &defaulted_call,
        &mut defaulted_stmts
    ));
    let defaulted_out = compact(&emit_stmts(defaulted_stmts));

    assert!(defaulted_out.contains("_$vaporKeyedList"), "{defaulted_out}");
    assert!(
        defaulted_out.contains("getKey:(item,index)=>(item===undefined?fallback:item)[0]"),
        "{defaulted_out}"
    );
    assert!(
        defaulted_out.contains("((item===undefined?fallback:item)[1].label)"),
        "{defaulted_out}"
    );
    assert!(!defaulted_out.contains(",\"key\","), "{defaulted_out}");

    let pat = parse_arrow_param("({ id, meta: [first] }) => id");
    let mut alias_exprs = HashMap::new();
    collect_alias_exprs_from_pat(&pat, parse_expr("(primary, fallback)", false), &mut alias_exprs);

    assert_eq!(
        compact(&emit_expr(alias_exprs.get("id").expect("id").clone())),
        "(primary,fallback).id;"
    );
    assert_eq!(
        compact(&emit_expr(alias_exprs.get("first").expect("first").clone())),
        "(primary,fallback).meta[0];"
    );
}

#[test]
fn hardens_map_shape_rejections_and_wrapper_value_noops() {
    for src in ["rows.map()", "rows.map(renderRow)", "rows.map((row) => <li />, extra)"] {
        let mut vt = new_vt();
        let call = parse_call(src, true);
        let mut stmts = Vec::new();

        assert!(!try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts), "{src}");
        assert!(stmts.is_empty(), "{src}");
    }

    for src in [
        "vapor(() => value)",
        "useMemo(() => value, [])",
        "_$vaporWithHookId('slot', () => value)",
        "_$vaporWithHookId('slot', () => useMemo(() => value, []))",
    ] {
        assert!(extract_render_root_key_expr(&parse_expr(src, true)).is_none(), "{src}");
    }
}

#[test]
fn hardens_remaining_list_param_prefix_and_wrapped_key_edges() {
    let member_call_prefix =
        parse_arrow_block("() => { const value = remote.run(); return value; }");
    let member_call_locals = collect_declared_idents_in_stmts(&member_call_prefix.stmts);
    assert!(!prefix_reads_external_reactive_values(
        &member_call_prefix.stmts[..1],
        &member_call_locals,
    ));

    let get_with_arg_prefix =
        parse_arrow_block("() => { const value = remote.get(seed); return value; }");
    let get_with_arg_locals = collect_declared_idents_in_stmts(&get_with_arg_prefix.stmts);
    assert!(!prefix_reads_external_reactive_values(
        &get_with_arg_prefix.stmts[..1],
        &get_with_arg_locals,
    ));

    let memo_no_key = extract_render_root_key_expr(&parse_expr(
        "useMemo(() => ready ? <li /> : <span />, [ready])",
        true,
    ));
    assert!(memo_no_key.is_none());

    let hook_no_key = extract_render_root_key_expr(&parse_expr(
        "_$vaporWithHookId('memo:edge', () => ready ? <li /> : <span />)",
        true,
    ));
    assert!(hook_no_key.is_none());

    let mut empty_param_vt = new_vt();
    let empty_param_call = parse_call("rows.map(() => <li key={fallbackKey}>Empty</li>)", true);
    let mut empty_param_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut empty_param_vt,
        &ident("root"),
        &empty_param_call,
        &mut empty_param_stmts,
    ));
    let empty_param_out = compact(&emit_stmts(empty_param_stmts));
    assert!(empty_param_out.contains("_$vaporKeyedList"), "{empty_param_out}");
    assert!(empty_param_out.contains("getKey:(item,idx)=>fallbackKey"), "{empty_param_out}");

    let mut rest_param_vt = new_vt();
    let rest_param_call =
        parse_call("rows.map((...row) => <li key={row[0].id}>{row[0].label}</li>)", true);
    let mut rest_param_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut rest_param_vt,
        &ident("root"),
        &rest_param_call,
        &mut rest_param_stmts,
    ));
    let rest_param_out = compact(&emit_stmts(rest_param_stmts));
    assert!(rest_param_out.contains("_$vaporKeyedList"), "{rest_param_out}");
    assert!(rest_param_out.contains("row[0].id"), "{rest_param_out}");
}

#[test]
fn hardens_wrapped_render_key_extraction_and_defaulted_object_params() {
    assert_eq!(
        normalize(&emit_expr(
            extract_render_root_key_expr(&parse_expr(
                "useMemo(() => { return <li key={row.id}>A</li>; }, [row.id])",
                true,
            ))
            .expect("memo block key"),
        )),
        normalize("row.id;"),
    );
    assert_eq!(
        normalize(&emit_expr(
            extract_render_root_key_expr(&parse_expr(
                "_$vaporWithHookId('memo:key', () => { return vapor(() => <li key={row.alt}>B</li>); })",
                true,
            ))
            .expect("hook block key"),
        )),
        normalize("row.alt;"),
    );

    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(({ id, label } = fallback, index) => <li key={id}>{label}:{index}</li>)",
        true,
    );
    let mut stmts = Vec::new();
    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("getKey:(item,index)=>(item===undefined?fallback:item).id"), "{out}");
    assert!(out.contains("((item===undefined?fallback:item).label)"), "{out}");
    assert!(!out.contains(",\"key\","), "{out}");
}

#[test]
fn hardens_list_fallback_for_block_returning_hook_wrapped_jsx() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map((row, index) => { const key = row.id ?? index; return _$vaporWithHookId('memo:item', () => useMemo(() => <li key={key}>{row.label}</li>, [key])); })",
        true,
    );
    let mut stmts = Vec::new();
    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));

    let out = compact(&emit_stmts(stmts));
    assert!(out.contains("getKey:(row,index)=>{constkey=row.id??index;returnkey;}"), "{out}");
    assert!(out.contains("constkey=row.id??index;"), "{out}");
    assert!(out.contains("_$vaporWithHookId("), "{out}");
    assert!(out.contains("memo:item"), "{out}");
    assert!(out.contains("renderBetween(__slot,parent,start,end);"), "{out}");
}

#[test]
fn hardens_remaining_wrapped_key_noops_and_assign_param_edges() {
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "useMemo(() => { const local = row.id; return <li />; }, [])",
            true,
        ))
        .is_none()
    );
    assert!(
        extract_render_root_key_expr(&parse_expr(
            "_$vaporWithHookId('memo', () => { const local = row.id; return <li />; })",
            true,
        ))
        .is_none()
    );

    let mut assign_member_vt = new_vt();
    let assign_member_call =
        parse_call("rows.map(({ id } = fallback) => <li key={id}>{id}</li>)", true);
    let mut assign_member_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut assign_member_vt,
        &ident("root"),
        &assign_member_call,
        &mut assign_member_stmts,
    ));
    let assign_member_out = compact(&emit_stmts(assign_member_stmts));
    assert!(
        assign_member_out.contains("getKey:(item,idx)=>(item===undefined?fallback:item).id"),
        "{assign_member_out}"
    );

    let mut block_slot_vt = new_vt();
    let block_slot_call = parse_call(
        "rows.map(row => { return (() => { const local = row.id; return <li key={local}>{local}</li>; })(); })",
        true,
    );
    let mut block_slot_stmts = Vec::new();
    assert!(try_build_list_from_map(
        &mut block_slot_vt,
        &ident("root"),
        &block_slot_call,
        &mut block_slot_stmts,
    ));
    let block_slot_out = compact(&emit_stmts(block_slot_stmts));
    assert!(block_slot_out.contains("renderBetween(__slot,parent,start,end);"), "{block_slot_out}");
}

#[test]
fn native_key_is_structural_metadata_only() {
    let mut native_vt = new_vt();
    let native_call =
        parse_call("rows.map(row => <tr key={row.id}><td>{row.label}</td></tr>)", true);
    let mut native_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut native_vt,
        &ident("root"),
        &native_call,
        &mut native_stmts,
    ));
    let native_out = compact(&emit_stmts(native_stmts));
    assert!(native_out.contains("getKey:(row,idx)=>row.id"), "{native_out}");
    assert!(!native_out.contains(",\"key\","), "{native_out}");

    let mut component_vt = new_vt();
    let component_call = parse_call("rows.map(row => <Row key={row.id} />)", true);
    let mut component_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut component_vt,
        &ident("root"),
        &component_call,
        &mut component_stmts,
    ));
    let component_out = compact(&emit_stmts(component_stmts));
    assert!(component_out.contains("getKey:(row,idx)=>row.id"), "{component_out}");
    assert!(component_out.contains("key:row.id"), "{component_out}");
    assert!(component_out.contains("ownedMount:true"), "{component_out}");

    let mut unkeyed_vt = new_vt();
    let unkeyed_call = parse_call("rows.map(row => <tr>{row.label}</tr>)", true);
    let mut unkeyed_stmts = Vec::new();

    assert!(try_build_list_from_map(
        &mut unkeyed_vt,
        &ident("root"),
        &unkeyed_call,
        &mut unkeyed_stmts,
    ));
    let unkeyed_out = compact(&emit_stmts(unkeyed_stmts));
    assert!(unkeyed_out.contains("getKey:(row,idx)=>idx"), "{unkeyed_out}");
}

#[test]
fn coalesces_safe_native_row_bindings() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(row => <tr key={row.id} className={row.id === selected.value ? 'danger' : ''}><td>{row.id}</td><td>{row.label}</td></tr>)",
        true,
    );
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("singleRoot:true"), "{out}");
    assert!(out.contains("directRoot:true"), "{out}");
    assert!(out.contains("compiledRowPatch:true"), "{out}");
    assert_eq!(
        out.matches("watchEffect(").count(),
        1,
        "safe row should emit only the list effect: {out}"
    );
    assert!(out.contains("return{patch:"), "safe row must return a patch record: {out}");
    assert!(
        out.contains("_$setClassName(")
            && out.contains("selected.value")
            && out.contains("row.id")
            && out.contains("row.label"),
        "merged effect must retain external and item-local reads: {out}"
    );
    assert!(
        out.contains("_$settextContent("),
        "item-local text should use direct text writes: {out}"
    );
    assert_eq!(
        out.matches("Object.is(").count(),
        3,
        "class and both direct-text setters need independent equality guards: {out}"
    );
    assert_eq!(
        out.matches("let_$rowBindingInitialized").count(),
        3,
        "each guarded binding needs row-local initialization state: {out}"
    );
    assert_eq!(
        out.matches("let_$rowBindingValue").count(),
        3,
        "each guarded binding needs its own row-local cached value: {out}"
    );
    assert_eq!(
        out.matches("_$rowBindingInitialized").count(),
        9,
        "each guard must read, initialize, and persist its own initialization flag: {out}"
    );
    assert!(
        out.contains("_$insertBefore(parent,_root,start)"),
        "safe row should mount its prepared fragment directly into the list range: {out}"
    );
    assert_eq!(
        out.matches("renderAnchor(").count(),
        0,
        "safe row should not register a per-row runtime anchor mount: {out}"
    );
}

#[test]
fn coalesces_safe_native_row_signal_get_bindings() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.get().map(row => <tr key={row.id} className={row.id === selected.get() ? 'danger' : ''}><td>{row.id}</td><td>{row.label}</td></tr>)",
        true,
    );
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("directRoot:true"), "{out}");
    assert!(out.contains("compiledRowPatch:true"), "{out}");
    assert_eq!(
        out.matches("watchEffect(").count(),
        1,
        "signal getter row should emit only the list effect: {out}"
    );
    assert!(out.contains("return{patch:"), "signal row must return a patch record: {out}");
    assert!(out.contains("selected.get()"), "{out}");
    assert!(!out.contains("_$createTextWrapper("), "{out}");
    assert!(!out.contains("renderAnchor("), "{out}");
}

#[test]
fn preserves_text_wrappers_for_mixed_row_content() {
    let mut vt = new_vt();
    let call = parse_call(
        "rows.map(row => <tr key={row.id}><td>id: {row.id}</td><td>{row.id}{row.label}</td></tr>)",
        true,
    );
    let mut stmts = Vec::new();

    assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
    let out = compact(&emit_stmts(stmts));

    assert!(out.contains("directRoot:true"), "safe row should retain the direct-root path: {out}");
    assert_eq!(
        out.matches("_$createTextWrapper(").count(),
        3,
        "mixed or adjacent text bindings need wrappers so textContent updates preserve siblings: {out}"
    );
}

#[test]
fn keeps_unsafe_list_row_bindings_on_conservative_paths() {
    let cases = [
        (
            "spread",
            "rows.map(row => <tr key={row.id} {...row.attrs}><td>{row.label}</td></tr>)",
            "_$spreadAttributes",
        ),
        (
            "ref",
            "rows.map(row => <tr key={row.id} ref={row.ref} title={row.id}><td>{row.label}</td></tr>)",
            "_$vaporBindUseRef",
        ),
        (
            "conditional",
            "rows.map(row => <tr key={row.id}>{row.visible ? <td>{row.label}</td> : null}</tr>)",
            "renderAnchor",
        ),
        (
            "component",
            "rows.map(row => <tr key={row.id}><Row label={row.label} /></tr>)",
            "_$createComponent",
        ),
        (
            "complex-call",
            "rows.map(row => <tr key={row.id} title={format(row.label)}><td>{row.label}</td></tr>)",
            "format(row.label)",
        ),
        (
            "get-with-args",
            "rows.map(row => <tr key={row.id} title={store.get(row.id)}><td>{row.label}</td></tr>)",
            "store.get(row.id)",
        ),
        (
            "nested-get-call",
            "rows.map(row => <tr key={row.id} title={createStore().get()}><td>{row.label}</td></tr>)",
            "createStore().get()",
        ),
    ];

    for (name, source, expected) in cases {
        let mut vt = new_vt();
        let call = parse_call(source, true);
        let mut stmts = Vec::new();

        assert!(try_build_list_from_map(&mut vt, &ident("root"), &call, &mut stmts));
        let out = compact(&emit_stmts(stmts));

        assert!(out.contains(expected), "{name} fallback lost expected code: {out}");
        assert!(
            !out.contains("compiledRowPatch:true"),
            "{name} fallback must not opt into compiled row records: {out}"
        );
        assert!(
            out.matches("watchEffect(").count() >= 2,
            "{name} fallback must retain its independent watcher(s): {out}"
        );
    }
}
