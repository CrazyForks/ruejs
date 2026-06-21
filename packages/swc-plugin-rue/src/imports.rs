use std::collections::{HashMap, HashSet};
// 原子字符串类型：更高效的字符串存储与比较（用于标识符/字符串字面量）
use swc_core::atoms::Atom;
// SWC 常量与上下文：
// - DUMMY_SP：稳定的“占位”源码位置信息
// - SyntaxContext：语义上下文（此处统一 empty()）
use swc_core::common::{DUMMY_SP, SyntaxContext};
// SWC ECMAScript AST 节点类型集合（Module/ImportDecl/Ident 等）
use swc_core::ecma::ast::*;
// SWC 只读访问器：
// - Visit：只读遍历接口
// - VisitWith：在节点上执行只读访问器
use swc_core::ecma::visit::{Visit, VisitWith};

/// 运行时导入收集与按需注入：
/// - `RuntimeUseCollector` 通过遍历表达式与类型引用，收集使用到的运行时符号与类型（如 `FC`）。
/// - `ensure_runtime_imports` 在模块级：
///   - 类型导入仍从 `@rue-js/rue` 注入，保持作者侧公开入口稳定；
///   - Vapor helper 值导入改为 `@rue-js/rue/vapor`，将编译产物依赖从默认入口收窄到专用子入口；
///   - 若对应 source 已存在 import，则仅追加缺失的 specifier；否则在顶部插入新的 import。
/// - 设计权衡：按需导入避免“全量导入”造成的未使用警告与打包体积波动，同时保证多次转换只产生一次导入。
struct RuntimeUseCollector {
    known_values: HashSet<&'static str>,
    used_values: HashSet<String>,
    used_types: HashSet<String>,
    used_type_refs: HashSet<String>,
}

#[derive(Clone, Debug)]
struct NamedImportSpec {
    local: String,
    local_ctxt: SyntaxContext,
    imported: Option<String>,
    is_type_only: bool,
}

impl NamedImportSpec {
    fn export_name(&self) -> &str {
        self.imported.as_deref().unwrap_or(self.local.as_str())
    }
}

const VAPOR_SAFE_VALUE_IMPORTS: &[&str] = &[
    // 响应式与生命周期 API 必须允许从 vapor 子入口导入，保证编译产物不会回到默认 runtime。
    "effect",
    "batch",
    "onCleanup",
    "onScopeDispose",
    "untrack",
    "setCurrentInstance",
    "getCurrentInstance",
    "withHookSlot",
    "toValue",
    "watchFn",
    "watchEffect",
    "watchSignal",
    "watchDeepSignal",
    "watchPath",
    "createResource",
    "watch",
    "useState",
    "useSignal",
    "useEffect",
    "signal",
    "ref",
    "shallowRef",
    "triggerRef",
    "toRef",
    "toRefs",
    "computed",
    "isProxy",
    "isReactive",
    "isReadonly",
    "reactive",
    "shallowReactive",
    "readonly",
    "shallowReadonly",
    "toRaw",
    "propsReactive",
    "useMemo",
    "useCallback",
    "useSetup",
    "useRef",
    "unref",
    "setReactiveScheduling",
    "vapor",
    "renderAnchor",
    "renderBetween",
    "onBeforeCreate",
    "onCreated",
    "onBeforeMount",
    "onMounted",
    "onBeforeUpdate",
    "onUpdated",
    "onRenderTracked",
    "onBeforeUnmount",
    "onUnmounted",
    "onError",
    "getCurrentContainer",
    "Transition",
    "Template",
];

const FORCED_ROOT_TYPE_IMPORTS: &[&str] = &["FC"];

const AUTO_INJECTED_VALUE_IMPORTS: &[&str] = &[
    "vapor",
    "renderAnchor",
    "renderBetween",
    "untrack",
    "watchEffect",
    "getCurrentInstance",
    "useMemo",
    "computed",
    "useSetup",
    "onBeforeUnmount",
    "Template",
];

