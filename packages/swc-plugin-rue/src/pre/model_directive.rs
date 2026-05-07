use std::sync::Arc;

use swc_core::common::{DUMMY_SP, FileName, SourceMap};
use swc_core::ecma::ast::*;
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_core::ecma::parser::{Parser, StringInput, Syntax, TsSyntax};

use crate::emit;
use crate::utils::{is_component, unwrap_expr};

const MODEL_DIRECTIVE_NAMES: &[&str] = &["v-model", "r-model"];
const SAFE_MODEL_PREFIX: &str = "__rue_model__";
const SAFE_MODIFIERS_MARKER: &str = "__mods__";
const RAW_MODEL_MODIFIER_NAMES: &[&str] = &["trim", "number", "lazy"];

#[derive(Clone, Debug)]
struct ModelDirectiveSpec {
    prop_name: String,
    update_name: String,
    modifiers_prop_name: String,
    modifiers: Vec<String>,
}

#[derive(Clone, Debug)]
enum NativeModelKind {
    TextInput { target_type: &'static str, event_name: &'static str, auto_number: bool },
    TextArea,
    Select { multiple: bool },
    Checkbox,
    Radio,
}

fn emit_expr_source(expr: &Expr) -> Option<String> {
    let cm = Arc::new(SourceMap::default());
    let mut buf = Vec::new();
    let mut emitter = Emitter {
        cfg: Default::default(),
        comments: None,
        cm: cm.clone(),
        wr: JsWriter::new(cm, "\n", &mut buf, None),
    };
    let script = Script {
        span: DUMMY_SP,
        body: vec![Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(expr.clone()) })],
        shebang: None,
    };
    emitter.emit_script(&script).ok()?;
    let emitted = String::from_utf8(buf).ok()?;
    Some(emitted.trim().trim_end_matches(';').trim().to_string())
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

fn jsx_attr_value_from_expr(expr: Expr) -> JSXAttrValue {
    JSXAttrValue::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(expr)),
    })
}

fn make_attr(name: &str, expr: Expr) -> JSXAttrOrSpread {
    JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(emit::ident(name).into()),
        value: Some(jsx_attr_value_from_expr(expr)),
    })
}

fn upsert_attr(opening: &mut JSXOpeningElement, name: &str, expr: Expr) {
    for attr_or_spread in &mut opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr_or_spread else {
            continue;
        };
        let JSXAttrName::Ident(ident) = &attr.name else {
            continue;
        };
        if ident.sym.as_ref() != name {
            continue;
        }
        attr.value = Some(jsx_attr_value_from_expr(expr));
        return;
    }

    opening.attrs.push(make_attr(name, expr));
}

fn build_noop_handler() -> Expr {
    Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![],
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

fn parsed_expr_or_noop(src: String, filename: &str) -> Expr {
    parse_expr(&src, filename).unwrap_or_else(build_noop_handler)
}

fn get_attr_value_expr(attr: &JSXAttr) -> Option<Expr> {
    match &attr.value {
        Some(JSXAttrValue::JSXExprContainer(ec)) => match &ec.expr {
            JSXExpr::Expr(e) => Some(*e.clone()),
            _ => None,
        },
        Some(JSXAttrValue::Str(s)) => Some(Expr::Lit(Lit::Str(s.clone()))),
        _ => None,
    }
}

fn get_static_truthy_bool(expr: &Expr) -> Option<bool> {
    match unwrap_expr(expr) {
        Expr::Lit(Lit::Str(s)) => Some(!s.value.is_empty()),
        Expr::Lit(Lit::Num(n)) => Some(n.value != 0.0 && !n.value.is_nan()),
        Expr::Lit(Lit::Bool(b)) => Some(b.value),
        Expr::Lit(Lit::Null(_)) => Some(false),
        Expr::Ident(id) if id.sym.as_ref() == "undefined" => Some(false),
        Expr::Unary(u) if matches!(u.op, UnaryOp::Void) => Some(false),
        _ => None,
    }
}

fn get_attr_expr_by_names(opening: &JSXOpeningElement, names: &[&str]) -> Option<Expr> {
    for attr_or_spread in &opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr_or_spread else {
            continue;
        };
        let JSXAttrName::Ident(ident) = &attr.name else {
            continue;
        };
        if names.contains(&ident.sym.as_ref()) {
            return get_attr_value_expr(attr);
        }
    }
    None
}

