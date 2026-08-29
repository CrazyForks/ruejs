use crate::compiled_capabilities::{
    RuntimeTier, aggregate_runtime_tier, runtime_import_tier, runtime_tier_for_helper,
    should_auto_inject_helper,
};

#[test]
fn aggregates_module_runtime_tier_from_used_capabilities() {
    assert_eq!(aggregate_runtime_tier(std::iter::empty()), RuntimeTier::None);
    assert_eq!(
        aggregate_runtime_tier(["signal", "effect", "_$compiledRoot"]),
        RuntimeTier::Compiled,
    );
    assert_eq!(
        aggregate_runtime_tier(["signal", "_$vaporMarkComponentRenderReactive"]),
        RuntimeTier::Vapor,
    );
    assert_eq!(aggregate_runtime_tier(["unknownUserBinding"]), RuntimeTier::None,);
}

#[test]
fn classifies_compiled_core_and_vapor_fallback_helpers() {
    for helper in [
        "signal",
        "effect",
        "batch",
        "untrack",
        "onCleanup",
        "createOwner",
        "runWithOwner",
        "disposeOwner",
        "createSelector",
        "_$compiledRoot",
        "_$reconcileKeyed",
    ] {
        assert_eq!(runtime_tier_for_helper(helper), Some(RuntimeTier::Compiled), "{helper}");
    }

    for helper in [
        "_$createComponent",
        "Hydration",
        "Transition",
        "KeepAlive",
        "Suspense",
        "renderBetween",
        "_$vaporMarkComponentRenderReactive",
    ] {
        assert_eq!(runtime_tier_for_helper(helper), Some(RuntimeTier::Vapor), "{helper}");
    }

    assert_eq!(runtime_tier_for_helper("userHelper"), None);
}

#[test]
fn upgrades_shared_compiled_core_helpers_for_vapor_modules() {
    assert_eq!(runtime_import_tier("signal", RuntimeTier::Compiled), Some(RuntimeTier::Compiled),);
    assert_eq!(runtime_import_tier("signal", RuntimeTier::Vapor), Some(RuntimeTier::Vapor),);
    assert_eq!(runtime_import_tier("untrack", RuntimeTier::Vapor), Some(RuntimeTier::Vapor),);
    assert_eq!(runtime_import_tier("_$compiledRoot", RuntimeTier::Vapor), Some(RuntimeTier::Vapor),);

    for helper in
        ["createOwner", "runWithOwner", "disposeOwner", "createSelector", "_$reconcileKeyed"]
    {
        assert_eq!(
            runtime_import_tier(helper, RuntimeTier::Vapor),
            Some(RuntimeTier::Vapor),
            "mixed modules must keep {helper} on the Vapor reactive graph",
        );
    }
}

#[test]
fn distinguishes_routable_user_apis_from_generated_helpers() {
    assert!(!should_auto_inject_helper("signal"));
    assert!(!should_auto_inject_helper("effect"));
    assert!(should_auto_inject_helper("onCleanup"));
    assert!(should_auto_inject_helper("_$compiledRoot"));
    assert!(should_auto_inject_helper("_$reconcileKeyed"));
    assert!(should_auto_inject_helper("untrack"));
    assert!(should_auto_inject_helper("_$vaporMarkComponentRenderReactive"));
}
