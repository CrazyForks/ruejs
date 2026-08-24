// SWC 常量与上下文：
// - DUMMY_SP：稳定的“占位”源码位置信息，避免测试受原始位置信息影响
// - SyntaxContext：语义上下文（此处统一用 empty() 保持简单作用域）
use swc_core::common::{DUMMY_SP, SyntaxContext};
// SWC ECMAScript AST 节点类型集合（ArrowExpr/JSXElement/Module 等）
use swc_core::ecma::ast::*;
// SWC 访问器接口：
// - VisitMut：实现可变访问器以就地改写 AST
// - VisitMutWith：在某节点上调用访问器（驱动遍历）
use swc_core::ecma::visit::{VisitMut, VisitMutWith};

use crate::emit::*;
use crate::imports::ensure_runtime_imports;
use crate::utils::unwrap_expr;

use super::VaporTransform;
use crate::log;

fn collect_scalar_names_from_pat(pat: &Pat, names: &mut std::collections::HashSet<String>) {
    match pat {
        Pat::Ident(binding) => {
            if crate::element_expr::is_global_scalar_constructor_name(binding.id.sym.as_ref()) {
                names.insert(binding.id.sym.to_string());
            }
        }
        Pat::Array(array) => {
            for element in array.elems.iter().flatten() {
                collect_scalar_names_from_pat(element, names);
            }
        }
        Pat::Object(object) => {
            for prop in &object.props {
                match prop {
                    ObjectPatProp::Assign(prop) => {
                        if crate::element_expr::is_global_scalar_constructor_name(
                            prop.key.sym.as_ref(),
                        ) {
                            names.insert(prop.key.sym.to_string());
                        }
                    }
                    ObjectPatProp::KeyValue(prop) => {
                        collect_scalar_names_from_pat(&prop.value, names);
                    }
                    ObjectPatProp::Rest(prop) => {
                        collect_scalar_names_from_pat(&prop.arg, names);
                    }
                }
            }
        }
        Pat::Assign(assign) => collect_scalar_names_from_pat(&assign.left, names),
        Pat::Rest(rest) => collect_scalar_names_from_pat(&rest.arg, names),
        _ => {}
    }
}

fn collect_scalar_names_from_stmts<'a>(
    stmts: impl IntoIterator<Item = &'a Stmt>,
) -> std::collections::HashSet<String> {
    let mut names = std::collections::HashSet::new();
    for stmt in stmts {
        let Stmt::Decl(decl) = stmt else {
            continue;
        };
        match decl {
            Decl::Var(var) => {
                for declarator in &var.decls {
                    collect_scalar_names_from_pat(&declarator.name, &mut names);
                }
            }
            Decl::Fn(function) => {
                if crate::element_expr::is_global_scalar_constructor_name(
                    function.ident.sym.as_ref(),
                ) {
                    names.insert(function.ident.sym.to_string());
                }
            }
            Decl::Class(class) => {
                if crate::element_expr::is_global_scalar_constructor_name(class.ident.sym.as_ref())
                {
                    names.insert(class.ident.sym.to_string());
                }
            }
            _ => {}
        }
    }
    names
}

fn collect_module_scalar_names(module: &Module) -> std::collections::HashSet<String> {
    let mut names = collect_scalar_names_from_stmts(
        module
            .body
            .iter()
            .filter_map(|item| if let ModuleItem::Stmt(stmt) = item { Some(stmt) } else { None }),
    );
    for item in &module.body {
        let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item else {
            continue;
        };
        for specifier in &import.specifiers {
            let local = match specifier {
                ImportSpecifier::Named(specifier) => &specifier.local,
                ImportSpecifier::Default(specifier) => &specifier.local,
                ImportSpecifier::Namespace(specifier) => &specifier.local,
            };
            if crate::element_expr::is_global_scalar_constructor_name(local.sym.as_ref()) {
                names.insert(local.sym.to_string());
            }
        }
    }
    names
}

