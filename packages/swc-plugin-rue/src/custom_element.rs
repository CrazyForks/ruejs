use swc_core::common::{DUMMY_SP, SyntaxContext};
use swc_core::ecma::ast::*;

use crate::emit::*;
use crate::vapor::VaporTransform;

const RUE_SLOT_BAG_PROP: &str = "__rue_slots";
const RUE_CONTEXT_PARENT_INSTANCE_PROP: &str = "__rue_context_parent_instance__";

pub(crate) fn is_custom_element_tag(tag: &str) -> bool {
    tag.contains('-')
}

pub(crate) fn emit_context_parent_property(target: &Ident, stmts: &mut Vec<Stmt>) {
    let current_instance = Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(Expr::Ident(ident("getCurrentInstance")))),
        args: vec![],
        type_args: None,
        ctxt: SyntaxContext::empty(),
    });

    stmts.push(Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(call_ident(
            "_$setProperty",
            vec![
                Expr::Ident(target.clone()),
                string_expr(RUE_CONTEXT_PARENT_INSTANCE_PROP),
                current_instance,
            ],
        )),
    }));
}

fn is_function_literal_expr(expr: &Expr) -> bool {
    matches!(crate::utils::unwrap_expr(expr), Expr::Arrow(_) | Expr::Fn(_))
}

fn is_template_slot_carrier(el: &JSXElement) -> bool {
    match &el.opening.name {
        JSXElementName::Ident(id) => {
            let name = id.sym.as_ref();
            name == "Template" || name == "template"
        }
        JSXElementName::JSXMemberExpr(expr) => expr.prop.sym.as_ref() == "Template",
        _ => false,
    }
}

fn push_slot_prop(slot_props: &mut Vec<PropOrSpread>, name_expr: Expr, value_expr: Expr) {
    slot_props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
        key: crate::element_component::slot_prop_name(name_expr),
        value: Box::new(value_expr),
    }))));
}

pub(crate) fn extract_custom_element_slot_children(
    vt: &mut VaporTransform,
    target: &Ident,
    children: &[JSXElementChild],
    stmts: &mut Vec<Stmt>,
) -> Vec<JSXElementChild> {
    let mut native_children = Vec::new();
    let mut slot_props: Vec<PropOrSpread> = Vec::new();
    let mut slot_stmts: Vec<Stmt> = Vec::new();

    for child in children.iter().cloned() {
        match child {
            JSXElementChild::JSXExprContainer(ec) => {
                if let JSXExpr::Expr(expr) = &ec.expr {
                    let inner = crate::utils::unwrap_expr(expr.as_ref());
                    if is_function_literal_expr(inner) {
                        push_slot_prop(&mut slot_props, string_expr("default"), inner.clone());
                        continue;
                    }
                }
                native_children.push(JSXElementChild::JSXExprContainer(ec));
            }
            JSXElementChild::JSXElement(el_box) if is_template_slot_carrier(&el_box) => {
                let mut slot_el = (*el_box).clone();
                let slot_name =
                    crate::element_component::extract_slot_name_expr(&slot_el.opening.attrs)
                        .unwrap_or_else(|| string_expr("default"));
                crate::element_component::remove_jsx_attr_ident(&mut slot_el.opening.attrs, "slot");

                if let Some(lowered) =
                    crate::element_component::lower_slot_value(vt, &slot_el.children)
                {
                    slot_stmts.extend(lowered.stmts);
                    push_slot_prop(&mut slot_props, slot_name, lowered.expr);
                }
            }
            other => native_children.push(other),
        }
    }

    if !slot_props.is_empty() {
        stmts.extend(slot_stmts);
        stmts.push(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(call_ident(
                "_$setProperty",
                vec![
                    Expr::Ident(target.clone()),
                    string_expr(RUE_SLOT_BAG_PROP),
                    Expr::Object(ObjectLit { span: DUMMY_SP, props: slot_props }),
                ],
            )),
        }));
    }

    native_children
}
