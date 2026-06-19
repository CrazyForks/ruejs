#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const RUNTIME_CRASHED: &str = "Rue runtime crashed";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const RUNTIME_CRASHED: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const NO_DOM_RENDER: &str = "Rue runtime: no DOM adapter for render";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const NO_DOM_RENDER: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const NO_DOM_RENDER_MOUNT: &str = "Rue runtime: no DOM adapter for render mount";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const NO_DOM_RENDER_MOUNT: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const RENDER_FAILED_NO_DOM: &str = "Rue vapor: render failed (create_real_dom=None)";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const RENDER_FAILED_NO_DOM: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const NO_DOM_RENDER_ANCHOR: &str = "Rue runtime: no DOM adapter for renderAnchor";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const NO_DOM_RENDER_ANCHOR: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const RENDER_ANCHOR_FAILED_NO_DOM: &str =
    "Rue vapor: renderAnchor failed (create_real_dom=None)";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const RENDER_ANCHOR_FAILED_NO_DOM: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const NO_DOM_RENDER_STATIC: &str = "Rue runtime: no DOM adapter for renderStatic";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const NO_DOM_RENDER_STATIC: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const RENDER_STATIC_FAILED_NO_DOM: &str =
    "Rue vapor: renderStatic failed (create_real_dom=None)";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const RENDER_STATIC_FAILED_NO_DOM: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const STATIC_HOST_MISSING: &str = "Rue vapor: mounted static subtree must expose a host";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const STATIC_HOST_MISSING: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const STATIC_DOM_CHECKED: &str = "Rue runtime: DOM adapter checked before renderStatic";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const STATIC_DOM_CHECKED: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const RANGE_HOST_MISSING: &str = "Rue vapor: mounted range subtree must expose a host";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const RANGE_HOST_MISSING: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const RANGE_STORE_OOB: &str =
    "Rue vapor: renderBetween range_map index out of bounds (store)";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const RANGE_STORE_OOB: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const RANGE_BLOCK_HIT_FAILED_NO_DOM: &str =
    "Rue vapor: renderBetween failed (block hit, create_real_dom=None)";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const RANGE_BLOCK_HIT_FAILED_NO_DOM: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const RANGE_EMPTY_HIT_FAILED_NO_DOM: &str =
    "Rue vapor: renderBetween failed (empty range hit, create_real_dom=None)";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const RANGE_EMPTY_HIT_FAILED_NO_DOM: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const RANGE_MISS_FAILED_NO_DOM: &str =
    "Rue vapor: renderBetween failed (range miss, create_real_dom=None)";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const RANGE_MISS_FAILED_NO_DOM: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const UNSUPPORTED_RENDER_INPUT: &str =
    "Rue runtime: render input not supported on the default path";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const UNSUPPORTED_RENDER_INPUT: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const UNSUPPORTED_RENDER_ANCHOR_INPUT: &str =
    "Rue runtime: renderAnchor input not supported on the default path";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const UNSUPPORTED_RENDER_ANCHOR_INPUT: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const UNSUPPORTED_RENDER_BETWEEN_INPUT: &str =
    "Rue runtime: renderBetween input not supported on the default path";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const UNSUPPORTED_RENDER_BETWEEN_INPUT: &str = "RV";

#[cfg(any(feature = "dev", debug_assertions, test))]
pub(crate) const UNSUPPORTED_RENDER_STATIC_INPUT: &str =
    "Rue runtime: renderStatic input not supported on the default path";
#[cfg(not(any(feature = "dev", debug_assertions, test)))]
pub(crate) const UNSUPPORTED_RENDER_STATIC_INPUT: &str = "RV";
