use super::*;
use swc_core::ecma::ast::{ExprStmt, Module, ModuleItem, Program, Stmt};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_jsx_element(src: &str) -> JSXElement {
    let cm = Arc::new(SourceMap::default());
    let fm = cm
        .new_source_file(FileName::Custom("if-directive-test.tsx".into()).into(), src.to_string());
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

fn ident_attr<'a>(el: &'a JSXElement, name: &str) -> &'a JSXAttr {
    get_directive_attr(el, &[name])
        .or_else(|| {
            el.opening.attrs.iter().find_map(|attr| match attr {
                JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
                    JSXAttrName::Ident(ident) if ident.sym.as_ref() == name => Some(attr),
                    _ => None,
                },
                _ => None,
            })
        })
        .expect("expected attr")
}

fn child_expr(child: &JSXElementChild) -> &Expr {
    match child {
        JSXElementChild::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => expr.as_ref(),
            _ => panic!("expected expr container"),
        },
        other => panic!("expected expr child, got {other:?}"),
    }
}

#[test]
fn pre_directive_short_circuits_other_rewrites() {
    let mut el = parse_jsx_element("<div v-pre v-text=\"msg\"></div>");
    transform_element(&mut el);

    assert!(has_pre_directive(&el));
    assert!(get_directive_attr(&el, TEXT_DIRECTIVE_NAMES).is_some());
    assert!(el.children.is_empty());
}

#[test]
fn memo_and_once_directives_lower_to_use_memo_wrappers() {
    let once_el = parse_jsx_element("<section v-once className=\"x\" />");
    let once_expr = memo_or_once_element_expr(&once_el).expect("v-once expr");
    let once_out = normalize(&emit_expr(once_expr));
    assert!(once_out.contains("_$vaporWithHookId"));
    assert!(once_out.contains("useMemo"));
    assert!(once_out.contains(&normalize("[]")));
    assert!(!once_out.contains("v-once"));

    let memo_el = parse_jsx_element("<section v-memo={[count]} />");
    let memo_expr = memo_or_once_element_expr(&memo_el).expect("v-memo expr");
    let memo_out = normalize(&emit_expr(memo_expr));
    assert!(memo_out.contains("_$vaporWithHookId"));
    assert!(memo_out.contains("useMemo"));
    assert!(memo_out.contains(&normalize("[ count ]")));
    assert!(!memo_out.contains("v-memo"));
}

#[test]
fn text_and_html_directives_rewrite_children_and_attrs() {
    let mut text_el = parse_jsx_element("<div v-text=\"msg\"><span /></div>");
    transform_element(&mut text_el);

    assert!(get_directive_attr(&text_el, TEXT_DIRECTIVE_NAMES).is_none());
    assert_eq!(text_el.children.len(), 1);
    assert!(
        matches!(child_expr(&text_el.children[0]), Expr::Ident(id) if id.sym.as_ref() == "msg")
    );

    let mut html_el = parse_jsx_element("<div r-html=\"markup\"><span /></div>");
    transform_element(&mut html_el);

    assert!(get_directive_attr(&html_el, HTML_DIRECTIVE_NAMES).is_none());
    assert!(html_el.children.is_empty());
    let html_attr = ident_attr(&html_el, "dangerouslySetInnerHTML");
    let JSXAttrValue::JSXExprContainer(container) = html_attr.value.as_ref().expect("html value")
    else {
        panic!("expected html expr container");
    };
    let JSXExpr::Expr(expr) = &container.expr else {
        panic!("expected html expr");
    };
    match expr.as_ref() {
        Expr::Object(obj) => {
            assert!(matches!(
                &obj.props[0],
                PropOrSpread::Prop(prop)
                    if matches!(prop.as_ref(), Prop::KeyValue(kv)
                        if matches!(&kv.key, PropName::Ident(id) if id.sym.as_ref() == "__html")
                        && matches!(kv.value.as_ref(), Expr::Ident(id) if id.sym.as_ref() == "markup"))
            ));
        }
        other => panic!("expected object expr, got {other:?}"),
    }
}

