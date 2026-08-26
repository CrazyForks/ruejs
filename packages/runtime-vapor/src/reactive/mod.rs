// 模块：响应式系统入口（导出聚合）
// 说明：
// - 本文件仅负责把各子模块的对外 API 汇总导出，便于 JS/TS 端按需使用。
// - 子模块职责：
//   - computed：计算属性（派生只读/可写信号）
//   - core：运行时核心与调度策略（副作用/信号的全局状态与微任务策略）
//   - effect：副作用（创建、清理、批量、untrack）
//   - resource：异步资源封装（data/error/loading 三信号）
//   - signal：基础信号与 reactive/ref 代理实现
//   - watch：侦听（函数、信号、路径与来源数组）
// - 所有导出均通过 `wasm_bindgen` 面向 JS 使用。
pub mod computed;
pub mod core;
pub mod effect;
pub(crate) mod graph;
pub mod resource;
pub mod signal;
pub mod watch;

// 计算属性：根据回调计算并缓存结果，自动在依赖变化时更新
pub use computed::create_computed;
// 核心：调度模式、nextTick、通用取值转换与 effect scope 清理
pub use core::{
    current_effect_id, current_effect_scope_wasm, next_tick, on_scope_dispose,
    set_reactive_scheduling, to_value,
};
// 副作用：注册、调度与清理能力，以及批量更新
pub use effect::{EffectHandle, batch, create_effect, on_cleanup, on_watcher_cleanup, untrack};
// 资源：基于信号驱动的异步数据加载器
pub use resource::create_resource;
// 信号：可订阅的可变数据容器（支持自定义等值比较）
pub use signal::{SignalHandle, create_custom_ref, create_signal};
// 侦听：对函数、信号的变化进行观察并触发处理函数
pub use watch::watch;
pub use watch::{watch_deep_signal, watch_effect, watch_fn, watch_path, watch_signal};
