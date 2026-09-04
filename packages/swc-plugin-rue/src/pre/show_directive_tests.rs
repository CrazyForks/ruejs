use super::*;
use std::sync::Arc;
use swc_core::common::{DUMMY_SP, FileName, SourceMap};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_ts_expr(src: &str) -> Expr {
    let cm = Arc::new(SourceMap::default());
    let fm = cm
        .new_source_file(FileName::Custom("show-directive-test.ts".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: false, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    *parser.parse_expr().expect("parse typescript expression")
}

fn parse_jsx_opening(src: &str) -> JSXOpeningElement {
    let cm = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(
        FileName::Custom("show-directive-test.tsx".into()).into(),
        src.to_string(),
    );
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    match *parser.parse_expr().expect("parse jsx expression") {
        Expr::JSXElement(el) => el.opening,
        other => panic!("expected JSXElement, got {other:?}"),
    }
}

fn parse_jsx_element(src: &str) -> JSXElement {
    let cm = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(
        FileName::Custom("show-directive-test.tsx".into()).into(),
        src.to_string(),
    );
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    match *parser.parse_expr().expect("parse jsx expression") {
        Expr::JSXElement(el) => *el,
        other => panic!("expected JSXElement, got {other:?}"),
    }
}

fn display_prop_value(expr: &Expr) -> Option<String> {
    let Expr::Object(obj) = unwrap_expr(expr) else {
        return None;
    };

    obj.props.iter().find_map(|prop| match prop {
        PropOrSpread::Prop(prop) => match prop.as_ref() {
            Prop::KeyValue(kv) => match (&kv.key, unwrap_expr(kv.value.as_ref())) {
                (PropName::Ident(id), Expr::Lit(Lit::Str(value)))
                    if id.sym.as_ref() == "display" =>
                {
                    Some(value.value.as_str().unwrap_or("").to_string())
                }
                _ => None,
            },
            _ => None,
        },
        _ => None,
    })
}

fn style_expr(opening: &JSXOpeningElement) -> &Expr {
    let style_attr = opening
        .attrs
        .iter()
        .find_map(|attr| match attr {
            JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
                JSXAttrName::Ident(name) if name.sym.as_ref() == "style" => Some(attr),
                _ => None,
            },
            _ => None,
        })
        .expect("style attr");

    match style_attr.value.as_ref().expect("style value") {
        JSXAttrValue::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => expr.as_ref(),
            _ => panic!("expected style expr"),
        },
        other => panic!("expected expr container, got {other:?}"),
    }
}

fn set_attr_to_empty_expr(opening: &mut JSXOpeningElement, attr_name: &str) {
    for attr in &mut opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            continue;
        };
        if matches!(&attr.name, JSXAttrName::Ident(name) if name.sym.as_ref() == attr_name) {
            attr.value = Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::JSXEmptyExpr(JSXEmptyExpr { span: DUMMY_SP }),
            }));
        }
    }
}

#[test]
fn detects_static_truthy_values_and_known_string_styles() {
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("'hello'")), Some(true));
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("''")), Some(false));
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("1")), Some(true));
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("0")), Some(false));
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("true")), Some(true));
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("null")), Some(false));
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("undefined")), Some(false));
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("void 0")), Some(false));
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("!ready")), None);
    assert_eq!(get_static_truthy_bool(&parse_ts_expr("maybe")), None);

    assert!(is_known_string_expr(&parse_ts_expr("'color:red'")));
    assert!(is_known_string_expr(&parse_ts_expr("`color:${tone}`")));
    assert!(is_known_string_expr(&parse_ts_expr("String(theme)")));
    assert!(is_known_string_expr(&parse_ts_expr("'base:' + suffix")));
    assert!(is_known_string_expr(&parse_ts_expr("prefix + 'px'")));
    assert!(!is_known_string_expr(&parse_ts_expr("count * 2")));
}

