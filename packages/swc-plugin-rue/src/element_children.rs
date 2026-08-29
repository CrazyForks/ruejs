use swc_core::common::{DUMMY_SP, SyntaxContext};
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitWith};

use crate::log;
use crate::vapor::VaporTransform;

/*
元素子节点编译：
- 目标：将 JSXElement 的 children 编译为原生 DOM 操作并附加到父元素；
- 空白策略：normalize_text 归一化段内空白，结合前后邻居（文本/表达式/纯空白）决定插入、保留或修剪；
- 分派路径：文本 → 规范化并插入；片段 → 递归；表达式容器 → 插槽渲染；嵌套元素 → 构建为原生 DOM；
- 设计宗旨：与 Vapor 块体的 children 编译保持一致，避免不同入口出现渲染差异。
*/
/// 元素子节点编译总览
/// - 职责：将 JSX 子节点编译为附加到当前元素的原生 DOM 操作
/// - 文本：使用 normalize_text + 上下文判断，精细保留/修剪空白，避免无意义节点
/// - 片段/表达式/嵌套元素：委托到各自模块，保持职责清晰
pub fn emit_element_children(
    vt: &mut VaporTransform,
    el_ident: &Ident,
    children: &[JSXElementChild],
    stmts: &mut Vec<Stmt>,
) {
    log::debug(&format!("children: count={}", children.len()));
    // 子节点遍历入口：
    // - 逐一检查当前文本及其前后邻居，配合下方空白处理策略决定：
    //   1) 仅空白是否需要插入一个空格（使用 `$createTextNode(" ")` + `$appendChild`）
    //   2) 含可见字符的首尾空白在行内拼接或块级场景中的保留/修剪
    for (i, c) in children.iter().enumerate() {
        match c {
            JSXElementChild::JSXText(t) => {
                let txt = crate::text::normalize_text(&t.value);
                if let Some(content) = crate::text::compute_jsx_text_content(children, i, &txt) {
                    let text_node = crate::emit::call_ident(
                        "_$createTextNode",
                        vec![crate::emit::string_expr(&content)],
                    );
                    stmts.push(crate::emit::append_child(el_ident.clone(), text_node));
                }
            }
            JSXElementChild::JSXFragment(frag) => {
                crate::element_fragment::emit_fragment_children(
                    vt,
                    el_ident,
                    &frag.children,
                    stmts,
                );
            }
            JSXElementChild::JSXExprContainer(ec) => {
                crate::element_expr::emit_element_expr_container_child(vt, el_ident, ec, stmts);
            }
            JSXElementChild::JSXElement(nested) => {
                crate::elements::build_element(vt, nested, el_ident, stmts);
            }
            JSXElementChild::JSXSpreadChild(_) => {}
        }
    }
}

fn compiled_tag_name(element: &JSXElement) -> Option<String> {
    let JSXElementName::Ident(name) = &element.opening.name else {
        return None;
    };
    let tag = name.sym.to_string();
    (crate::vapor::template::is_native_html_tag(&tag)
        && !crate::custom_element::is_custom_element_tag(&tag))
    .then_some(tag)
}

fn compiled_child_is_safe(
    vt: &VaporTransform,
    child: &JSXElementChild,
    shadowed_names: &std::collections::HashSet<String>,
) -> bool {
    match child {
        JSXElementChild::JSXText(_) => true,
        JSXElementChild::JSXFragment(fragment) => {
            fragment.children.iter().all(|child| compiled_child_is_safe(vt, child, shadowed_names))
        }
        JSXElementChild::JSXExprContainer(container) => match &container.expr {
            JSXExpr::JSXEmptyExpr(_) => true,
            JSXExpr::Expr(expr) => match crate::utils::unwrap_expr(expr.as_ref()) {
                Expr::Call(call) if compiled_list_call_is_safe(vt, call) => true,
                // A generic `.get()` has no return-type proof and may yield a Vapor renderable.
                Expr::Call(call) if crate::element_expr::is_accessor_get_call_expr(call) => false,
                expr => crate::vapor::is_compiled_scalar_expr_with_shadows(expr, shadowed_names),
            },
        },
        JSXElementChild::JSXElement(element) => {
            compiled_scalar_element_is_safe(vt, element, shadowed_names)
        }
        JSXElementChild::JSXSpreadChild(_) => false,
    }
}

/// A closed capability check for the task-7 tier. Any structural/renderable
/// capability causes the whole root to stay on the existing Vapor path.
fn compiled_scalar_element_is_safe(
    vt: &VaporTransform,
    element: &JSXElement,
    shadowed_names: &std::collections::HashSet<String>,
) -> bool {
    if crate::vapor::template::marked_static_template(element).is_some() {
        return true;
    }
    compiled_tag_name(element).is_some()
        && crate::attrs::attrs_support_compiled_scalar(&element.opening, shadowed_names)
        && element.children.iter().all(|child| compiled_child_is_safe(vt, child, shadowed_names))
}

