// 原子字符串：用于构造稳定的字符串字面量
use swc_core::atoms::Atom;
// 稳定的占位位置信息（span），避免来源位置信息影响测试
use swc_core::common::DUMMY_SP;
// SWC ECMAScript/JSX AST 节点类型集合
use swc_core::ecma::ast::*;

/*
工具与判定函数：
- unwrap_expr：剥离括号与 TS 断言，获取表达式核心；
- is_component：首字母大写即组件；
- is_children_member_expr：识别任意对象的 `.children`；
- 文本/空值判定：is_static_empty_like / is_static_text_literal / get_static_text_literal_expr；
- 组件静态性：is_static_component_without_props / is_static_component_children_ident / component_has_no_dynamic_props_excluding_children；
- 事件/回调属性：is_event_attr / is_callback_attr 用于静态性判断的放行。
*/
/// 工具函数说明：
/// - `unwrap_expr`：剥离括号与 TS 断言，得到表达式核心（便于统一判别与改写）。
/// - `is_component`：首字母大写即组件，用于决定走组件渲染分支。
/// - `is_props_member_expr`：识别 `props.xxx`，用于 children/slot 的特殊处理。
/// - `is_static_empty_like`/`is_static_text_literal`：静态空值与文本字面量判定，优化无需 watch 的一次性设置路径。
/// - `get_static_text_literal_expr`：数字转字符串以保持 textContent 的一致类型。
/// 去掉表达式外层的括号与 TS 类型断言，获得真实表达式
pub fn unwrap_expr(e: &Expr) -> &Expr {
    let mut x = e;
    loop {
        match x {
            Expr::Paren(p) => {
                x = &*p.expr;
            }
            Expr::TsAs(a) => {
                x = &*a.expr;
            }
            Expr::TsTypeAssertion(a) => {
                x = &*a.expr;
            }
            _ => break,
        }
    }
    x
}

/// 判断 JSX 元素是否为组件：
/// - 大写标识符视为组件
/// - JSX 成员表达式（如 `Card.Body` / `Collapse.Title`）也始终视为组件
pub fn is_component(name: &JSXElementName) -> bool {
    match name {
        JSXElementName::Ident(i) => {
            let s = i.sym.to_string();
            s.chars().next().map(|c| c.is_uppercase()).unwrap_or(false)
        }
        JSXElementName::JSXMemberExpr(_) => true,
        _ => false,
    }
}

pub fn is_builtin_fragment_element(el: &JSXElement) -> bool {
    matches!(&el.opening.name, JSXElementName::Ident(id) if id.sym.as_ref() == "Fragment")
}

fn jsx_attr_ident_name(name: &JSXAttrName) -> Option<String> {
    match name {
        JSXAttrName::Ident(i) => Some(i.sym.to_string()),
        _ => None,
    }
}

fn is_event_attr(name: &JSXAttrName) -> bool {
    if let Some(s) = jsx_attr_ident_name(name) {
        s.starts_with("on") && s.chars().nth(2).map(|c| c.is_uppercase()).unwrap_or(false)
    } else {
        false
    }
}

fn is_callback_attr(name: &JSXAttrName) -> bool {
    if let Some(s) = jsx_attr_ident_name(name) {
        let lower = s.to_ascii_lowercase();
        s.starts_with("on")
            || lower.ends_with("handler")
            || lower.ends_with("callback")
            || lower.ends_with("fn")
    } else {
        false
    }
}

/// 判断表达式是否为 `*.children` 成员访问（不再局限于 `props.children`）
/// 用途：识别任意形态的 `children` 插槽值，例如形参命名为 `p`、`props`、`args` 等
pub fn is_children_member_expr(e: &Expr) -> bool {
    let x = unwrap_expr(e);
    match x {
        Expr::Member(m) => match &m.prop {
            MemberProp::Ident(pi) => pi.sym.as_ref() == "children",
            _ => false,
        },
        _ => false,
    }
}

/// 静态空值检测：`null` / 布尔字面量 / `undefined` / `void 0`
/// 在条件表达式与逻辑分支中，空分支将被转换为 `""` 以保持渲染一致
/// 参考：`tests/conditional_rendering*.rs`
pub fn is_static_empty_like(e: &Expr) -> bool {
    let x = unwrap_expr(e);
    match x {
        Expr::Lit(Lit::Null(_)) => true,
        Expr::Lit(Lit::Bool(_)) => true,
        Expr::Ident(id) if id.sym.as_ref() == "undefined" => true,
        Expr::Unary(u) if matches!(u.op, UnaryOp::Void) => true,
        _ => false,
    }
}

