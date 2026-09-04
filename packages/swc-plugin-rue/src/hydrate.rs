use swc_core::atoms::Atom;
use swc_core::common::DUMMY_SP;
use swc_core::ecma::ast::*;

const HYDRATE_DOM_HELPERS: &[&str] = &[
    "_$compiledCreateElement",
    "_$compiledCreateTextNode",
    "_$compiledCreateComment",
    "_$compiledAppendChild",
    "_$compiledInsertBefore",
    "_$compiledRemoveChild",
    "_$template",
];

/// Compile with the closed client ABI, then route only DOM construction to the
/// explicit hydration entry. Reactive/owner helpers remain on the normal internal entry.
pub(crate) fn run(
    program: Program,
    comments: Option<swc_core::plugin::proxies::PluginCommentsProxy>,
) -> Program {
    let mut program = super::run_full_transform_with_options(program, true, true, comments);
    if let Program::Module(module) = &mut program {
        route_dom_helpers(module);
    }
    program
}

fn imported_name(specifier: &ImportSpecifier) -> Option<&str> {
    let ImportSpecifier::Named(named) = specifier else { return None };
    match named.imported.as_ref() {
        Some(ModuleExportName::Ident(ident)) => Some(ident.sym.as_ref()),
        Some(ModuleExportName::Str(value)) => value.value.as_str(),
        None => Some(named.local.sym.as_ref()),
    }
}

fn route_dom_helpers(module: &mut Module) {
    let mut hydration_specifiers = Vec::new();
    for item in &mut module.body {
        let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item else { continue };
        if !matches!(
            import.src.value.as_str(),
            Some("@rue-js/rue/internal" | "@rue-js/rue/internal/compiler")
        ) {
            continue;
        }
        let mut retained = Vec::with_capacity(import.specifiers.len());
        for specifier in import.specifiers.drain(..) {
            if imported_name(&specifier).is_some_and(|name| HYDRATE_DOM_HELPERS.contains(&name)) {
                hydration_specifiers.push(specifier);
            } else {
                retained.push(specifier);
            }
        }
        import.specifiers = retained;
    }
    if hydration_specifiers.is_empty() {
        return;
    }
    module.body.retain(|item| {
        !matches!(item,
            ModuleItem::ModuleDecl(ModuleDecl::Import(import))
                if matches!(
                    import.src.value.as_str(),
                    Some("@rue-js/rue/internal" | "@rue-js/rue/internal/compiler")
                ) && import.specifiers.is_empty()
        )
    });
    module.body.insert(
        0,
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: hydration_specifiers,
            src: Box::new(Str {
                span: DUMMY_SP,
                value: Atom::from("@rue-js/runtime/island").into(),
                raw: None,
            }),
            type_only: false,
            with: None,
            phase: Default::default(),
        })),
    );
}
