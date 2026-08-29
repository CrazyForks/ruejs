#[derive(Clone, Copy, Debug, Default, Eq, Ord, PartialEq, PartialOrd)]
pub(crate) enum RuntimeTier {
    #[default]
    None,
    Compiled,
    Vapor,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct RuntimeCapability {
    helper: &'static str,
    tier: RuntimeTier,
    available_in_vapor: bool,
    auto_injected: bool,
}

const fn capability(
    helper: &'static str,
    tier: RuntimeTier,
    available_in_vapor: bool,
) -> RuntimeCapability {
    RuntimeCapability { helper, tier, available_in_vapor, auto_injected: false }
}

const fn auto_capability(
    helper: &'static str,
    tier: RuntimeTier,
    available_in_vapor: bool,
) -> RuntimeCapability {
    RuntimeCapability { helper, tier, available_in_vapor, auto_injected: true }
}

// This table is the single source of truth for generated helpers and root values that may be
// moved to a runtime subpath. Shared core helpers upgrade to Vapor with the module tier so one
// module does not split its reactive ownership graph across runtimes.
const RUNTIME_CAPABILITIES: &[RuntimeCapability] = &[
    capability("signal", RuntimeTier::Compiled, true),
    capability("effect", RuntimeTier::Compiled, true),
    capability("batch", RuntimeTier::Compiled, true),
    auto_capability("untrack", RuntimeTier::Compiled, true),
    auto_capability("onCleanup", RuntimeTier::Compiled, true),
    capability("createOwner", RuntimeTier::Compiled, true),
    capability("runWithOwner", RuntimeTier::Compiled, true),
    capability("disposeOwner", RuntimeTier::Compiled, true),
    capability("createSelector", RuntimeTier::Compiled, true),
    capability("setReactiveScheduling", RuntimeTier::Compiled, true),
    auto_capability("_$compiledRoot", RuntimeTier::Compiled, true),
    auto_capability("_$reconcileKeyed", RuntimeTier::Compiled, true),
    auto_capability("_$compiledCreateElement", RuntimeTier::Compiled, true),
    auto_capability("_$compiledCreateTextNode", RuntimeTier::Compiled, true),
    auto_capability("_$compiledCreateComment", RuntimeTier::Compiled, true),
    auto_capability("_$compiledAppendChild", RuntimeTier::Compiled, true),
    auto_capability("_$template", RuntimeTier::Compiled, true),
    capability("onScopeDispose", RuntimeTier::Vapor, true),
    capability("setCurrentInstance", RuntimeTier::Vapor, true),
    auto_capability("getCurrentInstance", RuntimeTier::Vapor, true),
    capability("withHookSlot", RuntimeTier::Vapor, true),
    capability("toValue", RuntimeTier::Vapor, true),
    capability("watchFn", RuntimeTier::Vapor, true),
    auto_capability("watchEffect", RuntimeTier::Vapor, true),
    capability("watchSignal", RuntimeTier::Vapor, true),
    capability("watchDeepSignal", RuntimeTier::Vapor, true),
    capability("watchPath", RuntimeTier::Vapor, true),
    capability("createResource", RuntimeTier::Vapor, true),
    capability("watch", RuntimeTier::Vapor, true),
    capability("useState", RuntimeTier::Vapor, true),
    capability("useSignal", RuntimeTier::Vapor, true),
    capability("useEffect", RuntimeTier::Vapor, true),
    capability("ref", RuntimeTier::Vapor, true),
    capability("shallowRef", RuntimeTier::Vapor, true),
    capability("triggerRef", RuntimeTier::Vapor, true),
    capability("toRef", RuntimeTier::Vapor, true),
    capability("toRefs", RuntimeTier::Vapor, true),
    auto_capability("computed", RuntimeTier::Vapor, true),
    capability("isProxy", RuntimeTier::Vapor, true),
    capability("isReactive", RuntimeTier::Vapor, true),
    capability("isReadonly", RuntimeTier::Vapor, true),
    capability("reactive", RuntimeTier::Vapor, true),
    capability("shallowReactive", RuntimeTier::Vapor, true),
    capability("readonly", RuntimeTier::Vapor, true),
    capability("shallowReadonly", RuntimeTier::Vapor, true),
    capability("toRaw", RuntimeTier::Vapor, true),
    capability("propsReactive", RuntimeTier::Vapor, true),
    auto_capability("useMemo", RuntimeTier::Vapor, true),
    capability("useCallback", RuntimeTier::Vapor, true),
    auto_capability("useSetup", RuntimeTier::Vapor, true),
    capability("useRef", RuntimeTier::Vapor, true),
    capability("unref", RuntimeTier::Vapor, true),
    auto_capability("vapor", RuntimeTier::Vapor, true),
    auto_capability("renderAnchor", RuntimeTier::Vapor, true),
    auto_capability("renderBetween", RuntimeTier::Vapor, true),
    capability("useApp", RuntimeTier::Vapor, true),
    capability("onBeforeCreate", RuntimeTier::Vapor, true),
    capability("onCreated", RuntimeTier::Vapor, true),
    capability("onBeforeMount", RuntimeTier::Vapor, true),
    capability("onMounted", RuntimeTier::Vapor, true),
    capability("onBeforeUpdate", RuntimeTier::Vapor, true),
    capability("onUpdated", RuntimeTier::Vapor, true),
    capability("onRenderTracked", RuntimeTier::Vapor, true),
    auto_capability("onBeforeUnmount", RuntimeTier::Vapor, true),
    capability("onUnmounted", RuntimeTier::Vapor, true),
    capability("onError", RuntimeTier::Vapor, true),
    capability("getCurrentContainer", RuntimeTier::Vapor, true),
    capability("Hydration", RuntimeTier::Vapor, true),
    capability("Transition", RuntimeTier::Vapor, true),
    capability("TransitionGroup", RuntimeTier::Vapor, true),
    capability("KeepAlive", RuntimeTier::Vapor, true),
    capability("Suspense", RuntimeTier::Vapor, true),
    capability("Teleport", RuntimeTier::Vapor, true),
    auto_capability("Template", RuntimeTier::Vapor, true),
    auto_capability("_$createComponent", RuntimeTier::Vapor, true),
    auto_capability("_$vaporWithHookId", RuntimeTier::Vapor, true),
    auto_capability("_$vaporMarkComponentRenderReactive", RuntimeTier::Vapor, true),
    auto_capability("_$createElement", RuntimeTier::Vapor, true),
    auto_capability("_$createComment", RuntimeTier::Vapor, true),
    auto_capability("_$createTextNode", RuntimeTier::Vapor, true),
    auto_capability("_$setStyle", RuntimeTier::Vapor, true),
    auto_capability("_$settextContent", RuntimeTier::Vapor, true),
    auto_capability("_$createDocumentFragment", RuntimeTier::Vapor, true),
    auto_capability("_$appendChild", RuntimeTier::Vapor, true),
    auto_capability("_$insertBefore", RuntimeTier::Vapor, true),
    auto_capability("_$vaporKeyedList", RuntimeTier::Vapor, true),
    auto_capability("_$createTextWrapper", RuntimeTier::Vapor, true),
    auto_capability("_$vaporWithKey", RuntimeTier::Vapor, true),
    auto_capability("_$vaporShowStyle", RuntimeTier::Vapor, true),
    auto_capability("_$vaporBindUseRef", RuntimeTier::Vapor, true),
    auto_capability("_$vaporWithEventModifiers", RuntimeTier::Vapor, true),
    auto_capability("_$vaporWithNativeEvents", RuntimeTier::Vapor, true),
    auto_capability("_$setAttribute", RuntimeTier::Vapor, true),
    auto_capability("_$addEventListener", RuntimeTier::Vapor, true),
    auto_capability("_$setClassName", RuntimeTier::Vapor, true),
    auto_capability("_$setInnerHTML", RuntimeTier::Vapor, true),
    auto_capability("_$setValue", RuntimeTier::Vapor, true),
    auto_capability("_$setChecked", RuntimeTier::Vapor, true),
    auto_capability("_$setDisabled", RuntimeTier::Vapor, true),
    auto_capability("_$setProperty", RuntimeTier::Vapor, true),
    auto_capability("_$spreadAttributes", RuntimeTier::Vapor, true),
];

pub(crate) fn runtime_tier_for_helper(helper: &str) -> Option<RuntimeTier> {
    RUNTIME_CAPABILITIES
        .iter()
        .find(|capability| capability.helper == helper)
        .map(|capability| capability.tier)
}

pub(crate) fn should_auto_inject_helper(helper: &str) -> bool {
    RUNTIME_CAPABILITIES
        .iter()
        .find(|capability| capability.helper == helper)
        .is_some_and(|capability| capability.auto_injected)
}

pub(crate) fn aggregate_runtime_tier<'a>(
    helpers: impl IntoIterator<Item = &'a str>,
) -> RuntimeTier {
    helpers.into_iter().filter_map(runtime_tier_for_helper).max().unwrap_or_default()
}

pub(crate) fn runtime_import_tier(helper: &str, module_tier: RuntimeTier) -> Option<RuntimeTier> {
    let capability = RUNTIME_CAPABILITIES.iter().find(|capability| capability.helper == helper)?;
    if module_tier == RuntimeTier::Vapor && capability.available_in_vapor {
        Some(RuntimeTier::Vapor)
    } else {
        Some(capability.tier)
    }
}
