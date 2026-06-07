/*
共享运行时桥

有些能力由 JS 侧共享 runtime 维护，例如当前组件渲染栈、当前容器栈、props reactive 与组件销毁。
Rust 侧通过全局 `__rue_runtime_vapor_shared_bridge` 软调用这些方法：
- 若桥不存在，直接跳过，保证纯 Rust/测试环境可运行
- 若方法存在，按名称反射调用，避免 Rust 与 JS 共享层强耦合
*/
use js_sys::{Function, Object, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

const SHARED_BRIDGE_KEY: &str = "__rue_runtime_vapor_shared_bridge";

fn bridge_object() -> Option<Object> {
    let global = js_sys::global();
    let value =
        Reflect::get(&global, &JsValue::from_str(SHARED_BRIDGE_KEY)).unwrap_or(JsValue::UNDEFINED);
    if value.is_object() { Some(Object::from(value)) } else { None }
}

fn call_bridge_method0(name: &str) {
    let Some(bridge) = bridge_object() else {
        return;
    };
    let value = Reflect::get(&bridge, &JsValue::from_str(name)).unwrap_or(JsValue::UNDEFINED);
    let Some(func) = value.dyn_ref::<Function>() else {
        return;
    };
    let _ = func.call0(&bridge);
}

fn call_bridge_method0_result(name: &str) -> Option<JsValue> {
    let bridge = bridge_object()?;
    let value = Reflect::get(&bridge, &JsValue::from_str(name)).unwrap_or(JsValue::UNDEFINED);
    let func = value.dyn_ref::<Function>()?;
    func.call0(&bridge).ok()
}

fn call_bridge_method1(name: &str, arg: &JsValue) {
    let Some(bridge) = bridge_object() else {
        return;
    };
    let value = Reflect::get(&bridge, &JsValue::from_str(name)).unwrap_or(JsValue::UNDEFINED);
    let Some(func) = value.dyn_ref::<Function>() else {
        return;
    };
    let _ = func.call1(&bridge, arg);
}

fn call_bridge_method1_result(name: &str, arg: &JsValue) -> Option<JsValue> {
    let bridge = bridge_object()?;
    let value = Reflect::get(&bridge, &JsValue::from_str(name)).unwrap_or(JsValue::UNDEFINED);
    let func = value.dyn_ref::<Function>()?;
    func.call1(&bridge, arg).ok()
}

pub(crate) fn begin_component_render(instance: &JsValue) {
    call_bridge_method1("beginComponentRender", instance);
}

pub(crate) fn end_component_render() {
    call_bridge_method0("endComponentRender");
}

pub(crate) fn push_current_container(container: &JsValue) {
    call_bridge_method1("pushCurrentContainer", container);
}

pub(crate) fn pop_current_container() {
    call_bridge_method0("popCurrentContainer");
}

pub(crate) fn get_current_container() -> Option<JsValue> {
    call_bridge_method0_result("getCurrentContainer")
        .filter(|value| !value.is_undefined() && !value.is_null())
}

pub(crate) fn dispose_component(instance: &JsValue) {
    call_bridge_method1("disposeComponent", instance);
}

pub(crate) fn props_reactive(initial: &JsValue) -> Option<JsValue> {
    call_bridge_method1_result("propsReactive", initial)
}

#[cfg(test)]
mod tests {
    use super::*;
    use js_sys::{Array, Function, Object, Reflect};
    use wasm_bindgen_test::*;

    fn set_prop(target: &Object, key: &str, value: &JsValue) {
        Reflect::set(target, &JsValue::from_str(key), value).unwrap();
    }

    fn clear_bridge() {
        Reflect::delete_property(&js_sys::global(), &JsValue::from_str(SHARED_BRIDGE_KEY)).unwrap();
    }

    #[wasm_bindgen_test]
    fn bridge_methods_are_soft_optional_and_convert_return_values() {
        clear_bridge();
        begin_component_render(&JsValue::from_str("missing"));
        end_component_render();
        assert!(get_current_container().is_none());
        assert!(props_reactive(&JsValue::from_str("plain")).is_none());

        let bridge = Object::new();
        set_prop(&bridge, "calls", &Array::new().into());
        set_prop(&bridge, "current", &JsValue::from_str("container"));
        set_prop(
            &bridge,
            "beginComponentRender",
            &Function::new_with_args("instance", "this.calls.push('begin:' + instance);").into(),
        );
        set_prop(
            &bridge,
            "endComponentRender",
            &Function::new_no_args("this.calls.push('end');").into(),
        );
        set_prop(
            &bridge,
            "pushCurrentContainer",
            &Function::new_with_args(
                "container",
                "this.calls.push('push'); this.current = container;",
            )
            .into(),
        );
        set_prop(
            &bridge,
            "popCurrentContainer",
            &Function::new_no_args("this.calls.push('pop'); this.current = null;").into(),
        );
        set_prop(
            &bridge,
            "disposeComponent",
            &Function::new_with_args("instance", "this.calls.push('dispose:' + instance);").into(),
        );
        set_prop(
            &bridge,
            "getCurrentContainer",
            &Function::new_no_args("return this.current;").into(),
        );
        set_prop(
            &bridge,
            "propsReactive",
            &Function::new_with_args("initial", "return { wrapped: initial };").into(),
        );
        set_prop(&js_sys::global(), SHARED_BRIDGE_KEY, &bridge.clone().into());

        begin_component_render(&JsValue::from_str("one"));
        push_current_container(&JsValue::from_str("two"));
        assert_eq!(
            get_current_container().and_then(|value| value.as_string()).as_deref(),
            Some("two")
        );
        pop_current_container();
        end_component_render();
        dispose_component(&JsValue::from_str("dead"));

        let wrapped = props_reactive(&JsValue::from_str("props")).unwrap();
        assert_eq!(
            Reflect::get(&wrapped, &JsValue::from_str("wrapped")).unwrap().as_string().as_deref(),
            Some("props")
        );

        let calls = Array::from(&Reflect::get(&bridge, &JsValue::from_str("calls")).unwrap());
        let labels: Vec<String> =
            calls.iter().map(|value| value.as_string().unwrap_or_default()).collect();
        assert_eq!(labels, vec!["begin:one", "push", "pop", "end", "dispose:dead"]);

        set_prop(
            &bridge,
            "getCurrentContainer",
            &Function::new_no_args("throw new Error('boom');").into(),
        );
        set_prop(
            &bridge,
            "propsReactive",
            &Function::new_no_args("throw new Error('boom');").into(),
        );
        assert!(get_current_container().is_none());
        assert!(props_reactive(&JsValue::from_str("props")).is_none());

        set_prop(&bridge, "beginComponentRender", &JsValue::from_str("not a function"));
        begin_component_render(&JsValue::from_str("ignored"));
        set_prop(&bridge, "endComponentRender", &JsValue::from_str("not a function"));
        end_component_render();
        set_prop(&bridge, "disposeComponent", &JsValue::from_str("not a function"));
        dispose_component(&JsValue::from_str("ignored"));
        clear_bridge();
    }
}