#[test]
fn folds_static_show_styles_for_strings_objects_and_primitives() {
    let object_fold =
        fold_vapor_show_style(parse_ts_expr("({ color: 'tomato' })"), false).expect("object fold");
    assert_eq!(display_prop_value(&object_fold).as_deref(), Some("none"));

    let true_string_fold =
        fold_vapor_show_style(parse_ts_expr("'color:red'"), true).expect("string fold");
    assert!(
        matches!(unwrap_expr(&true_string_fold), Expr::Lit(Lit::Str(s)) if s.value.as_str().unwrap_or("") == "color:red")
    );

    let false_string_fold =
        fold_vapor_show_style(parse_ts_expr("'color:red'"), false).expect("string fold false");
    assert!(
        matches!(unwrap_expr(&false_string_fold), Expr::Lit(Lit::Str(s)) if s.value.as_str().unwrap_or("").contains("display: none"))
    );

    let primitive_fold =
        fold_vapor_show_style(parse_ts_expr("undefined"), false).expect("primitive fold");
    assert_eq!(display_prop_value(&primitive_fold).as_deref(), Some("none"));

    let void_fold = fold_vapor_show_style(parse_ts_expr("void 0"), false).expect("void fold");
    assert_eq!(display_prop_value(&void_fold).as_deref(), Some("none"));
    assert!(fold_vapor_show_style(parse_ts_expr("!ready"), false).is_none());

    let number_fold = fold_vapor_show_style(parse_ts_expr("0"), true).expect("number fold");
    assert_eq!(display_prop_value(&number_fold).as_deref(), Some(""));

    let void_fold = fold_vapor_show_style(parse_ts_expr("void 0"), false).expect("void fold");
    assert_eq!(display_prop_value(&void_fold).as_deref(), Some("none"));

    let known_string_fold =
        fold_vapor_show_style(parse_ts_expr("String(theme)"), false).expect("known string fold");
    assert!(
        matches!(unwrap_expr(&known_string_fold), Expr::Bin(bin) if matches!(bin.op, BinaryOp::Add))
    );

    let known_string_true =
        fold_vapor_show_style(parse_ts_expr("String(theme)"), true).expect("known string true");
    assert!(matches!(unwrap_expr(&known_string_true), Expr::Call(_)));

    assert!(fold_vapor_show_style(parse_ts_expr("dynamicStyle"), false).is_none());
}

#[test]
fn keeps_invalid_show_directive_unchanged() {
    let mut opening = parse_jsx_opening("<div v-show />");
    transform_opening(&mut opening);

    assert_eq!(opening.attrs.len(), 1);
    match &opening.attrs[0] {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(name) => assert_eq!(name.sym.as_ref(), "v-show"),
            _ => panic!("expected ident attr"),
        },
        _ => panic!("expected jsx attr"),
    }

    let mut empty_expr = parse_jsx_opening("<div v-show={ok} />");
    set_attr_to_empty_expr(&mut empty_expr, "v-show");
    transform_opening(&mut empty_expr);

    assert_eq!(empty_expr.attrs.len(), 1);
    match &empty_expr.attrs[0] {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.value {
            Some(JSXAttrValue::JSXExprContainer(container)) => {
                assert!(matches!(container.expr, JSXExpr::JSXEmptyExpr(_)));
            }
            other => panic!("expected empty expr container, got {other:?}"),
        },
        _ => panic!("expected jsx attr"),
    }
}