fn has_truthy_attr(opening: &JSXOpeningElement, name: &str) -> bool {
    for attr_or_spread in &opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr_or_spread else {
            continue;
        };
        let JSXAttrName::Ident(ident) = &attr.name else {
            continue;
        };
        if ident.sym.as_ref() != name {
            continue;
        }
        return match &attr.value {
            None => true,
            Some(JSXAttrValue::Str(s)) => !s.value.is_empty(),
            Some(JSXAttrValue::JSXExprContainer(ec)) => match &ec.expr {
                JSXExpr::Expr(expr) => get_static_truthy_bool(expr).unwrap_or(true),
                _ => true,
            },
            _ => true,
        };
    }
    false
}

fn get_static_string_attr(opening: &JSXOpeningElement, name: &str) -> Option<String> {
    for attr_or_spread in &opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr_or_spread else {
            continue;
        };
        let JSXAttrName::Ident(ident) = &attr.name else {
            continue;
        };
        if ident.sym.as_ref() != name {
            continue;
        }
        return match &attr.value {
            Some(JSXAttrValue::Str(s)) => Some(s.value.as_str().unwrap_or_default().to_string()),
            Some(JSXAttrValue::JSXExprContainer(ec)) => match &ec.expr {
                JSXExpr::Expr(expr) => match unwrap_expr(expr) {
                    Expr::Lit(Lit::Str(s)) => {
                        Some(s.value.as_str().unwrap_or_default().to_string())
                    }
                    _ => None,
                },
                _ => None,
            },
            _ => None,
        };
    }
    None
}

fn normalize_model_arg(raw: &str) -> Option<String> {
    let trimmed = raw.trim_matches(|ch| ch == '-' || ch == '_' || ch == ':' || ch == '.');
    if trimmed.is_empty() {
        return None;
    }

    if !trimmed.chars().any(|ch| ch == '-' || ch == '_' || ch == ':') {
        let mut chars = trimmed.chars();
        let first = chars.next()?;
        let mut normalized = String::new();
        normalized.extend(first.to_lowercase());
        normalized.push_str(chars.as_str());
        return Some(normalized);
    }

    let mut segments =
        trimmed.split(|ch| ch == '-' || ch == '_' || ch == ':').filter(|s| !s.is_empty());
    let first = segments.next()?.to_ascii_lowercase();
    let mut normalized = first;
    for segment in segments {
        let lower = segment.to_ascii_lowercase();
        let mut chars = lower.chars();
        let first = chars.next()?;
        normalized.extend(first.to_uppercase());
        normalized.push_str(chars.as_str());
    }
    Some(normalized)
}

fn pascalize_prop_name(raw: &str) -> String {
    let mut chars = raw.chars();
    let Some(first) = chars.next() else {
        return String::new();
    };
    let mut normalized = String::new();
    normalized.extend(first.to_uppercase());
    normalized.push_str(chars.as_str());
    normalized
}

fn normalize_modifier(raw: &str) -> Option<String> {
    let trimmed = raw.trim_matches(|ch| ch == '-' || ch == '_' || ch == ':' || ch == '.');
    if trimmed.is_empty() { None } else { Some(trimmed.to_ascii_lowercase()) }
}

fn is_raw_model_modifier_token(raw: &str) -> bool {
    let Some(normalized) = normalize_modifier(raw) else {
        return false;
    };
    RAW_MODEL_MODIFIER_NAMES.contains(&normalized.as_str())
}

fn parse_model_spec(raw_arg: Option<String>, modifiers: Vec<String>) -> ModelDirectiveSpec {
    let prop_name = raw_arg.unwrap_or_else(|| "modelValue".to_string());
    let update_name = format!("onUpdate{}", pascalize_prop_name(&prop_name));
    let modifiers_prop_name = if prop_name == "modelValue" {
        "modelModifiers".to_string()
    } else {
        format!("{}Modifiers", prop_name)
    };
    ModelDirectiveSpec { prop_name, update_name, modifiers_prop_name, modifiers }
}

