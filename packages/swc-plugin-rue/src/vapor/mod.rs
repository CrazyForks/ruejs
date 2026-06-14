mod block;
mod component;
mod helpers;
mod visitor;

use std::collections::HashSet;

use swc_core::common::DUMMY_SP;
use swc_core::ecma::ast::*;

/*
Vapor 深编译转换器说明：
- 职责：遍历箭头函数与返回 JSX 的位置，替换为 `vapor(() => { ... })`，并在块体中生成原生 DOM 构造语句。
- 片段渲染：通过在父节点插入 `start/end` 注释（`_listX`）作为锚点，结合 `renderBetween` 在两者之间插入片段。
- 命名策略：使用递增计数生成稳定的局部标识符，避免与用户代码冲突，并提升可读性与调试体验。
- Import 注入：当 `did_transform` 为 true 时，模块级访问会按需注入 `@rue-js/rue` 的运行时 import。
- 选择注释锚点的原因：原生 DOM 没有“片段占位”概念，注释节点可作为轻量且不影响布局的边界标记，配合 `parentNode` 枚举进行精准插入与复用。

结构体字段说明：
- next_el/next_list/next_map/next_child：各类计数器用于生成稳定名称；
- did_transform：标记是否发生 Vapor 转换，模块访问阶段据此注入运行时 import；
- once_depth：当前是否处于 v-once/r-once 子树编译上下文；
- el_tag_by_ident：记录元素标识符与标签名的映射，便于特殊处理（如 style 文本）。
*/

/// Vapor 转换器：将箭头函数返回的 JSX 转换为 Vapor DOM 构造代码
/// 工作流程（参考 `tests/basic.rs`）：
/// - 访问箭头函数体；若返回 JSX/Fragment，替换为 `vapor(() => { ... })`
/// - 在块体内调用 `elements::build_element` 递归生成原生 DOM 创建与插入代码
/// - 标记 `did_transform = true` 以便模块级注入运行时 import
pub struct VaporTransform {
    /// 递增的原生元素计数，用于生成 `_elX` 名称
    pub next_el: usize,
    /// 递增的占位注释计数，用于生成 `_listX` 名称
    pub next_list: usize,
    /// 递增的 map 计数，用于生成 `_mapX` 前缀
    pub next_map: usize,
    /// 递增的 children 片段计数，用于生成 `__childX` 名称
    pub next_child: usize,
    /// v-once/r-once 子树编译深度；大于 0 时动态内容只做首次赋值
    pub once_depth: usize,
    /// 标记当前模块是否发生过 Vapor 转换，用于触发运行时 import 注入
    pub did_transform: bool,
    /// 记录已创建元素的标识符与标签名，用于特殊处理（例如 style 子文本）
    pub el_tag_by_ident: std::collections::HashMap<String, String>,
    /// 当前可见的“renderable local” 变量名栈，用于把 bare ident child 判定为 slot 候选
    pub renderable_local_scopes: Vec<HashSet<String>>,
    /// 当前可见的普通局部变量名栈，用于避免把列表/块内文本临时变量误判为 slot
    pub plain_local_scopes: Vec<HashSet<String>>,
}

impl VaporTransform {
    pub(crate) fn is_once_context(&self) -> bool {
        self.once_depth > 0
    }

    pub(crate) fn with_once_context<T>(&mut self, f: impl FnOnce(&mut Self) -> T) -> T {
        self.once_depth += 1;
        let out = f(self);
        self.once_depth -= 1;
        out
    }

    pub(crate) fn current_renderable_local_names(&self) -> HashSet<String> {
        let mut names = HashSet::new();
        for scope in &self.renderable_local_scopes {
            names.extend(scope.iter().cloned());
        }
        names
    }

    pub(crate) fn push_renderable_local_scope(&mut self, scope: HashSet<String>) {
        self.renderable_local_scopes.push(scope);
    }

    pub(crate) fn pop_renderable_local_scope(&mut self) {
        self.renderable_local_scopes.pop();
    }

    pub(crate) fn current_plain_local_names(&self) -> HashSet<String> {
        let mut names = HashSet::new();
        for scope in &self.plain_local_scopes {
            names.extend(scope.iter().cloned());
        }
        names
    }

    pub(crate) fn push_plain_local_scope(&mut self, scope: HashSet<String>) {
        self.plain_local_scopes.push(scope);
    }

    pub(crate) fn pop_plain_local_scope(&mut self) {
        self.plain_local_scopes.pop();
    }
}

pub(crate) fn flatten_once_watch_effects(stmts: &mut Vec<Stmt>) {
    // v-once/r-once 子树只需要初次赋值。这里把生成阶段保守包上的 watchEffect 展平，
    // 保留内部 DOM 写入语句，避免 once 子树仍然参与响应式订阅。
    let mut next = Vec::with_capacity(stmts.len());
    for stmt in std::mem::take(stmts) {
        if let Some(mut body) = watch_effect_body(&stmt) {
            flatten_once_watch_effects(&mut body);
            next.push(Stmt::Block(BlockStmt {
                span: DUMMY_SP,
                ctxt: swc_core::common::SyntaxContext::empty(),
                stmts: body,
            }));
        } else {
            next.push(stmt);
        }
    }
    *stmts = next;
}

fn watch_effect_body(stmt: &Stmt) -> Option<Vec<Stmt>> {
    let Stmt::Expr(ExprStmt { expr, .. }) = stmt else {
        return None;
    };
    let Expr::Call(call) = expr.as_ref() else {
        return None;
    };
    let Callee::Expr(callee) = &call.callee else {
        return None;
    };
    let Expr::Ident(id) = callee.as_ref() else {
        return None;
    };
    if id.sym.as_ref() != "watchEffect" {
        return None;
    }

    let first = call.args.first()?;
    let Expr::Arrow(arrow) = first.expr.as_ref() else {
        return None;
    };
    match arrow.body.as_ref() {
        BlockStmtOrExpr::BlockStmt(block) => Some(block.stmts.clone()),
        BlockStmtOrExpr::Expr(expr) => {
            Some(vec![Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: expr.clone() })])
        }
    }
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
