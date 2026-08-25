mod block;
mod component;
mod helpers;
mod visitor;

use std::collections::HashSet;

use swc_core::common::DUMMY_SP;
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitMut, VisitMutWith, VisitWith};

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
    /// 当前可见的普通局部变量名栈；也承载作用域内对全局标量构造器的同名遮蔽
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

    pub(crate) fn current_scalar_constructor_shadows(&self) -> HashSet<String> {
        self.current_plain_local_names()
            .into_iter()
            .filter(|name| crate::element_expr::is_global_scalar_constructor_name(name))
            .collect()
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

/// 将安全列表行中原本分散的绑定 effect 编译为一个无 owner 的 patch。
///
/// 每个原 effect 的 body 都保留在独立块作用域中，避免属性/slot emission
/// 复用 `__slot`、`__obj` 等临时名时发生声明冲突。patch 会更新 renderItem
/// 参数绑定，使事件闭包与 DOM 绑定都能读取同 key 的最新对象；首次挂载也调用
/// 同一个 patch，后续由列表级 effect 批量调用。
pub(crate) fn coalesce_list_row_binding_effects(
    stmts: &mut Vec<Stmt>,
    item_ident: &Ident,
    index_ident: &Ident,
) -> Option<Ident> {
    collapse_sole_list_row_text_wrappers(stmts);

    let mut used_names = RowBindingIdentCollector::default();
    stmts.visit_with(&mut used_names);

    let mut retained = Vec::with_capacity(stmts.len());
    let mut effect_blocks = Vec::new();
    let mut binding_decls = Vec::new();
    let mut binding_index = 0;

    for stmt in std::mem::take(stmts) {
        if let Some(body) = watch_effect_body(&stmt) {
            let body = guard_row_binding_setter(
                body,
                &mut binding_decls,
                &mut used_names.names,
                &mut binding_index,
            );
            effect_blocks.push(Stmt::Block(BlockStmt {
                span: DUMMY_SP,
                ctxt: swc_core::common::SyntaxContext::empty(),
                stmts: body,
            }));
        } else {
            retained.push(stmt);
        }
    }

    if effect_blocks.is_empty() {
        *stmts = retained;
        return None;
    }

    retained.extend(binding_decls);

    let (patch_ident, next_item_ident, next_index_ident) = loop {
        let patch_ident = crate::emit::ident("_$rowPatch");
        let next_item_ident = crate::emit::ident("_$rowNextItem");
        let next_index_ident = crate::emit::ident("_$rowNextIndex");
        if [&patch_ident, &next_item_ident, &next_index_ident]
            .iter()
            .all(|ident| !used_names.names.contains(ident.sym.as_ref()))
        {
            break (patch_ident, next_item_ident, next_index_ident);
        }

        let suffix = binding_index;
        binding_index += 1;
        let patch_ident = crate::emit::ident(&format!("_$rowPatch{suffix}"));
        let next_item_ident = crate::emit::ident(&format!("_$rowNextItem{suffix}"));
        let next_index_ident = crate::emit::ident(&format!("_$rowNextIndex{suffix}"));
        if [&patch_ident, &next_item_ident, &next_index_ident]
            .iter()
            .all(|ident| !used_names.names.contains(ident.sym.as_ref()))
        {
            break (patch_ident, next_item_ident, next_index_ident);
        }
    };

    let mut patch_stmts = vec![
        assign_ident_stmt(item_ident.clone(), Expr::Ident(next_item_ident.clone())),
        assign_ident_stmt(index_ident.clone(), Expr::Ident(next_index_ident.clone())),
    ];
    patch_stmts.extend(effect_blocks);

    let patch_arrow = Expr::Arrow(ArrowExpr {
        span: DUMMY_SP,
        params: vec![
            Pat::Ident(BindingIdent { id: next_item_ident, type_ann: None }),
            Pat::Ident(BindingIdent { id: next_index_ident, type_ann: None }),
        ],
        body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
            span: DUMMY_SP,
            ctxt: swc_core::common::SyntaxContext::empty(),
            stmts: patch_stmts,
        })),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
        ctxt: swc_core::common::SyntaxContext::empty(),
    });
    retained.push(crate::emit::const_decl(patch_ident.clone(), patch_arrow));
    retained.push(Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(crate::emit::call_ident(
            patch_ident.sym.as_ref(),
            vec![Expr::Ident(item_ident.clone()), Expr::Ident(index_ident.clone())],
        )),
    }));
    *stmts = retained;
    Some(patch_ident)
}