#[test]
fn covers_directive_value_removal_and_chain_break_edges() {
    let bare_if = parse_jsx_element("<A v-if />");
    assert!(get_attr_value_expr(ident_attr(&bare_if, "v-if")).is_none());

    let string_if = parse_jsx_element("<A v-if=\"ok\" />");
    assert!(matches!(
        get_attr_value_expr(ident_attr(&string_if, "v-if")),
        Some(Expr::Lit(Lit::Str(_)))
    ));

    let invalid_text = parse_jsx_element("<A v-text=\"}\" />");
    assert!(get_text_attr_value_expr(ident_attr(&invalid_text, "v-text")).is_none());

    let bare_text = parse_jsx_element("<A v-text />");
    assert!(get_text_attr_value_expr(ident_attr(&bare_text, "v-text")).is_none());

    let mut empty_expr = parse_jsx_element("<A v-if={ok} v-text={msg} />");
    for attr_or_spread in &mut empty_expr.opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr_or_spread else {
            continue;
        };
        attr.value = Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
            span: DUMMY_SP,
            expr: JSXExpr::JSXEmptyExpr(JSXEmptyExpr { span: DUMMY_SP }),
        }));
    }
    assert!(get_attr_value_expr(ident_attr(&empty_expr, "v-if")).is_none());
    assert!(get_text_attr_value_expr(ident_attr(&empty_expr, "v-text")).is_none());

    let mut with_non_ident = parse_jsx_element(
        "<A {...props} data:x=\"y\" v-if={ok} r-else-if={alt} v-else v-text={msg} v-html={html} v-once v-memo={[deps]} />",
    );
    remove_directives(&mut with_non_ident);
    remove_text_directives(&mut with_non_ident);
    remove_html_directives(&mut with_non_ident);
    remove_once_directives(&mut with_non_ident);
    remove_memo_directives(&mut with_non_ident);
    assert!(
        with_non_ident
            .opening
            .attrs
            .iter()
            .any(|attr| matches!(attr, JSXAttrOrSpread::SpreadElement(_)))
    );
    assert!(with_non_ident.opening.attrs.iter().any(|attr| matches!(
        attr,
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::JSXNamespacedName(ns_name),
            ..
        }) if ns_name.ns.sym.as_ref() == "data"
    )));
    assert!(get_directive_attr(&with_non_ident, IF_DIRECTIVE_NAMES).is_none());
    assert!(get_directive_attr(&with_non_ident, TEXT_DIRECTIVE_NAMES).is_none());
    assert!(get_directive_attr(&with_non_ident, HTML_DIRECTIVE_NAMES).is_none());
    assert_eq!(normalize(&emit_expr(build_cond_expr(&[]))), normalize("null;"));
    assert!(memo_or_once_element_expr(&parse_jsx_element("<A v-pre v-once />")).is_none());

    let mut text_break = parse_jsx_element("<div><A v-if={a} /> text <B v-else /></div>");
    transform_element(&mut text_break);
    assert_eq!(text_break.children.len(), 3);
    assert!(matches!(child_expr(&text_break.children[0]), Expr::Cond(_)));
    assert!(
        matches!(&text_break.children[1], JSXElementChild::JSXText(text) if !text.value.trim().is_empty())
    );

    let mut pre_break = parse_jsx_element("<div><A v-if={a} /><B v-pre v-else /></div>");
    transform_element(&mut pre_break);
    assert_eq!(pre_break.children.len(), 2);
    assert!(matches!(child_expr(&pre_break.children[0]), Expr::Cond(_)));
    assert!(
        matches!(&pre_break.children[1], JSXElementChild::JSXElement(el) if has_pre_directive(el.as_ref()))
    );

    let mut element_break = parse_jsx_element("<div><A v-if={a} /><B /></div>");
    transform_element(&mut element_break);
    assert_eq!(element_break.children.len(), 2);
    assert!(matches!(child_expr(&element_break.children[0]), Expr::Cond(_)));

    let mut expr_break = parse_jsx_element("<div><A v-if={a} />{side}<B v-else /></div>");
    transform_element(&mut expr_break);
    assert_eq!(expr_break.children.len(), 3);
    assert!(matches!(child_expr(&expr_break.children[0]), Expr::Cond(_)));
    assert!(matches!(&expr_break.children[1], JSXElementChild::JSXExprContainer(_)));

    let mut starts_without_if = parse_jsx_element("<div><A /><B v-else /></div>");
    transform_element(&mut starts_without_if);
    assert_eq!(starts_without_if.children.len(), 2);
    assert!(matches!(starts_without_if.children[0], JSXElementChild::JSXElement(_)));

    let mut starts_with_else = parse_jsx_element("<div><A v-else /><B /></div>");
    transform_element(&mut starts_with_else);
    assert_eq!(starts_with_else.children.len(), 2);
    assert!(matches!(starts_with_else.children[0], JSXElementChild::JSXElement(_)));

    let mut r_memo = parse_jsx_element("<A r-memo={[deps]} data:x=\"y\" />");
    remove_memo_directives(&mut r_memo);
    assert!(get_directive_attr(&r_memo, MEMO_DIRECTIVE_NAMES).is_none());
    assert!(r_memo.opening.attrs.iter().any(|attr| matches!(
        attr,
        JSXAttrOrSpread::JSXAttr(JSXAttr {
            name: JSXAttrName::JSXNamespacedName(ns_name),
            ..
        }) if ns_name.ns.sym.as_ref() == "data"
    )));
}

