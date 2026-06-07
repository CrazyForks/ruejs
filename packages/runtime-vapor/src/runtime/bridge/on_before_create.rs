/*
生命周期桥接：onBeforeCreate

若当前可以可变借用 runtime，直接注册到实例/全局钩子；
若处在渲染重入中，则先放入 pending hooks，等组件挂载流程恢复后合并。
*/
use super::WasmRue;
use crate::runtime::globals::push_pending_hook;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onBeforeCreate")]
    pub fn on_before_create(&self, f: JsValue) {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.on_before_create(f);
        } else {
            push_pending_hook("before_create", f);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::createRue;
    use js_sys::{Function, Reflect};
    use wasm_bindgen::JsValue;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn on_before_create_bridge_registers_and_triggers_hook() {
        let rue = createRue(JsValue::UNDEFINED);
        Reflect::set(
            &js_sys::global(),
            &JsValue::from_str("__before_create_hits"),
            &JsValue::from_f64(0.0),
        )
        .unwrap();
        let hook = Function::new_no_args("globalThis.__before_create_hits += 1");

        rue.on_before_create(hook.into());
        rue.inner.borrow_mut().call_hooks("before_create");

        assert_eq!(
            Reflect::get(&js_sys::global(), &JsValue::from_str("__before_create_hits"))
                .unwrap()
                .as_f64(),
            Some(1.0),
        );
    }
}
