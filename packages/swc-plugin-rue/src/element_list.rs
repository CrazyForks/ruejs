use swc_core::common::{DUMMY_SP, SyntaxContext};
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitMut, VisitMutWith, VisitWith};

use crate::elements::build_element;
use crate::emit::*;
use crate::log;
use crate::text::normalize_text;
use crate::utils;
use crate::vapor::VaporTransform;

/// 判断一条语句是否属于“纯声明前缀”。
///
/// 这里故意只接受 `Stmt::Decl(_)`，不接受赋值、调用、if、for 等任意可执行语句。
/// 原因是这次收窄修复的目标，只是把诸如 `const y = ...` 这类局部绑定保留下来，
/// 而不是试图在编译阶段重放整段 block body 的控制流。
///
/// 一旦把带副作用或带控制流的语句也当成“可提取前缀”，就会出现两个风险：
/// 1. 语句被搬到 renderItem/getKey 后，执行时机可能变化；
/// 2. 语句原本依赖的条件分支/早退语义会被破坏。
///
/// 所以这里宁可保守，只认声明，不做更激进的代码搬运。
fn is_declaration_only_stmt(stmt: &Stmt) -> bool {
    matches!(stmt, Stmt::Decl(_))
}

/// 从一个 block body 中提取“声明前缀 + 最后一个 return 表达式”。
///
/// 这个函数只服务于“简单 block”快路径，适用的源码形态大致是：
///
/// ```ts
/// items.map(item => {
///   const y = ...
///   const z = ...
///   return <div>{y + z}</div>
/// })
/// ```
///
/// 满足条件时返回：
/// - 前缀声明列表：`const y = ...; const z = ...;`
/// - 最后 return 的表达式：`<div>{y + z}</div>`
///
/// 不满足条件时返回 None，典型包括：
/// - 中间夹了 if/for/表达式语句
/// - 最后一条不是 `return ...`
/// - 存在更复杂的多分支 return
///
/// 返回 None 后，调用方会切换到更保守的 fallback 路径，保留原 block 控制流，
/// 而不是继续尝试把整段逻辑硬拆成“前缀 + JSX return”。
fn collect_decl_prefix_and_final_return(block: &BlockStmt) -> Option<(Vec<Stmt>, Expr)> {
    let (last, prefix_stmts) = block.stmts.split_last()?;
    let mut prefix: Vec<Stmt> = Vec::new();

    for stmt in prefix_stmts {
        if !is_declaration_only_stmt(stmt) {
            return None;
        }
        prefix.push(stmt.clone());
    }

    match last {
        Stmt::Return(ReturnStmt { arg: Some(arg), .. }) => {
            Some((prefix, utils::unwrap_expr(arg.as_ref()).clone()))
        }
        _ => None,
    }
}

/// 递归收集一个 block 中所有 return 的表达式。
///
/// 这里的用途不是直接生成 renderItem，而是做“key 提取预扫描”：
/// map callback 里可能有多个 return，尤其是条件分支：
///
/// ```ts
/// items.map(item => {
///   if (item.hot) return <li key={item.id}>hot</li>
///   return <li key={item.id}>cold</li>
/// })
/// ```
///
/// 为了拿到 JSX 根上的 key，我们不能只看最后一个 return，
/// 否则前面的分支会漏掉。所以这里先把所有 return expr 扫一遍，
/// 后续统一交给 `try_extract_key` 处理。
fn collect_return_exprs_in_block(block: &BlockStmt, out: &mut Vec<Expr>) {
    for stmt in &block.stmts {
        collect_return_exprs_in_stmt(stmt, out);
    }
}

/// 递归收集单条语句里的所有 return 表达式。
///
/// 之所以递归到 if/switch/try/loop，是因为 map callback 的 return 可能埋在这些控制流里。
/// 这里只做“扫描”，不做语义改写；真正的渲染策略选择，仍由后面的 renderItem 分支决定。
fn collect_return_exprs_in_stmt(stmt: &Stmt, out: &mut Vec<Expr>) {
    match stmt {
        Stmt::Return(ReturnStmt { arg: Some(arg), .. }) => {
            out.push(utils::unwrap_expr(arg.as_ref()).clone());
        }
        Stmt::Block(block) => collect_return_exprs_in_block(block, out),
        Stmt::If(if_stmt) => {
            collect_return_exprs_in_stmt(if_stmt.cons.as_ref(), out);
            if let Some(alt) = &if_stmt.alt {
                collect_return_exprs_in_stmt(alt.as_ref(), out);
            }
        }
        Stmt::Labeled(stmt) => collect_return_exprs_in_stmt(stmt.body.as_ref(), out),
        Stmt::With(stmt) => collect_return_exprs_in_stmt(stmt.body.as_ref(), out),
        Stmt::Switch(stmt) => {
            for case in &stmt.cases {
                for case_stmt in &case.cons {
                    collect_return_exprs_in_stmt(case_stmt, out);
                }
            }
        }
        Stmt::Try(stmt) => {
            collect_return_exprs_in_block(&stmt.block, out);
            if let Some(handler) = &stmt.handler {
                collect_return_exprs_in_block(&handler.body, out);
            }
            if let Some(finalizer) = &stmt.finalizer {
                collect_return_exprs_in_block(finalizer, out);
            }
        }
        Stmt::While(stmt) => collect_return_exprs_in_stmt(stmt.body.as_ref(), out),
        Stmt::DoWhile(stmt) => collect_return_exprs_in_stmt(stmt.body.as_ref(), out),
        Stmt::For(stmt) => collect_return_exprs_in_stmt(stmt.body.as_ref(), out),
        Stmt::ForIn(stmt) => collect_return_exprs_in_stmt(stmt.body.as_ref(), out),
        Stmt::ForOf(stmt) => collect_return_exprs_in_stmt(stmt.body.as_ref(), out),
        _ => {}
    }
}

/// 从模式（pattern）里收集所有声明出来的标识符名。
///
/// 这个辅助函数主要给对象/数组解构服务，例如：
/// - `const { id, value } = row`
/// - `const [a, b] = pair`
///
/// 后面我们需要知道“某个 key 表达式是否依赖这些前缀声明”，
/// 所以先把声明名抽成集合，再做一次 AST 访问。
fn collect_declared_idents_from_pat(pat: &Pat, out: &mut std::collections::HashSet<String>) {
    match pat {
        Pat::Ident(binding) => {
            out.insert(binding.id.sym.to_string());
        }
        Pat::Array(arr) => {
            for elem in &arr.elems {
                if let Some(elem) = elem {
                    collect_declared_idents_from_pat(elem, out);
                }
            }
        }
        Pat::Object(obj) => {
            for prop in &obj.props {
                match prop {
                    ObjectPatProp::Assign(assign) => {
                        out.insert(assign.key.sym.to_string());
                    }
                    ObjectPatProp::KeyValue(kv) => collect_declared_idents_from_pat(&kv.value, out),
                    ObjectPatProp::Rest(rest) => collect_declared_idents_from_pat(&rest.arg, out),
                }
            }
        }
        Pat::Assign(assign) => collect_declared_idents_from_pat(&assign.left, out),
        Pat::Rest(rest) => collect_declared_idents_from_pat(&rest.arg, out),
        _ => {}
    }
}

fn fresh_ident_avoiding(base: &str, used: &std::collections::HashSet<String>) -> Ident {
    if !used.contains(base) {
        return ident(base);
    }

    let mut counter = 1usize;
    loop {
        let candidate = format!("__rue_{}{}", base, counter);
        if !used.contains(&candidate) {
            return ident(&candidate);
        }
        counter += 1;
    }
}

fn tuple_index_expr(base: Expr, index: usize) -> Expr {
    Expr::Member(MemberExpr {
        span: DUMMY_SP,
        obj: Box::new(base),
        prop: MemberProp::Computed(ComputedPropName {
            span: DUMMY_SP,
            expr: Box::new(Expr::Lit(Lit::Num(Number {
                span: DUMMY_SP,
                value: index as f64,
                raw: None,
            }))),
        }),
    })
}