#[test]
fn rewrites_existing_style_attribute_without_value() {
    let mut opening = parse_jsx_opening("<div v-show={ok} style />");
    transform_opening(&mut opening);

    assert_eq!(opening.attrs.len(), 1);
    let expr = style_expr(&opening);

    match unwrap_expr(expr) {
        Expr::Call(call) => {
            assert!(
                matches!(&call.callee, Callee::Expr(expr) if matches!(unwrap_expr(expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "_$compiledShowStyle"))
            );
            assert_eq!(call.args.len(), 2);
            assert!(
                matches!(unwrap_expr(call.args[0].expr.as_ref()), Expr::Lit(Lit::Str(s)) if s.value.is_empty())
            );
            assert!(
                matches!(unwrap_expr(call.args[1].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "ok")
            );
        }
        other => panic!("expected call expr, got {other:?}"),
    }
}

#[test]
fn rewrites_existing_style_with_unsupported_attr_value() {
    let mut opening = parse_jsx_opening("<div v-show={ok} style={styleObj} />");
    let span_value = parse_jsx_element("<span />");

    for attr in &mut opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            continue;
        };
        if matches!(&attr.name, JSXAttrName::Ident(name) if name.sym.as_ref() == "style") {
            attr.value = Some(JSXAttrValue::JSXElement(Box::new(span_value.clone())));
        }
    }

    transform_opening(&mut opening);

    match unwrap_expr(style_expr(&opening)) {
        Expr::Call(call) => {
            assert!(
                matches!(unwrap_expr(call.args[0].expr.as_ref()), Expr::Lit(Lit::Str(s)) if s.value.is_empty())
            );
            assert!(
                matches!(unwrap_expr(call.args[1].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "ok")
            );
        }
        other => panic!("expected call expr, got {other:?}"),
    }
}

#[test]
fn rewrites_static_conditions_with_existing_and_inserted_styles() {
    let mut existing_string = parse_jsx_opening("<div r-show={false} style=\"color:red\" />");
    transform_opening(&mut existing_string);
    assert_eq!(existing_string.attrs.len(), 1);
    assert!(
        matches!(unwrap_expr(style_expr(&existing_string)), Expr::Lit(Lit::Str(s)) if s.value.as_str().unwrap_or("").contains("display: none"))
    );

    let mut existing_object = parse_jsx_opening("<div v-show={true} style={{ color: 'red' }} />");
    transform_opening(&mut existing_object);
    assert_eq!(existing_object.attrs.len(), 1);
    assert_eq!(display_prop_value(style_expr(&existing_object)).as_deref(), Some(""));

    let mut inserted = parse_jsx_opening("<div v-show=\"shown\" id=\"x\" />");
    transform_opening(&mut inserted);
    assert_eq!(inserted.attrs.len(), 2);
    assert_eq!(display_prop_value(style_expr(&inserted)).as_deref(), Some(""));
    assert!(inserted.attrs.iter().all(|attr| match attr {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(name) => name.sym.as_ref() != "v-show",
            _ => true,
        },
        _ => true,
    }));
}

