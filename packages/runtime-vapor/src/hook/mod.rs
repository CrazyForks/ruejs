/*
Hook 模块出口

这里把 Vapor 运行时提供给 JSX/TSX 用户侧的 Hook 能力统一聚合：
- 状态类：useState/useSignal/useRef/ref/reactive/computed
- 副作用类：useEffect/useMemo/useCallback/useSetup
- 调试/取值类：isReactive/isReadonly/isProxy/toRaw/unref

这些入口大多会复用 reactive 层的基础能力，并在存在当前组件实例时写入 Hook 插槽，
以保持多次渲染之间的状态引用稳定。
*/
pub mod use_state;
pub use use_state::use_state;
pub mod use_memo;
pub use use_memo::use_memo;
pub mod use_callback;
pub use use_callback::use_callback;
pub mod use_setup;
pub use use_setup::use_setup;
pub mod use_ref;
pub use use_ref::use_ref;
pub mod use_signal;
pub use use_signal::use_signal;
pub mod use_effect;
pub use use_effect::use_effect;
pub mod computed;
pub use computed::computed_js;
pub mod is_reactive;
pub use is_reactive::{is_proxy, is_reactive};
pub mod is_ref;
pub use is_ref::is_ref;
pub mod is_readonly;
pub use is_readonly::is_readonly;
pub mod reactive;
pub use reactive::{reactive_js, readonly_js, shallow_reactive_js, shallow_readonly_js};
pub mod rue_ref;
pub use rue_ref::ref_js;
pub mod signal;
pub use signal::signal_js;
pub mod to_raw;
pub use to_raw::to_raw_js;
pub mod unref;
pub use unref::unref_js;