fn parse_raw_model_suffix(suffix: &str) -> Option<(Option<String>, Vec<String>)> {
    if suffix.is_empty() {
        return Some((None, Vec::new()));
    }

    if let Some(rest) = suffix.strip_prefix(':') {
        if rest.contains('.') {
            return None;
        }

        let tokens: Vec<&str> = rest.split('-').filter(|segment| !segment.is_empty()).collect();
        if tokens.is_empty() {
            return None;
        }

        let mut modifiers = Vec::new();
        let mut split_index = 0;
        while split_index < tokens.len() {
            let token = tokens[split_index];
            if !is_raw_model_modifier_token(token) {
                break;
            }
            modifiers.push(normalize_modifier(token)?);
            split_index += 1;
        }

        let arg_raw = tokens[split_index..].join("-");
        if arg_raw.is_empty() {
            return if modifiers.is_empty() { None } else { Some((None, modifiers)) };
        }

        return Some((Some(normalize_model_arg(&arg_raw)?), modifiers));
    }

    None
}

fn parse_safe_model_name(raw: &str) -> Option<(Option<String>, Vec<String>)> {
    let rest = raw.strip_prefix(SAFE_MODEL_PREFIX)?;
    let (arg_raw, modifier_raw) = match rest.split_once(SAFE_MODIFIERS_MARKER) {
        Some((arg_raw, modifier_raw)) => (arg_raw, Some(modifier_raw)),
        None => (rest, None),
    };
    let arg_name = if arg_raw.is_empty() { None } else { Some(normalize_model_arg(arg_raw)?) };
    let modifiers = modifier_raw
        .map(|raw| raw.split("__").filter_map(normalize_modifier).collect())
        .unwrap_or_default();
    Some((arg_name, modifiers))
}

fn directive_spec_from_name(name: &JSXAttrName) -> Option<ModelDirectiveSpec> {
    let (raw_arg, modifiers) = match name {
        JSXAttrName::JSXNamespacedName(ns_name) => {
            let namespace = ns_name.ns.sym.as_ref();
            if !MODEL_DIRECTIVE_NAMES.contains(&namespace) {
                return None;
            }
            parse_raw_model_suffix(&format!(":{}", ns_name.name.sym.as_ref()))?
        }
        JSXAttrName::Ident(ident) => {
            let raw = ident.sym.as_ref();
            if raw.starts_with(SAFE_MODEL_PREFIX) {
                parse_safe_model_name(raw)?
            } else if let Some(suffix) = raw.strip_prefix("v-model") {
                parse_raw_model_suffix(suffix)?
            } else if let Some(suffix) = raw.strip_prefix("r-model") {
                parse_raw_model_suffix(suffix)?
            } else {
                return None;
            }
        }
    };

    Some(parse_model_spec(raw_arg, modifiers))
}

fn is_model_directive_attr(attr: &JSXAttr) -> bool {
    directive_spec_from_name(&attr.name).is_some()
}

fn modifiers_object_expr(modifiers: &[String]) -> Expr {
    Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: modifiers
            .iter()
            .map(|modifier| {
                PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: PropName::Str(emit::str_lit(modifier)),
                    value: Box::new(Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: true }))),
                })))
            })
            .collect(),
    })
}

fn build_component_update_handler(model_src: &str) -> Expr {
    parsed_expr_or_noop(
        format!("(value) => ({} = value)", model_src),
        "v-model-component-handler.tsx",
    )
}

fn build_text_model_handler(model_src: &str, value_src: &str, trim: bool, number: bool) -> Expr {
    let mut body = format!("let value = {};", value_src);
    if trim {
        body.push_str("value = value.trim();");
    }
    if number {
        body.push_str(
            "const parsed = parseFloat(value);value = Number.isNaN(parsed) ? value : parsed;",
        );
    }
    body.push_str(&format!("{} = value;", model_src));
    parsed_expr_or_noop(format!("($event) => {{ {} }}", body), "v-model-text-handler.tsx")
}

fn build_checkbox_checked_expr(
    model_src: &str,
    value_src: &str,
    true_value_src: Option<&str>,
) -> Expr {
    let scalar = true_value_src
        .map(|true_value| format!("({}) === ({})", model_src, true_value))
        .unwrap_or_else(|| format!("!!({})", model_src));
    parsed_expr_or_noop(
        format!(
            "Array.isArray({0}) ? {0}.includes({1}) : {0} instanceof Set ? {0}.has({1}) : {2}",
            model_src, value_src, scalar,
        ),
        "v-model-checkbox-checked.tsx",
    )
}

