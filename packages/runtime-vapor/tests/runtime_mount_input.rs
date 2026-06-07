//! 默认 MountInput-first Rust 入口测试
//!
//! 覆盖 render / anchor / between / static 四类默认公开渲染入口，
//! 确保默认公开面不需要显式构造历史 compat 对象输出。
use crate::common::TestAdapter;
use js_sys::{Array, Function, Reflect};
use rue_runtime_vapor::{
    ComponentProps, DomAdapter, MountInput, MountInputChild, MountInputType, Rue,
};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

mod common;

fn text_input(text: &str) -> MountInput<TestAdapter> {
    MountInput {
        r#type: MountInputType::Text(text.to_string()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

fn compat_element_input(
    tag: &str,
    children: Vec<MountInputChild<TestAdapter>>,
) -> MountInput<TestAdapter> {
    MountInput {
        r#type: MountInputType::Element(tag.to_string()),
        props: ComponentProps::new(),
        children,
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

fn fragment_input(children: Vec<MountInputChild<TestAdapter>>) -> MountInput<TestAdapter> {
    MountInput {
        r#type: MountInputType::Fragment,
        props: ComponentProps::new(),
        children,
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

fn component_input(render: wasm_bindgen::JsValue) -> MountInput<TestAdapter> {
    MountInput {
        r#type: MountInputType::Component(render),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

fn component_input_with_children(
    render: JsValue,
    children: Vec<MountInputChild<TestAdapter>>,
) -> MountInput<TestAdapter> {
    component_input_with_props_and_children(render, ComponentProps::new(), children)
}

fn component_input_with_props_and_children(
    render: JsValue,
    props: ComponentProps,
    children: Vec<MountInputChild<TestAdapter>>,
) -> MountInput<TestAdapter> {
    MountInput {
        r#type: MountInputType::Component(render),
        props,
        children,
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

fn append_host_children(
    rue: &mut Rue<TestAdapter>,
    parent: &mut <TestAdapter as DomAdapter>::Element,
    children: Vec<MountInputChild<TestAdapter>>,
) {
    for child in children {
        match child {
            MountInputChild::Text(text) => {
                let node = rue.get_dom_adapter_mut().unwrap().create_text_node(&text);
                rue.get_dom_adapter_mut().unwrap().append_child(parent, &node);
            }
            MountInputChild::Input(input) => match input.r#type {
                MountInputType::Text(text) => {
                    let node = rue.get_dom_adapter_mut().unwrap().create_text_node(&text);
                    rue.get_dom_adapter_mut().unwrap().append_child(parent, &node);
                }
                _ => panic!("unsupported no-compat test child input"),
            },
        }
    }
}

fn element_input(
    rue: &mut Rue<TestAdapter>,
    tag: &str,
    children: Vec<MountInputChild<TestAdapter>>,
) -> MountInput<TestAdapter> {
    let mut host = rue.get_dom_adapter_mut().unwrap().create_element(tag);
    append_host_children(rue, &mut host, children);

    MountInput {
        r#type: MountInputType::Vapor,
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: Some(host),
    }
}

fn vapor_without_host_input() -> MountInput<TestAdapter> {
    MountInput {
        r#type: MountInputType::Vapor,
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

#[wasm_bindgen_test]
fn render_input_mounts_element_tree_without_vnode() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut container = rue.get_dom_adapter_mut().unwrap().create_document_fragment();

    let input = element_input(&mut rue, "div", vec![MountInputChild::Text("hello".into())]);
    rue.render_input(input, &mut container);

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&container);
    assert_eq!(children.len(), 1);
    assert_eq!(children[0].tag, "div");
    let div_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&children[0]);
    assert_eq!(div_children.len(), 1);
    assert_eq!(div_children[0].tag, "#text");
    assert_eq!(div_children[0].text, "hello");
    assert_eq!(rue.container_mount_count(), 1);
}

#[wasm_bindgen_test]
fn render_anchor_input_records_anchor_mount_without_vnode() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let input = element_input(&mut rue, "span", vec![MountInputChild::Text("A".into())]);
    rue.render_anchor_input(input, &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.tag == "comment_anchor"));
    assert!(children.iter().any(|node| node.tag == "span"));
    assert_eq!(rue.anchor_mount_count(), 1);
}

#[wasm_bindgen_test]
fn render_anchor_input_replaces_text_snapshot_with_element_input() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    rue.render_anchor_input(text_input("plain"), &mut parent, anchor.clone());

    let next = compat_element_input("strong", vec![MountInputChild::Text("rich".to_string())]);
    rue.render_anchor_input(next, &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(!children.iter().any(|node| node.tag == "#text" && node.text == "plain"));
    let strong = children.iter().find(|node| node.tag == "strong").expect("strong mounted");
    let strong_children = rue.get_dom_adapter().unwrap().collect_fragment_children(strong);
    assert!(strong_children.iter().any(|node| node.tag == "#text" && node.text == "rich"));
    assert!(children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn render_anchor_input_replaces_fragment_snapshot_with_element_input() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let fragment = fragment_input(vec![
        MountInputChild::Text("frag-text".to_string()),
        MountInputChild::Input(compat_element_input(
            "em",
            vec![MountInputChild::Text("frag-child".to_string())],
        )),
    ]);
    rue.render_anchor_input(fragment, &mut parent, anchor.clone());

    let next =
        compat_element_input("strong", vec![MountInputChild::Text("replacement".to_string())]);
    rue.render_anchor_input(next, &mut parent, anchor);

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(!children.iter().any(|node| node.tag == "#text" && node.text == "frag-text"));
    assert!(!children.iter().any(|node| node.tag == "em"));
    let strong = children.iter().find(|node| node.tag == "strong").expect("strong mounted");
    let strong_children = rue.get_dom_adapter().unwrap().collect_fragment_children(strong);
    assert!(strong_children.iter().any(|node| node.tag == "#text" && node.text == "replacement"));
}

#[wasm_bindgen_test]
fn render_anchor_input_fragment_skips_child_input_without_host() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let fragment = fragment_input(vec![
        MountInputChild::Input(vapor_without_host_input()),
        MountInputChild::Text("survives".to_string()),
    ]);
    rue.render_anchor_input(fragment, &mut parent, anchor);

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.tag == "#text" && node.text == "survives"));
    assert_eq!(children.iter().filter(|node| node.tag == "#text").count(), 1);
}

#[wasm_bindgen_test]
fn render_between_input_records_range_mount_without_vnode() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let start = rue.get_dom_adapter_mut().unwrap().create_element("comment_start");
    let end = rue.get_dom_adapter_mut().unwrap().create_element("comment_end");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &start);
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &end);

    let input = element_input(&mut rue, "span", vec![MountInputChild::Text("B".into())]);
    rue.render_between_input(input, &mut parent, start.clone(), end.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.tag == "comment_start"));
    assert!(children.iter().any(|node| node.tag == "comment_end"));
    assert!(children.iter().any(|node| node.tag == "span"));
    assert_eq!(rue.range_mount_count(), 1);
}