#[derive(Default)]
struct VaporCapabilityDetector {
    found: bool,
}

impl Visit for VaporCapabilityDetector {
    fn visit_expr(&mut self, expr: &Expr) {
        if let Expr::Ident(ident) = expr
            && crate::compiled_capabilities::runtime_tier_for_helper(ident.sym.as_ref())
                == Some(crate::compiled_capabilities::RuntimeTier::Vapor)
        {
            self.found = true;
            return;
        }
        expr.visit_children_with(self);
    }
}

fn compiled_list_call_is_safe(vt: &VaporTransform, call: &CallExpr) -> bool {
    let mut probe = vt.clone();
    let mut stmts = Vec::new();
    if !crate::element_list::try_build_list_from_map(
        &mut probe,
        &crate::emit::ident("_$compiledListProbe"),
        call,
        &mut stmts,
    ) {
        return false;
    }
    let block = BlockStmt { span: DUMMY_SP, ctxt: SyntaxContext::empty(), stmts };
    let mut detector = VaporCapabilityDetector::default();
    block.visit_with(&mut detector);
    !detector.found
}

fn compiled_child_has_binding(
    vt: &VaporTransform,
    child: &JSXElementChild,
    shadowed_names: &std::collections::HashSet<String>,
) -> bool {
    match child {
        JSXElementChild::JSXExprContainer(container) => match &container.expr {
            JSXExpr::Expr(expr) => match crate::utils::unwrap_expr(expr.as_ref()) {
                Expr::Call(call) if compiled_list_call_is_safe(vt, call) => true,
                expr => {
                    !crate::utils::is_static_empty_like(expr)
                        && crate::utils::get_static_text_literal_expr(expr).is_none()
                        && crate::vapor::is_compiled_scalar_expr_with_shadows(expr, shadowed_names)
                }
            },
            JSXExpr::JSXEmptyExpr(_) => false,
        },
        JSXElementChild::JSXElement(element) => {
            compiled_element_has_binding(vt, element, shadowed_names)
        }
        JSXElementChild::JSXFragment(fragment) => fragment
            .children
            .iter()
            .any(|child| compiled_child_has_binding(vt, child, shadowed_names)),
        JSXElementChild::JSXText(_) | JSXElementChild::JSXSpreadChild(_) => false,
    }
}

fn compiled_element_has_binding(
    vt: &VaporTransform,
    element: &JSXElement,
    shadowed_names: &std::collections::HashSet<String>,
) -> bool {
    crate::attrs::attrs_have_compiled_scalar(&element.opening, shadowed_names)
        || element
            .children
            .iter()
            .any(|child| compiled_child_has_binding(vt, child, shadowed_names))
}

pub(crate) fn is_compiled_scalar_element(vt: &VaporTransform, element: &JSXElement) -> bool {
    let shadowed_names = vt.current_scalar_constructor_shadows();
    compiled_scalar_element_is_safe(vt, element, &shadowed_names)
        && compiled_element_has_binding(vt, element, &shadowed_names)
}

pub(crate) fn is_compiled_safe_element(vt: &VaporTransform, element: &JSXElement) -> bool {
    let shadowed_names = vt.current_scalar_constructor_shadows();
    compiled_scalar_element_is_safe(vt, element, &shadowed_names)
}

pub(crate) fn is_compiled_safe_fragment(vt: &VaporTransform, fragment: &JSXFragment) -> bool {
    let shadowed_names = vt.current_scalar_constructor_shadows();
    fragment.children.iter().all(|child| compiled_child_is_safe(vt, child, &shadowed_names))
}

fn append_direct(parent: &Ident, child: Expr, stmts: &mut Vec<Stmt>) {
    stmts.push(Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(crate::emit::call_ident(
            "_$compiledAppendChild",
            vec![Expr::Ident(parent.clone()), child],
        )),
    }));
}

fn create_text_node(value: Expr) -> Expr {
    crate::emit::call_ident("_$compiledCreateTextNode", vec![value])
}

fn emit_compiled_static_expr_child(
    parent: &Ident,
    expression: &Expr,
    stmts: &mut Vec<Stmt>,
) -> bool {
    if crate::utils::is_static_empty_like(expression) {
        append_direct(parent, create_text_node(crate::emit::string_expr("")), stmts);
        return true;
    }
    if let Some(value) = crate::utils::get_static_text_literal_expr(expression) {
        append_direct(parent, create_text_node(value), stmts);
        return true;
    }
    false
}