#[test]
fn rewrites_existing_style_expr_with_dynamic_condition_to_runtime_call() {
    let mut opening = parse_jsx_opening("<div v-show={ok} style={styleObj} />");
    transform_opening(&mut opening);

    assert_eq!(opening.attrs.len(), 1);
    match unwrap_expr(style_expr(&opening)) {
        Expr::Call(call) => {
            assert!(
                matches!(&call.callee, Callee::Expr(expr) if matches!(unwrap_expr(expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "_$compiledShowStyle"))
            );
            assert!(
                matches!(unwrap_expr(call.args[0].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "styleObj")
            );
            assert!(
                matches!(unwrap_expr(call.args[1].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "ok")
            );
        }
        other => panic!("expected call expr, got {other:?}"),
    }
}

#[test]
fn rewrites_show_while_skipping_spreads_namespaces_and_empty_style_exprs() {
    let mut opening =
        parse_jsx_opening("<div {...props} data:x={meta} v-show={ok} style={styleObj} />");
    set_attr_to_empty_expr(&mut opening, "style");
    transform_opening(&mut opening);

    assert!(opening.attrs.iter().any(|attr| matches!(attr, JSXAttrOrSpread::SpreadElement(_))));
    assert!(opening.attrs.iter().any(|attr| matches!(
        attr,
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::JSXNamespacedName(ns_name),
            ..
        }) if ns_name.ns.sym.as_ref() == "data"
    )));

    match unwrap_expr(style_expr(&opening)) {
        Expr::Call(call) => {
            assert!(
                matches!(unwrap_expr(call.args[0].expr.as_ref()), Expr::Lit(Lit::Str(s)) if s.value.is_empty())
            );
            assert!(
                matches!(unwrap_expr(call.args[1].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "ok")
            );
        }
        other => panic!("expected call expr, got {other:?}"),
    }
}

#[test]
fn hardens_show_style_bare_and_static_false_insert_edges() {
    let mut bare_style = parse_jsx_opening("<div v-show={ok} style />");
    transform_opening(&mut bare_style);
    match unwrap_expr(style_expr(&bare_style)) {
        Expr::Call(call) => {
            assert!(
                matches!(unwrap_expr(call.args[0].expr.as_ref()), Expr::Lit(Lit::Str(s)) if s.value.is_empty())
            );
            assert!(
                matches!(unwrap_expr(call.args[1].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "ok")
            );
        }
        other => panic!("expected call expr, got {other:?}"),
    }

    let mut inserted_false = parse_jsx_opening("<div r-show={false} />");
    transform_opening(&mut inserted_false);
    assert_eq!(display_prop_value(style_expr(&inserted_false)).as_deref(), Some("none"));
    assert!(inserted_false.attrs.iter().all(|attr| match attr {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(name) => name.sym.as_ref() != "r-show",
            _ => true,
        },
        _ => true,
    }));
}

#[test]
fn hardens_show_unsupported_condition_and_insert_position_edges() {
    let mut unsupported_cond = parse_jsx_opening("<div v-show={ok} />");
    let span_value = parse_jsx_element("<span />");
    for attr in &mut unsupported_cond.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            continue;
        };
        if matches!(&attr.name, JSXAttrName::Ident(name) if name.sym.as_ref() == "v-show") {
            attr.value = Some(JSXAttrValue::JSXElement(Box::new(span_value.clone())));
        }
    }
    transform_opening(&mut unsupported_cond);
    assert!(unsupported_cond.attrs.iter().any(|attr| matches!(
        attr,
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::Ident(name),
            ..
        }) if name.sym.as_ref() == "v-show"
    )));

    let mut inserted_dynamic = parse_jsx_opening("<div id=\"a\" v-show={ok} data:x=\"b\" />");
    transform_opening(&mut inserted_dynamic);
    match unwrap_expr(style_expr(&inserted_dynamic)) {
        Expr::Call(call) => {
            assert!(
                matches!(unwrap_expr(call.args[0].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "undefined")
            );
            assert!(
                matches!(unwrap_expr(call.args[1].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "ok")
            );
        }
        other => panic!("expected dynamic show style call, got {other:?}"),
    }
    assert!(inserted_dynamic.attrs.iter().any(|attr| matches!(
        attr,
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::JSXNamespacedName(ns_name),
            ..
        }) if ns_name.ns.sym.as_ref() == "data"
    )));
}

#[test]
fn hardens_show_style_jsx_value_and_last_directive_wins() {
    let mut jsx_style = parse_jsx_opening("<div v-show={ok} style={styleObj} />");
    let style_child = parse_jsx_element("<span />");
    for attr in &mut jsx_style.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            continue;
        };
        if matches!(&attr.name, JSXAttrName::Ident(name) if name.sym.as_ref() == "style") {
            attr.value = Some(JSXAttrValue::JSXElement(Box::new(style_child.clone())));
        }
    }
    transform_opening(&mut jsx_style);

    match unwrap_expr(style_expr(&jsx_style)) {
        Expr::Call(call) => {
            assert!(
                matches!(unwrap_expr(call.args[0].expr.as_ref()), Expr::Lit(Lit::Str(s)) if s.value.is_empty())
            );
            assert!(
                matches!(unwrap_expr(call.args[1].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "ok")
            );
        }
        other => panic!("expected dynamic show style call, got {other:?}"),
    }

    let mut duplicated =
        parse_jsx_opening("<div v-show={first} r-show={second} style=\"display:block\" />");
    transform_opening(&mut duplicated);
    let out = format!("{:?}", style_expr(&duplicated));
    assert!(out.contains("second"), "{out}");
    assert!(duplicated.attrs.iter().any(|attr| matches!(
        attr,
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::Ident(name),
            ..
        }) if name.sym.as_ref() == "v-show"
    )));
    assert!(duplicated.attrs.iter().all(|attr| match attr {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(name) => name.sym.as_ref() != "r-show",
            _ => true,
        },
        _ => true,
    }));
}