/// 静态文本字面量：字符串或数字
pub fn is_static_text_literal(e: &Expr) -> bool {
    let x = unwrap_expr(e);
    matches!(x, Expr::Lit(Lit::Str(_)) | Expr::Lit(Lit::Num(_)))
}

/// 获取静态文本字面量对应的表达式（字符串保持原值；数字转为字符串）
/// 例如：`42` => `"42"`
pub fn get_static_text_literal_expr(e: &Expr) -> Option<Expr> {
    let x = unwrap_expr(e);
    match x {
        Expr::Lit(Lit::Str(s)) => Some(Expr::Lit(Lit::Str(s.clone()))),
        Expr::Lit(Lit::Num(n)) => {
            let v = n.value.to_string();
            Some(Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: Atom::from(v).into(),
                raw: None,
            })))
        }
        _ => None,
    }
}

pub fn is_static_component_without_props(el: &JSXElement) -> bool {
    let opening = &el.opening;
    if !is_component(&opening.name) {
        return false;
    }
    if !el.children.is_empty() {
        return false;
    }
    if opening.attrs.is_empty() {
        return true;
    }
    false
}

pub fn is_static_component_children_ident(el: &JSXElement) -> bool {
    let opening = &el.opening;
    if !is_component(&opening.name) {
        return false;
    }
    if opening.attrs.len() != 1 {
        return false;
    }
    if let JSXAttrOrSpread::JSXAttr(attr) = &opening.attrs[0] {
        if let JSXAttrName::Ident(idn) = &attr.name {
            if idn.sym.as_ref() == "children" {
                if let Some(JSXAttrValue::JSXExprContainer(ec)) = &attr.value {
                    if let JSXExpr::Expr(expr) = &ec.expr {
                        if let Expr::Ident(_) = unwrap_expr(expr) {
                            // children={ident} 以标识符引用的形式，视为静态 children（无需 watch）
                            return true;
                        }
                    }
                }
            }
        }
    }
    false
}

pub fn is_transition_group_component(el: &JSXElement) -> bool {
    match &el.opening.name {
        JSXElementName::Ident(id) => id.sym.as_ref() == "TransitionGroup",
        JSXElementName::JSXMemberExpr(expr) => expr.prop.sym.as_ref() == "TransitionGroup",
        _ => false,
    }
}

fn is_static_literal_expr(e: &Expr) -> bool {
    let x = unwrap_expr(e);
    matches!(
        x,
        Expr::Lit(Lit::Str(_))
            | Expr::Lit(Lit::Num(_))
            | Expr::Lit(Lit::Bool(_))
            | Expr::Lit(Lit::Null(_))
    )
}

fn is_function_literal_expr(e: &Expr) -> bool {
    let x = unwrap_expr(e);
    matches!(x, Expr::Arrow(_) | Expr::Fn(_))
}

