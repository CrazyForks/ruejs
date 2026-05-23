use std::sync::Arc;

use swc_core::common::SourceMap;
use swc_core::common::{DUMMY_SP, FileName};
use swc_core::ecma::ast::*;
use swc_core::ecma::parser::{Parser, StringInput, Syntax, TsSyntax};

use crate::emit;
use crate::utils::{is_component, unwrap_expr};

const ON_DIRECTIVE_NAMESPACES: &[&str] = &["v-on", "r-on"];
const SAFE_EVENT_PREFIX: &str = "__rue_on__";
const SAFE_MODIFIERS_MARKER: &str = "__mods__";
const COMPONENT_NATIVE_PREFIX: &str = "__rueNativeOn";
const DIRECTIVE_MODIFIER_NAMES: &[&str] = &[
    "stop", "prevent", "self", "once", "capture", "passive", "native", "ctrl", "shift", "alt",
    "meta", "exact", "enter", "tab", "delete", "esc", "space", "up", "down", "left", "right",
    "middle",
];
const HYPHEN_MODIFIER_EVENT_NAMES: &[&str] = &[
    "click",
    "dblclick",
    "keyup",
    "keydown",
    "keypress",
    "input",
    "change",
    "submit",
    "focus",
    "blur",
    "mousedown",
    "mouseup",
    "mousemove",
    "mouseover",
    "mouseout",
    "mouseenter",
    "mouseleave",
    "wheel",
    "scroll",
    "contextmenu",
    "pointerdown",
    "pointerup",
    "pointermove",
    "touchstart",
    "touchmove",
    "touchend",
];

struct OnDirectiveSpec {
    standard_name: String,
    modifiers: Vec<String>,
    has_native: bool,
}

fn normalize_event_suffix(raw: &str) -> Option<String> {
    let trimmed = raw.trim_matches(|ch| ch == '-' || ch == '_' || ch == ':' || ch == '.');
    if trimmed.is_empty() {
        return None;
    }

    let has_separator = trimmed.chars().any(|ch| ch == '-' || ch == '_' || ch == ':');
    let mut normalized = String::new();

    if has_separator {
        for segment in trimmed.split(|ch| ch == '-' || ch == '_' || ch == ':') {
            if segment.is_empty() {
                continue;
            }
            let mut chars = segment.chars();
            let first = chars.next()?;
            normalized.extend(first.to_uppercase());
            normalized.push_str(chars.as_str());
        }
    } else {
        let mut chars = trimmed.chars();
        let first = chars.next()?;
        normalized.extend(first.to_uppercase());
        normalized.push_str(chars.as_str());
    }

    if normalized.is_empty() { None } else { Some(normalized) }
}

fn normalize_modifier(raw: &str) -> Option<String> {
    let trimmed = raw.trim_matches(|ch| ch == '-' || ch == '_' || ch == ':' || ch == '.');
    if trimmed.is_empty() { None } else { Some(trimmed.to_ascii_lowercase()) }
}

fn is_modifier_token(raw: &str) -> bool {
    let Some(normalized) = normalize_modifier(raw) else {
        return false;
    };

    normalized.chars().all(|ch| ch.is_ascii_digit())
        || DIRECTIVE_MODIFIER_NAMES.contains(&normalized.as_str())
}

fn parse_namespaced_directive_name(raw: &str) -> Option<(String, Vec<String>)> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.contains('.') {
        let mut segments = trimmed.split('.');
        let event_raw = segments.next()?;
        let standard_name = format!("on{}", normalize_event_suffix(event_raw)?);
        let modifiers = segments.filter_map(normalize_modifier).collect();
        return Some((standard_name, modifiers));
    }

    let hyphen_tokens: Vec<&str> =
        trimmed.split('-').filter(|segment| !segment.is_empty()).collect();
    if hyphen_tokens.len() > 1 {
        let mut modifiers = Vec::new();
        let mut split_index = hyphen_tokens.len();

        while split_index > 1 {
            let token = hyphen_tokens[split_index - 1];
            if !is_modifier_token(token) {
                break;
            }
            modifiers.insert(0, normalize_modifier(token)?);
            split_index -= 1;
        }

        if !modifiers.is_empty() {
            let event_raw = hyphen_tokens[..split_index].join("-");
            let normalized_event = normalize_event_suffix(&event_raw)?.to_ascii_lowercase();
            if HYPHEN_MODIFIER_EVENT_NAMES.contains(&normalized_event.as_str()) {
                let standard_name = format!("on{}", normalize_event_suffix(&event_raw)?);
                return Some((standard_name, modifiers));
            }
        }
    }

    Some((format!("on{}", normalize_event_suffix(trimmed)?), Vec::new()))
}

