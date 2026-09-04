use serde::Serialize;
use std::collections::HashSet;
use swc_core::common::Span;
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitWith};

pub(crate) const MARKER: &str = "__RUE_COMPILER_DIAGNOSTIC__";

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub(crate) struct CompileDiagnostic {
    pub category: &'static str,
    pub start: u32,
    pub end: u32,
    pub syntax: &'static str,
    pub suggestion: &'static str,
}

impl CompileDiagnostic {
    fn new(
        category: &'static str,
        span: Span,
        syntax: &'static str,
        suggestion: &'static str,
    ) -> Self {
        Self { category, start: span.lo.0, end: span.hi.0, syntax, suggestion }
    }
}

#[derive(Default)]
struct Collector {
    diagnostics: Vec<CompileDiagnostic>,
    hooks: HashSet<String>,
    jsx_depth: usize,
    control_depth: usize,
}

impl Collector {
    fn push(&mut self, diagnostic: CompileDiagnostic) {
        if !self
            .diagnostics
            .iter()
            .any(|item| item.category == diagnostic.category && item.start == diagnostic.start)
        {
            self.diagnostics.push(diagnostic);
        }
    }
}

impl Visit for Collector {
    fn visit_jsx_element(&mut self, element: &JSXElement) {
        self.jsx_depth += 1;
        element.visit_children_with(self);
        self.jsx_depth -= 1;
    }

    fn visit_jsx_expr_container(&mut self, container: &JSXExprContainer) {
        container.visit_children_with(self);
    }

    fn visit_call_expr(&mut self, call: &CallExpr) {
        if let Callee::Expr(callee) = &call.callee
            && let Expr::Ident(ident) = callee.as_ref()
            && self.hooks.contains(ident.sym.as_ref())
        {
            if self.control_depth > 0 {
                self.push(CompileDiagnostic::new(
                    "dynamic-hook",
                    call.span,
                    "conditionally executed hook",
                    "Move the hook to unconditional component setup so the compiler can assign a stable slot.",
                ));
            }
        }
        call.visit_children_with(self);
    }

    fn visit_if_stmt(&mut self, stmt: &IfStmt) {
        self.control_depth += 1;
        stmt.visit_children_with(self);
        self.control_depth -= 1;
    }

    fn visit_switch_stmt(&mut self, stmt: &SwitchStmt) {
        self.control_depth += 1;
        stmt.visit_children_with(self);
        self.control_depth -= 1;
    }

    fn visit_cond_expr(&mut self, expr: &CondExpr) {
        self.control_depth += 1;
        expr.visit_children_with(self);
        self.control_depth -= 1;
    }
}

fn is_vapor_hook(name: &str) -> bool {
    matches!(
        name,
        "useState"
            | "useSignal"
            | "useEffect"
            | "useMemo"
            | "useCallback"
            | "useSetup"
            | "useRef"
            | "watch"
            | "watchEffect"
            | "computed"
            | "ref"
            | "reactive"
    )
}

#[derive(Default)]
struct ImportedHookCollector {
    hooks: HashSet<String>,
}

impl Visit for ImportedHookCollector {
    fn visit_import_decl(&mut self, import: &ImportDecl) {
        for specifier in &import.specifiers {
            let ImportSpecifier::Named(named) = specifier else {
                continue;
            };
            let imported_name = match &named.imported {
                Some(ModuleExportName::Ident(ident)) => ident.sym.to_string(),
                Some(ModuleExportName::Str(value)) => value.value.to_string_lossy().into_owned(),
                None => named.local.sym.to_string(),
            };
            if is_vapor_hook(&imported_name) {
                self.hooks.insert(named.local.sym.to_string());
            }
        }
    }
}

struct WrapperHookCollector<'a> {
    known_hooks: &'a HashSet<String>,
    wrappers: HashSet<String>,
    candidate: Option<String>,
}

impl WrapperHookCollector<'_> {
    fn visit_candidate<N>(&mut self, name: &Ident, node: &N)
    where
        N: VisitWith<Self>,
    {
        let name = name.sym.to_string();
        if !is_hook_wrapper_name(&name) {
            return;
        }
        let previous = self.candidate.replace(name);
        node.visit_children_with(self);
        self.candidate = previous;
    }
}

impl Visit for WrapperHookCollector<'_> {
    fn visit_fn_decl(&mut self, declaration: &FnDecl) {
        self.visit_candidate(&declaration.ident, &declaration.function);
    }

    fn visit_var_declarator(&mut self, declaration: &VarDeclarator) {
        let Pat::Ident(binding) = &declaration.name else {
            declaration.visit_children_with(self);
            return;
        };
        let Some(initializer) = &declaration.init else {
            return;
        };
        if matches!(initializer.as_ref(), Expr::Arrow(_) | Expr::Fn(_)) {
            self.visit_candidate(&binding.id, initializer.as_ref());
        } else {
            initializer.visit_with(self);
        }
    }

    fn visit_call_expr(&mut self, call: &CallExpr) {
        if let Some(candidate) = &self.candidate
            && let Callee::Expr(callee) = &call.callee
            && let Expr::Ident(ident) = callee.as_ref()
            && self.known_hooks.contains(ident.sym.as_ref())
        {
            self.wrappers.insert(candidate.clone());
        }
        call.visit_children_with(self);
    }
}

fn is_hook_wrapper_name(name: &str) -> bool {
    let Some(rest) = name.strip_prefix("use") else {
        return false;
    };
    rest.chars().next().is_some_and(char::is_uppercase)
}

fn collect_hooks(program: &Program) -> HashSet<String> {
    let mut imports = ImportedHookCollector::default();
    program.visit_with(&mut imports);
    let mut hooks = imports.hooks;

    loop {
        let mut collector =
            WrapperHookCollector { known_hooks: &hooks, wrappers: HashSet::new(), candidate: None };
        program.visit_with(&mut collector);
        let previous_len = hooks.len();
        hooks.extend(collector.wrappers);
        if hooks.len() == previous_len {
            return hooks;
        }
    }
}

pub(crate) fn collect(program: &Program) -> Vec<CompileDiagnostic> {
    let mut collector = Collector { hooks: collect_hooks(program), ..Default::default() };
    program.visit_with(&mut collector);
    collector.diagnostics.sort_by(|left, right| {
        (left.start, left.end, left.category).cmp(&(right.start, right.end, right.category))
    });
    collector.diagnostics
}

pub(crate) fn append_markers(program: &mut Program, diagnostics: &[CompileDiagnostic]) {
    let Program::Module(module) = program else {
        return;
    };
    let markers = diagnostics.iter().map(|diagnostic| {
        let json = serde_json::to_string(diagnostic).expect("serialize Rue compile diagnostic");
        ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: swc_core::common::DUMMY_SP,
            expr: Box::new(Expr::Lit(Lit::Str(Str {
                span: swc_core::common::DUMMY_SP,
                value: format!("{MARKER}{json}").into(),
                raw: None,
            }))),
        }))
    });
    module.body.splice(0..0, markers);
}
