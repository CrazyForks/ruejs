use std::collections::HashSet;

use swc_core::common::{DUMMY_SP, SyntaxContext};
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitMut, VisitMutWith, VisitWith};

use crate::emit::{ident, ident_name, string_expr};

const TEMPLATE_MARKER_ATTR: &str = "__rue_static_template_id__";

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct StaticTemplate {
    pub(crate) html: String,
}

#[derive(Clone, Debug)]
pub(crate) struct HoistedTemplate {
    pub(crate) id: usize,
    pub(crate) getter: Ident,
    pub(crate) html: String,
}

impl StaticTemplate {
    pub(crate) fn classify(element: &JSXElement) -> Option<Self> {
        let mut html = String::new();
        serialize_element(element, &mut html)?;
        Some(Self { html })
    }
}

fn html_tag_name(name: &JSXElementName) -> Option<&str> {
    let JSXElementName::Ident(name) = name else {
        return None;
    };
    let tag = name.sym.as_ref();
    is_native_html_tag(tag).then_some(tag)
}

pub(crate) fn is_native_html_tag(tag: &str) -> bool {
    matches!(
        tag,
        "a" | "abbr"
            | "address"
            | "area"
            | "article"
            | "aside"
            | "audio"
            | "b"
            | "base"
            | "bdi"
            | "bdo"
            | "blockquote"
            | "body"
            | "br"
            | "button"
            | "canvas"
            | "caption"
            | "cite"
            | "code"
            | "col"
            | "colgroup"
            | "data"
            | "datalist"
            | "dd"
            | "del"
            | "details"
            | "dfn"
            | "dialog"
            | "div"
            | "dl"
            | "dt"
            | "em"
            | "embed"
            | "fieldset"
            | "figcaption"
            | "figure"
            | "footer"
            | "form"
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6"
            | "head"
            | "header"
            | "hgroup"
            | "hr"
            | "html"
            | "i"
            | "iframe"
            | "img"
            | "input"
            | "ins"
            | "kbd"
            | "label"
            | "legend"
            | "li"
            | "link"
            | "main"
            | "map"
            | "mark"
            | "menu"
            | "meta"
            | "meter"
            | "nav"
            | "noscript"
            | "object"
            | "ol"
            | "optgroup"
            | "option"
            | "output"
            | "p"
            | "picture"
            | "pre"
            | "progress"
            | "q"
            | "rp"
            | "rt"
            | "ruby"
            | "s"
            | "samp"
            | "search"
            | "section"
            | "select"
            | "slot"
            | "small"
            | "source"
            | "span"
            | "strong"
            | "sub"
            | "summary"
            | "sup"
            | "table"
            | "tbody"
            | "td"
            | "template"
            | "tfoot"
            | "th"
            | "thead"
            | "time"
            | "tr"
            | "track"
            | "u"
            | "ul"
            | "var"
            | "video"
            | "wbr"
    )
}

fn is_void_tag(tag: &str) -> bool {
    matches!(
        tag,
        "area"
            | "base"
            | "br"
            | "col"
            | "embed"
            | "hr"
            | "img"
            | "input"
            | "link"
            | "meta"
            | "source"
            | "track"
            | "wbr"
    )
}