#[test]
fn transforms_if_else_chains_and_standalone_once_children() {
    let mut parent =
        parse_jsx_element("<div><A v-if={a} /> \n <B v-else-if={b} /> \n <C v-else /></div>");
    transform_element(&mut parent);

    assert_eq!(parent.children.len(), 1);
    let Expr::Cond(root) = child_expr(&parent.children[0]) else {
        panic!("expected root cond expr");
    };
    assert!(matches!(root.test.as_ref(), Expr::Ident(id) if id.sym.as_ref() == "a"));
    let Expr::JSXElement(cons_a) = root.cons.as_ref() else {
        panic!("expected A branch");
    };
    assert!(get_directive_attr(cons_a.as_ref(), IF_DIRECTIVE_NAMES).is_none());

    let Expr::Cond(nested) = root.alt.as_ref() else {
        panic!("expected nested cond expr");
    };
    assert!(matches!(nested.test.as_ref(), Expr::Ident(id) if id.sym.as_ref() == "b"));
    let Expr::JSXElement(cons_b) = nested.cons.as_ref() else {
        panic!("expected B branch");
    };
    assert!(get_directive_attr(cons_b.as_ref(), ELSE_IF_DIRECTIVE_NAMES).is_none());

    let Expr::JSXElement(alt_c) = nested.alt.as_ref() else {
        panic!("expected C branch");
    };
    assert!(get_directive_attr(alt_c.as_ref(), ELSE_DIRECTIVE_NAMES).is_none());

    let mut once_parent = parse_jsx_element("<div><Leaf v-once /></div>");
    transform_element(&mut once_parent);
    assert_eq!(once_parent.children.len(), 1);
    let once_child_out = normalize(&emit_expr(child_expr(&once_parent.children[0]).clone()));
    assert!(once_child_out.contains("_$vaporWithHookId"));
    assert!(once_child_out.contains("useMemo"));
    assert!(!once_child_out.contains("v-once"));
}

#[test]
fn leaves_non_chain_starters_and_broken_else_chains_untouched() {
    let mut parent = parse_jsx_element(
        "<div><Plain /> <Fallback v-else /> <Maybe v-else-if={ready} /> text</div>",
    );
    transform_element(&mut parent);

    assert_eq!(parent.children.len(), 6);
    let plain = match &parent.children[0] {
        JSXElementChild::JSXElement(el) => el,
        other => panic!("expected plain element, got {other:?}"),
    };
    assert!(matches!(
        &plain.opening.name,
        JSXElementName::Ident(name) if name.sym.as_ref() == "Plain"
    ));

    let fallback = match &parent.children[2] {
        JSXElementChild::JSXElement(el) => el,
        other => panic!("expected fallback element, got {other:?}"),
    };
    assert!(get_directive_attr(fallback.as_ref(), ELSE_DIRECTIVE_NAMES).is_some());

    let maybe = match &parent.children[4] {
        JSXElementChild::JSXElement(el) => el,
        other => panic!("expected maybe element, got {other:?}"),
    };
    assert!(get_directive_attr(maybe.as_ref(), ELSE_IF_DIRECTIVE_NAMES).is_some());
}