#[wasm_bindgen_test]
fn render_static_input_removes_anchor_without_vnode() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let input = element_input(&mut rue, "span", vec![MountInputChild::Input(text_input("static"))]);
    rue.render_static_input(input, &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(!children.iter().any(|node| node.id == anchor.id));
    assert!(children.iter().any(|node| node.tag == "span"));
}

#[wasm_bindgen_test]
fn render_static_input_mounts_text_and_removes_anchor() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    rue.render_static_input(text_input("plain"), &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(!children.iter().any(|node| node.id == anchor.id));
    assert!(children.iter().any(|node| node.tag == "#text" && node.text == "plain"));
    assert_eq!(rue.range_mount_count(), 0);
}

#[wasm_bindgen_test]
#[should_panic]
fn render_static_input_panics_without_dom_adapter() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    let mut parent = TestAdapter::default().create_document_fragment();
    let anchor = TestAdapter::default().create_element("comment_anchor");

    rue.render_static_input(text_input("plain"), &mut parent, anchor);
}

#[wasm_bindgen_test]
fn render_static_input_handles_unmountable_phantom_and_removes_anchor() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let input = MountInput {
        r#type: MountInputType::_Phantom(std::marker::PhantomData),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    rue.render_static_input(input, &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(!children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn render_static_input_mounts_compat_element_tree() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let input = compat_element_input(
        "section",
        vec![
            MountInputChild::Text("title".to_string()),
            MountInputChild::Input(compat_element_input(
                "strong",
                vec![MountInputChild::Text("child".to_string())],
            )),
        ],
    );
    rue.render_static_input(input, &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    let section = children.iter().find(|node| node.tag == "section").expect("section mounted");
    let section_children = rue.get_dom_adapter().unwrap().collect_fragment_children(section);
    assert!(section_children.iter().any(|node| node.tag == "#text" && node.text == "title"));
    assert!(section_children.iter().any(|node| node.tag == "strong"));
    assert!(!children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn render_static_input_expands_fragment_children_before_removing_anchor() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let input = fragment_input(vec![
        MountInputChild::Text("A".to_string()),
        MountInputChild::Input(compat_element_input(
            "em",
            vec![MountInputChild::Text("B".to_string())],
        )),
    ]);
    rue.render_static_input(input, &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.tag == "#text" && node.text == "A"));
    assert!(children.iter().any(|node| node.tag == "em"));
    assert!(!children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn render_static_input_mounts_component_returning_host_value() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let render = js_sys::Function::new_no_args("return 42");
    rue.render_static_input(component_input(render.into()), &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.id == 42));
    assert!(!children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn render_static_input_reuses_vapor_with_setup_el_hint_without_calling_setup() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);
    let existing = rue.get_dom_adapter_mut().unwrap().create_element("prebuilt-vapor");

    let input = MountInput {
        r#type: MountInputType::VaporWithSetup(
            Function::new_no_args("throw new Error('nope');").into(),
        ),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: Some("setup-hint".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(77),
        el_hint: Some(existing.clone()),
    };

    rue.render_static_input(input, &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.id == existing.id));
    assert!(children.iter().any(|node| node.tag == "prebuilt-vapor"));
    assert!(!children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn render_static_input_mounts_vapor_with_non_function_setup_as_placeholder() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let input = MountInput {
        r#type: MountInputType::VaporWithSetup(JsValue::from_str("not-a-function")),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: Some("setup-placeholder".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(78),
        el_hint: None,
    };

    rue.render_static_input(input, &mut parent, anchor.clone());

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.tag == "div"));
    assert!(!children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn render_static_input_serializes_component_children_for_props_object() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let vapor_child = element_input(&mut rue, "i", vec![MountInputChild::Text("vapor".into())]);
    let render = Function::new_with_args(
        "props",
        "globalThis.__rue_component_children_length = props.children.length; \
         globalThis.__rue_component_children_second = props.children[1]; \
         globalThis.__rue_component_children_third = props.children[2]; \
         return 77;",
    );
    let input = component_input_with_children(
        render.into(),
        vec![
            MountInputChild::Text("slot".to_string()),
            MountInputChild::Input(compat_element_input(
                "strong",
                vec![MountInputChild::Text("compat".to_string())],
            )),
            MountInputChild::Input(vapor_child),
        ],
    );

    rue.render_static_input(input, &mut parent, anchor.clone());

    assert_eq!(
        Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_component_children_length"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_f64(),
        Some(3.0)
    );
    assert!(
        Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_component_children_second"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_object()
    );
    assert!(
        Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_component_children_third"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_object()
    );

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.id == 77));
    assert!(!children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn render_static_input_serializes_portable_child_wrappers_with_metadata() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let cleanup_bucket = Array::new();
    cleanup_bucket.push(&JsValue::from_str("cleanup"));

    let mut child_props = ComponentProps::new();
    child_props.insert("label".to_string(), JsValue::from_str("child"));
    let component_child = MountInput {
        r#type: MountInputType::Component(Function::new_no_args("return null;").into()),
        props: child_props,
        children: vec![MountInputChild::Text("inner".to_string())],
        key: Some("component-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: Some(cleanup_bucket.clone().into()),
        mount_effect_scope_id: Some(21),
        el_hint: None,
    };
    let vapor_setup_child = MountInput {
        r#type: MountInputType::VaporWithSetup(Function::new_no_args("return 91;").into()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: Some("setup-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(22),
        el_hint: None,
    };
    let fragment_child = MountInput {
        r#type: MountInputType::Fragment,
        props: ComponentProps::new(),
        children: vec![MountInputChild::Text("frag-slot".to_string())],
        key: Some("fragment-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(23),
        el_hint: None,
    };
    let render = Function::new_with_args(
        "props",
        "globalThis.__rue_nested_component_child = props.children[0]; \
         globalThis.__rue_nested_setup_child = props.children[1]; \
         globalThis.__rue_nested_fragment_child = props.children[2]; \
         return 78;",
    );
    let input = component_input_with_children(
        render.into(),
        vec![
            MountInputChild::Input(component_child),
            MountInputChild::Input(vapor_setup_child),
            MountInputChild::Input(fragment_child),
        ],
    );

    rue.render_static_input(input, &mut parent, anchor.clone());

    let global = js_sys::global();
    let component =
        Reflect::get(&global, &JsValue::from_str("__rue_nested_component_child")).unwrap();
    assert!(Reflect::has(&component, &JsValue::from_str("__rue_component_type")).unwrap());
    assert_eq!(
        Reflect::get(&component, &JsValue::from_str("key")).unwrap().as_string().as_deref(),
        Some("component-key")
    );
    assert_eq!(
        Reflect::get(&component, &JsValue::from_str("__rue_effect_scope_id")).unwrap().as_f64(),
        Some(21.0)
    );
    let component_props = Reflect::get(&component, &JsValue::from_str("props")).unwrap();
    let component_children =
        Array::from(&Reflect::get(&component_props, &JsValue::from_str("children")).unwrap());
    assert_eq!(component_children.get(0).as_string().as_deref(), Some("inner"));

    let setup = Reflect::get(&global, &JsValue::from_str("__rue_nested_setup_child")).unwrap();
    assert!(Reflect::has(&setup, &JsValue::from_str("__rue_vapor_setup")).unwrap());
    assert_eq!(
        Reflect::get(&setup, &JsValue::from_str("key")).unwrap().as_string().as_deref(),
        Some("setup-key")
    );

    let fragment =
        Reflect::get(&global, &JsValue::from_str("__rue_nested_fragment_child")).unwrap();
    assert_eq!(
        Reflect::get(&fragment, &JsValue::from_str("type")).unwrap().as_string().as_deref(),
        Some("fragment")
    );
    assert_eq!(
        Reflect::get(&fragment, &JsValue::from_str("__rue_effect_scope_id")).unwrap().as_f64(),
        Some(23.0)
    );
    let fragment_children =
        Array::from(&Reflect::get(&fragment, &JsValue::from_str("children")).unwrap());
    assert_eq!(fragment_children.get(0).as_string().as_deref(), Some("frag-slot"));

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.id == 78));
    assert!(!children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn render_static_input_reuses_existing_props_children_when_no_mount_children() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let existing = Array::new();
    existing.push(&JsValue::from_str("existing-a"));
    existing.push(&JsValue::from_str("existing-b"));
    let mut props = ComponentProps::new();
    props.insert("children".to_string(), existing.into());
    let render = Function::new_with_args(
        "props",
        "globalThis.__rue_existing_children_length = props.children.length; \
         globalThis.__rue_existing_children_first = props.children[0]; \
         globalThis.__rue_existing_children_second = props.children[1]; \
         return 79;",
    );

    rue.render_static_input(
        component_input_with_props_and_children(render.into(), props, Vec::new()),
        &mut parent,
        anchor.clone(),
    );

    let global = js_sys::global();
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_existing_children_length"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_f64(),
        Some(2.0)
    );
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_existing_children_first"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("existing-a")
    );
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_existing_children_second"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("existing-b")
    );

    let children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(children.iter().any(|node| node.id == 79));
    assert!(!children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
#[should_panic]
fn render_static_input_panics_for_unsupported_object_inside_component_array_return() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let render =
        Function::new_no_args("return ['before-bad-child', { unsupportedDefaultChild: true }];");

    rue.render_static_input(component_input(render.into()), &mut parent, anchor);
}

