/*
emitted：组件事件发射器桥接

把 props 里的事件处理器映射为 emitter(name, args)。
组件内部调用 emitter 时，运行时会按事件名找到对应 prop 并转发参数列表。
*/
use super::WasmRue;
use crate::runtime::types::ComponentProps;
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn props_map_from_value(props: &JsValue) -> ComponentProps {
    let mut props_map: ComponentProps = ComponentProps::new();
    if props.is_object() {
        let obj = Object::from(props.clone());
        let keys = Object::keys(&obj);
        for i in 0..keys.length() {
            let k = keys.get(i);
            if let Some(ks) = k.as_string() {
                let v = Reflect::get(&obj, &k).unwrap_or(JsValue::UNDEFINED);
                props_map.insert(ks, v);
            }
        }
    }
    props_map
}

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "emitted")]
    /// 返回一个 JS 回调函数，用于在组件内部发射事件
    ///
    /// - 根据 props 构建事件发射器 emitter(name, args)
    /// - 回调参数 args 若为数组，将其拆解为 Vec<JsValue> 传入
    pub fn emitted_wasm(&self, props: JsValue) -> JsValue {
        #[cfg(feature = "dev")]
        {
            if crate::log::want_log("debug", "runtime:emitted") {
                crate::log::log("debug", "runtime:emitted");
            }
        }
        // 尝试只读借用 inner：若失败则返回一个空操作回调
        let inner = match self.inner.try_borrow() {
            Ok(i) => i,
            Err(_) => {
                let cb = wasm_bindgen::closure::Closure::wrap(Box::new(
                    move |_evt: JsValue, _args: JsValue| {},
                )
                    as Box<dyn FnMut(JsValue, JsValue)>);
                return cb.into_js_value();
            }
        };
        // props 归一化为 ComponentProps 映射
        let props_map = props_map_from_value(&props);
        // 创建 emitter，并将其捕获到闭包的环境中
        let mut emitter = inner.emitted(&props_map);
        let cb =
            wasm_bindgen::closure::Closure::wrap(Box::new(move |evt: JsValue, args: JsValue| {
                let name = evt.as_string().unwrap_or_default();
                let mut list: Vec<JsValue> = Vec::new();
                // args 若为数组：拆解为参数列表；否则忽略
                if Array::is_array(&args) {
                    let arr = Array::from(&args);
                    for i in 0..arr.length() {
                        list.push(arr.get(i));
                    }
                }
                emitter(name, list);
            })
                as Box<dyn FnMut(JsValue, JsValue)>);
        cb.into_js_value()
    }
}

#[cfg(test)]
// emitted 桥接测试，覆盖重入借用和非标准 props/event name 的容错路径。
mod tests {
    use super::super::createRue;
    use js_sys::{Function, Object};
    use wasm_bindgen::JsCast;
    use wasm_bindgen_test::*;

    use super::*;

    #[wasm_bindgen_test]
    fn emitted_returns_noop_when_runtime_is_already_borrowed() {
        let rue = createRue(JsValue::UNDEFINED);
        let borrow = rue.inner.borrow_mut();
        let emitter: Function = rue.emitted_wasm(Object::new().into()).unchecked_into();

        emitter
            .call2(&JsValue::UNDEFINED, &JsValue::from_str("save"), &JsValue::UNDEFINED)
            .unwrap();
        drop(borrow);
    }

    #[wasm_bindgen_test]
    fn emitted_accepts_non_object_props_and_non_string_event_names() {
        let rue = createRue(JsValue::UNDEFINED);
        let emitter: Function = rue.emitted_wasm(JsValue::from_str("not-props")).unchecked_into();

        emitter.call2(&JsValue::UNDEFINED, &JsValue::from_f64(1.0), &JsValue::NULL).unwrap();
    }

    #[wasm_bindgen_test]
    fn emitted_splits_array_args_for_handler() {
        let rue = createRue(JsValue::UNDEFINED);
        let calls = Array::new();
        let calls_for_handler = calls.clone();
        let handler =
            wasm_bindgen::closure::Closure::wrap(Box::new(move |first: JsValue, second: JsValue| {
                calls_for_handler.push(&first);
                calls_for_handler.push(&second);
            })
                as Box<dyn FnMut(JsValue, JsValue)>);

        let props = Object::new();
        Reflect::set(&props, &JsValue::from_str("onSave"), handler.as_ref()).unwrap();
        let emitter: Function = rue.emitted_wasm(props.into()).unchecked_into();
        let args = Array::new();
        args.push(&JsValue::from_str("payload"));
        args.push(&JsValue::from_f64(3.0));

        emitter.call2(&JsValue::UNDEFINED, &JsValue::from_str("save"), &args.into()).unwrap();

        assert_eq!(calls.length(), 2);
        assert_eq!(calls.get(0).as_string().as_deref(), Some("payload"));
        assert_eq!(calls.get(1).as_f64(), Some(3.0));
        handler.forget();
    }
}