#[test]
fn hardens_if_chain_empty_item_pre_break_and_non_element_starters() {
    let mut pre_break = parse_jsx_element("<div><A v-if={ok} /> <B v-pre v-else /></div>");
    transform_element(&mut pre_break);

    assert_eq!(pre_break.children.len(), 2);
    let first = child_expr(&pre_break.children[0]);
    assert!(matches!(first, Expr::Cond(_)));
    let pre_child = match &pre_break.children[1] {
        JSXElementChild::JSXElement(el) => el,
        other => panic!("expected pre element, got {other:?}"),
    };
    assert!(has_pre_directive(pre_child.as_ref()));
    assert!(get_directive_attr(pre_child.as_ref(), ELSE_DIRECTIVE_NAMES).is_some());

    let mut non_element = parse_jsx_element("<div>{/* noop */}{...items}<Plain /></div>");
    transform_element(&mut non_element);
    assert!(matches!(&non_element.children[0], JSXElementChild::JSXExprContainer(_)));
    assert!(matches!(&non_element.children[1], JSXElementChild::JSXSpreadChild(_)));
    assert!(matches!(&non_element.children[2], JSXElementChild::JSXElement(_)));

    let mut immediate_non_chain_start = parse_jsx_element("<div><Plain/><Else r-else /></div>");
    transform_element(&mut immediate_non_chain_start);
    assert_eq!(immediate_non_chain_start.children.len(), 2);
    assert!(matches!(
        &immediate_non_chain_start.children[0],
        JSXElementChild::JSXElement(el)
            if matches!(&el.opening.name, JSXElementName::Ident(name) if name.sym.as_ref() == "Plain")
    ));
    assert!(matches!(
        &immediate_non_chain_start.children[1],
        JSXElementChild::JSXElement(el)
            if get_directive_attr(el.as_ref(), ELSE_DIRECTIVE_NAMES).is_some()
    ));
}

#[test]
fn hardens_if_chain_whitespace_spread_and_comment_boundaries() {
    let mut parent = parse_jsx_element("<div>\n <A v-if={a} />\n {...spread}<B v-else />\n</div>");
    transform_element(&mut parent);

    assert_eq!(parent.children.len(), 5);
    assert!(parent.children.iter().any(|child| {
        matches!(
            child,
            JSXElementChild::JSXExprContainer(container)
                if matches!(&container.expr, JSXExpr::Expr(expr) if matches!(expr.as_ref(), Expr::Cond(_)))
        )
    }));
    assert!(
        parent.children.iter().any(|child| matches!(child, JSXElementChild::JSXSpreadChild(_)))
    );
    assert!(parent.children.iter().any(|child| matches!(
        child,
        JSXElementChild::JSXElement(el)
            if get_directive_attr(el.as_ref(), ELSE_DIRECTIVE_NAMES).is_some()
    )));

    let mut comment_break = parse_jsx_element("<div><A v-if={a} />{/* keep */}<B v-else /></div>");
    transform_element(&mut comment_break);
    assert_eq!(comment_break.children.len(), 3);
    assert!(matches!(child_expr(&comment_break.children[0]), Expr::Cond(_)));
    assert!(matches!(&comment_break.children[1], JSXElementChild::JSXExprContainer(_)));
    assert!(matches!(
        &comment_break.children[2],
        JSXElementChild::JSXElement(el)
            if get_directive_attr(el.as_ref(), ELSE_DIRECTIVE_NAMES).is_some()
    ));
}
