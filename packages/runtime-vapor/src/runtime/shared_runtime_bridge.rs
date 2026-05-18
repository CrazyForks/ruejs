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