impl RuntimeUseCollector {
    fn new() -> Self {
        let known_values: HashSet<&'static str> = AUTO_INJECTED_VALUE_IMPORTS
            .iter()
            .copied()
            .chain([
                "_$createComponent",
                "_$vaporWithHookId",
                "_$createElement",
                "_$createComment",
                "_$createTextNode",
                "_$setStyle",
                "_$settextContent",
                "_$createDocumentFragment",
                "_$appendChild",
                "_$vaporKeyedList",
                "_$createTextWrapper",
                "_$vaporWithKey",
                "_$vaporShowStyle",
                "_$vaporBindUseRef",
                "_$vaporWithEventModifiers",
                "_$vaporWithNativeEvents",
                "_$setAttribute",
                "_$addEventListener",
                "_$setClassName",
                "_$setInnerHTML",
                "_$setValue",
                "_$setChecked",
                "_$setDisabled",
                "_$setProperty",
                "_$spreadAttributes",
            ])
            .collect();
        Self {
            known_values,
            used_values: HashSet::new(),
            used_types: HashSet::new(),
            used_type_refs: HashSet::new(),
        }
    }
}

impl Visit for RuntimeUseCollector {
    fn visit_expr(&mut self, e: &Expr) {
        if let Expr::Ident(i) = e {
            let name = i.sym.as_ref();
            if self.known_values.contains(name) {
                self.used_values.insert(name.to_string());
            }
        }
        e.visit_children_with(self);
    }

    fn visit_ts_type_ref(&mut self, t: &TsTypeRef) {
        if let TsEntityName::Ident(id) = &t.type_name {
            self.used_type_refs.insert(id.sym.to_string());
            if id.sym.as_ref() == "FC" {
                self.used_types.insert("FC".to_string());
            }
        }
        t.visit_children_with(self);
    }
}

fn module_export_name_to_string(name: &ModuleExportName) -> String {
    match name {
        ModuleExportName::Ident(ident) => ident.sym.to_string(),
        ModuleExportName::Str(str) => str.value.as_str().unwrap_or_default().to_string(),
    }
}

fn named_import_to_spec(spec: &ImportNamedSpecifier) -> NamedImportSpec {
    NamedImportSpec {
        local: spec.local.sym.to_string(),
        local_ctxt: spec.local.ctxt,
        imported: spec.imported.as_ref().map(module_export_name_to_string),
        is_type_only: spec.is_type_only,
    }
}

fn spec_to_named_import(spec: &NamedImportSpec) -> ImportSpecifier {
    ImportSpecifier::Named(ImportNamedSpecifier {
        span: DUMMY_SP,
        local: Ident::new(Atom::from(spec.local.as_str()), DUMMY_SP, spec.local_ctxt),
        imported: spec.imported.as_ref().map(|name| {
            ModuleExportName::Ident(Ident::new(
                Atom::from(name.as_str()),
                DUMMY_SP,
                SyntaxContext::empty(),
            ))
        }),
        is_type_only: spec.is_type_only,
    })
}

fn is_safe_vapor_value_import(name: &str) -> bool {
    VAPOR_SAFE_VALUE_IMPORTS.contains(&name)
}

fn mark_root_type_only_imports(m: &mut Module, used_type_refs: &HashSet<String>) {
    if used_type_refs.is_empty() {
        return;
    }

    for item in &mut m.body {
        let ModuleItem::ModuleDecl(ModuleDecl::Import(decl)) = item else {
            continue;
        };
        if decl.src.value.as_str() != Some("@rue-js/rue") {
            continue;
        }

        for spec in &mut decl.specifiers {
            let ImportSpecifier::Named(named) = spec else {
                continue;
            };
            if named.is_type_only {
                continue;
            }

            let export_name = named
                .imported
                .as_ref()
                .map(module_export_name_to_string)
                .unwrap_or_else(|| named.local.sym.to_string());
            if !FORCED_ROOT_TYPE_IMPORTS.contains(&export_name.as_str()) {
                continue;
            }
            if !used_type_refs.contains(export_name.as_str())
                && !used_type_refs.contains(named.local.sym.as_ref())
            {
                continue;
            }

            named.is_type_only = true;
        }
    }
}

