/*
生命周期桥接：onServerPrefetch

服务端渲染专用的异步预取钩子。注册阶段与其他 lifecycle 一样支持重入 pending；
执行阶段返回 Promise，供 SSR renderer 在组件输出前 await。
*/
use super::WasmRue;
use crate::runtime::globals::push_pending_hook;
use js_sys::Promise;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onServerPrefetch")]
    /// 注册当前上下文的 serverPrefetch 预取钩子。
    pub fn on_server_prefetch(&self, f: JsValue) {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.on_server_prefetch(f);
        } else {
            push_pending_hook("server_prefetch", f);
        }
    }

    #[wasm_bindgen(js_name = "runServerPrefetch")]
    /// 执行已注册的 serverPrefetch 钩子并返回 Promise.all。
    pub fn run_server_prefetch(&self) -> Promise {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.run_server_prefetch()
        } else {
            Promise::resolve(&JsValue::UNDEFINED)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::createRue;
    use js_sys::{Function, Promise, Reflect};
    use wasm_bindgen::JsValue;
    use wasm_bindgen_futures::JsFuture;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test(async)]
    async fn on_server_prefetch_bridge_runs_registered_promises() {
        let rue = createRue(JsValue::UNDEFINED);
        Reflect::set(
            &js_sys::global(),
            &JsValue::from_str("__server_prefetch_hits"),
            &JsValue::from_f64(0.0),
        )
        .unwrap();
        let hook = Function::new_no_args(
            "globalThis.__server_prefetch_hits += 1; return Promise.resolve('done')",
        );

        rue.on_server_prefetch(hook.into());
        let promise: Promise = rue.run_server_prefetch();
        JsFuture::from(promise).await.unwrap();

        assert_eq!(
            Reflect::get(&js_sys::global(), &JsValue::from_str("__server_prefetch_hits"))
                .unwrap()
                .as_f64(),
            Some(1.0),
        );
    }
}