fn escape_text(value: &str) -> Option<String> {
    if value.contains('\0') {
        return None;
    }
    Some(value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;"))
}

fn escape_attr(value: &str) -> Option<String> {
    if value.contains('\0') {
        return None;
    }
    Some(
        value
            .replace('&', "&amp;")
            .replace('"', "&quot;")
            .replace('<', "&lt;")
            .replace('>', "&gt;"),
    )
}

fn normalized_attr_name(name: &str) -> &str {
    match name {
        "className" => "class",
        "htmlFor" => "for",
        "acceptCharset" => "accept-charset",
        "httpEquiv" => "http-equiv",
        _ => name,
    }
}

fn is_boolean_attr(name: &str) -> bool {
    matches!(
        name,
        "allowFullScreen"
            | "async"
            | "autoFocus"
            | "autoPlay"
            | "checked"
            | "controls"
            | "default"
            | "defer"
            | "disabled"
            | "formNoValidate"
            | "hidden"
            | "inert"
            | "loop"
            | "multiple"
            | "muted"
            | "noModule"
            | "noValidate"
            | "open"
            | "playsInline"
            | "readOnly"
            | "required"
            | "reversed"
            | "selected"
    )
}

fn static_expr_attr_value(name: &str, expr: &Expr) -> Option<Option<String>> {
    let expr = crate::utils::unwrap_expr(expr);
    if is_boolean_attr(name) {
        return match expr {
            Expr::Lit(Lit::Bool(value)) => Some(value.value.then(String::new)),
            Expr::Lit(Lit::Str(value)) => Some((!value.value.is_empty()).then(String::new)),
            Expr::Lit(Lit::Num(value)) => {
                Some((value.value != 0.0 && !value.value.is_nan()).then(String::new))
            }
            Expr::Lit(Lit::Null(_)) => Some(None),
            _ => None,
        };
    }

    match expr {
        Expr::Lit(Lit::Str(value)) => Some(Some(value.value.as_str()?.to_string())),
        Expr::Lit(Lit::Num(value)) => Some(Some(value.value.to_string())),
        Expr::Lit(Lit::Bool(value)) => {
            Some(Some(if value.value { "true" } else { "false" }.to_string()))
        }
        _ => None,
    }
}

fn serialize_attr(tag: &str, attr: &JSXAttr, out: &mut String) -> Option<()> {
    let JSXAttrName::Ident(name) = &attr.name else {
        return None;
    };
    let name = name.sym.as_ref();
    if name == TEMPLATE_MARKER_ATTR || name == "key" {
        return Some(());
    }
    if name == "ref"
        || name == "dangerouslySetInnerHTML"
        || name == "is"
        || (name == "value" && matches!(tag, "select" | "textarea"))
        || (name == "style"
            && matches!(
                &attr.value,
                Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                    expr: JSXExpr::Expr(expr),
                    ..
                })) if !matches!(crate::utils::unwrap_expr(expr), Expr::Lit(Lit::Str(_)))
            ))
        || name.starts_with("__rue_")
        || name.to_ascii_lowercase().starts_with("on")
    {
        return None;
    }

    let value = match &attr.value {
        Some(JSXAttrValue::Str(value)) => {
            if is_boolean_attr(name) {
                Some(String::new())
            } else {
                Some(value.value.as_str()?.to_string())
            }
        }
        Some(JSXAttrValue::JSXExprContainer(container)) => {
            let JSXExpr::Expr(expr) = &container.expr else {
                return None;
            };
            static_expr_attr_value(name, expr)?
        }
        None if is_boolean_attr(name) => Some(String::new()),
        None if name.starts_with("data-") || name.starts_with("aria-") => Some("true".to_string()),
        None => return None,
        _ => return None,
    };

    let Some(value) = value else {
        return Some(());
    };
    out.push(' ');
    out.push_str(normalized_attr_name(name));
    out.push_str("=\"");
    out.push_str(&escape_attr(&value)?);
    out.push('"');
    Some(())
}

fn serialize_children(children: &[JSXElementChild], out: &mut String) -> Option<()> {
    for (index, child) in children.iter().enumerate() {
        match child {
            JSXElementChild::JSXText(text) => {
                let normalized = crate::text::normalize_text(&text.value);
                if let Some(content) =
                    crate::text::compute_jsx_text_content(children, index, &normalized)
                {
                    out.push_str(&escape_text(&content)?);
                }
            }
            JSXElementChild::JSXElement(element) => serialize_element(element, out)?,
            JSXElementChild::JSXFragment(fragment) => {
                serialize_children(&fragment.children, out)?;
            }
            JSXElementChild::JSXExprContainer(container)
                if matches!(container.expr, JSXExpr::JSXEmptyExpr(_)) => {}
            JSXElementChild::JSXExprContainer(_) | JSXElementChild::JSXSpreadChild(_) => {
                return None;
            }
        }
    }
    Some(())
}

fn serialize_element(element: &JSXElement, out: &mut String) -> Option<()> {
    let tag = html_tag_name(&element.opening.name)?;
    if matches!(tag, "body" | "head" | "html" | "iframe" | "noscript") {
        return None;
    }

    out.push('<');
    out.push_str(tag);
    for attr in &element.opening.attrs {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            return None;
        };
        serialize_attr(tag, attr, out)?;
    }
    out.push('>');

    let children_start = out.len();
    serialize_children(&element.children, out)?;
    if is_void_tag(tag) {
        if out.len() != children_start {
            return None;
        }
        return Some(());
    }

    out.push_str("</");
    out.push_str(tag);
    out.push('>');
    Some(())
}