fn prop_access_expr(base: Expr, key: &PropName) -> Expr {
    match key {
        PropName::Ident(id) => Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: Box::new(base),
            prop: MemberProp::Ident(id.clone().into()),
        }),
        PropName::Str(s) => Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: Box::new(base),
            prop: MemberProp::Computed(ComputedPropName {
                span: DUMMY_SP,
                expr: Box::new(Expr::Lit(Lit::Str(s.clone()))),
            }),
        }),
        PropName::Num(n) => Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: Box::new(base),
            prop: MemberProp::Computed(ComputedPropName {
                span: DUMMY_SP,
                expr: Box::new(Expr::Lit(Lit::Num(n.clone()))),
            }),
        }),
        PropName::Computed(computed) => Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: Box::new(base),
            prop: MemberProp::Computed(computed.clone()),
        }),
        PropName::BigInt(bigint) => Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: Box::new(base),
            prop: MemberProp::Computed(ComputedPropName {
                span: DUMMY_SP,
                expr: Box::new(Expr::Lit(Lit::BigInt(bigint.clone()))),
            }),
        }),
    }
}

fn collect_alias_exprs_from_pat(
    pat: &Pat,
    source_expr: Expr,
    out: &mut std::collections::HashMap<String, Expr>,
) {
    match pat {
        Pat::Ident(binding) => {
            out.insert(binding.id.sym.to_string(), source_expr);
        }
        Pat::Array(arr) => {
            for (index, elem) in arr.elems.iter().enumerate() {
                if let Some(elem) = elem {
                    collect_alias_exprs_from_pat(
                        elem,
                        tuple_index_expr(source_expr.clone(), index),
                        out,
                    );
                }
            }
        }
        Pat::Object(obj) => {
            for prop in &obj.props {
                match prop {
                    ObjectPatProp::Assign(assign) => {
                        out.insert(
                            assign.key.sym.to_string(),
                            prop_access_expr(
                                source_expr.clone(),
                                &PropName::Ident(assign.key.clone().into()),
                            ),
                        );
                    }
                    ObjectPatProp::KeyValue(kv) => {
                        collect_alias_exprs_from_pat(
                            &kv.value,
                            prop_access_expr(source_expr.clone(), &kv.key),
                            out,
                        );
                    }
                    ObjectPatProp::Rest(rest) => {
                        collect_alias_exprs_from_pat(&rest.arg, source_expr.clone(), out);
                    }
                }
            }
        }
        Pat::Assign(assign) => collect_alias_exprs_from_pat(&assign.left, source_expr, out),
        Pat::Rest(rest) => collect_alias_exprs_from_pat(&rest.arg, source_expr, out),
        _ => {}
    }
}

struct AliasExprRewriter<'a> {
    alias_exprs: &'a std::collections::HashMap<String, Expr>,
}

fn wrap_alias_expr_if_needed(expr: Expr) -> Expr {
    match expr {
        Expr::Paren(_) => expr,
        other => match utils::unwrap_expr(&other) {
            Expr::Bin(_) | Expr::Cond(_) | Expr::Assign(_) | Expr::Seq(_) => {
                Expr::Paren(ParenExpr { span: DUMMY_SP, expr: Box::new(other) })
            }
            _ => other,
        },
    }
}

impl VisitMut for AliasExprRewriter<'_> {
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if let Expr::Ident(ident) = expr {
            if let Some(rewritten) = self.alias_exprs.get(ident.sym.as_ref()) {
                *expr = wrap_alias_expr_if_needed(rewritten.clone());
                return;
            }
        }
        expr.visit_mut_children_with(self);
    }

    fn visit_mut_prop(&mut self, prop: &mut Prop) {
        if let Prop::Shorthand(ident) = prop {
            if let Some(rewritten) = self.alias_exprs.get(ident.sym.as_ref()) {
                *prop = Prop::KeyValue(KeyValueProp {
                    key: PropName::Ident(ident.clone().into()),
                    value: Box::new(wrap_alias_expr_if_needed(rewritten.clone())),
                });
                return;
            }
        }
        prop.visit_mut_children_with(self);
    }
}

fn rewrite_alias_exprs_in_expr(
    expr: &mut Expr,
    alias_exprs: &std::collections::HashMap<String, Expr>,
) {
    if alias_exprs.is_empty() {
        return;
    }
    let mut rewriter = AliasExprRewriter { alias_exprs };
    expr.visit_mut_with(&mut rewriter);
}

fn rewrite_alias_exprs_in_stmt(
    stmt: &mut Stmt,
    alias_exprs: &std::collections::HashMap<String, Expr>,
) {
    if alias_exprs.is_empty() {
        return;
    }
    let mut rewriter = AliasExprRewriter { alias_exprs };
    stmt.visit_mut_with(&mut rewriter);
}

/// 从一组语句里收集所有“由声明引入的标识符名”。
///
/// 它和 `collect_declared_idents_from_pat` 配合使用，最终产物是一个名字集合，
/// 用来回答下面这个问题：
/// “当前 getKey 表达式，是否引用了前缀声明里定义出来的局部变量？”
///
/// 例如：
///
/// ```ts
/// const rowKey = id
/// return <li key={rowKey}>...</li>
/// ```
///
/// 这里 key 实际依赖 `rowKey`，所以 getKey 里也必须保留 `const rowKey = id`。
fn collect_declared_idents_in_stmts(stmts: &[Stmt]) -> std::collections::HashSet<String> {
    let mut out = std::collections::HashSet::new();
    for stmt in stmts {
        match stmt {
            Stmt::Decl(Decl::Var(var)) => {
                for decl in &var.decls {
                    collect_declared_idents_from_pat(&decl.name, &mut out);
                }
            }
            Stmt::Decl(Decl::Fn(func)) => {
                out.insert(func.ident.sym.to_string());
            }
            Stmt::Decl(Decl::Class(class)) => {
                out.insert(class.ident.sym.to_string());
            }
            _ => {}
        }
    }
    out
}

struct IdentUseCollector<'a> {
    names: &'a std::collections::HashSet<String>,
    found: bool,
}

impl Visit for IdentUseCollector<'_> {
    /// 访问表达式里的所有标识符，只要命中目标集合中的任意一个名字，就认为“表达式依赖前缀声明”。
    fn visit_ident(&mut self, ident: &Ident) {
        if self.names.contains(ident.sym.as_ref()) {
            self.found = true;
        }
    }
}

/// 判断一个表达式是否使用了前缀声明里引入的局部变量。
///
/// 这里的核心用途只有一个：
/// 决定 getKey 是否需要把某些“声明前缀”一并复制进去。
///
/// 如果 key 本身只依赖原始 item / idx，就不要多生成块体；
/// 如果 key 依赖前面声明出来的中间变量，就必须把对应声明带进 getKey，
/// 否则会再次出现“key 用到了未定义变量”的同类作用域问题。
fn expr_uses_declared_prefix(expr: &Expr, prefix_stmts: &[Stmt]) -> bool {
    let declared = collect_declared_idents_in_stmts(prefix_stmts);
    if declared.is_empty() {
        return false;
    }
    let mut collector = IdentUseCollector { names: &declared, found: false };
    expr.visit_with(&mut collector);
    collector.found
}

struct ExternalReactivePrefixCollector<'a> {
    local_names: &'a std::collections::HashSet<String>,
    found: bool,
}

impl Visit for ExternalReactivePrefixCollector<'_> {
    fn visit_member_expr(&mut self, member: &MemberExpr) {
        if self.found {
            return;
        }

        if let Expr::Ident(obj_ident) = utils::unwrap_expr(member.obj.as_ref()) {
            let is_local = self.local_names.contains(obj_ident.sym.as_ref());
            if !is_local {
                if let MemberProp::Ident(prop) = &member.prop {
                    if prop.sym.as_ref() == "value" {
                        self.found = true;
                        return;
                    }
                }
            }
        }

        member.visit_children_with(self);
    }

    fn visit_call_expr(&mut self, call: &CallExpr) {
        if self.found {
            return;
        }

        if let Callee::Expr(callee) = &call.callee {
            if let Expr::Member(member) = utils::unwrap_expr(callee.as_ref()) {
                if let Expr::Ident(obj_ident) = utils::unwrap_expr(member.obj.as_ref()) {
                    let is_local = self.local_names.contains(obj_ident.sym.as_ref());
                    if !is_local {
                        if let MemberProp::Ident(prop) = &member.prop {
                            if prop.sym.as_ref() == "get" && call.args.is_empty() {
                                self.found = true;
                                return;
                            }
                        }
                    }
                }
            }
        }

        call.visit_children_with(self);
    }
}