/// 将安全 direct-root 行里的 ref helper 绑定到当前行 owner。
///
/// 普通 JSX 保持二参数调用，由 runtime 登记组件卸载；只有已经通过列表行能力
/// 分类的生成语句才会补第三个 registrar 参数。
pub(crate) fn bind_list_row_ref_cleanups(stmts: &mut Vec<Stmt>, registrar: &Ident) -> bool {
    struct BindRefCleanupRegistrar<'a> {
        registrar: &'a Ident,
        found: bool,
    }

    impl VisitMut for BindRefCleanupRegistrar<'_> {
        fn visit_mut_call_expr(&mut self, call: &mut CallExpr) {
            call.visit_mut_children_with(self);
            if call_ident_name(call) == Some("_$vaporBindUseRef") && call.args.len() == 2 {
                self.found = true;
                call.args.push(ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Ident(self.registrar.clone())),
                });
            }
        }
    }

    let mut binder = BindRefCleanupRegistrar { registrar, found: false };
    stmts.visit_mut_with(&mut binder);
    binder.found
}

#[derive(Default)]
struct RowBindingIdentCollector {
    names: HashSet<String>,
}

impl Visit for RowBindingIdentCollector {
    fn visit_ident(&mut self, ident: &Ident) {
        self.names.insert(ident.sym.to_string());
    }
}

fn guard_row_binding_setter(
    body: Vec<Stmt>,
    binding_decls: &mut Vec<Stmt>,
    used_names: &mut HashSet<String>,
    binding_index: &mut usize,
) -> Vec<Stmt> {
    let [Stmt::Expr(expr_stmt)] = body.as_slice() else {
        return body;
    };
    let Expr::Call(call) = expr_stmt.expr.as_ref() else {
        return body;
    };
    let value_arg_index = match call_ident_name(call) {
        Some("_$setClassName" | "_$settextContent") if call.args.len() == 2 => 1,
        Some("_$setAttribute") if call.args.len() == 3 => 2,
        _ => return body,
    };
    if call.args.iter().any(|arg| arg.spread.is_some()) {
        return body;
    }

    let (value_ident, initialized_ident, next_ident) = loop {
        let index = *binding_index;
        *binding_index += 1;
        let value_ident = crate::emit::ident(&format!("_$rowBindingValue{index}"));
        let initialized_ident = crate::emit::ident(&format!("_$rowBindingInitialized{index}"));
        let next_ident = crate::emit::ident(&format!("_$rowBindingNext{index}"));
        if [&value_ident, &initialized_ident, &next_ident]
            .iter()
            .all(|ident| !used_names.contains(ident.sym.as_ref()))
        {
            used_names.extend([
                value_ident.sym.to_string(),
                initialized_ident.sym.to_string(),
                next_ident.sym.to_string(),
            ]);
            break (value_ident, initialized_ident, next_ident);
        }
    };

    binding_decls.push(let_decl(value_ident.clone(), None));
    binding_decls.push(let_decl(
        initialized_ident.clone(),
        Some(Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: false }))),
    ));

    let next_value = call.args[value_arg_index].expr.as_ref().clone();
    let mut guarded_call = call.clone();
    guarded_call.args[value_arg_index].expr = Box::new(Expr::Ident(next_ident.clone()));

    let same_value = crate::emit::call_member(
        crate::emit::ident("Object"),
        "is",
        vec![Expr::Ident(value_ident.clone()), Expr::Ident(next_ident.clone())],
    );
    let should_write = Expr::Bin(BinExpr {
        span: DUMMY_SP,
        op: BinaryOp::LogicalOr,
        left: Box::new(Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Bang,
            arg: Box::new(Expr::Ident(initialized_ident.clone())),
        })),
        right: Box::new(Expr::Unary(UnaryExpr {
            span: DUMMY_SP,
            op: UnaryOp::Bang,
            arg: Box::new(same_value),
        })),
    });

    vec![
        crate::emit::const_decl(next_ident.clone(), next_value),
        Stmt::If(IfStmt {
            span: DUMMY_SP,
            test: Box::new(should_write),
            cons: Box::new(Stmt::Block(BlockStmt {
                span: DUMMY_SP,
                ctxt: swc_core::common::SyntaxContext::empty(),
                stmts: vec![
                    Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(Expr::Call(guarded_call)),
                    }),
                    assign_ident_stmt(value_ident, Expr::Ident(next_ident)),
                    assign_ident_stmt(
                        initialized_ident,
                        Expr::Lit(Lit::Bool(Bool { span: DUMMY_SP, value: true })),
                    ),
                ],
            })),
            alt: None,
        }),
    ]
}

fn let_decl(name: Ident, init: Option<Expr>) -> Stmt {
    Stmt::Decl(Decl::Var(Box::new(VarDecl {
        span: DUMMY_SP,
        ctxt: swc_core::common::SyntaxContext::empty(),
        kind: VarDeclKind::Let,
        declare: false,
        decls: vec![VarDeclarator {
            span: DUMMY_SP,
            name: Pat::Ident(BindingIdent { id: name, type_ann: None }),
            init: init.map(Box::new),
            definite: false,
        }],
    })))
}