fn marker_id(element: &JSXElement) -> Option<usize> {
    element.opening.attrs.iter().find_map(|attr| {
        let JSXAttrOrSpread::JSXAttr(attr) = attr else {
            return None;
        };
        let JSXAttrName::Ident(name) = &attr.name else {
            return None;
        };
        if name.sym.as_ref() != TEMPLATE_MARKER_ATTR {
            return None;
        }
        let Some(JSXAttrValue::Str(value)) = &attr.value else {
            return None;
        };
        value.value.as_str()?.parse().ok()
    })
}

pub(crate) fn marked_static_template(element: &JSXElement) -> Option<(StaticTemplate, usize)> {
    let id = marker_id(element)?;
    Some((StaticTemplate::classify(element)?, id))
}

struct StaticTemplateCollector {
    hoisted_templates: Vec<HoistedTemplate>,
    used_names: HashSet<String>,
    next_id: usize,
}

impl StaticTemplateCollector {
    fn new(used_names: HashSet<String>) -> Self {
        Self { hoisted_templates: Vec::new(), used_names, next_id: 1 }
    }

    fn intern(&mut self, template: StaticTemplate) -> usize {
        if let Some(index) =
            self.hoisted_templates.iter().position(|existing| existing.html == template.html)
        {
            return self.hoisted_templates[index].id;
        }

        let id = loop {
            let id = self.next_id;
            self.next_id += 1;
            let getter = format!("_$getTemplate{id}");
            if !self.used_names.contains(&getter) {
                self.used_names.insert(getter);
                break id;
            }
        };
        self.hoisted_templates.push(HoistedTemplate {
            id,
            getter: ident(&format!("_$getTemplate{id}")),
            html: template.html,
        });
        id
    }
}

impl VisitMut for StaticTemplateCollector {
    fn visit_mut_jsx_element(&mut self, element: &mut JSXElement) {
        if let Some(template) = StaticTemplate::classify(element) {
            let id = self.intern(template);
            element.opening.attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
                span: DUMMY_SP,
                name: JSXAttrName::Ident(ident(TEMPLATE_MARKER_ATTR).into()),
                value: Some(JSXAttrValue::Str(Str {
                    span: DUMMY_SP,
                    value: id.to_string().into(),
                    raw: None,
                })),
            }));
            return;
        }

        let boundary_tag = match &element.opening.name {
            JSXElementName::Ident(name) => name.sym.as_ref(),
            _ => return,
        };
        if matches!(boundary_tag, "svg" | "math")
            || crate::utils::is_component(&element.opening.name)
            || crate::custom_element::is_custom_element_tag(boundary_tag)
        {
            return;
        }
        element.visit_mut_children_with(self);
    }
}

pub(crate) fn collect_hoisted_templates(module: &mut Module) -> Vec<HoistedTemplate> {
    #[derive(Default)]
    struct IdentCollector {
        names: HashSet<String>,
    }

    impl Visit for IdentCollector {
        fn visit_ident(&mut self, ident: &Ident) {
            self.names.insert(ident.sym.to_string());
        }
    }

    let mut identifiers = IdentCollector::default();
    module.visit_with(&mut identifiers);
    let mut collector = StaticTemplateCollector::new(identifiers.names);
    module.visit_mut_children_with(&mut collector);
    collector.hoisted_templates
}

fn expr_stmt(expr: Expr) -> Stmt {
    Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(expr) })
}

fn member_expr(object: Expr, property: &str) -> Expr {
    Expr::Member(MemberExpr {
        span: DUMMY_SP,
        obj: Box::new(object),
        prop: MemberProp::Ident(ident_name(property)),
    })
}

fn call_expr(callee: Expr, args: Vec<Expr>) -> Expr {
    Expr::Call(CallExpr {
        span: DUMMY_SP,
        callee: Callee::Expr(Box::new(callee)),
        args: args
            .into_iter()
            .map(|expr| ExprOrSpread { spread: None, expr: Box::new(expr) })
            .collect(),
        type_args: None,
        ctxt: SyntaxContext::empty(),
    })
}

fn call_member(object: Expr, property: &str, args: Vec<Expr>) -> Expr {
    call_expr(member_expr(object, property), args)
}

