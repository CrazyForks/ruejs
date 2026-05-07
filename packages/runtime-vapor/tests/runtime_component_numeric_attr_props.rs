use js_sys::{Function, Object, Reflect};
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

mod common;

use common::{children_of, make_vapor_only_adapter as make_adapter, tick};

fn attr_string(node: &JsValue, name: &str) -> String {
    let attrs = Reflect::get(node, &JsValue::from_str("attrs")).unwrap_or_else(|_| Object::new().into());
    Reflect::get(&attrs, &JsValue::from_str(name))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default()
}

#[wasm_bindgen_test(async)]
async fn component_numeric_props_keep_dom_attribute_values() {
    let adapter = make_adapter();
    let rue = createRue(adapter);
    let container = Object::new();

    let component = Function::new_with_args(
        "props",
        "return { \
            type: 'input', \
            props: { \
                minLength: props.minLength, \
                maxLength: props.maxLength, \
                placeholder: props.placeholder \
            }, \
            children: [] \
        };",
    );

    let props_a = Object::new();
    let _ = Reflect::set(&props_a, &JsValue::from_str("minLength"), &JsValue::from_f64(3.0));
    let _ = Reflect::set(&props_a, &JsValue::from_str("maxLength"), &JsValue::from_f64(30.0));
    let _ = Reflect::set(&props_a, &JsValue::from_str("placeholder"), &JsValue::from_str("Username"));

    let vnode_a = rue.create_component_wasm(component.clone().into(), props_a.into());
    rue.render_wasm(vnode_a, container.clone().into());
    tick().await;

    let children_a = children_of(&container.clone().into());
    assert_eq!(children_a.length(), 1);
    let input_a = children_a.get(0);
    let tag_a = Reflect::get(&input_a, &JsValue::from_str("tag"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default();
    assert_eq!(tag_a, "input");
    assert_eq!(attr_string(&input_a, "minLength"), "3");
    assert_eq!(attr_string(&input_a, "maxLength"), "30");
    assert_eq!(attr_string(&input_a, "placeholder"), "Username");

    let props_b = Object::new();
    let _ = Reflect::set(&props_b, &JsValue::from_str("minLength"), &JsValue::from_f64(5.0));
    let _ = Reflect::set(&props_b, &JsValue::from_str("maxLength"), &JsValue::from_f64(50.0));
    let _ = Reflect::set(&props_b, &JsValue::from_str("placeholder"), &JsValue::from_str("Reviewer"));

    let vnode_b = rue.create_component_wasm(component.into(), props_b.into());
    rue.render_wasm(vnode_b, container.clone().into());
    tick().await;

    let children_b = children_of(&container.clone().into());
    assert_eq!(children_b.length(), 1);
    let input_b = children_b.get(0);
    assert_eq!(attr_string(&input_b, "minLength"), "5");
    assert_eq!(attr_string(&input_b, "maxLength"), "50");
    assert_eq!(attr_string(&input_b, "placeholder"), "Reviewer");
}