fn parse_expr(src: &str, filename: &str) -> Option<Expr> {
    let cm = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(FileName::Custom(filename.into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    let expr = parser.parse_expr().ok()?;
    Some(*expr)
}

fn parse_inline_handler_source(src: &str) -> Option<Expr> {
    let trimmed = src.trim();
    if trimmed.is_empty() {
        return Some(build_noop_handler());
    }

    if !trimmed.contains(';') {
        if let Some(expr) = parse_expr(trimmed, "v-on-handler.tsx") {
            return Some(expr);
        }
    }

    parse_expr(&format!("($event) => {{ {} }}", trimmed), "v-on-handler-inline-statements.tsx")
}

fn parse_safe_directive_name(raw: &str) -> Option<(String, Vec<String>)> {
    let rest = raw.strip_prefix(SAFE_EVENT_PREFIX)?;
    let (event_raw, modifier_raw) = match rest.split_once(SAFE_MODIFIERS_MARKER) {
        Some((event_raw, modifier_raw)) => (event_raw, Some(modifier_raw)),
        None => (rest, None),
    };

    let standard_name = format!("on{}", normalize_event_suffix(event_raw)?);
    let modifiers = modifier_raw
        .map(|raw| raw.split("__").filter_map(normalize_modifier).collect())
        .unwrap_or_default();
    Some((standard_name, modifiers))
}

fn directive_spec_from_name(name: &JSXAttrName) -> Option<OnDirectiveSpec> {
    let (standard_name, modifiers) = match name {
        JSXAttrName::JSXNamespacedName(ns_name) => {
            let ns = ns_name.ns.sym.as_ref();
            if !ON_DIRECTIVE_NAMESPACES.contains(&ns) {
                return None;
            }

            parse_namespaced_directive_name(ns_name.name.sym.as_ref())?
        }
        JSXAttrName::Ident(ident) => parse_safe_directive_name(ident.sym.as_ref())?,
    };

    let has_native = modifiers.iter().any(|modifier| modifier == "native");
    Some(OnDirectiveSpec { standard_name, modifiers, has_native })
}

fn build_event_param() -> Pat {
    Pat::Ident(BindingIdent { id: emit::ident("$event"), type_ann: None })
}

fn build_noop_handler() -> Expr {
    Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![build_event_param()],
        body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
            span: DUMMY_SP,
            ctxt: Default::default(),
            stmts: vec![],
        })),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: Default::default(),
    })
}

fn build_event_arrow(body: Expr) -> Expr {
    Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![build_event_param()],
        body: Box::new(BlockStmtOrExpr::Expr(Box::new(body))),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: Default::default(),
    })
}

fn is_method_path(expr: &Expr) -> bool {
    matches!(unwrap_expr(expr), Expr::Ident(_) | Expr::Member(_))
}

fn build_handler_expr(expr: Expr) -> Expr {
    let inner = unwrap_expr(&expr).clone();
    match &inner {
        Expr::Arrow(_) | Expr::Fn(_) => inner,
        _ if is_method_path(&inner) => Expr::Arrow(ArrowExpr {
            span: DUMMY_SP,
            params: vec![build_event_param()],
            body: Box::new(BlockStmtOrExpr::Expr(Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                callee: Callee::Expr(Box::new(inner)),
                args: vec![ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Ident(emit::ident("$event").into())),
                }],
                type_args: None,
                ctxt: Default::default(),
            })))),
            is_async: false,
            is_generator: false,
            type_params: None,
            return_type: None,
            ctxt: Default::default(),
        }),
        _ => build_event_arrow(inner),
    }
}

fn build_handler_expr_from_attr(attr: &JSXAttr) -> Option<Expr> {
    let expr = match &attr.value {
        None => return Some(build_noop_handler()),
        Some(JSXAttrValue::Str(s)) => parse_inline_handler_source(&s.value.to_string_lossy())?,
        Some(JSXAttrValue::JSXExprContainer(container)) => match &container.expr {
            JSXExpr::Expr(expr) => unwrap_expr(expr.as_ref()).clone(),
            JSXExpr::JSXEmptyExpr(_) => return Some(build_noop_handler()),
        },
        _ => return None,
    };

    Some(build_handler_expr(expr))
}