fn prefix_reads_external_reactive_values(
    prefix_stmts: &[Stmt],
    local_names: &std::collections::HashSet<String>,
) -> bool {
    if prefix_stmts.is_empty() {
        return false;
    }

    let mut collector = ExternalReactivePrefixCollector { local_names, found: false };
    for stmt in prefix_stmts {
        stmt.visit_with(&mut collector);
        if collector.found {
            return true;
        }
    }

    false
}

fn collect_inline_alias_exprs_from_prefix(
    prefix_stmts: &[Stmt],
) -> Option<std::collections::HashMap<String, Expr>> {
    let mut alias_exprs = std::collections::HashMap::new();

    for stmt in prefix_stmts {
        let Stmt::Decl(Decl::Var(var)) = stmt else {
            return None;
        };

        for decl in &var.decls {
            let Pat::Ident(binding) = &decl.name else {
                return None;
            };
            let init = decl.init.as_ref()?;
            let mut next_expr = utils::unwrap_expr(init.as_ref()).clone();
            rewrite_alias_exprs_in_expr(&mut next_expr, &alias_exprs);
            alias_exprs.insert(binding.id.sym.to_string(), next_expr);
        }
    }

    Some(alias_exprs)
}

fn is_native_single_root_jsx_element(el: &JSXElement) -> bool {
    match &el.opening.name {
        JSXElementName::Ident(id) => {
            id.sym.chars().next().map(|ch| ch.is_ascii_lowercase()).unwrap_or(false)
        }
        _ => false,
    }
}

fn collect_meaningful_fragment_children<'a>(
    children: &'a [JSXElementChild],
) -> Vec<&'a JSXElementChild> {
    let mut meaningful = Vec::new();
    for child in children {
        match child {
            JSXElementChild::JSXText(text) => {
                if !normalize_text(&text.value).trim().is_empty() {
                    meaningful.push(child);
                }
            }
            _ => meaningful.push(child),
        }
    }
    meaningful
}

fn is_single_root_native_fragment_children(children: &[JSXElementChild]) -> bool {
    let meaningful = collect_meaningful_fragment_children(children);
    if meaningful.len() != 1 {
        return false;
    }

    match meaningful[0] {
        JSXElementChild::JSXElement(el) => is_native_single_root_jsx_element(el),
        JSXElementChild::JSXFragment(inner) => {
            is_single_root_native_fragment_children(&inner.children)
        }
        _ => false,
    }
}

fn is_single_root_native_jsx_fragment(frag: &JSXFragment) -> bool {
    is_single_root_native_fragment_children(&frag.children)
}