fn append_missing_specifiers(decl: &mut ImportDecl, specs: &[NamedImportSpec]) {
    let mut existing: HashSet<(String, Option<String>, bool)> = decl
        .specifiers
        .iter()
        .filter_map(|spec| match spec {
            ImportSpecifier::Named(named) => Some(named_import_to_spec(named)),
            _ => None,
        })
        .map(|spec| (spec.local, spec.imported, spec.is_type_only))
        .collect();

    for spec in specs {
        let key = (spec.local.clone(), spec.imported.clone(), spec.is_type_only);
        let has_local_collision = decl.specifiers.iter().any(|current| match current {
            ImportSpecifier::Named(named) => named.local.sym.as_ref() == spec.local,
            ImportSpecifier::Default(default) => default.local.sym.as_ref() == spec.local,
            ImportSpecifier::Namespace(namespace) => namespace.local.sym.as_ref() == spec.local,
        });
        if existing.contains(&key) || has_local_collision {
            continue;
        }
        decl.specifiers.push(spec_to_named_import(spec));
        existing.insert(key);
    }
}

fn insert_import(m: &mut Module, import_source: &Str, specs: Vec<NamedImportSpec>) {
    let specifiers = specs.iter().map(spec_to_named_import).collect();
    let import = ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
        span: DUMMY_SP,
        specifiers,
        src: Box::new(import_source.clone()),
        type_only: false,
        with: None,
        phase: Default::default(),
    }));
    m.body.insert(0, import);
}

fn drain_safe_root_value_imports(m: &mut Module) -> Vec<NamedImportSpec> {
    let mut moved = Vec::new();
    let mut next_body = Vec::with_capacity(m.body.len());

    for item in m.body.drain(..) {
        match item {
            ModuleItem::ModuleDecl(ModuleDecl::Import(mut decl))
                if decl.src.value.as_str() == Some("@rue-js/rue") =>
            {
                let mut next_specifiers = Vec::with_capacity(decl.specifiers.len());
                for spec in decl.specifiers {
                    match spec {
                        ImportSpecifier::Named(named) => {
                            let named_spec = named_import_to_spec(&named);
                            if !named_spec.is_type_only
                                && is_safe_vapor_value_import(named_spec.export_name())
                            {
                                moved.push(named_spec);
                            } else {
                                next_specifiers.push(ImportSpecifier::Named(named));
                            }
                        }
                        other => next_specifiers.push(other),
                    }
                }

                if !next_specifiers.is_empty() {
                    decl.specifiers = next_specifiers;
                    next_body.push(ModuleItem::ModuleDecl(ModuleDecl::Import(decl)));
                }
            }
            other => next_body.push(other),
        }
    }

    m.body = next_body;
    moved
}

fn sort_named_specs(specs: &mut [NamedImportSpec], rank: &HashMap<&str, usize>) {
    specs.sort_by(|a, b| {
        let a_rank = rank.get(a.export_name()).cloned().unwrap_or(usize::MAX);
        let b_rank = rank.get(b.export_name()).cloned().unwrap_or(usize::MAX);
        a_rank
            .cmp(&b_rank)
            .then_with(|| a.export_name().cmp(b.export_name()))
            .then_with(|| a.local.cmp(&b.local))
    });
}

fn dedupe_named_specs(specs: &mut Vec<NamedImportSpec>) {
    let mut seen = HashSet::new();
    specs
        .retain(|spec| seen.insert((spec.local.clone(), spec.imported.clone(), spec.is_type_only)));
}