#[test]
fn hardens_show_static_folding_for_known_string_expressions() {
    let mut static_true = parse_jsx_opening("<div v-show={'visible'} style={String(theme)} />");
    transform_opening(&mut static_true);

    match unwrap_expr(style_expr(&static_true)) {
        Expr::Call(call) => {
            assert!(matches!(
                &call.callee,
                Callee::Expr(expr)
                    if matches!(unwrap_expr(expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "String")
            ));
            assert_eq!(call.args.len(), 1);
        }
        other => panic!("expected preserved String(style) call, got {other:?}"),
    }
    assert!(static_true.attrs.iter().all(|attr| match attr {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(name) => name.sym.as_ref() != "v-show",
            _ => true,
        },
        _ => true,
    }));

    let mut static_false =
        parse_jsx_opening("<div r-show={void 0} style={`color:${theme.color}`} />");
    transform_opening(&mut static_false);

    match unwrap_expr(style_expr(&static_false)) {
        Expr::Bin(bin) => {
            assert!(matches!(bin.op, BinaryOp::Add));
            assert!(
                matches!(unwrap_expr(bin.right.as_ref()), Expr::Lit(Lit::Str(s)) if s.value.as_str().unwrap_or("").contains("display: none"))
            );
        }
        other => panic!("expected static false string concat, got {other:?}"),
    }
    assert!(static_false.attrs.iter().all(|attr| match attr {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(name) => name.sym.as_ref() != "r-show",
            _ => true,
        },
        _ => true,
    }));
}

#[test]
fn hardens_show_insert_with_spreads_namespaces_and_static_values() {
    let mut static_false = parse_jsx_opening("<div {...props} data:x=\"m\" v-show={0} />");
    transform_opening(&mut static_false);

    assert!(
        static_false.attrs.iter().any(|attr| matches!(attr, JSXAttrOrSpread::SpreadElement(_)))
    );
    assert!(static_false.attrs.iter().any(|attr| matches!(
        attr,
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::JSXNamespacedName(ns_name),
            ..
        }) if ns_name.ns.sym.as_ref() == "data"
    )));
    assert_eq!(display_prop_value(style_expr(&static_false)).as_deref(), Some("none"));
    assert!(static_false.attrs.iter().all(|attr| match attr {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(name) => name.sym.as_ref() != "v-show",
            _ => true,
        },
        _ => true,
    }));

    let mut static_true = parse_jsx_opening("<div id=\"x\" r-show={1} />");
    transform_opening(&mut static_true);
    assert_eq!(display_prop_value(style_expr(&static_true)).as_deref(), Some(""));
    assert!(static_true.attrs.iter().all(|attr| match attr {
        JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(name) => name.sym.as_ref() != "r-show",
            _ => true,
        },
        _ => true,
    }));
}

#[test]
fn hardens_show_empty_style_container_and_string_condition_insert() {
    let mut empty_style = parse_jsx_opening("<div v-show={ready} style={styleObj} />");
    set_attr_to_empty_expr(&mut empty_style, "style");
    transform_opening(&mut empty_style);

    match unwrap_expr(style_expr(&empty_style)) {
        Expr::Call(call) => {
            assert_eq!(call.args.len(), 2);
            assert!(
                matches!(unwrap_expr(call.args[0].expr.as_ref()), Expr::Lit(Lit::Str(s)) if s.value.is_empty())
            );
            assert!(
                matches!(unwrap_expr(call.args[1].expr.as_ref()), Expr::Ident(id) if id.sym.as_ref() == "ready")
            );
        }
        other => panic!("expected show style call, got {other:?}"),
    }

    let mut string_condition = parse_jsx_opening("<div r-show=\"ready\" />");
    transform_opening(&mut string_condition);
    match unwrap_expr(style_expr(&string_condition)) {
        Expr::Object(obj) => {
            assert!(obj.props.iter().any(|prop| matches!(
                prop,
                PropOrSpread::Prop(prop)
                    if matches!(prop.as_ref(), Prop::KeyValue(kv)
                        if matches!(&kv.key, PropName::Ident(id) if id.sym.as_ref() == "display"))
            )));
        }
        other => panic!("expected folded object style, got {other:?}"),
    }
}