fn emit_compiled_children(
    vt: &mut VaporTransform,
    parent: &Ident,
    children: &[JSXElementChild],
    stmts: &mut Vec<Stmt>,
) {
    for (index, child) in children.iter().enumerate() {
        match child {
            JSXElementChild::JSXText(text) => {
                let normalized = crate::text::normalize_text(&text.value);
                if let Some(content) =
                    crate::text::compute_jsx_text_content(children, index, &normalized)
                {
                    append_direct(
                        parent,
                        create_text_node(crate::emit::string_expr(&content)),
                        stmts,
                    );
                }
            }
            JSXElementChild::JSXFragment(fragment) => {
                emit_compiled_children(vt, parent, &fragment.children, stmts)
            }
            JSXElementChild::JSXExprContainer(container) => {
                if let JSXExpr::Expr(expr) = &container.expr
                    && let Expr::Call(call) = crate::utils::unwrap_expr(expr.as_ref())
                    && crate::element_list::try_build_list_from_map(vt, parent, call, stmts)
                {
                    continue;
                }
                if let JSXExpr::Expr(expr) = &container.expr
                    && emit_compiled_static_expr_child(parent, expr.as_ref(), stmts)
                {
                    continue;
                }
                let _ = crate::vapor::emit_compiled_text_binding(vt, parent, container, stmts);
            }
            JSXElementChild::JSXElement(element) => {
                emit_compiled_element(vt, element, parent, stmts)
            }
            JSXElementChild::JSXSpreadChild(_) => {}
        }
    }
}

fn emit_compiled_element(
    vt: &mut VaporTransform,
    element: &JSXElement,
    parent: &Ident,
    stmts: &mut Vec<Stmt>,
) {
    if crate::vapor::template::emit_marked_template_child(vt, element, parent, stmts) {
        return;
    }
    let tag = compiled_tag_name(element).expect("compiled element must have a native HTML tag");
    let target = vt.next_el_ident();
    let create = crate::emit::call_ident(
        "_$compiledCreateElement",
        vec![crate::emit::string_expr(&tag), Expr::Ident(parent.clone())],
    );
    stmts.push(crate::emit::const_decl(target.clone(), create));
    append_direct(parent, Expr::Ident(target.clone()), stmts);
    crate::attrs::emit_compiled_attrs_for(vt, stmts, &target, &element.opening);
    emit_compiled_children(vt, &target, &element.children, stmts);
}

/// Build the setup body consumed by `_$compiledRoot`.
pub(crate) fn compiled_scalar_element_to_block(
    vt: &mut VaporTransform,
    element: &JSXElement,
) -> BlockStmt {
    let root = crate::emit::ident("_root");
    let tag = compiled_tag_name(element).expect("compiled root must have a native HTML tag");
    let create = crate::emit::call_ident(
        "_$compiledCreateElement",
        vec![
            crate::emit::string_expr(&tag),
            Expr::Ident(crate::emit::ident("__rue_parent_context")),
        ],
    );
    let mut stmts = vec![crate::emit::const_decl(root.clone(), create)];
    crate::attrs::emit_compiled_attrs_for(vt, &mut stmts, &root, &element.opening);
    emit_compiled_children(vt, &root, &element.children, &mut stmts);
    stmts.push(crate::emit::return_root(root));
    BlockStmt { span: DUMMY_SP, ctxt: SyntaxContext::empty(), stmts }
}

/// Build a safe Fragment setup body without pulling in the Vapor DOM layer.
pub(crate) fn compiled_fragment_to_block(
    vt: &mut VaporTransform,
    fragment: &JSXFragment,
) -> BlockStmt {
    let root = crate::emit::ident("_root");
    let create =
        crate::emit::call_member(crate::emit::ident("document"), "createDocumentFragment", vec![]);
    let mut stmts = vec![crate::emit::const_decl(root.clone(), create)];
    emit_compiled_children(vt, &root, &fragment.children, &mut stmts);
    stmts.push(crate::emit::return_root(root));
    BlockStmt { span: DUMMY_SP, ctxt: SyntaxContext::empty(), stmts }
}

pub(crate) fn compiled_block_to_root_expr(block: BlockStmt) -> Expr {
    let setup = Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![Pat::Ident(BindingIdent {
            id: crate::emit::ident("__rue_parent_context"),
            type_ann: None,
        })],
        body: Box::new(BlockStmtOrExpr::BlockStmt(block)),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: SyntaxContext::empty(),
    });
    crate::emit::call_ident("_$compiledRoot", vec![setup])
}

#[cfg(test)]
#[path = "element_children_tests.rs"]
mod tests;