#[wasm_bindgen_test]
fn render_text_input_creates_and_reuses_text_host() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut container = rue.get_dom_adapter_mut().unwrap().create_document_fragment();

    rue.render_input(text_input("hello"), &mut container);
    let first_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&container);
    assert_eq!(first_children.len(), 1);
    assert_eq!(first_children[0].tag, "#text");
    assert_eq!(first_children[0].text, "hello");

    rue.render_input(text_input("hello again"), &mut container);
    let second_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&container);
    assert_eq!(second_children.len(), 1);
    assert_eq!(second_children[0].text, "hello again");
}

#[wasm_bindgen_test]
fn render_text_input_handles_empty_text_and_replacement() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut container = rue.get_dom_adapter_mut().unwrap().create_document_fragment();

    rue.render_input(text_input("filled"), &mut container);
    rue.render_input(text_input(""), &mut container);
    let cleared_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&container);
    assert_eq!(cleared_children.len(), 1);
    assert_eq!(cleared_children[0].tag, "#text");
    assert_eq!(cleared_children[0].text, "");

    let element = element_input(&mut rue, "strong", vec![MountInputChild::Text("bold".into())]);
    rue.render_input(element, &mut container);
    let element_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&container);
    assert_eq!(element_children.len(), 1);
    assert_eq!(element_children[0].tag, "strong");
}

