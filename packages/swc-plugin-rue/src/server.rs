use swc_core::common::DUMMY_SP;
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{VisitMut, VisitMutWith};

use crate::emit::{call_ident, str_lit, string_expr};

/// JSX lowering for the server renderer's compiler-only operation protocol.
pub(crate) struct ServerTransform {
    pub(crate) did_transform: bool,
}

impl ServerTransform {
    fn jsx_object_to_expr(object: &JSXObject) -> Expr {
        match object {
            JSXObject::Ident(ident) => Expr::Ident(ident.clone()),
            JSXObject::JSXMemberExpr(member) => Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(Self::jsx_object_to_expr(&member.obj)),
                prop: MemberProp::Ident(member.prop.clone()),
            }),
        }
    }

    fn component_name_to_expr(name: &JSXElementName) -> Expr {
        match name {
            JSXElementName::Ident(ident) => Expr::Ident(ident.clone()),
            JSXElementName::JSXMemberExpr(member) => Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(Self::jsx_object_to_expr(&member.obj)),
                prop: MemberProp::Ident(member.prop.clone()),
            }),
            JSXElementName::JSXNamespacedName(name) => {
                string_expr(&format!("{}:{}", name.ns.sym, name.name.sym))
            }
        }
    }

    fn native_name_to_expr(name: &JSXElementName) -> Expr {
        match name {
            JSXElementName::Ident(ident) => string_expr(ident.sym.as_ref()),
            JSXElementName::JSXNamespacedName(name) => {
                string_expr(&format!("{}:{}", name.ns.sym, name.name.sym))
            }
            JSXElementName::JSXMemberExpr(_) => Self::component_name_to_expr(name),
        }
    }

    fn attr_name(name: &JSXAttrName) -> PropName {
        match name {
            JSXAttrName::Ident(ident) => {
                let raw = ident.sym.as_ref();
                let mut chars = raw.chars();
                let safe = chars
                    .next()
                    .is_some_and(|ch| ch == '$' || ch == '_' || ch.is_ascii_alphabetic())
                    && chars.all(|ch| ch == '$' || ch == '_' || ch.is_ascii_alphanumeric());
                if safe { PropName::Ident(ident.clone()) } else { PropName::Str(str_lit(raw)) }
            }
            JSXAttrName::JSXNamespacedName(name) => {
                PropName::Str(str_lit(&format!("{}:{}", name.ns.sym, name.name.sym)))
            }
        }
    }

    fn lower_attr_value(&mut self, value: Option<JSXAttrValue>) -> Expr {
        match value {
            None => Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: true })),
            Some(JSXAttrValue::Str(value)) => {
                Expr::Lit(Lit::Str(Str { span: value.span, value: value.value, raw: None }))
            }
            Some(JSXAttrValue::JSXExprContainer(container)) => match container.expr {
                JSXExpr::Expr(mut expr) => {
                    expr.visit_mut_with(self);
                    *expr
                }
                JSXExpr::JSXEmptyExpr(_) => Expr::Ident(crate::emit::ident("undefined")),
            },
            Some(JSXAttrValue::JSXElement(element)) => self.lower_element(*element),
            Some(JSXAttrValue::JSXFragment(fragment)) => self.lower_fragment(fragment),
        }
    }

    fn lower_props(&mut self, attrs: Vec<JSXAttrOrSpread>) -> Expr {
        if attrs.is_empty() {
            return Expr::Lit(Lit::Null(Null { span: DUMMY_SP }));
        }

        let props = attrs
            .into_iter()
            .map(|attr| match attr {
                JSXAttrOrSpread::SpreadElement(mut spread) => {
                    spread.expr.visit_mut_with(self);
                    PropOrSpread::Spread(spread)
                }
                JSXAttrOrSpread::JSXAttr(attr) => {
                    PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                        key: Self::attr_name(&attr.name),
                        value: Box::new(self.lower_attr_value(attr.value)),
                    })))
                }
            })
            .collect();
        Expr::Object(ObjectLit { span: DUMMY_SP, props })
    }

    fn lower_children(&mut self, children: Vec<JSXElementChild>) -> Expr {
        let sibling_context = children.clone();
        let mut elements = Vec::new();
        for (index, child) in children.into_iter().enumerate() {
            let expression = match child {
                JSXElementChild::JSXText(text) => {
                    let normalized = crate::text::normalize_text(text.value.as_ref());
                    let Some(text) =
                        crate::text::compute_jsx_text_content(&sibling_context, index, &normalized)
                    else {
                        continue;
                    };
                    string_expr(&text)
                }
                JSXElementChild::JSXExprContainer(container) => match container.expr {
                    JSXExpr::Expr(mut expr) => {
                        expr.visit_mut_with(self);
                        *expr
                    }
                    JSXExpr::JSXEmptyExpr(_) => continue,
                },
                JSXElementChild::JSXSpreadChild(mut spread) => {
                    spread.expr.visit_mut_with(self);
                    *spread.expr
                }
                JSXElementChild::JSXElement(element) => self.lower_element(*element),
                JSXElementChild::JSXFragment(fragment) => self.lower_fragment(fragment),
            };
            elements.push(Some(ExprOrSpread { spread: None, expr: Box::new(expression) }));
        }
        Expr::Array(ArrayLit { span: DUMMY_SP, elems: elements })
    }

    fn lower_element(&mut self, element: JSXElement) -> Expr {
        self.did_transform = true;
        let is_fragment = matches!(
            &element.opening.name,
            JSXElementName::Ident(ident) if ident.sym.as_ref() == "Fragment"
        );
        let is_component = crate::utils::is_component(&element.opening.name) && !is_fragment;
        let children = self.lower_children(element.children);
        if is_fragment {
            return call_ident("_$serverFragment", vec![children]);
        }
        let props = self.lower_props(element.opening.attrs);
        let type_expr = if is_component {
            Self::component_name_to_expr(&element.opening.name)
        } else {
            Self::native_name_to_expr(&element.opening.name)
        };
        call_ident(
            if is_component { "_$serverComponent" } else { "_$serverElement" },
            vec![type_expr, props, children],
        )
    }

    fn lower_fragment(&mut self, fragment: JSXFragment) -> Expr {
        self.did_transform = true;
        call_ident("_$serverFragment", vec![self.lower_children(fragment.children)])
    }
}

impl VisitMut for ServerTransform {
    fn visit_mut_expr(&mut self, expression: &mut Expr) {
        let lowered = match expression {
            Expr::JSXElement(element) => Some(self.lower_element((**element).clone())),
            Expr::JSXFragment(fragment) => Some(self.lower_fragment(fragment.clone())),
            _ => None,
        };
        if let Some(lowered) = lowered {
            *expression = lowered;
        } else {
            expression.visit_mut_children_with(self);
        }
    }
}
