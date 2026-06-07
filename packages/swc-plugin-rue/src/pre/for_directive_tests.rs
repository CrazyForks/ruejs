use super::*;
use swc_core::ecma::ast::{ExprStmt, Module, ModuleItem, Program, Stmt};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_jsx_element(src: &str) -> JSXElement {
    let cm = Arc::new(SourceMap::default());
    let fm = cm
        .new_source_file(FileName::Custom("for-directive-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    match *parser.parse_expr().expect("parse jsx element") {
        Expr::JSXElement(el) => *el,
        other => panic!("expected JSXElement, got {other:?}"),
    }
}

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
fn parses_top_level_separators_without_entering_nested_structures() {
    let raw = "(item, key) in records.filter(entry => entry.kind === 'inbox')";
    let (sep_idx, sep_len) = find_top_level_separator(raw).expect("separator");
    assert_eq!(raw[..sep_idx].trim(), "(item, key)");
    assert_eq!(raw[sep_idx + sep_len..].trim(), "records.filter(entry => entry.kind === 'inbox')");

    let raw_of = "([value, key], index) of sourceMap";
    let (sep_idx, sep_len) = find_top_level_separator(raw_of).expect("of separator");
    assert_eq!(raw_of[..sep_idx].trim(), "([value, key], index)");
    assert_eq!(raw_of[sep_idx + sep_len..].trim(), "sourceMap");

    let quoted = r#""left \" in hidden" in source"#;
    let (sep_idx, sep_len) = find_top_level_separator(quoted).expect("quoted separator");
    assert_eq!(quoted[sep_idx + sep_len..].trim(), "source");

    let braced = "{ value: item in group } in objectSource";
    let (sep_idx, sep_len) = find_top_level_separator(braced).expect("braced separator");
    assert_eq!(braced[sep_idx + sep_len..].trim(), "objectSource");

    assert!(find_top_level_separator("item => item + 1").is_none());
}

#[test]
fn parses_aliases_and_directive_specs_for_supported_forms() {
    let single = parse_aliases("item").expect("single alias");
    assert_eq!(single.len(), 1);
    assert!(matches!(&single[0], Pat::Ident(binding) if binding.id.sym.as_ref() == "item"));

    assert!(parse_aliases(" ").is_none());
    let triple = parse_aliases("(value, key, index)").expect("triple alias");
    assert_eq!(triple.len(), 3);
    assert!(parse_aliases("(a, b, c, d)").is_none());
    assert!(parse_aliases("()").is_none());
    assert!(parse_aliases("(a,").is_none());

    let directive_el = parse_jsx_element("<li v-for=\"(item, index) in list\" />");
    let attr = get_directive_attr(&directive_el, FOR_DIRECTIVE_NAMES).expect("v-for attr");
    let spec = parse_directive_attr(attr).expect("directive spec");
    assert_eq!(spec.aliases.len(), 2);
    assert_eq!(normalize(&emit_expr(spec.source)), normalize("list;"));

    let invalid_el = parse_jsx_element("<li v-for={items} />");
    let invalid_attr = get_directive_attr(&invalid_el, FOR_DIRECTIVE_NAMES).expect("invalid attr");
    assert!(parse_directive_attr(invalid_attr).is_none());
}

#[test]
fn handles_directive_attr_edge_values_and_preserves_non_ident_attrs() {
    let expr_string_el = parse_jsx_element("<li v-for={'item in list'} />");
    let attr = get_directive_attr(&expr_string_el, FOR_DIRECTIVE_NAMES).expect("expr string attr");
    let spec = parse_directive_attr(attr).expect("expr string directive");
    assert_eq!(spec.aliases.len(), 1);
    assert_eq!(normalize(&emit_expr(spec.source)), normalize("list;"));

    let bare_el = parse_jsx_element("<li v-for />");
    let bare_attr = get_directive_attr(&bare_el, FOR_DIRECTIVE_NAMES).expect("bare attr");
    assert!(parse_directive_attr(bare_attr).is_none());

    let mut empty_expr_el = parse_jsx_element("<li v-for=\"item in list\" />");
    for attr in &mut empty_expr_el.opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            continue;
        };
        let JSXAttrName::Ident(name) = &attr.name else {
            continue;
        };
        if name.sym.as_ref() == "v-for" {
            attr.value = Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::JSXEmptyExpr(JSXEmptyExpr { span: DUMMY_SP }),
            }));
        }
    }
    let empty_attr = get_directive_attr(&empty_expr_el, FOR_DIRECTIVE_NAMES).expect("empty attr");
    assert!(parse_directive_attr(empty_attr).is_none());

    let mut clean = parse_jsx_element("<li {...props} data:x=\"y\" v-for=\"item in list\" />");
    remove_directives(&mut clean);
    assert!(get_directive_attr(&clean, FOR_DIRECTIVE_NAMES).is_none());
    assert!(
        clean.opening.attrs.iter().any(|attr| matches!(attr, JSXAttrOrSpread::SpreadElement(_)))
    );
    assert!(clean.opening.attrs.iter().any(|attr| matches!(
        attr,
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::JSXNamespacedName(ns_name),
            ..
        }) if ns_name.ns.sym.as_ref() == "data"
    )));

    let non_ident_only = parse_jsx_element("<li data:x=\"y\" />");
    assert!(get_directive_attr(&non_ident_only, FOR_DIRECTIVE_NAMES).is_none());
}