fn var_decl(kind: VarDeclKind, name: Ident, init: Option<Expr>) -> Stmt {
    Stmt::Decl(Decl::Var(Box::new(VarDecl {
        span: DUMMY_SP,
        ctxt: SyntaxContext::empty(),
        kind,
        declare: false,
        decls: vec![VarDeclarator {
            span: DUMMY_SP,
            name: Pat::Ident(BindingIdent { id: name, type_ann: None }),
            init: init.map(Box::new),
            definite: false,
        }],
    })))
}

fn assign_ident(name: Ident, value: Expr) -> Expr {
    Expr::Assign(AssignExpr {
        span: DUMMY_SP,
        op: AssignOp::Assign,
        left: AssignTarget::Simple(SimpleAssignTarget::Ident(BindingIdent {
            id: name,
            type_ann: None,
        })),
        right: Box::new(value),
    })
}

fn arrow(params: Vec<Pat>, stmts: Vec<Stmt>) -> Expr {
    Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params,
        body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts,
        })),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: SyntaxContext::empty(),
    })
}

fn return_expr(expr: Expr) -> Stmt {
    Stmt::Return(ReturnStmt { span: DUMMY_SP, arg: Some(Box::new(expr)) })
}

fn throw_error(message: &str) -> Stmt {
    Stmt::Throw(ThrowStmt {
        span: DUMMY_SP,
        arg: Box::new(Expr::New(NewExpr {
            span: DUMMY_SP,
            callee: Box::new(Expr::Ident(ident("Error"))),
            args: Some(vec![ExprOrSpread { spread: None, expr: Box::new(string_expr(message)) }]),
            type_args: None,
            ctxt: SyntaxContext::empty(),
        })),
    })
}

fn if_block(test: Expr, stmts: Vec<Stmt>) -> Stmt {
    Stmt::If(IfStmt {
        span: DUMMY_SP,
        test: Box::new(test),
        cons: Box::new(Stmt::Block(BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts,
        })),
        alt: None,
    })
}

fn template_getter_call(id: usize) -> Expr {
    call_expr(Expr::Ident(ident(&format!("_$getTemplate{id}"))), Vec::new())
}

fn clone_template_expr(id: usize) -> Expr {
    call_member(
        member_expr(template_getter_call(id), "content"),
        "cloneNode",
        vec![Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: true }))],
    )
}

pub(crate) fn emit_marked_template_child(
    transform: &mut super::VaporTransform,
    element: &JSXElement,
    parent: &Ident,
    stmts: &mut Vec<Stmt>,
) -> bool {
    let Some((_, id)) = marked_static_template(element) else {
        return false;
    };
    transform.next_el += static_element_count(element);
    stmts.push(expr_stmt(call_member(
        Expr::Ident(parent.clone()),
        "appendChild",
        vec![clone_template_expr(id)],
    )));
    true
}

fn static_element_count(element: &JSXElement) -> usize {
    fn child_count(child: &JSXElementChild) -> usize {
        match child {
            JSXElementChild::JSXElement(element) => static_element_count(element),
            JSXElementChild::JSXFragment(fragment) => {
                fragment.children.iter().map(child_count).sum()
            }
            _ => 0,
        }
    }

    1 + element.children.iter().map(child_count).sum::<usize>()
}

