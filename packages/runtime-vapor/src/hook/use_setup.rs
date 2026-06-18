/*
useSetup：只执行一次的 setup 工厂

通过空依赖的 useMemo 缓存 setup 返回值，并在执行期间绑定当前组件的 Hook/effect scope。
这让 setup 内创建的响应式副作用可以在组件卸载或重建时被统一清理。
*/
use js_sys::{Array, Function};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::prelude::*;
use wasm_bindgen::throw_val;

use crate::hook::use_memo;
use crate::reactive::context::{get_current_instance, with_current_instance_hook_scope};
use crate::reactive::core::dispatch_error_captured;
use crate::runtime::mark_crashed_from_hook;

#[wasm_bindgen(js_name = useSetup)]
pub fn use_setup(factory: Function) -> JsValue {
    // 空依赖数组：只会在首次执行时调用 factory 并缓存结果
    let empty: JsValue = Array::new().into();
    let scoped_factory = Closure::wrap(Box::new(move || {
        with_current_instance_hook_scope(|| match factory.call0(&JsValue::NULL) {
            Ok(value) => value,
            Err(error) => {
                let instance = get_current_instance();
                if dispatch_error_captured(&error, &instance, "setup") {
                    return JsValue::NULL;
                }
                mark_crashed_from_hook(&error);
                throw_val(error.clone());
            }
        })
    }) as Box<dyn FnMut() -> JsValue>);
    let scoped_factory_fn: Function = scoped_factory.as_ref().clone().unchecked_into();
    let value = use_memo(scoped_factory_fn, empty);
    scoped_factory.forget();
    value
}

#[wasm_bindgen(typescript_custom_section)]
const TS_USE_SETUP_DECL: &'static str = r#"
/**
 * useSetup：仅在首次调用时计算一次并缓存
 *
 * - factory 会在组件实例的持久 hook scope 中执行，而不是挂到单次 render scope 上。
 * - 因此 setup 内创建的 watch/watchEffect/createEffect 会随组件实例一起存活，直到组件卸载时统一清理。
 * - 但 setup 首次执行里直接算出来的普通 props 快照仍然只是首帧值；需要动态追踪时，仍应在 computed/watch/effect 中读取 props。
 */
export function useSetup<T>(factory: () => T): T;
"#;