#[wasm_bindgen_test]
fn render_anchor_text_input_patches_and_replaces_at_anchor_boundary() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    rue.render_anchor_input(text_input("anchor A"), &mut parent, anchor.clone());
    rue.render_anchor_input(text_input("anchor B"), &mut parent, anchor.clone());

    let patched_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(patched_children.iter().any(|node| node.tag == "#text" && node.text == "anchor B"));

    let element = element_input(&mut rue, "em", vec![MountInputChild::Text("anchor C".into())]);
    rue.render_anchor_input(element, &mut parent, anchor.clone());

    let replaced_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(replaced_children.iter().any(|node| node.tag == "em"));
    assert!(replaced_children.iter().any(|node| node.tag == "comment_anchor"));
}

#[wasm_bindgen_test]
fn render_between_text_input_patches_and_replaces_inside_range() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let start = rue.get_dom_adapter_mut().unwrap().create_element("comment_start");
    let end = rue.get_dom_adapter_mut().unwrap().create_element("comment_end");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &start);
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &end);

    rue.render_between_input(text_input("range A"), &mut parent, start.clone(), end.clone());
    rue.render_between_input(text_input("range B"), &mut parent, start.clone(), end.clone());

    let patched_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(patched_children.iter().any(|node| node.tag == "#text" && node.text == "range B"));

    let element = element_input(&mut rue, "mark", vec![MountInputChild::Text("range C".into())]);
    rue.render_between_input(element, &mut parent, start.clone(), end.clone());

    let replaced_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&parent);
    assert!(replaced_children.iter().any(|node| node.tag == "mark"));
    assert!(replaced_children.iter().any(|node| node.tag == "comment_start"));
    assert!(replaced_children.iter().any(|node| node.tag == "comment_end"));
}

#[wasm_bindgen_test]
#[should_panic]
fn render_input_same_component_rethrows_update_error_after_restoring_context() {
    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(TestAdapter::default());
    let mut container = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let component = Function::new_with_args(
        "props",
        "if (props.fail) throw new Error('plan999 component update boom'); return 82;",
    );

    let mut ok_props = ComponentProps::new();
    ok_props.insert("fail".to_string(), JsValue::FALSE);
    rue.render_input(
        component_input_with_props_and_children(component.clone().into(), ok_props, Vec::new()),
        &mut container,
    );

    let mut failing_props = ComponentProps::new();
    failing_props.insert("fail".to_string(), JsValue::TRUE);
    rue.render_input(
        component_input_with_props_and_children(component.into(), failing_props, Vec::new()),
        &mut container,
    );
}