pub(crate) fn static_root_handle_expr(element: &JSXElement) -> Option<(Expr, usize)> {
    let (_, id) = marked_static_template(element)?;
    let root = ident("_root");
    let disposed = ident("_disposed");
    let dispose = ident("_dispose");
    let fragment = ident("_fragment");
    let parent_context = ident("__rue_parent_context");

    let has_parent = Expr::Bin(BinExpr {
        span: DUMMY_SP,
        op: BinaryOp::LogicalAnd,
        left: Box::new(Expr::Ident(root.clone())),
        right: Box::new(member_expr(Expr::Ident(root.clone()), "parentNode")),
    });
    let remove_root = call_member(
        member_expr(Expr::Ident(root.clone()), "parentNode"),
        "removeChild",
        vec![Expr::Ident(root.clone())],
    );
    let dispose_arrow = arrow(
        Vec::new(),
        vec![
            Stmt::If(IfStmt {
                span: DUMMY_SP,
                test: Box::new(Expr::Ident(disposed.clone())),
                cons: Box::new(Stmt::Return(ReturnStmt { span: DUMMY_SP, arg: None })),
                alt: None,
            }),
            expr_stmt(assign_ident(
                disposed.clone(),
                Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: true })),
            )),
            if_block(has_parent, vec![expr_stmt(remove_root)]),
        ],
    );

    let setup_arrow = arrow(
        vec![Pat::Ident(BindingIdent { id: parent_context, type_ann: None })],
        vec![
            if_block(
                Expr::Ident(disposed.clone()),
                vec![throw_error("Cannot mount a disposed static root")],
            ),
            if_block(
                Expr::Ident(root.clone()),
                vec![throw_error("A static root can only be mounted once")],
            ),
            var_decl(VarDeclKind::Const, fragment.clone(), Some(clone_template_expr(id))),
            expr_stmt(assign_ident(root.clone(), member_expr(Expr::Ident(fragment), "firstChild"))),
            return_expr(Expr::Ident(root.clone())),
        ],
    );

    let handle = Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: vec![
            PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                key: PropName::Ident(ident_name("__rue_cleanup_bucket")),
                value: Box::new(Expr::Array(ArrayLit {
                    span: DUMMY_SP,
                    elems: vec![Some(ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(dispose.clone())),
                    })],
                })),
            }))),
            PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                key: PropName::Ident(ident_name("__rue_vapor_setup")),
                value: Box::new(setup_arrow),
            }))),
            PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                key: PropName::Ident(ident_name("dispose")),
                value: Box::new(Expr::Ident(dispose.clone())),
            }))),
        ],
    });
    let factory = arrow(
        Vec::new(),
        vec![
            var_decl(VarDeclKind::Let, root, None),
            var_decl(
                VarDeclKind::Let,
                disposed,
                Some(Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: false }))),
            ),
            var_decl(VarDeclKind::Const, dispose, Some(dispose_arrow)),
            return_expr(handle),
        ],
    );
    Some((
        call_expr(Expr::Paren(ParenExpr { span: DUMMY_SP, expr: Box::new(factory) }), Vec::new()),
        static_element_count(element).saturating_sub(1),
    ))
}

fn hoisted_template_items(template: &HoistedTemplate) -> Vec<ModuleItem> {
    let getter = call_expr(Expr::Ident(ident("_$template")), vec![string_expr(&template.html)]);

    vec![ModuleItem::Stmt(var_decl(VarDeclKind::Const, template.getter.clone(), Some(getter)))]
}

pub(crate) fn inject_hoisted_templates(module: &mut Module, templates: &[HoistedTemplate]) {
    if templates.is_empty() {
        return;
    }
    let insertion = module
        .body
        .iter()
        .take_while(|item| {
            matches!(item, ModuleItem::ModuleDecl(ModuleDecl::Import(_)))
                || matches!(
                    item,
                    ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. }))
                        if matches!(expr.as_ref(), Expr::Lit(Lit::Str(_)))
                )
        })
        .count();
    let items = templates.iter().flat_map(hoisted_template_items).collect::<Vec<_>>();
    module.body.splice(insertion..insertion, items);
}

#[derive(Default)]
struct UsedTemplateGetterCollector {
    names: HashSet<String>,
}

impl Visit for UsedTemplateGetterCollector {
    fn visit_ident(&mut self, ident: &Ident) {
        if ident.sym.starts_with("_$getTemplate") {
            self.names.insert(ident.sym.to_string());
        }
    }
}

pub(crate) fn retain_used_hoisted_templates(module: &Module, templates: &mut Vec<HoistedTemplate>) {
    let mut collector = UsedTemplateGetterCollector::default();
    module.visit_with(&mut collector);
    templates.retain(|template| collector.names.contains(template.getter.sym.as_ref()));
}

struct TemplateMarkerStripper;

impl VisitMut for TemplateMarkerStripper {
    fn visit_mut_jsx_opening_element(&mut self, opening: &mut JSXOpeningElement) {
        opening.attrs.retain(|attr| {
            !matches!(
                attr,
                JSXAttrOrSpread::JSXAttr(JSXAttr {
                    name: JSXAttrName::Ident(name),
                    ..
                }) if name.sym.as_ref() == TEMPLATE_MARKER_ATTR
            )
        });
        opening.visit_mut_children_with(self);
    }
}

pub(crate) fn strip_template_markers(module: &mut Module) {
    module.visit_mut_with(&mut TemplateMarkerStripper);
}

#[cfg(test)]
#[path = "template_tests.rs"]
mod tests;