fn extract_jsx_element_key_expr(jsx_el: &JSXElement) -> Option<Expr> {
    for attr in &jsx_el.opening.attrs {
        if let JSXAttrOrSpread::JSXAttr(attr) = attr {
            if let JSXAttrName::Ident(name) = &attr.name {
                if name.sym.as_ref() != "key" {
                    continue;
                }
                match &attr.value {
                    Some(JSXAttrValue::Str(s)) => {
                        return Some(Expr::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: s.value.clone(),
                            raw: None,
                        })));
                    }
                    Some(JSXAttrValue::JSXExprContainer(ec)) => {
                        if let JSXExpr::Expr(expr) = &ec.expr {
                            return Some(crate::utils::unwrap_expr(expr.as_ref()).clone());
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    None
}

fn extract_arrow_body_expr<'a>(body: &'a BlockStmtOrExpr) -> Option<&'a Expr> {
    match body {
        BlockStmtOrExpr::Expr(expr) => Some(crate::utils::unwrap_expr(expr.as_ref())),
        BlockStmtOrExpr::BlockStmt(block) => {
            for stmt in block.stmts.iter().rev() {
                if let Stmt::Return(ReturnStmt { arg: Some(expr), .. }) = stmt {
                    return Some(crate::utils::unwrap_expr(expr.as_ref()));
                }
            }
            None
        }
    }
}

fn extract_key_expr_from_root_attr_effect(stmts: &[Stmt], root_ident: &Ident) -> Option<Expr> {
    for stmt in stmts {
        let Stmt::Expr(expr_stmt) = stmt else {
            continue;
        };
        let Expr::Call(watch_call) = crate::utils::unwrap_expr(expr_stmt.expr.as_ref()) else {
            continue;
        };
        let Callee::Expr(watch_callee) = &watch_call.callee else {
            continue;
        };
        let Expr::Ident(watch_ident) = watch_callee.as_ref() else {
            continue;
        };
        if watch_ident.sym.as_ref() != "watchEffect" || watch_call.args.is_empty() {
            continue;
        }
        let watch_body = match crate::utils::unwrap_expr(watch_call.args[0].expr.as_ref()) {
            Expr::Arrow(ArrowExpr { body, .. }) => body,
            _ => continue,
        };
        let BlockStmtOrExpr::BlockStmt(watch_block) = watch_body.as_ref() else {
            continue;
        };
        for watch_stmt in &watch_block.stmts {
            let Stmt::Expr(watch_expr_stmt) = watch_stmt else {
                continue;
            };
            let Expr::Call(set_attr_call) =
                crate::utils::unwrap_expr(watch_expr_stmt.expr.as_ref())
            else {
                continue;
            };
            let Callee::Expr(set_attr_callee) = &set_attr_call.callee else {
                continue;
            };
            let Expr::Ident(set_attr_ident) = set_attr_callee.as_ref() else {
                continue;
            };
            if set_attr_ident.sym.as_ref() != "_$setAttribute" || set_attr_call.args.len() < 3 {
                continue;
            }
            let target_expr = crate::utils::unwrap_expr(set_attr_call.args[0].expr.as_ref());
            let Expr::Ident(target_ident) = target_expr else {
                continue;
            };
            if target_ident.to_id() != root_ident.to_id() {
                continue;
            }
            let key_name_expr = crate::utils::unwrap_expr(set_attr_call.args[1].expr.as_ref());
            let Expr::Lit(Lit::Str(key_name)) = key_name_expr else {
                continue;
            };
            if key_name.value != *"key" {
                continue;
            }
            let raw_value_expr = crate::utils::unwrap_expr(set_attr_call.args[2].expr.as_ref());
            if let Expr::Call(string_call) = raw_value_expr {
                let Callee::Expr(string_callee) = &string_call.callee else {
                    continue;
                };
                let Expr::Ident(string_ident) = string_callee.as_ref() else {
                    continue;
                };
                if string_ident.sym.as_ref() == "String" && string_call.args.len() == 1 {
                    return Some(
                        crate::utils::unwrap_expr(string_call.args[0].expr.as_ref()).clone(),
                    );
                }
            }
            return Some(raw_value_expr.clone());
        }
    }
    None
}

fn extract_returned_root_key_expr_from_block(stmts: &[Stmt]) -> Option<Expr> {
    for stmt in stmts.iter().rev() {
        let Stmt::Return(ReturnStmt { arg: Some(expr), .. }) = stmt else {
            continue;
        };
        let Expr::Ident(root_ident) = crate::utils::unwrap_expr(expr.as_ref()) else {
            continue;
        };
        return extract_key_expr_from_root_attr_effect(stmts, root_ident);
    }
    None
}

fn call_callee_ident_name(call: &CallExpr) -> Option<&str> {
    let Callee::Expr(callee) = &call.callee else {
        return None;
    };
    let Expr::Ident(ident) = crate::utils::unwrap_expr(callee.as_ref()) else {
        return None;
    };
    Some(ident.sym.as_ref())
}

fn extract_render_root_key_expr(expr: &Expr) -> Option<Expr> {
    match crate::utils::unwrap_expr(expr) {
        Expr::JSXElement(jsx_el) => extract_jsx_element_key_expr(jsx_el),
        Expr::Cond(CondExpr { cons, alt, .. }) => extract_render_root_key_expr(cons.as_ref())
            .or_else(|| extract_render_root_key_expr(alt.as_ref())),
        Expr::Bin(BinExpr { op: BinaryOp::LogicalAnd, right, .. })
        | Expr::Bin(BinExpr { op: BinaryOp::LogicalOr, right, .. }) => {
            extract_render_root_key_expr(right.as_ref())
        }
        Expr::Call(call) => match call_callee_ident_name(call) {
            Some("_$vaporWithKey") if call.args.len() >= 2 => {
                Some(crate::utils::unwrap_expr(call.args[1].expr.as_ref()).clone())
            }
            Some("vapor") | Some("useMemo") => {
                let first = call.args.first()?;
                let Expr::Arrow(arrow) = crate::utils::unwrap_expr(first.expr.as_ref()) else {
                    return None;
                };
                if let Some(body_expr) = extract_arrow_body_expr(&arrow.body) {
                    if let Some(key_expr) = extract_render_root_key_expr(body_expr) {
                        return Some(key_expr);
                    }
                }
                if let BlockStmtOrExpr::BlockStmt(block) = arrow.body.as_ref() {
                    return extract_returned_root_key_expr_from_block(&block.stmts);
                }
                None
            }
            Some("_$vaporWithHookId") => {
                let runner = call.args.get(1)?;
                let Expr::Arrow(arrow) = crate::utils::unwrap_expr(runner.expr.as_ref()) else {
                    return None;
                };
                if let Some(body_expr) = extract_arrow_body_expr(&arrow.body) {
                    if let Some(key_expr) = extract_render_root_key_expr(body_expr) {
                        return Some(key_expr);
                    }
                }
                if let BlockStmtOrExpr::BlockStmt(block) = arrow.body.as_ref() {
                    return extract_returned_root_key_expr_from_block(&block.stmts);
                }
                None
            }
            _ => None,
        },
        _ => None,
    }
}

/*
列表渲染（Array.map(JSX)）设计：
- 采用“键控片段复用”策略：持久化 `Map<key, { start,end }>`，在更新时重用已存在的 DOM 片段，减少重建与移动。
- 通过注释锚点 `rue:list:start/end` 标记插入边界，`renderBetween` 在边界间渲染每项的片段。
- `_$vaporKeyedList` 负责对比新旧集合并执行插入/移动/卸载；本模块生成其所需的回调与参数对象。
- 参数解构保护：若 `map` 参数使用解构且使用了解构出的 key，需要在 `getKey`/`renderItem` 中显式对 `item` 解构，以保证作用域正确。
*/
// 抽取 Array.map(JSX) 列表渲染逻辑
// 转换目标：将 `arr.map((item, idx) => <li key={...}>...</li>)` 按 Vapor 的“键控片段复用”策略生成：
// - 在父元素下插入 `rue:list:start` / `rue:list:end` 注释作为渲染锚点
// - 声明持久 `Map` 保存 key 到片段之间的映射，跨次渲染复用已有 DOM
// - 在 `watchEffect` 中调用 `_$vaporKeyedList({ items, getKey, elements, parent, before, start, renderItem })`
// - `getKey(item, idx)`：优先使用 JSX 上的 `key` 表达式；否则回退到索引
// - `renderItem(item, parent, start, end, idx)`：默认以 `renderBetween(vapor(()=>{...}), parent, start, end)` 渲染每个项
// - 若开启 `optimize_component_anchors` 且列表项为单根原生元素，则改为 `renderAnchor(vapor(()=>{...}), parent, start)`
// 关键点：当 map 参数使用解构（如 `({ sha })`）且 `key={sha}`，需在 `getKey` 中先对 `item` 进行一次解构，
// 以确保 `sha` 作用域正确（参考 `tests/spec14.rs`）。
pub(crate) fn try_build_list_from_map(
    vt: &mut VaporTransform,
    el_ident: &Ident,
    call: &CallExpr,
    stmts: &mut Vec<Stmt>,
) -> bool {
    // 将 `arr.map((item, idx) => <li key={...}>{...}</li>)` 转为：
    // - 在父元素下插入列表 start/end 注释
    // - 使用持久化 `Map` 实现 key => item 片段 的复用
    // - 在 `watchEffect` 中调用 `_$vaporKeyedList({ items, getKey, elements, parent, before, start, renderItem })`
    // - `renderItem` 默认通过 `renderBetween(vapor(()=>{ ... }), parent, start, end)` 渲染每个项
    // - 若项为单根原生元素且开启单锚点优化，则改为 `renderAnchor(vapor(()=>{ ... }), parent, start)`
    // 参考测试：`tests/lists_and_keys.rs`、`tests/spec14.rs`
    // 仅处理 obj.map(cb) 且仅一个参数的情形
    if let Callee::Expr(expr_callee) = &call.callee {
        if let Expr::Member(MemberExpr { obj, prop: MemberProp::Ident(prop_ident), .. }) =
            &**expr_callee
        {
            if prop_ident.sym == *"map" && call.args.len() == 1 {
                log::debug("list: detected Array.map -> keyed list");
                // 占位标记
                let start = vt.next_list_ident();
                let end = vt.next_list_ident();
                // 生成列表渲染锚点：后续 renderBetween 仅在两注释之间进行插入/移动
                // 注释锚点创建细节：
                // - callee：标识符 `_$createComment`
                // - args：标记字符串（start/end）
                // - ctxt：统一 `SyntaxContext::empty()`，由 emit::call_ident 设置
                let make_start = call_ident("_$createComment", vec![string_expr("rue:list:start")]);
                let make_end = call_ident("_$createComment", vec![string_expr("rue:list:end")]);
                stmts.push(const_decl(start.clone(), make_start));
                stmts.push(const_decl(end.clone(), make_end));
                stmts.push(append_child(el_ident.clone(), Expr::Ident(start.clone())));
                stmts.push(append_child(el_ident.clone(), Expr::Ident(end.clone())));

                // 提取 map 回调与数组对象
                let cb = &call.args[0];
                let cb_expr = utils::unwrap_expr(&cb.expr);
                let arr_expr = utils::unwrap_expr(obj).clone();

                // 使用 Map 键控闭包实现列表渲染与复用
                // 先声明持久 Map：let _mapX_elements = new Map();
                let map_base = vt.next_map_base();
                let elements_ident = ident(&format!("{}{}", map_base, "_elements"));
                // 持久化 Map，实现跨次渲染的片段复用（key -> {start,end,stop}）
                let new_map_expr = Expr::New(NewExpr {
                    span: DUMMY_SP,
                    callee: Box::new(Expr::Ident(ident("Map"))),
                    args: None,
                    type_args: None,
                    ctxt: SyntaxContext::empty(),
                });
                let elements_decl = Stmt::Decl(Decl::Var(Box::new(VarDecl {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    kind: VarDeclKind::Let,
                    declare: false,
                    decls: vec![VarDeclarator {
                        span: DUMMY_SP,
                        name: Pat::Ident(BindingIdent {
                            id: elements_ident.clone(),
                            type_ann: None,
                        }),
                        init: Some(Box::new(new_map_expr)),
                        definite: false,
                    }],
                })));
                stmts.push(elements_decl);
                log::debug("list: emitted anchors and elements Map");

                // 构造 watchEffect 箭头函数体
                let map_current = ident(&format!("{}{}", map_base, "_current"));
                let or_arr = Expr::Bin(BinExpr {
                    span: DUMMY_SP,
                    op: BinaryOp::LogicalOr,
                    left: Box::new(arr_expr.clone()),
                    right: Box::new(Expr::Array(ArrayLit { span: DUMMY_SP, elems: vec![] })),
                });
                let decl_current = const_decl(map_current.clone(), or_arr);

                let map_new = ident(&format!("{}{}", map_base, "_newElements"));

                let mut body_stmts: Vec<Stmt> = vec![decl_current.clone()];

                // 构造 for 循环：for (let idx = 0; idx < _map_current.length; idx++) { const item = _map_current[idx]; ... }
                let mut idx_ident = ident("idx");
                let mut item_ident = ident("item");
                let mut item_param_pattern: Option<Pat> = None;
                let mut parent_param_ident = ident("parent");
                let mut start_param_ident = ident("start");
                let mut end_param_ident = ident("end");
                let mut item_alias_exprs = std::collections::HashMap::new();
                if let Expr::Arrow(ArrowExpr { params, body, .. }) = cb_expr {
                    if !params.is_empty() {
                        match &params[0] {
                            Pat::Ident(bi) => {
                                item_ident = bi.id.clone();
                            }
                            Pat::Object(_) | Pat::Array(_) => {
                                item_param_pattern = Some(params[0].clone());
                            }
                            _ => {}
                        }
                    }
                    if params.len() >= 2 {
                        if let Pat::Ident(bi) = &params[1] {
                            idx_ident = bi.id.clone();
                        }
                    }
                    if let Some(pat) = &item_param_pattern {
                        let mut pattern_bound_idents = std::collections::HashSet::new();
                        collect_declared_idents_from_pat(pat, &mut pattern_bound_idents);

                        let mut internal_param_names = pattern_bound_idents.clone();
                        item_ident = fresh_ident_avoiding("item", &internal_param_names);
                        internal_param_names.insert(item_ident.sym.to_string());

                        if params.len() < 2 {
                            idx_ident = fresh_ident_avoiding("idx", &internal_param_names);
                        }
                        internal_param_names.insert(idx_ident.sym.to_string());

                        parent_param_ident = fresh_ident_avoiding("parent", &internal_param_names);
                        internal_param_names.insert(parent_param_ident.sym.to_string());

                        start_param_ident = fresh_ident_avoiding("start", &internal_param_names);
                        internal_param_names.insert(start_param_ident.sym.to_string());

                        end_param_ident = fresh_ident_avoiding("end", &internal_param_names);

                        collect_alias_exprs_from_pat(
                            pat,
                            Expr::Ident(item_ident.clone()),
                            &mut item_alias_exprs,
                        );
                    }
                    // 提取 JSX 根 key 表达式（若无则使用 idx）
                    let mut item_key_expr: Expr = Expr::Ident(idx_ident.clone());
                    let extract_generated_key_expr_from_stmts =
                        |stmts: &[Stmt], root_ident: &Ident| -> Option<Expr> {
                            for stmt in stmts {
                                let Stmt::Expr(expr_stmt) = stmt else {
                                    continue;
                                };
                                let Expr::Call(watch_call) =
                                    utils::unwrap_expr(expr_stmt.expr.as_ref())
                                else {
                                    continue;
                                };
                                let Callee::Expr(watch_callee) = &watch_call.callee else {
                                    continue;
                                };
                                let Expr::Ident(watch_ident) = watch_callee.as_ref() else {
                                    continue;
                                };
                                if watch_ident.sym.as_ref() != "watchEffect"
                                    || watch_call.args.is_empty()
                                {
                                    continue;
                                }
                                let watch_body =
                                    match utils::unwrap_expr(watch_call.args[0].expr.as_ref()) {
                                        Expr::Arrow(ArrowExpr { body, .. }) => body,
                                        _ => continue,
                                    };
                                let BlockStmtOrExpr::BlockStmt(watch_block) = watch_body.as_ref()
                                else {
                                    continue;
                                };
                                for watch_stmt in &watch_block.stmts {
                                    let Stmt::Expr(watch_expr_stmt) = watch_stmt else {
                                        continue;
                                    };
                                    let Expr::Call(set_attr_call) =
                                        utils::unwrap_expr(watch_expr_stmt.expr.as_ref())
                                    else {
                                        continue;
                                    };
                                    let Callee::Expr(set_attr_callee) = &set_attr_call.callee
                                    else {
                                        continue;
                                    };
                                    let Expr::Ident(set_attr_ident) = set_attr_callee.as_ref()
                                    else {
                                        continue;
                                    };
                                    if set_attr_ident.sym.as_ref() != "_$setAttribute"
                                        || set_attr_call.args.len() < 3
                                    {
                                        continue;
                                    }
                                    let target_expr =
                                        utils::unwrap_expr(set_attr_call.args[0].expr.as_ref());
                                    let Expr::Ident(target_ident) = target_expr else {
                                        continue;
                                    };
                                    if target_ident.to_id() != root_ident.to_id() {
                                        continue;
                                    }
                                    let key_name_expr =
                                        utils::unwrap_expr(set_attr_call.args[1].expr.as_ref());
                                    let Expr::Lit(Lit::Str(key_name)) = key_name_expr else {
                                        continue;
                                    };
                                    if key_name.value != *"key" {
                                        continue;
                                    }
                                    let raw_value_expr =
                                        utils::unwrap_expr(set_attr_call.args[2].expr.as_ref());
                                    if let Expr::Call(string_call) = raw_value_expr {
                                        let Callee::Expr(string_callee) = &string_call.callee
                                        else {
                                            continue;
                                        };
                                        let Expr::Ident(string_ident) = string_callee.as_ref()
                                        else {
                                            continue;
                                        };
                                        if string_ident.sym.as_ref() == "String"
                                            && string_call.args.len() == 1
                                        {
                                            return Some(
                                                utils::unwrap_expr(
                                                    string_call.args[0].expr.as_ref(),
                                                )
                                                .clone(),
                                            );
                                        }
                                    }
                                    return Some(raw_value_expr.clone());
                                }
                            }
                            None
                        };
                    let simple_block_render = match &**body {
                        // 只有“纯声明前缀 + 最后 return”的简单 block，
                        // 才允许走 direct vapor 快路径。
                        // 一旦不是这种形态，就交给后面的 fallback 路径保留原控制流。
                        BlockStmtOrExpr::BlockStmt(block) => {
                            collect_decl_prefix_and_final_return(block)
                        }
                        BlockStmtOrExpr::Expr(_) => None,
                    };

                    if let Some((_, ret_expr)) = simple_block_render.as_ref() {
                        if let Some(key_expr) = extract_render_root_key_expr(ret_expr) {
                            item_key_expr = key_expr;
                        }
                    } else {
                        match &**body {
                            BlockStmtOrExpr::BlockStmt(block) => {
                                // 这里不再只看“最后一个 return”，而是先把 block 内所有 return expr 都扫出来。
                                // 原因是 key 可能出现在 if / else 的任意分支里；
                                // 如果只抽最后一个 return，会漏掉前面分支上的 JSX key。
                                let mut return_exprs = Vec::new();
                                collect_return_exprs_in_block(block, &mut return_exprs);
                                for expr in &return_exprs {
                                    if let Some(key_expr) = extract_render_root_key_expr(expr) {
                                        item_key_expr = key_expr;
                                    }
                                }
                            }
                            BlockStmtOrExpr::Expr(expr_ret) => {
                                if let Some(key_expr) =
                                    extract_render_root_key_expr(expr_ret.as_ref())
                                {
                                    item_key_expr = key_expr;
                                }
                            }
                        }
                    }

                    let direct_render_expr = match &**body {
                        BlockStmtOrExpr::Expr(ret_expr) => {
                            Some(utils::unwrap_expr(ret_expr.as_ref()).clone())
                        }
                        BlockStmtOrExpr::BlockStmt(_block) => {
                            simple_block_render.as_ref().map(|(_, ret_expr)| ret_expr.clone())
                        }
                    };

                    let direct_render_expr = direct_render_expr.map(|mut expr| {
                        rewrite_alias_exprs_in_expr(&mut expr, &item_alias_exprs);
                        expr
                    });

                    if let Some(ret_expr) = direct_render_expr.as_ref() {
                        if let Some(key_expr) = extract_render_root_key_expr(ret_expr) {
                            item_key_expr = key_expr;
                        }
                    }

                    let callback_prefix_stmts = simple_block_render
                        .as_ref()
                        .map(|(prefix, _)| prefix.clone())
                        .unwrap_or_default();

                    let mut rewritten_callback_prefix_stmts = callback_prefix_stmts.clone();
                    for stmt in &mut rewritten_callback_prefix_stmts {
                        rewrite_alias_exprs_in_stmt(stmt, &item_alias_exprs);
                    }

                    let mut render_prefix_local_names =
                        collect_declared_idents_in_stmts(&rewritten_callback_prefix_stmts);
                    render_prefix_local_names.insert(item_ident.sym.to_string());
                    render_prefix_local_names.insert(idx_ident.sym.to_string());
                    let prefix_has_external_reactive_reads = prefix_reads_external_reactive_values(
                        &rewritten_callback_prefix_stmts,
                        &render_prefix_local_names,
                    );
                    let reactive_prefix_inline_alias_exprs = if prefix_has_external_reactive_reads {
                        collect_inline_alias_exprs_from_prefix(&rewritten_callback_prefix_stmts)
                    } else {
                        None
                    };
                    let render_item_prefix_stmts = if prefix_has_external_reactive_reads
                        && reactive_prefix_inline_alias_exprs.is_some()
                    {
                        Vec::new()
                    } else {
                        rewritten_callback_prefix_stmts.clone()
                    };
                    let render_item_direct_expr = if prefix_has_external_reactive_reads {
                        reactive_prefix_inline_alias_exprs.as_ref().and_then(|alias_exprs| {
                            direct_render_expr.as_ref().map(|expr| {
                                let mut next = expr.clone();
                                rewrite_alias_exprs_in_expr(&mut next, alias_exprs);
                                next
                            })
                        })
                    } else {
                        direct_render_expr.clone()
                    };

                    let mut use_single_root_anchor = false;

                    // renderItem(item, start, end)
                    // `_$vaporKeyedList` 的 `renderItem` 约定参数：
                    // - `item`：当前项
                    // - `parent`：父元素（插入点所在）
                    // - `start`/`end`：锚点注释，用于片段插入边界
                    // - `idx`：当前索引
                    // 渲染策略：使用 `renderBetween(vapor(()=>{ ... }), parent, start, end)`
                    let mut render_item_stmts: Vec<Stmt> = Vec::new();
                    if let Some(inner_ret) = render_item_direct_expr.as_ref() {
                        if let Expr::JSXElement(jsx_el) = inner_ret {
                            if let Some(key_expr) = extract_jsx_element_key_expr(jsx_el) {
                                item_key_expr = key_expr;
                            }
                            let builtin_fragment_single_root =
                                crate::utils::is_builtin_fragment_element(jsx_el)
                                    && is_single_root_native_fragment_children(&jsx_el.children);
                            if crate::utils::is_component(&jsx_el.opening.name) {
                                let mut component_el = (**jsx_el).clone();
                                let rewrite =
                                    crate::element_component::rewrite_component_children_to_props(
                                        vt,
                                        &mut component_el,
                                    );
                                let slot_expr =
                                    rewrite.direct_render_expr.clone().unwrap_or_else(|| {
                                        crate::element_component::build_component_mount_expr(
                                            &component_el,
                                        )
                                    });
                                render_item_stmts.extend(render_item_prefix_stmts.iter().cloned());
                                render_item_stmts.extend(rewrite.stmts);
                                if builtin_fragment_single_root {
                                    use_single_root_anchor = true;
                                }
                                let render_item_call = if builtin_fragment_single_root {
                                    Expr::Call(CallExpr {
                                        span: DUMMY_SP,
                                        callee: Callee::Expr(Box::new(Expr::Ident(ident(
                                            "renderAnchor",
                                        )))),
                                        args: vec![
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(ident("__slot"))),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    parent_param_ident.clone(),
                                                )),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    start_param_ident.clone(),
                                                )),
                                            },
                                        ],
                                        type_args: None,
                                        ctxt: SyntaxContext::empty(),
                                    })
                                } else {
                                    Expr::Call(CallExpr {
                                        span: DUMMY_SP,
                                        callee: Callee::Expr(Box::new(Expr::Ident(ident(
                                            "renderBetween",
                                        )))),
                                        args: vec![
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(ident("__slot"))),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    parent_param_ident.clone(),
                                                )),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    start_param_ident.clone(),
                                                )),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    end_param_ident.clone(),
                                                )),
                                            },
                                        ],
                                        type_args: None,
                                        ctxt: SyntaxContext::empty(),
                                    })
                                };
                                render_item_stmts.push(const_decl(ident("__slot"), slot_expr));
                                render_item_stmts.push(Stmt::Expr(ExprStmt {
                                    span: DUMMY_SP,
                                    expr: Box::new(render_item_call),
                                }));
                            } else {
                                // direct vapor 快路径：
                                // 只适用于表达式体，或“纯声明前缀 + 最后 return”的简单 block。
                                // 这种情况下可以把前缀声明搬进 vapor setup，
                                // 然后像普通 JSX 一样生成 DocumentFragment。
                                let child_root = ident("_root");
                                let mut child_body: Vec<Stmt> = vec![const_decl(
                                    child_root.clone(),
                                    call_ident("_$createDocumentFragment", vec![]),
                                )];
                                child_body.extend(render_item_prefix_stmts.iter().cloned());
                                if is_native_single_root_jsx_element(jsx_el) {
                                    use_single_root_anchor = true;
                                }
                                build_element(vt, jsx_el, &child_root.clone(), &mut child_body);
                                if let Some(key_expr) =
                                    extract_generated_key_expr_from_stmts(&child_body, &child_root)
                                {
                                    item_key_expr = key_expr;
                                }
                                child_body.push(return_root(child_root.clone()));
                                let arrow_setup = Expr::Arrow(ArrowExpr {
                                    span: DUMMY_SP,
                                    params: vec![],
                                    body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
                                        span: DUMMY_SP,
                                        ctxt: SyntaxContext::empty(),
                                        stmts: child_body,
                                    })),
                                    is_async: false,
                                    is_generator: false,
                                    type_params: None,
                                    return_type: None,
                                    ctxt: SyntaxContext::empty(),
                                });
                                let child_vapor_expr = call_ident("vapor", vec![arrow_setup]);
                                let render_item_call = if use_single_root_anchor {
                                    Expr::Call(CallExpr {
                                        span: DUMMY_SP,
                                        callee: Callee::Expr(Box::new(Expr::Ident(ident(
                                            "renderAnchor",
                                        )))),
                                        args: vec![
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(ident("__slot"))),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    parent_param_ident.clone(),
                                                )),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    start_param_ident.clone(),
                                                )),
                                            },
                                        ],
                                        type_args: None,
                                        ctxt: SyntaxContext::empty(),
                                    })
                                } else {
                                    Expr::Call(CallExpr {
                                        span: DUMMY_SP,
                                        callee: Callee::Expr(Box::new(Expr::Ident(ident(
                                            "renderBetween",
                                        )))),
                                        args: vec![
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(ident("__slot"))),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    parent_param_ident.clone(),
                                                )),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    start_param_ident.clone(),
                                                )),
                                            },
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(Expr::Ident(
                                                    end_param_ident.clone(),
                                                )),
                                            },
                                        ],
                                        type_args: None,
                                        ctxt: SyntaxContext::empty(),
                                    })
                                };
                                render_item_stmts
                                    .push(const_decl(ident("__slot"), child_vapor_expr));
                                render_item_stmts.push(Stmt::Expr(ExprStmt {
                                    span: DUMMY_SP,
                                    expr: Box::new(render_item_call),
                                }));
                            }
                        } else if let Expr::JSXFragment(frag) = inner_ret {
                            // direct vapor 快路径：
                            // 只适用于表达式体，或“纯声明前缀 + 最后 return”的简单 block。
                            // 这种情况下可以把前缀声明搬进 vapor setup，
                            // 然后像普通 JSX 一样生成 DocumentFragment。
                            let child_root = ident("_root");
                            let mut child_body: Vec<Stmt> = vec![const_decl(
                                child_root.clone(),
                                call_ident("_$createDocumentFragment", vec![]),
                            )];
                            if let Some(pat) = &item_param_pattern {
                                let destruct_decl = Stmt::Decl(Decl::Var(Box::new(VarDecl {
                                    span: DUMMY_SP,
                                    ctxt: SyntaxContext::empty(),
                                    kind: VarDeclKind::Const,
                                    declare: false,
                                    decls: vec![VarDeclarator {
                                        span: DUMMY_SP,
                                        name: pat.clone(),
                                        init: Some(Box::new(Expr::Ident(item_ident.clone()))),
                                        definite: false,
                                    }],
                                })));
                                child_body.push(destruct_decl);
                            }
                            child_body.extend(render_item_prefix_stmts.iter().cloned());
                            if is_single_root_native_jsx_fragment(frag) {
                                use_single_root_anchor = true;
                            }
                            crate::element_fragment::emit_fragment_children(
                                vt,
                                &child_root.clone(),
                                &frag.children,
                                &mut child_body,
                            );
                            child_body.push(return_root(child_root.clone()));
                            let arrow_setup = Expr::Arrow(ArrowExpr {
                                span: DUMMY_SP,
                                params: vec![],
                                body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
                                    span: DUMMY_SP,
                                    ctxt: SyntaxContext::empty(),
                                    stmts: child_body,
                                })),
                                is_async: false,
                                is_generator: false,
                                type_params: None,
                                return_type: None,
                                ctxt: SyntaxContext::empty(),
                            });
                            let child_vapor_expr = call_ident("vapor", vec![arrow_setup]);
                            let render_item_call = if use_single_root_anchor {
                                Expr::Call(CallExpr {
                                    span: DUMMY_SP,
                                    callee: Callee::Expr(Box::new(Expr::Ident(ident(
                                        "renderAnchor",
                                    )))),
                                    args: vec![
                                        ExprOrSpread {
                                            spread: None,
                                            expr: Box::new(Expr::Ident(ident("__slot"))),
                                        },
                                        ExprOrSpread {
                                            spread: None,
                                            expr: Box::new(Expr::Ident(parent_param_ident.clone())),
                                        },
                                        ExprOrSpread {
                                            spread: None,
                                            expr: Box::new(Expr::Ident(start_param_ident.clone())),
                                        },
                                    ],
                                    type_args: None,
                                    ctxt: SyntaxContext::empty(),
                                })
                            } else {
                                Expr::Call(CallExpr {
                                    span: DUMMY_SP,
                                    callee: Callee::Expr(Box::new(Expr::Ident(ident(
                                        "renderBetween",
                                    )))),
                                    args: vec![
                                        ExprOrSpread {
                                            spread: None,
                                            expr: Box::new(Expr::Ident(ident("__slot"))),
                                        },
                                        ExprOrSpread {
                                            spread: None,
                                            expr: Box::new(Expr::Ident(parent_param_ident.clone())),
                                        },
                                        ExprOrSpread {
                                            spread: None,
                                            expr: Box::new(Expr::Ident(start_param_ident.clone())),
                                        },
                                        ExprOrSpread {
                                            spread: None,
                                            expr: Box::new(Expr::Ident(end_param_ident.clone())),
                                        },
                                    ],
                                    type_args: None,
                                    ctxt: SyntaxContext::empty(),
                                })
                            };
                            render_item_stmts.push(const_decl(ident("__slot"), child_vapor_expr));
                            render_item_stmts.push(Stmt::Expr(ExprStmt {
                                span: DUMMY_SP,
                                expr: Box::new(render_item_call),
                            }));
                        } else if crate::element_expr::contains_jsx_in_expr(inner_ret) {
                            let slot_expr = crate::element_expr::make_expr_for_slot(vt, inner_ret);
                            let render_item_call = Expr::Call(CallExpr {
                                span: DUMMY_SP,
                                callee: Callee::Expr(Box::new(Expr::Ident(ident("renderBetween")))),
                                args: vec![
                                    ExprOrSpread {
                                        spread: None,
                                        expr: Box::new(Expr::Ident(ident("__slot"))),
                                    },
                                    ExprOrSpread {
                                        spread: None,
                                        expr: Box::new(Expr::Ident(parent_param_ident.clone())),
                                    },
                                    ExprOrSpread {
                                        spread: None,
                                        expr: Box::new(Expr::Ident(start_param_ident.clone())),
                                    },
                                    ExprOrSpread {
                                        spread: None,
                                        expr: Box::new(Expr::Ident(end_param_ident.clone())),
                                    },
                                ],
                                type_args: None,
                                ctxt: SyntaxContext::empty(),
                            });
                            render_item_stmts.extend(render_item_prefix_stmts.iter().cloned());
                            render_item_stmts.push(const_decl(ident("__slot"), slot_expr));
                            render_item_stmts.push(Stmt::Expr(ExprStmt {
                                span: DUMMY_SP,
                                expr: Box::new(render_item_call),
                            }));
                        } else {
                            let slot_expr = crate::element_expr::make_expr_for_slot(vt, inner_ret);
                            let render_item_call = Expr::Call(CallExpr {
                                span: DUMMY_SP,
                                callee: Callee::Expr(Box::new(Expr::Ident(ident("renderBetween")))),
                                args: vec![
                                    ExprOrSpread {
                                        spread: None,
                                        expr: Box::new(Expr::Ident(ident("__slot"))),
                                    },
                                    ExprOrSpread {
                                        spread: None,
                                        expr: Box::new(Expr::Ident(parent_param_ident.clone())),
                                    },
                                    ExprOrSpread {
                                        spread: None,
                                        expr: Box::new(Expr::Ident(start_param_ident.clone())),
                                    },
                                    ExprOrSpread {
                                        spread: None,
                                        expr: Box::new(Expr::Ident(end_param_ident.clone())),
                                    },
                                ],
                                type_args: None,
                                ctxt: SyntaxContext::empty(),
                            });
                            render_item_stmts.extend(render_item_prefix_stmts.iter().cloned());
                            render_item_stmts.push(const_decl(ident("__slot"), slot_expr));
                            render_item_stmts.push(Stmt::Expr(ExprStmt {
                                span: DUMMY_SP,
                                expr: Box::new(render_item_call),
                            }));
                        }
                    } else {
                        // fallback 路径：
                        // 说明当前 block body 已经不是“声明前缀 + 最后 return”的简单形态，
                        // 典型场景是 if/else 多分支 return、try/switch 等复杂控制流。
                        //
                        // 这里不再试图把 block 拆碎重组，而是保留原 block 结构，
                        // 在 renderItem 内执行一个立即调用函数拿到 __slot，
                        // 再把原始值直接交给 runtime 的 Renderable/compat 边界。
                        //
                        // 这样做的好处是：
                        // 1. 条件 return 的原始语义不会被破坏；
                        // 2. 不需要继续扩张“前缀语句搬运”的规则；
                        // 3. 列表主路径不再额外依赖旧的中间对象 helper 生成包装值。
                        let mut slot_block_stmts: Vec<Stmt> = Vec::new();
                        if let BlockStmtOrExpr::BlockStmt(block) = &**body {
                            slot_block_stmts.extend(block.stmts.iter().cloned());
                            for stmt in &mut slot_block_stmts {
                                rewrite_alias_exprs_in_stmt(stmt, &item_alias_exprs);
                            }
                        }
                        let slot_arrow = Expr::Arrow(ArrowExpr {
                            span: DUMMY_SP,
                            params: vec![],
                            body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
                                span: DUMMY_SP,
                                ctxt: SyntaxContext::empty(),
                                stmts: slot_block_stmts,
                            })),
                            is_async: false,
                            is_generator: false,
                            type_params: None,
                            return_type: None,
                            ctxt: SyntaxContext::empty(),
                        });
                        let slot_expr = Expr::Call(CallExpr {
                            span: DUMMY_SP,
                            callee: Callee::Expr(Box::new(Expr::Paren(ParenExpr {
                                span: DUMMY_SP,
                                expr: Box::new(slot_arrow),
                            }))),
                            args: vec![],
                            type_args: None,
                            ctxt: SyntaxContext::empty(),
                        });
                        let render_item_call = Expr::Call(CallExpr {
                            span: DUMMY_SP,
                            callee: Callee::Expr(Box::new(Expr::Ident(ident("renderBetween")))),
                            args: vec![
                                ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Ident(ident("__slot"))),
                                },
                                ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Ident(parent_param_ident.clone())),
                                },
                                ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Ident(start_param_ident.clone())),
                                },
                                ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Ident(end_param_ident.clone())),
                                },
                            ],
                            type_args: None,
                            ctxt: SyntaxContext::empty(),
                        });
                        render_item_stmts.push(const_decl(ident("__slot"), slot_expr));
                        render_item_stmts.push(Stmt::Expr(ExprStmt {
                            span: DUMMY_SP,
                            expr: Box::new(render_item_call),
                        }));
                    }
                    let render_item_arrow = Expr::Arrow(ArrowExpr {
                        span: DUMMY_SP,
                        params: vec![
                            Pat::Ident(BindingIdent { id: item_ident.clone(), type_ann: None }),
                            Pat::Ident(BindingIdent {
                                id: parent_param_ident.clone(),
                                type_ann: None,
                            }),
                            Pat::Ident(BindingIdent {
                                id: start_param_ident.clone(),
                                type_ann: None,
                            }),
                            Pat::Ident(BindingIdent {
                                id: end_param_ident.clone(),
                                type_ann: None,
                            }),
                            Pat::Ident(BindingIdent { id: idx_ident.clone(), type_ann: None }),
                        ],
                        body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
                            span: DUMMY_SP,
                            ctxt: SyntaxContext::empty(),
                            stmts: render_item_stmts,
                        })),
                        is_async: false,
                        is_generator: false,
                        type_params: None,
                        return_type: None,
                        ctxt: SyntaxContext::empty(),
                    });

                    // getKey 箭头函数
                    // 若 `map` 参数是对象/数组解构，这里不再手动插入
                    // `const { ... } = item; return <key-expr>;`。
                    // 这种“拆成声明 + 表达式”的重组方式，在后续打包重命名时
                    // 可能让 key 表达式里的别名引用和解构声明脱钩。
                    //
                    // 改为保留原始 pattern 作为一个立即调用的箭头函数参数：
                    // - `(__rue_item)=>(([item, index])=>item.id)(__rue_item)`
                    // 这样 key 表达式和解构绑定仍在同一棵 AST 子树里，
                    // 后续改名时不会再出现 `const [item1] = ...; return item.id` 这类悬空引用。
                    let mut rewritten_item_key_expr = item_key_expr.clone();
                    rewrite_alias_exprs_in_expr(&mut rewritten_item_key_expr, &item_alias_exprs);

                    let key_needs_prefix_scope = expr_uses_declared_prefix(
                        &rewritten_item_key_expr,
                        &rewritten_callback_prefix_stmts,
                    );
                    // 这里不再因为“callback 是 block body”就无脑生成块体 getKey。
                    // 现在只有两种情况才会包块：
                    // 1. 参数本身是解构，需要先把 item 解构出来；
                    // 2. key 确实依赖声明前缀里的局部变量。
                    //
                    // 这样可以把这次修复范围收窄到“作用域真正需要的部分”，
                    // 避免为了兼容 block body 而让所有 getKey 都发生额外 codegen 变化。
                    let get_key_body = if key_needs_prefix_scope {
                        let mut get_key_stmts: Vec<Stmt> = Vec::new();
                        get_key_stmts.extend(rewritten_callback_prefix_stmts.iter().cloned());
                        get_key_stmts.push(Stmt::Return(ReturnStmt {
                            span: DUMMY_SP,
                            arg: Some(Box::new(rewritten_item_key_expr.clone())),
                        }));
                        BlockStmtOrExpr::BlockStmt(BlockStmt {
                            span: DUMMY_SP,
                            ctxt: SyntaxContext::empty(),
                            stmts: get_key_stmts,
                        })
                    } else {
                        BlockStmtOrExpr::Expr(Box::new(rewritten_item_key_expr.clone()))
                    };
                    let get_key_arrow = Expr::Arrow(ArrowExpr {
                        span: DUMMY_SP,
                        params: vec![
                            Pat::Ident(BindingIdent { id: item_ident.clone(), type_ann: None }),
                            Pat::Ident(BindingIdent { id: idx_ident.clone(), type_ann: None }),
                        ],
                        body: Box::new(get_key_body),
                        is_async: false,
                        is_generator: false,
                        type_params: None,
                        return_type: None,
                        ctxt: SyntaxContext::empty(),
                    });

                    // _$vaporKeyedList({ items, getKey, elements, parent, before, start, renderItem })
                    let parent_expr = if el_ident.sym.as_ref() == "_root" {
                        // 对于块体根 _root，renderBetween 的 parent 取 start.parentNode；元素上下文直接用 el_ident
                        Expr::Member(MemberExpr {
                            span: DUMMY_SP,
                            obj: Box::new(Expr::Ident(start.clone())),
                            prop: MemberProp::Ident(ident_name("parentNode")),
                        })
                    } else {
                        Expr::Ident(el_ident.clone())
                    };
                    // 传入 keyedList 所需参数：items、key 计算、元素映射以及父/锚点位置
                    let mut keyed_list_props = vec![
                        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(ident_name("items")),
                            value: Box::new(Expr::Ident(map_current.clone())),
                        }))),
                        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(ident_name("getKey")),
                            value: Box::new(get_key_arrow),
                        }))),
                        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(ident_name("elements")),
                            value: Box::new(Expr::Ident(elements_ident.clone())),
                        }))),
                        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(ident_name("parent")),
                            value: Box::new(parent_expr),
                        }))),
                        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(ident_name("before")),
                            value: Box::new(Expr::Ident(end.clone())),
                        }))),
                    ];

                    if use_single_root_anchor {
                        keyed_list_props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(
                            KeyValueProp {
                                key: PropName::Ident(ident_name("singleRoot")),
                                value: Box::new(Expr::Lit(Lit::Bool(Bool {
                                    span: DUMMY_SP,
                                    value: true,
                                }))),
                            },
                        ))));
                    }

                    keyed_list_props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(
                        KeyValueProp {
                            key: PropName::Ident(ident_name("start")),
                            value: Box::new(Expr::Ident(start.clone())),
                        },
                    ))));
                    keyed_list_props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(
                        KeyValueProp {
                            key: PropName::Ident(ident_name("renderItem")),
                            value: Box::new(render_item_arrow),
                        },
                    ))));

                    let args_obj =
                        Expr::Object(ObjectLit { span: DUMMY_SP, props: keyed_list_props });
                    // _$vaporKeyedList 调用细节：
                    // - callee：标识符 `_$vaporKeyedList`
                    // - args：对象字面量，包含 `items/getKey/elements/parent/before/start/renderItem`
                    // - ctxt：统一 `SyntaxContext::empty()`
                    let decl_new =
                        const_decl(map_new.clone(), call_ident("_$vaporKeyedList", vec![args_obj]));
                    body_stmts.push(decl_new);
                    // elements = newElements
                    // 更新持久 Map 引用，保持下一轮复用
                    body_stmts.push(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(Expr::Assign(AssignExpr {
                            span: DUMMY_SP,
                            op: AssignOp::Assign,
                            left: AssignTarget::Simple(SimpleAssignTarget::Ident(
                                elements_ident.clone().into(),
                            )),
                            right: Box::new(Expr::Ident(map_new.clone())),
                        })),
                    }));
                }

                // watchEffect(() => { ... })
                let arrow = Expr::Arrow(ArrowExpr {
                    span: DUMMY_SP,
                    params: vec![],
                    body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
                        span: DUMMY_SP,
                        ctxt: SyntaxContext::empty(),
                        stmts: body_stmts,
                    })),
                    is_async: false,
                    is_generator: false,
                    type_params: None,
                    return_type: None,
                    ctxt: SyntaxContext::empty(),
                });
                // watch 调用细节：
                // - callee：标识符 `watchEffect`
                // - args：箭头函数体封装列表的 diff 与渲染逻辑
                // - ctxt：`SyntaxContext::empty()`
                let watch_call = call_ident("watchEffect", vec![arrow]);
                stmts.push(Stmt::Expr(ExprStmt { span: DUMMY_SP, expr: Box::new(watch_call) }));

                return true;
            }
        }
    }
    false
}