fn vapor_parent_param() -> Pat {
    Pat::Ident(BindingIdent { id: ident("__rue_parent_context"), type_ann: None })
}

/// 访问器核心：
/// - 将表达式体或 `return` 返回的 JSX/Fragment 包裹进 `vapor(() => { ... })`
/// - 通过 `jsx_to_block/fragment_to_block` 生成块体，避免运行时解析 JSX
/// - 在发生转换后设置 `did_transform=true`，Module 访问阶段按需注入运行时 import
impl VisitMut for VaporTransform {
    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        let visible_renderable_locals = self.current_renderable_local_names();
        let scope = crate::element_expr::collect_renderable_local_alias_names(
            block.stmts.iter(),
            &visible_renderable_locals,
        );
        let scalar_scope = collect_scalar_names_from_stmts(block.stmts.iter());
        self.push_renderable_local_scope(scope);
        self.push_plain_local_scope(scalar_scope);
        block.visit_mut_children_with(self);
        self.pop_plain_local_scope();
        self.pop_renderable_local_scope();
    }

    /// 将 `() => <JSX />` 的箭头函数体替换为 `() => vapor(() => { ... })`
    /// 生成块体示例（参考 `tests/spec1.rs`）：
    /// - `const _root = _$createElement("div");`
    /// - `const _el1 = _$createElement("h1"); _$appendChild(_root, _el1);`
    /// - `return _root`
    fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
        log::debug("rue-swc: visit arrow_expr");
        let mut scalar_scope = std::collections::HashSet::new();
        for param in &arrow.params {
            collect_scalar_names_from_pat(param, &mut scalar_scope);
        }
        self.push_plain_local_scope(scalar_scope);
        match &mut *arrow.body {
            BlockStmtOrExpr::Expr(expr) => {
                let inner = unwrap_expr(expr.as_ref());
                match inner {
                    Expr::JSXElement(el) => {
                        log::debug("rue-swc: arrow JSXElement");
                        // 将 JSXElement 编译为块体，并用 vapor(() => {block}) 包裹
                        let block = self.jsx_to_block(el.as_ref());
                        let func = Expr::Arrow(ArrowExpr {
                            span: DUMMY_SP,
                            params: vec![vapor_parent_param()],
                            body: Box::new(BlockStmtOrExpr::BlockStmt(block)),
                            is_async: false,
                            is_generator: false,
                            type_params: None,
                            return_type: None,
                            ctxt: SyntaxContext::empty(),
                        });
                        let call = call_ident("vapor", vec![func]);
                        **expr = call;
                        // 标记已进行 Vapor 转换，用于模块级导入注入
                        self.did_transform = true;
                    }
                    Expr::JSXFragment(frag) => {
                        log::debug("rue-swc: arrow JSXFragment");
                        // 将片段编译为块体，并用 vapor(() => {block}) 包裹
                        let block = self.jsx_fragment_to_block(frag);
                        let func = Expr::Arrow(ArrowExpr {
                            span: DUMMY_SP,
                            params: vec![vapor_parent_param()],
                            body: Box::new(BlockStmtOrExpr::BlockStmt(block)),
                            is_async: false,
                            is_generator: false,
                            type_params: None,
                            return_type: None,
                            ctxt: SyntaxContext::empty(),
                        });
                        let call = call_ident("vapor", vec![func]);
                        **expr = call;
                        self.did_transform = true;
                    }
                    _ => {
                        // 重要：表达式体不直接是 JSX 时，仍需深入遍历其子节点（例如参数中的 ArrowExpr）
                        expr.visit_mut_children_with(self);
                    }
                }
            }
            BlockStmtOrExpr::BlockStmt(block) => {
                log::debug("rue-swc: arrow block");
                // 必须走 block visitor 本身，才能为块内 `const iconNode = <JSX />` 这类 bare local
                // renderable alias 建立作用域；只访问 children 会绕过 visit_mut_block_stmt。
                block.visit_mut_with(self);
            }
        }
        self.pop_plain_local_scope();
    }

    fn visit_mut_function(&mut self, function: &mut Function) {
        let mut scalar_scope = std::collections::HashSet::new();
        for param in &function.params {
            collect_scalar_names_from_pat(&param.pat, &mut scalar_scope);
        }
        self.push_plain_local_scope(scalar_scope);
        function.visit_mut_children_with(self);
        self.pop_plain_local_scope();
    }

    /// 将任意函数体中的 `return <JSX/>` / `return <>...</>` 转成 `return vapor(() => { ... })`
    fn visit_mut_return_stmt(&mut self, ret: &mut ReturnStmt) {
        if let Some(expr) = &mut ret.arg {
            let inner = unwrap_expr(expr.as_ref());
            match inner {
                Expr::JSXElement(el) => {
                    log::debug("rue-swc: nested return JSXElement");
                    // 将返回的 JSX 编译为块体，并用 vapor 包裹替换原返回值
                    let body_block = self.jsx_to_block(el.as_ref());
                    let func = Expr::Arrow(ArrowExpr {
                        span: DUMMY_SP,
                        params: vec![vapor_parent_param()],
                        body: Box::new(BlockStmtOrExpr::BlockStmt(body_block)),
                        is_async: false,
                        is_generator: false,
                        type_params: None,
                        return_type: None,
                        ctxt: SyntaxContext::empty(),
                    });
                    let call = call_ident("vapor", vec![func]);
                    **expr = call;
                    self.did_transform = true;
                }
                Expr::JSXFragment(frag) => {
                    log::debug("rue-swc: nested return JSXFragment");
                    // 将返回的片段编译为块体，并用 vapor 包裹替换原返回值
                    let body_block = self.jsx_fragment_to_block(frag);
                    let func = Expr::Arrow(ArrowExpr {
                        span: DUMMY_SP,
                        params: vec![vapor_parent_param()],
                        body: Box::new(BlockStmtOrExpr::BlockStmt(body_block)),
                        is_async: false,
                        is_generator: false,
                        type_params: None,
                        return_type: None,
                        ctxt: SyntaxContext::empty(),
                    });
                    let call = call_ident("vapor", vec![func]);
                    **expr = call;
                    self.did_transform = true;
                }
                _ => {}
            }
        }
    }

    /// 模块级处理：在发生 Vapor 转换后，按需注入 `@rue-js/rue` 运行时 import
    fn visit_mut_module(&mut self, m: &mut Module) {
        log::debug("rue-swc: visit module");
        let visible_renderable_locals = self.current_renderable_local_names();
        let scope = crate::element_expr::collect_renderable_local_alias_names(
            m.body.iter().filter_map(|item| match item {
                ModuleItem::Stmt(stmt) => Some(stmt),
                _ => None,
            }),
            &visible_renderable_locals,
        );
        let scalar_scope = collect_module_scalar_names(m);
        self.push_renderable_local_scope(scope);
        self.push_plain_local_scope(scalar_scope);
        // propagate into children first
        m.visit_mut_children_with(self);
        self.pop_plain_local_scope();
        self.pop_renderable_local_scope();
        if !self.did_transform {
            return;
        }
        log::info("rue-swc: ensure runtime imports");
        // 注入导入集合包含：`vapor`, `renderBetween`, `_$createElement`, `_$appendChild`, `watchEffect` 等，
        // 以及类型导入 `FC`；若已存在从 `@rue-js/rue` 的 import，则合并缺失的 specifier，保持一次导入。
        // 细节：
        // - import 源：固定为 '@rue-js/rue'
        // - 类型导入优先插入（如 FC），值导入按稳定序列排序，保证快照稳定
        // - 采用 DUMMY_SP 与 SyntaxContext::empty() 构造 importdecl/specifier，避免位置信息干扰
        ensure_runtime_imports(m);
    }
}

#[cfg(test)]
#[path = "visitor_tests.rs"]
mod tests;