#[test]
fn normalizes_array_number_and_object_sources_before_mapping() {
    let normalized = normalize(&emit_expr(build_normalized_iterable_expr(
        parse_expr("source").expect("source expr"),
    )));

    assert!(normalized.contains("Array.isArray(__rue_v_for_source)"));
    assert!(normalized.contains("__rue_v_for_source.map((value, index)=>[ value, index, index ])"));
    assert!(normalized.contains("Array.from({ length: __rue_v_for_source }, (__rue_v_for_unused, index)=>[ index + 1, index, index ])"));
    assert!(normalized.contains("Object.entries(__rue_v_for_source == null ? {} : __rue_v_for_source).map(([key, value], index)=>[ value, key, index ])"));
}

#[test]
fn rewrites_v_for_children_to_map_expr_and_preserves_other_children() {
    let mut parent = parse_jsx_element(
        "<ul><li v-for=\"(item, key, index) in itemsMap\" key={item.id}>{index}:{key}:{item.name}</li><li>Static</li></ul>",
    );
    transform_element(&mut parent);

    assert_eq!(parent.children.len(), 2);
    let first = match &parent.children[0] {
        JSXElementChild::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => expr.as_ref(),
            _ => panic!("expected expr child"),
        },
        other => panic!("expected expr container, got {other:?}"),
    };
    let rendered = normalize(&emit_expr(first.clone()));
    assert!(rendered.contains("Array.isArray(__rue_v_for_source)"));
    assert!(rendered.contains(".map(([item, key, index])=>"));
    assert!(!rendered.contains("v-for"));
    assert!(rendered.contains("key={item.id}"));
    assert!(matches!(&parent.children[1], JSXElementChild::JSXElement(_)));

    let mut r_for_parent = parse_jsx_element("<div><span r-for=\"n in 3\">{n}</span></div>");
    transform_element(&mut r_for_parent);
    let r_for_expr = match &r_for_parent.children[0] {
        JSXElementChild::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => expr.as_ref(),
            _ => panic!("expected r-for expr"),
        },
        other => panic!("expected expr container, got {other:?}"),
    };
    let r_for_rendered = normalize(&emit_expr(r_for_expr.clone()));
    assert!(r_for_rendered.contains("Array.from({ length: __rue_v_for_source }"));
    assert!(r_for_rendered.contains(".map(([n])=>"));
}

#[test]
fn hardens_malformed_for_specs_and_transform_noops() {
    let too_many_aliases = parse_jsx_element("<li v-for=\"(a, b, c, d) in list\" />");
    let too_many_attr =
        get_directive_attr(&too_many_aliases, FOR_DIRECTIVE_NAMES).expect("too many attr");
    assert!(parse_directive_attr(too_many_attr).is_none());

    let missing_source = parse_jsx_element("<li v-for=\"item in\" />");
    let missing_attr = get_directive_attr(&missing_source, FOR_DIRECTIVE_NAMES).expect("attr");
    assert!(parse_directive_attr(missing_attr).is_none());

    let missing_alias = parse_jsx_element("<li v-for=\" in items\" />");
    let missing_alias_attr =
        get_directive_attr(&missing_alias, FOR_DIRECTIVE_NAMES).expect("missing alias attr");
    assert!(parse_directive_attr(missing_alias_attr).is_none());

    let mut parent = parse_jsx_element("<ul><li v-for=\"item in\">{item}</li><li>A</li></ul>");
    transform_element(&mut parent);
    assert_eq!(parent.children.len(), 2);
    assert!(matches!(&parent.children[0], JSXElementChild::JSXElement(_)));
}

#[test]
fn hardens_for_alias_parse_expression_and_empty_pattern_edges() {
    let empty_tuple = parse_jsx_element("<li v-for=\"() in items\" />");
    let empty_tuple_attr = get_directive_attr(&empty_tuple, FOR_DIRECTIVE_NAMES).expect("attr");
    assert!(parse_directive_attr(empty_tuple_attr).is_none());

    let expression_value = parse_jsx_element("<li v-for={'item in items'}>{item}</li>");
    let expression_attr =
        get_directive_attr(&expression_value, FOR_DIRECTIVE_NAMES).expect("expression attr");
    let spec = parse_directive_attr(expression_attr).expect("string expression directive");
    assert_eq!(spec.aliases.len(), 1);

    let mut unsupported_expr = parse_jsx_element("<ul><li v-for={items}>{item}</li></ul>");
    transform_element(&mut unsupported_expr);
    assert!(matches!(&unsupported_expr.children[0], JSXElementChild::JSXElement(_)));
}