pub fn component_has_no_dynamic_props_excluding_children(el: &JSXElement) -> bool {
    let opening = &el.opening;
    if !is_component(&opening.name) {
        return false;
    }
    for a in &opening.attrs {
        if let JSXAttrOrSpread::JSXAttr(attr) = a {
            if let JSXAttrName::Ident(idn) = &attr.name {
                if idn.sym.as_ref() == "children" {
                    continue;
                }
            }
            if is_event_attr(&attr.name) {
                // 事件属性不影响静态性判定
                continue;
            }
            match &attr.value {
                Some(JSXAttrValue::Str(_)) => {}
                Some(JSXAttrValue::JSXExprContainer(ec)) => {
                    if let JSXExpr::Expr(expr) = &ec.expr {
                        if is_function_literal_expr(expr) {
                            // 函数字面量作为属性值不影响静态性判定
                            continue;
                        }
                        if let Expr::Ident(_) = unwrap_expr(expr) {
                            if is_callback_attr(&attr.name) {
                                // 形如 foo={bar}，当属性名表现为回调类语义时视为函数引用，不影响静态性
                                continue;
                            }
                        }
                        if !is_static_literal_expr(expr) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                _ => {
                    return false;
                }
            }
        } else {
            // spread 或其它形式视为动态
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use swc_core::common::{FileName, SourceMap};
    use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

    fn parse_expr(src: &str, tsx: bool) -> Expr {
        let cm = Arc::new(SourceMap::default());
        let fm =
            cm.new_source_file(FileName::Custom("utils-test.tsx".into()).into(), src.to_string());
        let mut parser = Parser::new(
            Syntax::Typescript(TsSyntax { tsx, ..Default::default() }),
            StringInput::from(&*fm),
            None,
        );
        *parser.parse_expr().expect("parse expr")
    }

    fn parse_jsx_element(src: &str) -> JSXElement {
        match parse_expr(src, true) {
            Expr::JSXElement(el) => *el,
            other => panic!("expected JSXElement, got {other:?}"),
        }
    }

    #[test]
    fn unwraps_ts_wrappers_and_detects_component_like_elements() {
        let paren_expr = parse_expr("(((foo)))", false);
        assert!(matches!(unwrap_expr(&paren_expr), Expr::Ident(id) if id.sym.as_ref() == "foo"));

        let as_expr = parse_expr("foo as number", false);
        assert!(matches!(unwrap_expr(&as_expr), Expr::Ident(id) if id.sym.as_ref() == "foo"));

        let type_assert_expr = parse_expr("<number>foo", false);
        assert!(
            matches!(unwrap_expr(&type_assert_expr), Expr::Ident(id) if id.sym.as_ref() == "foo")
        );

        assert!(is_component(&parse_jsx_element("<Dialog />").opening.name));
        assert!(!is_component(&parse_jsx_element("<dialog />").opening.name));
        assert!(is_component(&parse_jsx_element("<Dialog.Header />").opening.name));
        assert!(is_builtin_fragment_element(&parse_jsx_element("<Fragment />")));
        assert!(is_transition_group_component(&parse_jsx_element("<TransitionGroup />")));
        assert!(is_transition_group_component(&parse_jsx_element("<UI.TransitionGroup />")));
        assert!(!is_transition_group_component(&parse_jsx_element("<UI.Panel />")));
    }

    #[test]
    fn detects_children_members_and_static_literal_shapes() {
        assert!(is_children_member_expr(&parse_expr("props.children", false)));
        assert!(is_children_member_expr(&parse_expr("ctx.children", false)));
        assert!(!is_children_member_expr(&parse_expr("props['children']", false)));

        assert!(is_static_empty_like(&parse_expr("null", false)));
        assert!(is_static_empty_like(&parse_expr("false", false)));
        assert!(is_static_empty_like(&parse_expr("undefined", false)));
        assert!(is_static_empty_like(&parse_expr("void 0", false)));
        assert!(!is_static_empty_like(&parse_expr("1", false)));

        assert!(is_static_text_literal(&parse_expr("'hello'", false)));
        assert!(is_static_text_literal(&parse_expr("42", false)));
        assert!(!is_static_text_literal(&parse_expr("true", false)));

        let str_expr =
            get_static_text_literal_expr(&parse_expr("'hello'", false)).expect("string lit");
        assert!(
            matches!(str_expr, Expr::Lit(Lit::Str(s)) if s.value.as_str().unwrap_or("") == "hello")
        );

        let number_expr =
            get_static_text_literal_expr(&parse_expr("42", false)).expect("number lit");
        assert!(
            matches!(number_expr, Expr::Lit(Lit::Str(s)) if s.value.as_str().unwrap_or("") == "42")
        );
    }

    #[test]
    fn detects_static_component_shortcuts() {
        assert!(is_static_component_without_props(&parse_jsx_element("<Card />")));
        assert!(!is_static_component_without_props(&parse_jsx_element("<Card title=\"x\" />")));
        assert!(!is_static_component_without_props(&parse_jsx_element("<Card>Child</Card>")));
        assert!(!is_static_component_without_props(&parse_jsx_element("<div />")));

        assert!(is_static_component_children_ident(&parse_jsx_element("<Card children={slot} />")));
        assert!(!is_static_component_children_ident(&parse_jsx_element(
            "<Card children=\"slot\" />"
        )));
        assert!(!is_static_component_children_ident(&parse_jsx_element(
            "<Card children={slot} extra=\"x\" />"
        )));
        assert!(!is_static_component_children_ident(&parse_jsx_element("<div children={slot} />")));
    }

    #[test]
    fn distinguishes_dynamic_component_props_from_allowed_static_and_callback_forms() {
        let static_component = parse_jsx_element(
            "<Card title=\"ok\" count={1} active={true} onClick={handleClick} footerCallback={handleFooter} renderFn={() => null} children={slot} />",
        );
        assert!(component_has_no_dynamic_props_excluding_children(&static_component));

        let dynamic_ident_prop = parse_jsx_element("<Card data={store} />");
        assert!(!component_has_no_dynamic_props_excluding_children(&dynamic_ident_prop));

        let spread_component = parse_jsx_element("<Card {...props} title=\"ok\" />");
        assert!(!component_has_no_dynamic_props_excluding_children(&spread_component));

        let dynamic_expr_component = parse_jsx_element("<Card title={label + suffix} />");
        assert!(!component_has_no_dynamic_props_excluding_children(&dynamic_expr_component));

        let native_el = parse_jsx_element("<div title=\"ok\" />");
        assert!(!component_has_no_dynamic_props_excluding_children(&native_el));
    }
}
