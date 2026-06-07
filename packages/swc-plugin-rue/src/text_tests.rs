use super::*;
use std::sync::Arc;
use swc_core::common::DUMMY_SP;
use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::ast::{
    Expr, JSXElementChild, JSXExpr, JSXExprContainer, JSXFragment, Lit, Str,
};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_fragment(src: &str) -> JSXFragment {
    let cm = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(FileName::Custom("text-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    match *parser.parse_expr().expect("parse fragment") {
        Expr::JSXFragment(fragment) => fragment,
        _ => panic!("expected jsx fragment"),
    }
}

fn string_expr(value: &str) -> JSXElementChild {
    JSXElementChild::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: value.into(),
            raw: None,
        })))),
    })
}

fn jsx_text(value: &str) -> JSXElementChild {
    JSXElementChild::JSXText(swc_core::ecma::ast::JSXText {
        span: DUMMY_SP,
        value: value.into(),
        raw: value.into(),
    })
}

fn empty_expr() -> JSXElementChild {
    JSXElementChild::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::JSXEmptyExpr(swc_core::ecma::ast::JSXEmptyExpr { span: DUMMY_SP }),
    })
}

#[test]
fn normalize_text_collapses_newlines_but_preserves_inline_spaces() {
    assert_eq!(normalize_text("foo   bar"), "foo   bar");
    assert_eq!(normalize_text("foo \n  bar\r\n baz"), "foo bar baz");
    assert_eq!(normalize_text("foo\tbar"), "foo\tbar");
    assert_eq!(normalize_text("foo\r\n"), "foo ");
}

#[test]
fn keeps_inline_spacing_around_expression_neighbors() {
    let fragment = parse_fragment("<>Hello {year} Rue</>");
    let children = &fragment.children;

    let JSXElementChild::JSXText(first) = &children[0] else {
        panic!("expected first text child");
    };
    let JSXElementChild::JSXText(last) = &children[2] else {
        panic!("expected trailing text child");
    };

    assert_eq!(
        compute_jsx_text_content(children, 0, &normalize_text(&first.value)),
        Some("Hello ".to_string())
    );
    assert_eq!(
        compute_jsx_text_content(children, 2, &normalize_text(&last.value)),
        Some(" Rue".to_string())
    );
}

#[test]
fn collapses_or_drops_whitespace_only_nodes_by_context() {
    let inline = parse_fragment("<>{left}   {right}</>");
    let JSXElementChild::JSXText(inline_gap) = &inline.children[1] else {
        panic!("expected inline whitespace child");
    };
    assert_eq!(
        compute_jsx_text_content(&inline.children, 1, &normalize_text(&inline_gap.value)),
        Some(" ".to_string())
    );

    let block_only_children = vec![JSXElementChild::JSXText(swc_core::ecma::ast::JSXText {
        span: DUMMY_SP,
        value: "   ".into(),
        raw: "   ".into(),
    })];
    assert_eq!(compute_jsx_text_content(&block_only_children, 0, "   "), None);
}

#[test]
fn trims_visible_text_against_explicit_space_neighbors() {
    let leading_space_neighbor = vec![
        string_expr(" "),
        parse_fragment("<> hello {name}</>").children[0].clone(),
        parse_fragment("<> hello {name}</>").children[1].clone(),
    ];
    let JSXElementChild::JSXText(leading_text) = &leading_space_neighbor[1] else {
        panic!("expected leading text child");
    };
    assert_eq!(
        compute_jsx_text_content(&leading_space_neighbor, 1, &normalize_text(&leading_text.value),),
        Some("hello ".to_string())
    );

    let trailing_space_neighbor = vec![
        parse_fragment("<>{name} hello </>").children[0].clone(),
        parse_fragment("<>{name} hello </>").children[1].clone(),
        string_expr(" "),
    ];
    let JSXElementChild::JSXText(trailing_text) = &trailing_space_neighbor[1] else {
        panic!("expected trailing text child");
    };
    assert_eq!(
        compute_jsx_text_content(
            &trailing_space_neighbor,
            1,
            &normalize_text(&trailing_text.value),
        ),
        Some(" hello".to_string())
    );
}

#[test]
fn handles_jsx_text_neighbors_and_empty_expr_neighbors() {
    let visible_text_neighbors = vec![jsx_text("left"), jsx_text("  middle  "), jsx_text("right")];
    let JSXElementChild::JSXText(middle) = &visible_text_neighbors[1] else {
        panic!("expected middle text child");
    };
    assert_eq!(
        compute_jsx_text_content(&visible_text_neighbors, 1, &normalize_text(&middle.value),),
        Some("  middle  ".to_string())
    );

    let whitespace_text_neighbors = vec![jsx_text(" "), jsx_text(" padded "), jsx_text("\n")];
    let JSXElementChild::JSXText(padded) = &whitespace_text_neighbors[1] else {
        panic!("expected padded text child");
    };
    assert_eq!(
        compute_jsx_text_content(&whitespace_text_neighbors, 1, &normalize_text(&padded.value),),
        Some("padded".to_string())
    );

    let empty_expr_neighbors = vec![empty_expr(), jsx_text(" padded "), empty_expr()];
    let JSXElementChild::JSXText(empty_padded) = &empty_expr_neighbors[1] else {
        panic!("expected padded text child");
    };
    assert_eq!(
        compute_jsx_text_content(&empty_expr_neighbors, 1, &normalize_text(&empty_padded.value),),
        Some(" padded ".to_string())
    );
}