#[test]
fn hardens_defaulted_destructured_aliases_and_complex_sources() {
    let directive_el = parse_jsx_element(
        "<li v-for=\"({ id, meta: [first] } = fallback, key, index) in rows.filter(row => row.kind === 'inbox')\" />",
    );
    let attr = get_directive_attr(&directive_el, FOR_DIRECTIVE_NAMES).expect("v-for attr");
    let spec = parse_directive_attr(attr).expect("directive spec");

    assert_eq!(spec.aliases.len(), 3);
    assert!(
        matches!(&spec.aliases[0], Pat::Assign(assign) if matches!(assign.left.as_ref(), Pat::Object(_)))
    );
    assert_eq!(
        normalize(&emit_expr(spec.source)),
        normalize("rows.filter((row)=>row.kind === 'inbox');")
    );

    let mut parent = parse_jsx_element(
        "<ul><li r-for=\"([id, meta] = fallback, index) of rows\" key={id}>{meta.label}:{index}</li></ul>",
    );
    transform_element(&mut parent);
    let rendered = match &parent.children[0] {
        JSXElementChild::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => normalize(&emit_expr(*expr.clone())),
            _ => panic!("expected expr child"),
        },
        other => panic!("expected expr container, got {other:?}"),
    };

    assert!(rendered.contains(".map(([[id, meta] = fallback, index])=>"), "{rendered}");
    assert!(!rendered.contains("r-for"), "{rendered}");
}

#[test]
fn hardens_for_alias_boundaries_and_safe_sources() {
    for raw in ["(item, key, index, extra)", "({ id }, , index)", ""] {
        assert!(parse_aliases(raw).is_none(), "{raw}");
    }

    let directive_el = parse_jsx_element(
        "<li v-for=\"([first, { id }], key = fallbackKey) in source?.items ?? []\" />",
    );
    let attr = get_directive_attr(&directive_el, FOR_DIRECTIVE_NAMES).expect("v-for attr");
    let spec = parse_directive_attr(attr).expect("directive spec");
    assert_eq!(spec.aliases.len(), 2);
    assert_eq!(normalize(&emit_expr(spec.source)), normalize("source?.items ?? [];"));

    let mut parent =
        parse_jsx_element("<ul><li {...props} v-for=\"item of rows\">{item.label}</li></ul>");
    transform_element(&mut parent);
    let rendered = match &parent.children[0] {
        JSXElementChild::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => normalize(&emit_expr(*expr.clone())),
            _ => panic!("expected expr child"),
        },
        other => panic!("expected expr container, got {other:?}"),
    };
    assert!(rendered.contains("...props"), "{rendered}");
    assert!(!rendered.contains("v-for"), "{rendered}");
}

#[test]
fn hardens_for_directive_nested_separator_and_invalid_expression_edges() {
    let with_nested_words = parse_jsx_element(
        r#"<li v-for="([label = `in ${kind}`], index) in rows.filter(row => row.kind === 'of')" />"#,
    );
    let attr = get_directive_attr(&with_nested_words, FOR_DIRECTIVE_NAMES).expect("attr");
    let spec = parse_directive_attr(attr).expect("nested words spec");
    assert_eq!(spec.aliases.len(), 2);
    assert_eq!(
        normalize(&emit_expr(spec.source)),
        normalize("rows.filter((row)=>row.kind === 'of');")
    );

    for src in [
        "<li v-for=\"item rows\" />",
        "<li v-for=\"(item, index) in\" />",
        "<li v-for=\"(item,, index) in rows\" />",
    ] {
        let el = parse_jsx_element(src);
        let attr = get_directive_attr(&el, FOR_DIRECTIVE_NAMES).expect("attr");
        assert!(parse_directive_attr(attr).is_none(), "{src}");
    }

    let mut parent = parse_jsx_element(
        "<ul><li v-for=\"([label = `in ${kind}`], index) of rows\">{label}:{index}</li></ul>",
    );
    transform_element(&mut parent);
    let rendered = match &parent.children[0] {
        JSXElementChild::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => normalize(&emit_expr(*expr.clone())),
            _ => panic!("expected expr child"),
        },
        other => panic!("expected expr container, got {other:?}"),
    };
    assert!(rendered.contains(".map(([[label = `in ${kind}`], index])=>"), "{rendered}");
    assert!(!rendered.contains("v-for"), "{rendered}");
}

#[test]
fn hardens_for_alias_parser_direct_edges() {
    assert_eq!(parse_aliases("item, key").expect("two bare aliases").len(), 2);
    assert!(parse_aliases("(item, key").is_none());
    assert!(parse_aliases("(item, key,)").is_some());

    let invalid_source = parse_jsx_element("<li v-for=\"item in )\" />");
    let attr = get_directive_attr(&invalid_source, FOR_DIRECTIVE_NAMES).expect("attr");
    assert!(parse_directive_attr(attr).is_none());

    let expr_empty_string = parse_jsx_element("<li v-for={''} />");
    let attr = get_directive_attr(&expr_empty_string, FOR_DIRECTIVE_NAMES).expect("attr");
    assert!(parse_directive_attr(attr).is_none());
}