fn modifier_array_expr(modifiers: &[String]) -> Expr {
    Expr::Array(ArrayLit {
        span: DUMMY_SP,
        elems: modifiers
            .iter()
            .map(|modifier| {
                Some(ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: modifier.as_str().into(),
                        raw: None,
                    }))),
                })
            })
            .collect(),
    })
}

fn wrap_with_modifiers(handler: Expr, modifiers: &[String]) -> Expr {
    if modifiers.is_empty() {
        handler
    } else {
        emit::call_ident("_$vaporWithEventModifiers", vec![handler, modifier_array_expr(modifiers)])
    }
}

fn handler_to_attr_value(handler: Expr) -> JSXAttrValue {
    JSXAttrValue::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(handler)),
    })
}

fn native_prop_name(standard_name: &str) -> String {
    format!("{}{}", COMPONENT_NATIVE_PREFIX, standard_name.trim_start_matches("on"))
}

pub fn transform_opening(opening: &mut JSXOpeningElement) {
    let is_component_opening = is_component(&opening.name);

    for attr_or_spread in &mut opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr_or_spread else {
            continue;
        };

        let Some(spec) = directive_spec_from_name(&attr.name) else {
            continue;
        };
        let Some(handler_expr) = build_handler_expr_from_attr(attr) else {
            continue;
        };

        let runtime_modifiers: Vec<String> = spec
            .modifiers
            .iter()
            .filter(|modifier| modifier.as_str() != "native")
            .cloned()
            .collect();
        let handler_expr = wrap_with_modifiers(handler_expr, &runtime_modifiers);

        let next_name = if is_component_opening && spec.has_native {
            native_prop_name(&spec.standard_name)
        } else {
            spec.standard_name.clone()
        };

        attr.value = Some(handler_to_attr_value(handler_expr));
        attr.name = JSXAttrName::Ident(emit::ident(next_name.as_str()).into());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::ecma::ast::{ExprStmt, Module, ModuleItem, Program, Stmt};
    use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
    use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

    fn parse_ts_expr(src: &str) -> Expr {
        let cm = Arc::new(SourceMap::default());
        let fm = cm.new_source_file(
            FileName::Custom("on-directive-test.ts".into()).into(),
            src.to_string(),
        );
        let mut parser = Parser::new(
            Syntax::Typescript(TsSyntax { tsx: false, ..Default::default() }),
            StringInput::from(&*fm),
            None,
        );
        *parser.parse_expr().expect("parse typescript expr")
    }

    fn parse_jsx_opening(src: &str) -> JSXOpeningElement {
        let cm = Arc::new(SourceMap::default());
        let fm = cm.new_source_file(
            FileName::Custom("on-directive-test.tsx".into()).into(),
            src.to_string(),
        );
        let mut parser = Parser::new(
            Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
            StringInput::from(&*fm),
            None,
        );
        match *parser.parse_expr().expect("parse jsx expr") {
            Expr::JSXElement(el) => el.opening,
            other => panic!("expected JSXElement, got {other:?}"),
        }
    }

    fn emit_expr(expr: Expr) -> String {
        let cm = Arc::new(SourceMap::default());
        let module = Module {
            span: DUMMY_SP,
            body: vec![ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(expr),
            }))],
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

    fn ident_attr<'a>(opening: &'a JSXOpeningElement, name: &str) -> &'a JSXAttr {
        opening
            .attrs
            .iter()
            .find_map(|attr| match attr {
                JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
                    JSXAttrName::Ident(ident) if ident.sym.as_ref() == name => Some(attr),
                    _ => None,
                },
                _ => None,
            })
            .expect("expected attr")
    }

    fn attr_expr(attr: &JSXAttr) -> &Expr {
        match attr.value.as_ref().expect("attr value") {
            JSXAttrValue::JSXExprContainer(container) => match &container.expr {
                JSXExpr::Expr(expr) => expr.as_ref(),
                _ => panic!("expected expr attr"),
            },
            other => panic!("expected expr container, got {other:?}"),
        }
    }

    #[test]
    fn normalizes_event_names_and_safe_directive_markers() {
        assert_eq!(normalize_event_suffix("__mouse_down"), Some("MouseDown".to_string()));
        assert_eq!(normalize_event_suffix("..."), None);

        assert_eq!(normalize_modifier("__Prevent"), Some("prevent".to_string()));
        assert!(is_modifier_token("once"));
        assert!(is_modifier_token("12"));
        assert!(!is_modifier_token("custom"));

        assert_eq!(
            parse_namespaced_directive_name("click.prevent.stop"),
            Some(("onClick".to_string(), vec!["prevent".to_string(), "stop".to_string()])),
        );
        assert_eq!(
            parse_namespaced_directive_name("click-meta-exact"),
            Some(("onClick".to_string(), vec!["meta".to_string(), "exact".to_string()])),
        );
        assert_eq!(
            parse_namespaced_directive_name("mouse_down"),
            Some(("onMouseDown".to_string(), Vec::new())),
        );
        assert_eq!(
            parse_safe_directive_name("__rue_on__mouse_down__mods__native__once"),
            Some(("onMouseDown".to_string(), vec!["native".to_string(), "once".to_string()],)),
        );
    }

    #[test]
    fn parses_inline_handlers_and_wraps_handler_shapes() {
        let empty = parse_inline_handler_source("").expect("empty handler");
        assert_eq!(normalize(&emit_expr(empty)), normalize("($event)=>{};"));

        let inline_statements =
            parse_inline_handler_source("count++; log($event)").expect("inline statements");
        let emitted_inline = normalize(&emit_expr(inline_statements));
        assert!(emitted_inline.contains(&normalize("($event)=>{")));
        assert!(emitted_inline.contains(&normalize("count++;")));
        assert!(emitted_inline.contains(&normalize("log($event)")));

        let method_handler = build_handler_expr(parse_ts_expr("actions.submit"));
        assert_eq!(
            normalize(&emit_expr(method_handler)),
            normalize("($event)=>actions.submit($event);"),
        );

        let call_handler = build_handler_expr(parse_ts_expr("submit()"));
        assert_eq!(normalize(&emit_expr(call_handler)), normalize("($event)=>submit();"));

        let literal_handler = build_handler_expr(parse_ts_expr("($event) => submit($event)"));
        assert_eq!(normalize(&emit_expr(literal_handler)), normalize("($event)=>submit($event);"),);
    }

    #[test]
    fn rewrites_standard_native_and_safe_event_directives() {
        let mut dom_opening = parse_jsx_opening("<div v-on:click-stop-prevent=\"submit\" />");
        transform_opening(&mut dom_opening);

        let dom_attr = ident_attr(&dom_opening, "onClick");
        let dom_expr = normalize(&emit_expr(attr_expr(dom_attr).clone()));
        assert!(dom_expr.contains("_$vaporWithEventModifiers"));
        assert!(dom_expr.contains(&normalize("submit($event)")));
        assert!(dom_expr.contains(&normalize("\"stop\"")));
        assert!(dom_expr.contains(&normalize("\"prevent\"")));

        let mut component_opening =
            parse_jsx_opening("<Card r-on:click-native-once={handleClick} />");
        transform_opening(&mut component_opening);

        let component_attr = ident_attr(&component_opening, "__rueNativeOnClick");
        let component_expr = normalize(&emit_expr(attr_expr(component_attr).clone()));
        assert!(component_expr.contains("_$vaporWithEventModifiers"));
        assert!(component_expr.contains(&normalize("handleClick($event)")));
        assert!(component_expr.contains(&normalize("\"once\"")));
        assert!(!component_expr.contains(&normalize("\"native\"")));

        let mut safe_opening = parse_jsx_opening("<div __rue_on__keyup__mods__enter />");
        transform_opening(&mut safe_opening);

        let safe_attr = ident_attr(&safe_opening, "onKeyup");
        let safe_expr = normalize(&emit_expr(attr_expr(safe_attr).clone()));
        assert!(safe_expr.contains("_$vaporWithEventModifiers"));
        assert!(safe_expr.contains(&normalize("($event)=>{}")));
        assert!(safe_expr.contains(&normalize("\"enter\"")));
    }

    #[test]
    fn leaves_non_directive_attrs_unchanged() {
        let mut opening = parse_jsx_opening("<div onClick={handleClick} />");
        transform_opening(&mut opening);

        let attr = ident_attr(&opening, "onClick");
        assert_eq!(normalize(&emit_expr(attr_expr(attr).clone())), normalize("handleClick;"));
    }
}