/// 基于模块实际使用情况按需注入运行时导入。
/// 类型走 `@rue-js/rue`，值 helper 走 `@rue-js/rue/vapor`。
pub fn ensure_runtime_imports(m: &mut Module) {
    crate::log::debug("rue-swc: ensure_runtime_imports start");
    let type_import_source =
        Str { span: DUMMY_SP, value: Atom::from("@rue-js/rue").into(), raw: None };
    let helper_import_source =
        Str { span: DUMMY_SP, value: Atom::from("@rue-js/rue/vapor").into(), raw: None };

    let mut collector = RuntimeUseCollector::new();
    m.visit_with(&mut collector);
    mark_root_type_only_imports(m, &collector.used_type_refs);

    let mut helper_specs: Vec<NamedImportSpec> = collector
        .used_values
        .iter()
        .map(|s| NamedImportSpec {
            local: s.clone(),
            local_ctxt: SyntaxContext::empty(),
            imported: None,
            is_type_only: false,
        })
        .collect();
    let mut moved_helper_specs = drain_safe_root_value_imports(m);
    moved_helper_specs.append(&mut helper_specs);
    let mut helper_specs = moved_helper_specs;

    let type_specs: Vec<NamedImportSpec> = collector
        .used_types
        .iter()
        .map(|s| NamedImportSpec {
            local: s.clone(),
            local_ctxt: SyntaxContext::empty(),
            imported: None,
            is_type_only: true,
        })
        .collect();

    if helper_specs.is_empty() && type_specs.is_empty() {
        crate::log::debug("rue-swc: ensure_runtime_imports none");
        return;
    }

    // 为了稳定输出顺序，按预定义序列排序值导入
    // 说明：稳定的导入顺序有助于避免测试快照抖动，并提升读者的熟悉成本
    let order: Vec<&str> = vec![
        "vapor",
        "onBeforeCreate",
        "onCreated",
        "onBeforeMount",
        "onMounted",
        "onBeforeUpdate",
        "onUpdated",
        "onRenderTracked",
        "onBeforeUnmount",
        "onUnmounted",
        "onError",
        "getCurrentContainer",
        "Transition",
        "Template",
        "_$createComponent",
        "renderAnchor",
        "renderBetween",
        "_$createElement",
        "_$createComment",
        "_$createTextNode",
        "_$setStyle",
        "_$settextContent",
        "_$createDocumentFragment",
        "_$appendChild",
        "effect",
        "batch",
        "onCleanup",
        "onScopeDispose",
        "untrack",
        "setCurrentInstance",
        "getCurrentInstance",
        "withHookSlot",
        "toValue",
        "watchFn",
        "watchEffect",
        "watchSignal",
        "watchDeepSignal",
        "watchPath",
        "createResource",
        "watch",
        "useState",
        "useSignal",
        "useEffect",
        "signal",
        "ref",
        "shallowRef",
        "triggerRef",
        "computed",
        "isProxy",
        "isReactive",
        "isReadonly",
        "reactive",
        "shallowReactive",
        "readonly",
        "shallowReadonly",
        "toRaw",
        "propsReactive",
        "useMemo",
        "useCallback",
        "_$vaporKeyedList",
        "_$createTextWrapper",
        "_$vaporWithKey",
        "_$vaporShowStyle",
        "_$vaporBindUseRef",
        "_$vaporWithEventModifiers",
        "_$vaporWithNativeEvents",
        "_$vaporWithHookId",
        "_$setAttribute",
        "_$addEventListener",
        "_$setClassName",
        "_$setInnerHTML",
        "_$setValue",
        "_$setChecked",
        "_$setDisabled",
        "useSetup",
        "useRef",
        "unref",
        "setReactiveScheduling",
    ];
    let rank: HashMap<&str, usize> = order.iter().enumerate().map(|(i, s)| (*s, i)).collect();
    sort_named_specs(&mut helper_specs, &rank);
    dedupe_named_specs(&mut helper_specs);

    let mut merged_type = type_specs.is_empty();
    let mut merged_helper = helper_specs.is_empty();
    for item in &mut m.body {
        if let ModuleItem::ModuleDecl(ModuleDecl::Import(decl)) = item {
            if !merged_type && decl.src.value.as_str() == Some("@rue-js/rue") {
                append_missing_specifiers(decl, &type_specs);
                merged_type = true;
                crate::log::debug("rue-swc: merge existing @rue-js/rue import");
            }
            if !merged_helper && decl.src.value.as_str() == Some("@rue-js/rue/vapor") {
                append_missing_specifiers(decl, &helper_specs);
                merged_helper = true;
                crate::log::debug("rue-swc: merge existing @rue-js/rue/vapor import");
            }
            if merged_type && merged_helper {
                break;
            }
        }
    }

    if !merged_helper {
        crate::log::debug("rue-swc: insert new @rue-js/rue/vapor import");
        insert_import(m, &helper_import_source, helper_specs);
    }

    if !merged_type {
        crate::log::debug("rue-swc: insert new @rue-js/rue import");
        insert_import(m, &type_import_source, type_specs);
    }
}

#[cfg(test)]
#[path = "imports_tests.rs"]
mod tests;