fn build_checkbox_handler(
    model_src: &str,
    value_src: &str,
    true_value_src: &str,
    false_value_src: &str,
) -> Expr {
    parsed_expr_or_noop(
        format!(
            "($event) => {{ const checked = ($event.target as HTMLInputElement).checked; const value = {value_src}; if (Array.isArray({model_src})) {{ {model_src} = checked ? ({model_src}.includes(value) ? {model_src} : {model_src}.concat([value])) : {model_src}.filter(item => item !== value); return; }} if ({model_src} instanceof Set) {{ {model_src} = checked ? new Set([...{model_src}, value]) : new Set(Array.from({model_src}).filter(item => item !== value)); return; }} {model_src} = checked ? {true_value_src} : {false_value_src}; }}",
            model_src = model_src,
            value_src = value_src,
            true_value_src = true_value_src,
            false_value_src = false_value_src,
        ),
        "v-model-checkbox-handler.tsx",
    )
}

fn build_radio_checked_expr(model_src: &str, value_src: &str) -> Expr {
    parsed_expr_or_noop(format!("({}) === ({})", model_src, value_src), "v-model-radio-checked.tsx")
}

fn build_radio_handler(model_src: &str, value_src: &str) -> Expr {
    parsed_expr_or_noop(
        format!(
            "($event) => {{ if (($event.target as HTMLInputElement).checked) {{ {} = {}; }} }}",
            model_src, value_src,
        ),
        "v-model-radio-handler.tsx",
    )
}

fn build_select_multiple_handler(model_src: &str, trim: bool, number: bool) -> Expr {
    let mapper = if trim || number {
        let mut body = "let value = option.value;".to_string();
        if trim {
            body.push_str("value = value.trim();");
        }
        if number {
            body.push_str(
                "const parsed = parseFloat(value);value = Number.isNaN(parsed) ? value : parsed;",
            );
        }
        body.push_str("return value;");
        format!(
            "Array.from(($event.target as HTMLSelectElement).selectedOptions).map(option => {{ {} }})",
            body,
        )
    } else {
        "Array.from(($event.target as HTMLSelectElement).selectedOptions).map(option => option.value)"
            .to_string()
    };

    parsed_expr_or_noop(
        format!("($event) => {{ {} = {}; }}", model_src, mapper),
        "v-model-select-multiple-handler.tsx",
    )
}

fn native_model_kind(opening: &JSXOpeningElement) -> NativeModelKind {
    let tag = match &opening.name {
        JSXElementName::Ident(ident) => ident.sym.as_ref().to_ascii_lowercase(),
        _ => String::new(),
    };

    match tag.as_str() {
        "textarea" => NativeModelKind::TextArea,
        "select" => NativeModelKind::Select { multiple: has_truthy_attr(opening, "multiple") },
        "input" => {
            let input_type = get_static_string_attr(opening, "type")
                .unwrap_or_else(|| "text".to_string())
                .to_ascii_lowercase();
            match input_type.as_str() {
                "checkbox" => NativeModelKind::Checkbox,
                "radio" => NativeModelKind::Radio,
                "number" | "range" => NativeModelKind::TextInput {
                    target_type: "HTMLInputElement",
                    event_name: "onInput",
                    auto_number: true,
                },
                _ => NativeModelKind::TextInput {
                    target_type: "HTMLInputElement",
                    event_name: "onInput",
                    auto_number: false,
                },
            }
        }
        _ => NativeModelKind::TextInput {
            target_type: "HTMLInputElement",
            event_name: "onInput",
            auto_number: false,
        },
    }
}

fn apply_component_model(
    opening: &mut JSXOpeningElement,
    spec: &ModelDirectiveSpec,
    model_expr: Expr,
) {
    let model_src = emit_expr_source(&model_expr).unwrap_or_else(|| "undefined".to_string());
    upsert_attr(opening, &spec.prop_name, model_expr);
    upsert_attr(opening, &spec.update_name, build_component_update_handler(&model_src));
    if !spec.modifiers.is_empty() {
        upsert_attr(opening, &spec.modifiers_prop_name, modifiers_object_expr(&spec.modifiers));
    }
}

