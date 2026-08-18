use swc_core::ecma::ast::*;

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

#[cfg(test)]
#[path = "element_children_tests.rs"]
mod tests;