fn assign_ident_stmt(target: Ident, value: Expr) -> Stmt {
    Stmt::Expr(ExprStmt {
        span: DUMMY_SP,
        expr: Box::new(Expr::Assign(AssignExpr {
            span: DUMMY_SP,
            op: AssignOp::Assign,
            left: AssignTarget::Simple(SimpleAssignTarget::Ident(target.into())),
            right: Box::new(value),
        })),
    })
}

fn call_ident_name(call: &CallExpr) -> Option<&str> {
    let Callee::Expr(callee) = &call.callee else {
        return None;
    };
    let Expr::Ident(ident) = callee.as_ref() else {
        return None;
    };
    Some(ident.sym.as_ref())
}

fn text_wrapper_decl(stmt: &Stmt) -> Option<(Id, Ident)> {
    let Stmt::Decl(Decl::Var(var)) = stmt else {
        return None;
    };
    let [decl] = var.decls.as_slice() else {
        return None;
    };
    let Pat::Ident(wrapper) = &decl.name else {
        return None;
    };
    let Expr::Call(call) = decl.init.as_deref()? else {
        return None;
    };
    if call_ident_name(call) != Some("_$createTextWrapper") {
        return None;
    }
    let [parent] = call.args.as_slice() else {
        return None;
    };
    let Expr::Ident(parent) = parent.expr.as_ref() else {
        return None;
    };
    Some((wrapper.id.to_id(), parent.clone()))
}

fn append_child_idents(stmt: &Stmt) -> Option<(Id, Id)> {
    let Stmt::Expr(expr_stmt) = stmt else {
        return None;
    };
    let Expr::Call(call) = expr_stmt.expr.as_ref() else {
        return None;
    };
    if call_ident_name(call) != Some("_$appendChild") {
        return None;
    }
    let [parent, child] = call.args.as_slice() else {
        return None;
    };
    let Expr::Ident(parent) = parent.expr.as_ref() else {
        return None;
    };
    let Expr::Ident(child) = child.expr.as_ref() else {
        return None;
    };
    Some((parent.to_id(), child.to_id()))
}

fn append_child_parent(stmt: &Stmt) -> Option<Id> {
    let Stmt::Expr(expr_stmt) = stmt else {
        return None;
    };
    let Expr::Call(call) = expr_stmt.expr.as_ref() else {
        return None;
    };
    if call_ident_name(call) != Some("_$appendChild") {
        return None;
    }
    let parent = call.args.first()?;
    let Expr::Ident(parent) = parent.expr.as_ref() else {
        return None;
    };
    Some(parent.to_id())
}

struct ReplaceSoleTextWrappers<'a> {
    parents: &'a std::collections::HashMap<Id, Ident>,
}

impl VisitMut for ReplaceSoleTextWrappers<'_> {
    fn visit_mut_ident(&mut self, ident: &mut Ident) {
        if let Some(parent) = self.parents.get(&ident.to_id()) {
            *ident = parent.clone();
        }
    }
}

/// 安全 direct-root 列表行中，如果某个元素唯一追加的子节点就是动态文本
/// wrapper，则直接更新父元素的 textContent。混合静态文本、多动态文本和嵌套
/// 元素仍保留 wrapper，避免 textContent 更新清掉相邻节点或事件监听器。
fn collapse_sole_list_row_text_wrappers(stmts: &mut Vec<Stmt>) {
    let wrappers: std::collections::HashMap<Id, Ident> =
        stmts.iter().filter_map(text_wrapper_decl).collect();
    if wrappers.is_empty() {
        return;
    }

    let mut append_counts = std::collections::HashMap::<Id, usize>::new();
    for parent in stmts.iter().filter_map(append_child_parent) {
        *append_counts.entry(parent).or_default() += 1;
    }

    let eligible: std::collections::HashMap<Id, Ident> = wrappers
        .into_iter()
        .filter(|(_, parent)| append_counts.get(&parent.to_id()) == Some(&1))
        .collect();
    if eligible.is_empty() {
        return;
    }

    stmts.retain(|stmt| {
        if let Some((wrapper, _)) = text_wrapper_decl(stmt) {
            return !eligible.contains_key(&wrapper);
        }
        if let Some((_, child)) = append_child_idents(stmt) {
            return !eligible.contains_key(&child);
        }
        true
    });

    let mut replacer = ReplaceSoleTextWrappers { parents: &eligible };
    stmts.visit_mut_with(&mut replacer);
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