fn apply_native_model(opening: &mut JSXOpeningElement, model_expr: Expr, modifiers: &[String]) {
    let model_src = emit_expr_source(&model_expr).unwrap_or_else(|| "undefined".to_string());
    let trim = modifiers.iter().any(|modifier| modifier == "trim");
    let lazy = modifiers.iter().any(|modifier| modifier == "lazy");
    let explicit_number = modifiers.iter().any(|modifier| modifier == "number");

    let value_expr = get_attr_expr_by_names(opening, &["value"]);
    let value_src = value_expr
        .as_ref()
        .and_then(emit_expr_source)
        .unwrap_or_else(|| "($event.target as HTMLInputElement).value".to_string());
    let checked_value_src =
        value_expr.as_ref().and_then(emit_expr_source).unwrap_or_else(|| "\"on\"".to_string());
    let true_value_src = get_attr_expr_by_names(opening, &["true-value", "trueValue"])
        .and_then(|expr| emit_expr_source(&expr))
        .unwrap_or_else(|| "true".to_string());
    let false_value_src = get_attr_expr_by_names(opening, &["false-value", "falseValue"])
        .and_then(|expr| emit_expr_source(&expr))
        .unwrap_or_else(|| "false".to_string());

    match native_model_kind(opening) {
        NativeModelKind::TextInput { target_type, event_name, auto_number } => {
            let event_name = if lazy { "onChange" } else { event_name };
            let number = explicit_number || auto_number;
            let dom_value_src = format!("($event.target as {}).value", target_type);
            upsert_attr(opening, "value", model_expr);
            upsert_attr(
                opening,
                event_name,
                build_text_model_handler(&model_src, &dom_value_src, trim, number),
            );
        }
        NativeModelKind::TextArea => {
            let event_name = if lazy { "onChange" } else { "onInput" };
            upsert_attr(opening, "value", model_expr);
            upsert_attr(
                opening,
                event_name,
                build_text_model_handler(
                    &model_src,
                    "($event.target as HTMLTextAreaElement).value",
                    trim,
                    explicit_number,
                ),
            );
        }
        NativeModelKind::Select { multiple } => {
            upsert_attr(opening, "value", model_expr);
            if multiple {
                upsert_attr(
                    opening,
                    "onChange",
                    build_select_multiple_handler(&model_src, trim, explicit_number),
                );
            } else {
                upsert_attr(
                    opening,
                    "onChange",
                    build_text_model_handler(
                        &model_src,
                        "($event.target as HTMLSelectElement).value",
                        trim,
                        explicit_number,
                    ),
                );
            }
        }
        NativeModelKind::Checkbox => {
            let true_value_opt = get_attr_expr_by_names(opening, &["true-value", "trueValue"])
                .and_then(|expr| emit_expr_source(&expr));
            upsert_attr(
                opening,
                "checked",
                build_checkbox_checked_expr(
                    &model_src,
                    &checked_value_src,
                    true_value_opt.as_deref(),
                ),
            );
            upsert_attr(
                opening,
                "onChange",
                build_checkbox_handler(&model_src, &value_src, &true_value_src, &false_value_src),
            );
        }
        NativeModelKind::Radio => {
            upsert_attr(
                opening,
                "checked",
                build_radio_checked_expr(&model_src, &checked_value_src),
            );
            upsert_attr(opening, "onChange", build_radio_handler(&model_src, &value_src));
        }
    }
}

pub fn transform_opening(opening: &mut JSXOpeningElement) {
    let directives: Vec<(ModelDirectiveSpec, Expr)> = opening
        .attrs
        .iter()
        .filter_map(|attr_or_spread| match attr_or_spread {
            JSXAttrOrSpread::JSXAttr(attr) => {
                let spec = directive_spec_from_name(&attr.name)?;
                let value = get_attr_value_expr(attr)
                    .unwrap_or_else(|| Expr::Ident(emit::ident("undefined")));
                Some((spec, value))
            }
            _ => None,
        })
        .collect();

    if directives.is_empty() {
        return;
    }

    opening.attrs.retain(|attr_or_spread| match attr_or_spread {
        JSXAttrOrSpread::JSXAttr(attr) => !is_model_directive_attr(attr),
        _ => true,
    });

    if is_component(&opening.name) {
        for (spec, model_expr) in directives {
            apply_component_model(opening, &spec, model_expr);
        }
        return;
    }

    if let Some((spec, model_expr)) = directives.into_iter().next() {
        apply_native_model(opening, model_expr, &spec.modifiers);
    }
}
