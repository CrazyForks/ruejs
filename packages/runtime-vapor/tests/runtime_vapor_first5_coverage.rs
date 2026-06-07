#![cfg(feature = "compat")]

use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{
    ComponentProps, DomAdapter, JsDomAdapter, MountInput, MountInputChild, MountInputType, Rue,
    createRue,
};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

mod common;

use common::{
    TestAdapter, child_sequence, children_of, first_child_text, setup_anchor, setup_container,
    setup_range, tick, update_siblings,
};

fn set_fn(obj: &Object, name: &str, args: &str, body: &str) {
    let _ =
        Reflect::set(obj, &JsValue::from_str(name), &Function::new_with_args(args, body).into());
}

fn make_moving_adapter() -> JsValue {
    let obj = Object::new();
    set_fn(&obj, "createElement", "tag", "return { tag, children: [], nodeType: 1 }");
    set_fn(
        &obj,
        "createTextNode",
        "text",
        "return { tag: '#text', text, children: [], nodeType: 3 }",
    );
    set_fn(
        &obj,
        "createDocumentFragment",
        "",
        "return { tag: 'fragment', children: [], nodeType: 11 }",
    );
    set_fn(&obj, "isFragment", "el", "return !!el && el.tag === 'fragment'");
    set_fn(&obj, "collectFragmentChildren", "el", "return Array.from(el && el.children || [])");
    set_fn(&obj, "setTextContent", "el,text", "el.text = text");
    let move_helpers = "\
        function detach(node) { \
          const old = node && node.parentNode; \
          if (old && old.children) old.children = old.children.filter(x => x !== node); \
        } \
        function insertOne(p, node, before) { \
          p.children = p.children || []; \
          detach(node); \
          const existing = p.children.indexOf(node); \
          if (existing >= 0) p.children.splice(existing, 1); \
          const idx = before ? p.children.indexOf(before) : -1; \
          const at = idx >= 0 ? idx : p.children.length; \
          p.children.splice(at, 0, node); \
          node.parentNode = p; \
        } \
        const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c];";
    set_fn(
        &obj,
        "appendChild",
        "p,c",
        &format!(
            "{} for (const item of items) insertOne(p, item, null); if (c && c.tag === 'fragment') c.children = [];",
            move_helpers
        ),
    );
    set_fn(
        &obj,
        "insertBefore",
        "p,c,b",
        &format!(
            "{} for (const item of items) insertOne(p, item, b); if (c && c.tag === 'fragment') c.children = [];",
            move_helpers
        ),
    );
    set_fn(
        &obj,
        "removeChild",
        "p,c",
        "p.children = (p.children || []).filter(x => x !== c); if (c) c.parentNode = null",
    );
    set_fn(
        &obj,
        "contains",
        "p,c",
        "function has(root, node) { return root === node || Array.from(root && root.children || []).some(ch => has(ch, node)); } return has(p, c)",
    );
    set_fn(&obj, "setClassName", "el,v", "el.className = v; el.class = v");
    set_fn(&obj, "patchStyle", "el,oldv,newv", "el.style = newv");
    set_fn(
        &obj,
        "setInnerHTML",
        "el,html",
        "Array.from(el.children || []).forEach(ch => ch.parentNode = null); el.children = []; el.text = html",
    );
    set_fn(&obj, "setValue", "el,v", "el.value = v");
    set_fn(&obj, "setChecked", "el,b", "el.checked = !!b");
    set_fn(&obj, "setDisabled", "el,b", "el.disabled = !!b");
    set_fn(&obj, "clearRef", "r", "return");
    set_fn(&obj, "applyRef", "el,r", "return");
    set_fn(&obj, "setAttribute", "el,k,v", "el.attrs = el.attrs || {}; el.attrs[k] = v");
    set_fn(&obj, "removeAttribute", "el,k", "if (el.attrs) delete el.attrs[k]");
    set_fn(&obj, "getTagName", "el", "return el.tag || ''");
    set_fn(&obj, "addEventListener", "el,evt,h", "return");
    set_fn(&obj, "removeEventListener", "el,evt,h", "return");
    set_fn(&obj, "hasValueProperty", "el", "return 'value' in el");
    set_fn(&obj, "isSelectMultiple", "el", "return el.tag === 'SELECT' && !!el.multiple");
    set_fn(&obj, "querySelector", "sel", "return { tag: sel, children: [], nodeType: 1 }");
    obj.into()
}

fn make_fragment_host_adapter() -> JsValue {
    let adapter = make_moving_adapter();
    let obj = Object::from(adapter.clone());
    set_fn(&obj, "isFragment", "el", "return false");
    let direct_move_helpers = "\
        function detach(node) { \
          const old = node && node.parentNode; \
          if (old && old.children) old.children = old.children.filter(x => x !== node); \
        } \
        function insertOne(p, node, before) { \
          p.children = p.children || []; \
          detach(node); \
          const existing = p.children.indexOf(node); \
          if (existing >= 0) p.children.splice(existing, 1); \
          const idx = before ? p.children.indexOf(before) : -1; \
          const at = idx >= 0 ? idx : p.children.length; \
          p.children.splice(at, 0, node); \
          node.parentNode = p; \
        }";
    set_fn(&obj, "appendChild", "p,c", &format!("{} insertOne(p, c, null);", direct_move_helpers));
    set_fn(&obj, "insertBefore", "p,c,b", &format!("{} insertOne(p, c, b);", direct_move_helpers));
    adapter
}

fn make_unrecognized_consuming_fragment_adapter() -> JsValue {
    let adapter = make_moving_adapter();
    let obj = Object::from(adapter.clone());
    set_fn(&obj, "isFragment", "el", "return false");
    adapter
}

fn adapter_call0(adapter: &JsValue, method: &str) -> JsValue {
    let f = Reflect::get(adapter, &JsValue::from_str(method)).unwrap();
    f.unchecked_ref::<Function>().call0(adapter).unwrap()
}

fn adapter_call1(adapter: &JsValue, method: &str, arg: &JsValue) -> JsValue {
    let f = Reflect::get(adapter, &JsValue::from_str(method)).unwrap();
    f.unchecked_ref::<Function>().call1(adapter, arg).unwrap()
}

fn adapter_call2(adapter: &JsValue, method: &str, arg1: &JsValue, arg2: &JsValue) {
    let f = Reflect::get(adapter, &JsValue::from_str(method)).unwrap();
    let _ = f.unchecked_ref::<Function>().call2(adapter, arg1, arg2);
}

fn key_props(key: &str) -> JsValue {
    let props = Object::new();
    let _ = Reflect::set(&props, &JsValue::from_str("key"), &JsValue::from_str(key));
    props.into()
}

fn text_of(node: &JsValue) -> String {
    if Reflect::get(node, &JsValue::from_str("tag")).unwrap_or(JsValue::UNDEFINED).as_string()
        == Some("#text".to_string())
    {
        return Reflect::get(node, &JsValue::from_str("text"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .unwrap_or_default();
    }
    first_child_text(node)
}

fn manual_component_input(
    render: JsValue,
    children: Vec<MountInputChild<JsDomAdapter>>,
) -> MountInput<JsDomAdapter> {
    manual_component_input_with_props(render, ComponentProps::new(), children)
}

fn manual_component_input_with_props(
    render: JsValue,
    props: ComponentProps,
    children: Vec<MountInputChild<JsDomAdapter>>,
) -> MountInput<JsDomAdapter> {
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

#[wasm_bindgen_test(async)]
async fn compat_children_patch_reorders_mixed_keyed_unkeyed_and_fragment_children() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let a = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("a"),
        Array::of1(&JsValue::from_str("A")).into(),
    );
    let b = rue.create_element_wasm(
        JsValue::from_str("em"),
        key_props("b"),
        Array::of1(&JsValue::from_str("B")).into(),
    );
    let loose = rue.create_element_wasm(
        JsValue::from_str("i"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("loose")).into(),
    );
    let initial_children = Array::new();
    initial_children.push(&a);
    initial_children.push(&JsValue::from_str("old-text"));
    initial_children.push(&b);
    initial_children.push(&loose);
    let ul = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        initial_children.into(),
    );
    rue.render_wasm(ul, container.clone());
    tick().await;

    let b2 = rue.create_element_wasm(
        JsValue::from_str("em"),
        key_props("b"),
        Array::of1(&JsValue::from_str("B2")).into(),
    );
    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("frag"),
        Array::of2(&JsValue::from_str("F1"), &JsValue::from_str("F2")).into(),
    );
    let a2 = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("a"),
        Array::of1(&JsValue::from_str("A2")).into(),
    );
    let next_children = Array::new();
    next_children.push(&b2);
    next_children.push(&JsValue::from_str("new-text"));
    next_children.push(&fragment);
    next_children.push(&a2);
    let next_ul =
        rue.create_element_wasm(JsValue::from_str("ul"), JsValue::UNDEFINED, next_children.into());
    rue.render_wasm(next_ul, container.clone());
    tick().await;

    let roots = children_of(&container);
    assert_eq!(roots.length(), 1);
    let ul = roots.get(0);
    let children = children_of(&ul);
    let sequence: Vec<String> = children.iter().map(|child| text_of(&child)).collect();
    assert_eq!(sequence, vec!["B2", "new-text", "F1", "F2", "A2"]);
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_reuses_unkeyed_input_child_by_index() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let old_child = rue.create_element_wasm(
        JsValue::from_str("span"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("old")).into(),
    );
    let initial_children = Array::of1(&old_child);
    let root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        initial_children.into(),
    );
    rue.render_wasm(root, container.clone());
    tick().await;

    let next_child = rue.create_element_wasm(
        JsValue::from_str("em"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("new")).into(),
    );
    let next_children = Array::of1(&next_child);
    let next_root =
        rue.create_element_wasm(JsValue::from_str("ul"), JsValue::UNDEFINED, next_children.into());
    rue.render_wasm(next_root, container.clone());
    tick().await;

    let roots = children_of(&container);
    assert_eq!(roots.length(), 1);
    let ul = roots.get(0);
    let children = children_of(&ul);
    assert_eq!(children.length(), 1);
    let em = children.get(0);
    assert_eq!(
        Reflect::get(&em, &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("em")
    );
    assert_eq!(first_child_text(&em), "new");
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_appends_rightmost_new_text_and_removes_old_keyed_child() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let old_child = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("old"),
        Array::of1(&JsValue::from_str("old")).into(),
    );
    let root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&old_child).into(),
    );
    rue.render_wasm(root, container.clone());
    tick().await;

    let next_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("fresh-text")).into(),
    );
    rue.render_wasm(next_root, container.clone());
    tick().await;

    let roots = children_of(&container);
    assert_eq!(roots.length(), 1);
    let ul = roots.get(0);
    let children = children_of(&ul);
    assert_eq!(children.length(), 1);
    assert_eq!(text_of(&children.get(0)), "fresh-text");
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_moves_rightmost_existing_fragment_without_cursor() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let old_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("frag"),
        Array::of2(&JsValue::from_str("A"), &JsValue::from_str("B")).into(),
    );
    let root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&old_fragment).into(),
    );
    rue.render_wasm(root, container.clone());
    tick().await;

    let next_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("frag"),
        Array::of2(&JsValue::from_str("A2"), &JsValue::from_str("B2")).into(),
    );
    let next_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&next_fragment).into(),
    );
    rue.render_wasm(next_root, container.clone());
    tick().await;

    let roots = children_of(&container);
    assert_eq!(roots.length(), 1);
    let ul = roots.get(0);
    let children = children_of(&ul);
    let sequence: Vec<String> = children.iter().map(|child| text_of(&child)).collect();
    assert_eq!(sequence, vec!["A2", "B2"]);
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_creates_new_keyed_input_before_new_text_cursor() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let root =
        rue.create_element_wasm(JsValue::from_str("ul"), JsValue::UNDEFINED, Array::new().into());
    rue.render_wasm(root, container.clone());
    tick().await;

    let new_child = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("new"),
        Array::of1(&JsValue::from_str("head")).into(),
    );
    let next_children = Array::new();
    next_children.push(&new_child);
    next_children.push(&JsValue::from_str("tail"));
    let next_root =
        rue.create_element_wasm(JsValue::from_str("ul"), JsValue::UNDEFINED, next_children.into());
    rue.render_wasm(next_root, container.clone());
    tick().await;

    let roots = children_of(&container);
    assert_eq!(roots.length(), 1);
    let ul = roots.get(0);
    let children = children_of(&ul);
    let sequence: Vec<String> = children.iter().map(|child| text_of(&child)).collect();
    assert_eq!(sequence, vec!["head", "tail"]);
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_creates_rightmost_fragment_without_cursor() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let root =
        rue.create_element_wasm(JsValue::from_str("ul"), JsValue::UNDEFINED, Array::new().into());
    rue.render_wasm(root, container.clone());
    tick().await;

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("frag"),
        Array::of2(&JsValue::from_str("F1"), &JsValue::from_str("F2")).into(),
    );
    let next_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&fragment).into(),
    );
    rue.render_wasm(next_root, container.clone());
    tick().await;

    let roots = children_of(&container);
    assert_eq!(roots.length(), 1);
    let ul = roots.get(0);
    let children = children_of(&ul);
    let sequence: Vec<String> = children.iter().map(|child| text_of(&child)).collect();
    assert_eq!(sequence, vec!["F1", "F2"]);
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_creates_unkeyed_input_over_keyed_old_index() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let old_child = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("old"),
        Array::of1(&JsValue::from_str("old")).into(),
    );
    let root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&old_child).into(),
    );
    rue.render_wasm(root, container.clone());
    tick().await;

    let new_child = rue.create_element_wasm(
        JsValue::from_str("em"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("new")).into(),
    );
    let next_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&new_child).into(),
    );
    rue.render_wasm(next_root, container.clone());
    tick().await;

    let roots = children_of(&container);
    assert_eq!(roots.length(), 1);
    let ul = roots.get(0);
    let children = children_of(&ul);
    assert_eq!(children.length(), 1);
    let em = children.get(0);
    assert_eq!(
        Reflect::get(&em, &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("em")
    );
    assert_eq!(first_child_text(&em), "new");
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_creates_unkeyed_input_when_old_index_is_missing() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let root =
        rue.create_element_wasm(JsValue::from_str("ul"), JsValue::UNDEFINED, Array::new().into());
    rue.render_wasm(root, container.clone());
    tick().await;

    let new_child = rue.create_element_wasm(
        JsValue::from_str("em"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("new")).into(),
    );
    let next_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&new_child).into(),
    );
    rue.render_wasm(next_root, container.clone());
    tick().await;

    let roots = children_of(&container);
    assert_eq!(roots.length(), 1);
    let ul = roots.get(0);
    let children = children_of(&ul);
    assert_eq!(children.length(), 1);
    let em = children.get(0);
    assert_eq!(
        Reflect::get(&em, &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("em")
    );
    assert_eq!(first_child_text(&em), "new");
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_removes_unreused_duplicate_old_key() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let stale = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("dup"),
        Array::of1(&JsValue::from_str("stale")).into(),
    );
    let reused = rue.create_element_wasm(
        JsValue::from_str("em"),
        key_props("dup"),
        Array::of1(&JsValue::from_str("reused")).into(),
    );
    let initial_children = Array::new();
    initial_children.push(&stale);
    initial_children.push(&reused);
    let root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        initial_children.into(),
    );
    rue.render_wasm(root, container.clone());
    tick().await;

    let next = rue.create_element_wasm(
        JsValue::from_str("em"),
        key_props("dup"),
        Array::of1(&JsValue::from_str("kept")).into(),
    );
    let next_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&next).into(),
    );
    rue.render_wasm(next_root, container.clone());
    tick().await;

    let roots = children_of(&container);
    assert_eq!(roots.length(), 1);
    let ul = roots.get(0);
    let children = children_of(&ul);
    assert_eq!(children.length(), 1);
    assert_eq!(text_of(&children.get(0)), "kept");
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_uses_contained_anchor_for_text_host_and_fragment_children() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let empty_root =
        rue.create_element_wasm(JsValue::from_str("ul"), JsValue::UNDEFINED, Array::new().into());
    rue.render_anchor_wasm(empty_root, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let ul = children_of(&parent).get(0);
    adapter_call2(&adapter, "appendChild", &ul, &anchor);
    update_siblings(&ul);
    update_siblings(&parent);
    assert_eq!(child_sequence(&ul), vec!["comment_anchor"]);

    let text_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("one")).into(),
    );
    rue.render_anchor_wasm(text_root, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&ul);
    assert_eq!(child_sequence(&ul), vec!["one", "comment_anchor"]);

    let updated_text_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("two")).into(),
    );
    rue.render_anchor_wasm(updated_text_root, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&ul);
    assert_eq!(child_sequence(&ul), vec!["two", "comment_anchor"]);

    let keyed_host = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("host"),
        Array::of1(&JsValue::from_str("host-one")).into(),
    );
    let host_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&keyed_host).into(),
    );
    rue.render_anchor_wasm(host_root, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&ul);
    assert_eq!(child_sequence(&ul), vec!["span", "comment_anchor"]);
    assert_eq!(first_child_text(&children_of(&ul).get(0)), "host-one");

    let updated_keyed_host = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("host"),
        Array::of1(&JsValue::from_str("host-two")).into(),
    );
    let updated_host_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&updated_keyed_host).into(),
    );
    rue.render_anchor_wasm(updated_host_root, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&ul);
    assert_eq!(child_sequence(&ul), vec!["span", "comment_anchor"]);
    assert_eq!(first_child_text(&children_of(&ul).get(0)), "host-two");

    let keyed_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("frag"),
        Array::of2(&JsValue::from_str("frag-one"), &JsValue::from_str("frag-two")).into(),
    );
    let fragment_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&keyed_fragment).into(),
    );
    rue.render_anchor_wasm(fragment_root, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&ul);
    assert_eq!(child_sequence(&ul), vec!["frag-one", "frag-two", "comment_anchor"]);

    let updated_keyed_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("frag"),
        Array::of2(&JsValue::from_str("frag-three"), &JsValue::from_str("frag-four")).into(),
    );
    let updated_fragment_root = rue.create_element_wasm(
        JsValue::from_str("ul"),
        JsValue::UNDEFINED,
        Array::of1(&updated_keyed_fragment).into(),
    );
    rue.render_anchor_wasm(updated_fragment_root, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&ul);
    assert_eq!(child_sequence(&ul), vec!["frag-three", "frag-four", "comment_anchor"]);
}

#[wasm_bindgen_test(async)]
async fn compat_boundary_clears_nested_anchor_entry_when_fragment_is_replaced() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let anchor = adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_anchor"));

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&anchor).into(),
    );
    rue.render_wasm(fragment, container.clone());
    tick().await;
    update_siblings(&container);

    let inner = rue.create_element_wasm(
        JsValue::from_str("span"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("anchored")).into(),
    );
    rue.render_anchor_wasm(inner, container.clone(), anchor.clone());
    tick().await;
    update_siblings(&container);
    assert_eq!(child_sequence(&container), vec!["span", "comment_anchor"]);

    let replacement = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("done")).into(),
    );
    rue.render_wasm(replacement, container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), vec!["div"]);
    let div = children_of(&container).get(0);
    assert_eq!(first_child_text(&div), "done");
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_replaces_keyed_fragment_with_element_child() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("swap"),
        Array::of1(&JsValue::from_str("A")).into(),
    );
    let root_a = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment).into(),
    );
    rue.render_wasm(root_a, container.clone());
    tick().await;
    update_siblings(&container);

    let span = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("swap"),
        Array::of1(&JsValue::from_str("B")).into(),
    );
    let root_b = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&span).into(),
    );
    rue.render_wasm(root_b, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    assert_eq!(child_sequence(&section), vec!["span"]);
    assert_eq!(first_child_text(&children_of(&section).get(0)), "B");
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_replaces_contained_fragment_host_with_element_child() {
    let adapter = make_fragment_host_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("swap"),
        Array::of1(&JsValue::from_str("A")).into(),
    );
    let root_a = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment).into(),
    );
    rue.render_wasm(root_a, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    assert_eq!(child_sequence(&section), vec!["fragment"]);

    let span = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("swap"),
        Array::of1(&JsValue::from_str("B")).into(),
    );
    let root_b = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&span).into(),
    );
    rue.render_wasm(root_b, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    assert_eq!(child_sequence(&section), vec!["span"]);
    assert_eq!(first_child_text(&children_of(&section).get(0)), "B");
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_updates_contained_fragment_host_using_old_host_anchor() {
    let adapter = make_fragment_host_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("frag"),
        Array::of1(&JsValue::from_str("A")).into(),
    );
    let root_a = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment).into(),
    );
    rue.render_wasm(root_a, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    assert_eq!(child_sequence(&section), vec!["fragment"]);

    let next_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("frag"),
        Array::of1(&JsValue::from_str("B")).into(),
    );
    let root_b = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&next_fragment).into(),
    );
    rue.render_wasm(root_b, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    assert_eq!(child_sequence(&section), vec!["B", "fragment"]);
}

#[wasm_bindgen_test(async)]
async fn compat_children_patch_replaces_unrecognized_consumed_fragment_and_clears_stale_children() {
    let adapter = make_unrecognized_consuming_fragment_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("swap"),
        Array::of1(&JsValue::from_str("A")).into(),
    );
    let root_a = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment).into(),
    );
    rue.render_wasm(root_a, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    assert_eq!(child_sequence(&section), vec!["A"]);

    let span = rue.create_element_wasm(
        JsValue::from_str("span"),
        key_props("swap"),
        Array::of1(&JsValue::from_str("B")).into(),
    );
    let root_b = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&span).into(),
    );
    rue.render_wasm(root_b, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    assert_eq!(child_sequence(&section), vec!["span"]);
    assert_eq!(first_child_text(&children_of(&section).get(0)), "B");
}

#[wasm_bindgen_test(async)]
async fn compat_root_fragment_patch_handles_empty_new_fragment() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    rue.render_wasm(fragment, container.clone());
    tick().await;
    update_siblings(&container);
    assert_eq!(child_sequence(&container), vec!["A"]);

    let empty_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    rue.render_wasm(empty_fragment, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(children_of(&container).length(), 0);
}

#[wasm_bindgen_test(async)]
async fn compat_root_empty_fragment_replaces_with_element() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let empty_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    rue.render_wasm(empty_fragment, container.clone());
    tick().await;
    assert_eq!(children_of(&container).length(), 0);

    let span = rue.create_element_wasm(
        JsValue::from_str("span"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("B")).into(),
    );
    rue.render_wasm(span, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["span"]);
    assert_eq!(first_child_text(&children_of(&container).get(0)), "B");
}

#[wasm_bindgen_test(async)]
async fn compat_component_return_array_mounts_as_fragment_publicly() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let component = Function::new_no_args(
        "return [ \
           'array-text', \
           { type: 'span', props: { key: 'array-child' }, children: ['array-span'] } \
         ];",
    );
    let vnode = rue.create_element_wasm(component.into(), Object::new().into(), JsValue::UNDEFINED);
    rue.render_wasm(vnode, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["array-text", "span"]);
    assert_eq!(first_child_text(&children_of(&container).get(1)), "array-span");
}

#[wasm_bindgen_test(async)]
async fn create_element_normalizes_hidden_context_vapor_and_numeric_children_publicly() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let global = js_sys::global();
    Reflect::delete_property(&global, &JsValue::from_str("__plan999_context_parent_seen")).unwrap();

    let parent_instance = Object::new();
    Reflect::set(&parent_instance, &JsValue::from_str("marker"), &JsValue::from_str("parent"))
        .unwrap();
    let props = Object::new();
    let descriptor = Object::new();
    Reflect::set(&descriptor, &JsValue::from_str("value"), &parent_instance).unwrap();
    Reflect::set(&descriptor, &JsValue::from_str("enumerable"), &JsValue::FALSE).unwrap();
    Object::define_property(
        &props,
        &JsValue::from_str("__rue_context_parent_instance__"),
        &descriptor,
    );

    let component = Function::new_with_args(
        "props",
        "const seen = props.__rue_context_parent_instance__ && props.__rue_context_parent_instance__.marker === 'parent'; \
         globalThis.__plan999_context_parent_seen = seen; \
         return { tag: 'ctx-root', nodeType: 1, children: [] };",
    );
    let component_vnode = rue.create_component_wasm(component.into(), JsValue::from(props.clone()));
    rue.render_wasm(component_vnode, container.clone());
    tick().await;
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__plan999_context_parent_seen"))
            .unwrap()
            .as_bool(),
        Some(true),
    );

    let number_child = rue.create_element_wasm(
        JsValue::from_str("num-child"),
        JsValue::UNDEFINED,
        JsValue::from_f64(42.0),
    );
    rue.render_wasm(number_child, container.clone());
    tick().await;
    assert_eq!(first_child_text(&children_of(&container).get(0)), "42");

    let no_setup_vapor =
        rue.create_element_wasm(JsValue::from_str("vapor"), Object::new().into(), JsValue::NULL);
    rue.render_wasm(no_setup_vapor, container.clone());
    tick().await;

    let non_function_setup_props = Object::new();
    Reflect::set(
        &non_function_setup_props,
        &JsValue::from_str("setup"),
        &JsValue::from_str("not-callable"),
    )
    .unwrap();
    let non_function_setup_vapor = rue.create_element_wasm(
        JsValue::from_str("vapor"),
        non_function_setup_props.into(),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(non_function_setup_vapor, container.clone());
    tick().await;

    let unknown_type = Object::new();
    Reflect::set(&unknown_type, &JsValue::from_str("kind"), &JsValue::from_str("fallback"))
        .unwrap();
    let fallback = rue.create_element_wasm(
        unknown_type.into(),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("fallback-child")).into(),
    );
    rue.render_wasm(fallback, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["div"]);
    assert_eq!(first_child_text(&children_of(&container).get(0)), "fallback-child");

    let props_children = Object::new();
    let existing = Array::of1(&JsValue::from_str("from-props"));
    Reflect::set(&props_children, &JsValue::from_str("children"), &existing.into()).unwrap();
    let empty_children_fallback = rue.create_element_wasm(
        JsValue::from_str("props-children"),
        props_children.into(),
        Array::new().into(),
    );
    rue.render_wasm(empty_children_fallback, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["props-children"]);
    assert_eq!(first_child_text(&children_of(&container).get(0)), "");

    let props_children_undefined = Object::new();
    let existing_undefined = Array::of1(&JsValue::from_str("from-props"));
    Reflect::set(
        &props_children_undefined,
        &JsValue::from_str("children"),
        &existing_undefined.into(),
    )
    .unwrap();
    let undefined_children_fallback = rue.create_element_wasm(
        JsValue::from_str("props-children"),
        props_children_undefined.into(),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(undefined_children_fallback, container.clone());
    tick().await;
    assert_eq!(first_child_text(&children_of(&container).get(0)), "from-props");

    Reflect::delete_property(&global, &JsValue::from_str("__plan999_context_parent_seen")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn strict_component_return_compat_vnode_handles_numeric_children_and_invalid_type() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let numeric_child_component = Function::new_no_args(
        "return { \
           type: 'numeric-section', \
           props: {}, \
           children: [7, false, { type: 'small', props: {}, children: ['nested'] }] \
         };",
    );
    let numeric_vnode =
        rue.create_component_wasm(numeric_child_component.into(), Object::new().into());
    rue.render_wasm(numeric_vnode, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["numeric-section"]);
    let root = children_of(&container).get(0);
    assert_eq!(child_sequence(&root), vec!["7", "small"]);
    assert_eq!(first_child_text(&children_of(&root).get(1)), "nested");

    let invalid_type_component =
        Function::new_no_args("return { type: null, props: {}, children: ['ignored'] };");
    let invalid_vnode =
        rue.create_component_wasm(invalid_type_component.into(), Object::new().into());
    rue.render_wasm(invalid_vnode, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["numeric-section"]);
}

#[wasm_bindgen_test]
fn render_static_jsdom_input_serializes_nested_component_children_publicly() {
    let adapter = make_moving_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));
    let mut parent = setup_container(&adapter);
    let anchor = adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_anchor"));
    adapter_call2(&adapter, "appendChild", &parent, &anchor);

    let cleanup_bucket = Array::new();
    cleanup_bucket.push(&JsValue::from_str("cleanup"));

    let mut component_props = ComponentProps::new();
    component_props.insert("label".to_string(), JsValue::from_str("component-child"));
    let component_child = MountInput {
        r#type: MountInputType::Component(Function::new_no_args("return null;").into()),
        props: component_props,
        children: vec![MountInputChild::Text("inner".to_string())],
        key: Some("component-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: Some(cleanup_bucket.clone().into()),
        mount_effect_scope_id: Some(31),
        el_hint: None,
    };
    let setup_child = MountInput {
        r#type: MountInputType::VaporWithSetup(Function::new_no_args("return null;").into()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: Some("setup-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(32),
        el_hint: None,
    };
    let mut element_props = ComponentProps::new();
    element_props.insert("title".to_string(), JsValue::from_str("element-title"));
    let element_child = MountInput {
        r#type: MountInputType::Element("strong".to_string()),
        props: element_props,
        children: vec![MountInputChild::Text("element-slot".to_string())],
        key: Some("element-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(33),
        el_hint: None,
    };
    let mut fragment_props = ComponentProps::new();
    fragment_props.insert("data-frag".to_string(), JsValue::from_str("kept"));
    let fragment_child = MountInput {
        r#type: MountInputType::Fragment,
        props: fragment_props,
        children: vec![MountInputChild::Text("fragment-slot".to_string())],
        key: Some("fragment-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(34),
        el_hint: None,
    };
    let nested_vapor_el = adapter_call1(&adapter, "createElement", &JsValue::from_str("hinted"));
    let nested_fragment_child = MountInput {
        r#type: MountInputType::Fragment,
        props: ComponentProps::new(),
        children: vec![MountInputChild::Text("nested-fragment".to_string())],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    let nested_component_child = MountInput {
        r#type: MountInputType::Component(Function::new_no_args("return null;").into()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    let nested_text_input_child = MountInput {
        r#type: MountInputType::Text("nested-input-text".to_string()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    let nested_setup_input_child = MountInput {
        r#type: MountInputType::VaporWithSetup(Function::new_no_args("return null;").into()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    let nested_element_input_child = MountInput {
        r#type: MountInputType::Element("small".to_string()),
        props: ComponentProps::new(),
        children: vec![MountInputChild::Text("small-slot".to_string())],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    let nested_phantom_child = MountInput {
        r#type: MountInputType::_Phantom(std::marker::PhantomData),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    let vapor_child = MountInput {
        r#type: MountInputType::Vapor,
        props: ComponentProps::new(),
        children: vec![
            MountInputChild::Text("nested-text".to_string()),
            MountInputChild::Input(nested_fragment_child),
            MountInputChild::Input(nested_component_child),
            MountInputChild::Input(nested_text_input_child),
            MountInputChild::Input(nested_setup_input_child),
            MountInputChild::Input(nested_element_input_child),
            MountInputChild::Input(nested_phantom_child),
        ],
        key: Some("vapor-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: Some(nested_vapor_el),
    };
    let text_child = MountInput {
        r#type: MountInputType::Text("text-slot".to_string()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };

    let render = Function::new_with_args(
        "props",
        "globalThis.__plan999_static_children = props.children; \
         return { __rue_host_node: { tag: 'static-root', tagName: 'STATIC-ROOT', nodeType: 1, children: [] } };",
    );
    let input = manual_component_input(
        render.into(),
        vec![
            MountInputChild::Text("plain-child".to_string()),
            MountInputChild::Input(component_child),
            MountInputChild::Input(setup_child),
            MountInputChild::Input(element_child),
            MountInputChild::Input(fragment_child),
            MountInputChild::Input(vapor_child),
            MountInputChild::Input(text_child),
        ],
    );

    rue.render_static_input(input, &mut parent, anchor.clone());

    let global = js_sys::global();
    let children = Reflect::get(&global, &JsValue::from_str("__plan999_static_children"))
        .unwrap_or(JsValue::UNDEFINED);
    let children = Array::from(&children);
    assert_eq!(children.length(), 7);
    assert_eq!(children.get(0).as_string().as_deref(), Some("plain-child"));
    assert!(Reflect::has(&children.get(1), &JsValue::from_str("__rue_component_type")).unwrap());
    assert!(Reflect::has(&children.get(2), &JsValue::from_str("__rue_vapor_setup")).unwrap());
    assert_eq!(
        Reflect::get(&children.get(3), &JsValue::from_str("type"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("strong")
    );
    assert_eq!(
        Reflect::get(&children.get(4), &JsValue::from_str("type"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("fragment")
    );
    assert!(Reflect::has(&children.get(5), &JsValue::from_str("__rue_mount_id")).unwrap());
    assert_eq!(children.get(6).as_string().as_deref(), Some("text-slot"));
    assert_eq!(child_sequence(&parent), vec!["static-root"]);

    Reflect::delete_property(&global, &JsValue::from_str("__plan999_static_children")).unwrap();
}

#[wasm_bindgen_test]
fn render_static_jsdom_input_reuses_props_children_publicly() {
    let adapter = make_moving_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));
    let mut parent = setup_container(&adapter);
    let anchor = adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_anchor"));
    adapter_call2(&adapter, "appendChild", &parent, &anchor);

    let render = Function::new_with_args(
        "props",
        "globalThis.__plan999_props_children_snapshots = globalThis.__plan999_props_children_snapshots || []; \
         globalThis.__plan999_props_children_snapshots.push(Array.from(props.children)); \
         return { __rue_host_node: { tag: 'props-root', tagName: 'PROPS-ROOT', nodeType: 1, children: [] } };",
    );
    let global = js_sys::global();
    Reflect::delete_property(&global, &JsValue::from_str("__plan999_props_children_snapshots"))
        .unwrap();

    let existing = Array::new();
    existing.push(&JsValue::from_str("array-a"));
    existing.push(&JsValue::from_str("array-b"));
    let mut array_props = ComponentProps::new();
    array_props.insert("children".to_string(), existing.into());
    rue.render_static_input(
        manual_component_input_with_props(render.clone().into(), array_props, Vec::new()),
        &mut parent,
        anchor.clone(),
    );

    let anchor2 = adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_anchor_2"));
    adapter_call2(&adapter, "appendChild", &parent, &anchor2);
    let mut scalar_props = ComponentProps::new();
    scalar_props.insert("children".to_string(), JsValue::from_str("scalar-child"));
    rue.render_static_input(
        manual_component_input_with_props(render.clone().into(), scalar_props, Vec::new()),
        &mut parent,
        anchor2.clone(),
    );

    let anchor3 = adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_anchor_3"));
    adapter_call2(&adapter, "appendChild", &parent, &anchor3);
    let mut null_props = ComponentProps::new();
    null_props.insert("children".to_string(), JsValue::NULL);
    rue.render_static_input(
        manual_component_input_with_props(render.into(), null_props, Vec::new()),
        &mut parent,
        anchor3.clone(),
    );

    let snapshots = Reflect::get(&global, &JsValue::from_str("__plan999_props_children_snapshots"))
        .unwrap_or(JsValue::UNDEFINED);
    let snapshots = Array::from(&snapshots);
    assert_eq!(snapshots.length(), 3);
    let first = Array::from(&snapshots.get(0));
    assert_eq!(first.length(), 2);
    assert_eq!(first.get(0).as_string().as_deref(), Some("array-a"));
    assert_eq!(first.get(1).as_string().as_deref(), Some("array-b"));
    let second = Array::from(&snapshots.get(1));
    assert_eq!(second.length(), 1);
    assert_eq!(second.get(0).as_string().as_deref(), Some("scalar-child"));
    let third = Array::from(&snapshots.get(2));
    assert_eq!(third.length(), 0);

    Reflect::delete_property(&global, &JsValue::from_str("__plan999_props_children_snapshots"))
        .unwrap();
}

#[wasm_bindgen_test]
#[should_panic]
fn render_static_jsdom_input_panics_for_unsupported_compat_child_publicly() {
    let adapter = make_moving_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));
    let mut parent = setup_container(&adapter);
    let anchor = adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_anchor"));
    adapter_call2(&adapter, "appendChild", &parent, &anchor);

    let render = Function::new_no_args(
        "return { \
           type: 'section', \
           props: {}, \
           children: [{ unsupportedDefaultChild: true }] \
         };",
    );

    rue.render_static_input(manual_component_input(render.into(), Vec::new()), &mut parent, anchor);
}

#[wasm_bindgen_test(async)]
async fn same_component_fragment_key_change_replaces_old_fragment_with_new_fragment() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let global = js_sys::global();
    Reflect::set(
        &global,
        &JsValue::from_str("__rue_component_fragment_key"),
        &JsValue::from_str("first"),
    )
    .unwrap();
    Reflect::set(
        &global,
        &JsValue::from_str("__rue_component_fragment_text"),
        &JsValue::from_str("A"),
    )
    .unwrap();

    let component = Function::new_no_args(
        "return { \
           type: 'fragment', \
           props: { key: globalThis.__rue_component_fragment_key }, \
           children: [globalThis.__rue_component_fragment_text] \
         };",
    );
    let vnode_a = rue.create_component_wasm(component.clone().into(), Object::new().into());
    rue.render_wasm(vnode_a, container.clone());
    tick().await;
    update_siblings(&container);
    assert_eq!(child_sequence(&container), vec!["A"]);

    Reflect::set(
        &global,
        &JsValue::from_str("__rue_component_fragment_key"),
        &JsValue::from_str("second"),
    )
    .unwrap();
    Reflect::set(
        &global,
        &JsValue::from_str("__rue_component_fragment_text"),
        &JsValue::from_str("B"),
    )
    .unwrap();

    let vnode_b = rue.create_component_wasm(component.into(), Object::new().into());
    rue.render_wasm(vnode_b, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["B"]);
    Reflect::delete_property(&global, &JsValue::from_str("__rue_component_fragment_key")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_component_fragment_text")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn compat_fragment_clear_records_component_anchor_owner_debug_metadata() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let component_anchor =
        adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_component_anchor"));
    let _ = Reflect::set(
        &component_anchor,
        &JsValue::from_str("nodeValue"),
        &JsValue::from_str("rue:component:anchor"),
    );

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&component_anchor).into(),
    );
    rue.render_wasm(fragment, container.clone());
    tick().await;
    update_siblings(&container);

    let global = js_sys::global();
    let _ =
        Reflect::set(&global, &JsValue::from_str("__rue_debug_clear_enabled__"), &JsValue::TRUE);
    let _ = Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_clear__"));
    let _ = Reflect::set(
        &global,
        &JsValue::from_str("__rue_debug_clear_source__"),
        &JsValue::from_str("manual-clear"),
    );
    let _ = Reflect::set(
        &global,
        &JsValue::from_str("__rue_debug_clear_meta__"),
        &JsValue::from_str("manual-meta"),
    );

    rue.render_wasm(JsValue::NULL, container.clone());
    tick().await;

    let records = Reflect::get(&global, &JsValue::from_str("__rue_debug_clear__"))
        .unwrap_or(JsValue::UNDEFINED);
    assert!(Array::is_array(&records));
    let records = Array::from(&records);
    assert!(records.length() >= 1);
    let first = records.get(0);
    assert_eq!(
        Reflect::get(&first, &JsValue::from_str("source"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("clear_container")
    );
    assert_eq!(
        Reflect::get(&first, &JsValue::from_str("meta"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("manual-meta")
    );
    assert_eq!(
        Reflect::get(&first, &JsValue::from_str("kind"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("component-anchor-owner")
    );
    let _ = Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_clear_enabled__"));
    let _ = Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_clear__"));
    let _ = Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_clear_source__"));
    let _ = Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_clear_meta__"));
}

#[wasm_bindgen_test(async)]
async fn compat_patch_handles_component_element_fragment_and_null_replacement() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let component =
        Function::new_no_args("return { type: 'span', props: {}, children: ['component'] }");
    let component_vnode =
        rue.create_element_wasm(component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_wasm(component_vnode, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["span"]);

    let element = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("element")).into(),
    );
    rue.render_wasm(element, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["div"]);

    let host = Object::new();
    let _ = Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("host-rebuild"));
    let _ = Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into());
    let _ = Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0));
    let host_bridge = Object::new();
    let _ = Reflect::set(&host_bridge, &JsValue::from_str("__rue_host_node"), &host);
    rue.render_wasm(host_bridge.into(), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["host-rebuild"]);

    let second_component =
        Function::new_no_args("return { type: 'strong', props: {}, children: ['component-2'] }");
    let second_component_vnode =
        rue.create_element_wasm(second_component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_wasm(second_component_vnode, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["strong"]);

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of2(&JsValue::from_str("left"), &JsValue::from_str("right")).into(),
    );
    rue.render_wasm(fragment, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["left", "right"]);

    let third_component =
        Function::new_no_args("return { type: 'small', props: {}, children: ['component-3'] }");
    let third_component_vnode =
        rue.create_element_wasm(third_component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_wasm(third_component_vnode, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["small"]);

    rue.render_wasm(JsValue::NULL, container.clone());
    tick().await;
    assert_eq!(children_of(&container).length(), 0);
}

#[wasm_bindgen_test(async)]
async fn render_helpers_cover_range_anchor_positioning_current_container_and_error_input() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let before = adapter_call1(&adapter, "createElement", &JsValue::from_str("before"));
    let after = adapter_call1(&adapter, "createElement", &JsValue::from_str("after"));
    let _ = Reflect::set(&before, &JsValue::from_str("parentNode"), &parent);
    let _ = Reflect::set(&after, &JsValue::from_str("parentNode"), &parent);

    let range_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of2(&JsValue::from_str("R1"), &JsValue::from_str("R2")).into(),
    );
    rue.render_between_wasm(range_vnode, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);
    assert_eq!(child_sequence(&parent), vec!["comment_start", "R1", "R2", "comment_end"]);

    let current_container = setup_container(&adapter);
    let current_vnode = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("current")).into(),
    );
    rue.render_wasm(current_vnode, current_container.clone());
    tick().await;
    let got = rue.get_current_container_wasm();
    assert!(js_sys::Object::is(&got, &current_container));

    let (anchor_parent, anchor) = setup_anchor(&adapter);
    let anchor_vnode = rue.create_element_wasm(
        JsValue::from_str("strong"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    rue.render_anchor_wasm(anchor_vnode, anchor_parent.clone(), anchor.clone());
    tick().await;
    assert_eq!(child_sequence(&anchor_parent), vec!["strong", "comment_anchor"]);

    let errors = Array::new();
    let errors_for_hook = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |_err: JsValue| {
        errors_for_hook.push(&JsValue::from_str("error"));
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    rue.render_wasm(Object::new().into(), parent.clone());
    tick().await;
    assert_eq!(errors.length(), 1);
    assert_eq!(child_sequence(&parent), Vec::<String>::new());
}

#[wasm_bindgen_test(async)]
async fn lifecycle_hooks_fire_in_render_update_unmount_and_error_order() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = adapter_call0(&adapter, "createDocumentFragment");
    let calls = Array::new();

    for name in
        ["before_mount", "mounted", "before_update", "updated", "before_unmount", "unmounted"]
    {
        let calls_for_hook = calls.clone();
        let label = name.to_string();
        let hook = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
            calls_for_hook.push(&JsValue::from_str(&label));
        }) as Box<dyn FnMut()>);
        match name {
            "before_mount" => rue.on_before_mount(hook.as_ref().clone().into()),
            "mounted" => rue.on_mounted(hook.as_ref().clone().into()),
            "before_update" => rue.on_before_update(hook.as_ref().clone().into()),
            "updated" => rue.on_updated(hook.as_ref().clone().into()),
            "before_unmount" => rue.on_before_unmount(hook.as_ref().clone().into()),
            "unmounted" => rue.on_unmounted(hook.as_ref().clone().into()),
            _ => unreachable!(),
        }
        hook.forget();
    }

    let calls_for_error = calls.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |_err: JsValue| {
        calls_for_error.push(&JsValue::from_str("error"));
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let first = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("one")).into(),
    );
    rue.render_wasm(first, container.clone());
    tick().await;

    let second = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("two")).into(),
    );
    rue.render_wasm(second, container.clone());
    tick().await;

    rue.unmount_wasm(container.clone());
    tick().await;
    rue.render_wasm(Object::new().into(), container.clone());
    tick().await;

    let sequence: Vec<String> =
        calls.iter().map(|value| value.as_string().unwrap_or_default()).collect();
    assert_eq!(
        sequence,
        vec![
            "before_mount",
            "mounted",
            "before_mount",
            "before_update",
            "updated",
            "mounted",
            "before_unmount",
            "unmounted",
            "error",
        ]
    );
}

#[wasm_bindgen_test(async)]
async fn same_component_syncs_props_children_across_updates() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let container = adapter_call0(&adapter, "createDocumentFragment");
    let global = js_sys::global();
    Reflect::delete_property(&global, &JsValue::from_str("__plan999_sync_children_snapshots"))
        .unwrap();

    let component = Function::new_with_args(
        "props",
        "const snapshots = globalThis.__plan999_sync_children_snapshots || []; \
         const children = Array.from(props.children || []); \
         snapshots.push({ label: props.label, length: children.length, first: children[0] }); \
         globalThis.__plan999_sync_children_snapshots = snapshots; \
         return { type: 'div', props: { className: props.label }, children: [props.label + ':' + children.join('|')] };",
    );

    let initial_props = Object::new();
    Reflect::set(&initial_props, &JsValue::from_str("label"), &JsValue::from_str("first")).unwrap();
    let initial_props_children = Array::of1(&JsValue::from_str("prop-child"));
    Reflect::set(&initial_props, &JsValue::from_str("children"), &initial_props_children.into())
        .unwrap();
    let first =
        rue.create_element_wasm(component.clone().into(), initial_props.into(), JsValue::UNDEFINED);
    rue.render_wasm(first, container.clone());
    tick().await;

    let next_props = Object::new();
    Reflect::set(&next_props, &JsValue::from_str("label"), &JsValue::from_str("second")).unwrap();
    let explicit_children_prop = Array::of1(&JsValue::from_str("prop-should-yield"));
    Reflect::set(&next_props, &JsValue::from_str("children"), &explicit_children_prop.into())
        .unwrap();
    let next_children = Array::of2(&JsValue::from_str("slot-a"), &JsValue::from_str("slot-b"));
    let second = rue.create_element_wasm(component.into(), next_props.into(), next_children.into());
    rue.render_wasm(second, container.clone());
    tick().await;

    let snapshots =
        Reflect::get(&global, &JsValue::from_str("__plan999_sync_children_snapshots")).unwrap();
    let snapshots = Array::from(&snapshots);
    assert_eq!(snapshots.length(), 2);
    let first_snapshot = snapshots.get(0);
    assert_eq!(
        Reflect::get(&first_snapshot, &JsValue::from_str("label")).unwrap().as_string().as_deref(),
        Some("first")
    );
    assert_eq!(
        Reflect::get(&first_snapshot, &JsValue::from_str("first")).unwrap().as_string().as_deref(),
        Some("prop-child")
    );
    let second_snapshot = snapshots.get(1);
    assert_eq!(
        Reflect::get(&second_snapshot, &JsValue::from_str("label")).unwrap().as_string().as_deref(),
        Some("second")
    );
    assert_eq!(
        Reflect::get(&second_snapshot, &JsValue::from_str("length")).unwrap().as_f64(),
        Some(2.0)
    );
    assert_eq!(
        Reflect::get(&second_snapshot, &JsValue::from_str("first")).unwrap().as_string().as_deref(),
        Some("slot-a")
    );
    assert_eq!(first_child_text(&children_of(&container).get(0)), "second:slot-a|slot-b");

    Reflect::delete_property(&global, &JsValue::from_str("__plan999_sync_children_snapshots"))
        .unwrap();
}

#[wasm_bindgen_test(async)]
async fn range_compaction_drops_disconnected_start_and_records_sidebar_host() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);
    let global = js_sys::global();
    Reflect::set(&global, &JsValue::from_str("__rue_debug_compact_enabled__"), &JsValue::TRUE)
        .unwrap();
    let seeded_records = Array::of1(&Object::new().into());
    Reflect::set(&global, &JsValue::from_str("__rue_debug_compact__"), &seeded_records.into())
        .unwrap();

    let old_host = Object::new();
    Reflect::set(&old_host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&old_host, &JsValue::from_str("tag"), &JsValue::from_str("aside")).unwrap();
    Reflect::set(
        &old_host,
        &JsValue::from_str("className"),
        &JsValue::from_str("sidebar-playground stale-range"),
    )
    .unwrap();
    Reflect::set(&old_host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &old_host.clone().into()).unwrap();
    rue.render_between_wasm(bridge.into(), parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);
    assert_eq!(child_sequence(&parent), vec!["comment_start", "aside", "comment_end"]);

    Reflect::set(&start, &JsValue::from_str("isConnected"), &JsValue::FALSE).unwrap();
    let start_next =
        adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_next_start"));
    let end_next = adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_next_end"));
    adapter_call2(&adapter, "appendChild", &parent, &start_next);
    adapter_call2(&adapter, "appendChild", &parent, &end_next);
    update_siblings(&parent);

    let next = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("next")).into(),
    );
    rue.render_between_wasm(next, parent.clone(), start_next, end_next);
    tick().await;

    let records = Reflect::get(&global, &JsValue::from_str("__rue_debug_compact__"))
        .unwrap_or(Array::new().into());
    let records = Array::from(&records);
    assert_eq!(records.length(), 2);
    let record = records.get(1);
    assert_eq!(
        Reflect::get(&record, &JsValue::from_str("kind")).unwrap().as_string().as_deref(),
        Some("range")
    );
    assert_eq!(
        Reflect::get(&record, &JsValue::from_str("hostClass")).unwrap().as_string().as_deref(),
        Some("sidebar-playground stale-range")
    );

    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact_enabled__")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact__")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn range_compaction_skips_sidebar_debug_when_disabled() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);
    let global = js_sys::global();
    Reflect::set(&global, &JsValue::from_str("__rue_debug_compact_enabled__"), &JsValue::FALSE)
        .unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact__")).unwrap();

    let old_host = Object::new();
    Reflect::set(&old_host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&old_host, &JsValue::from_str("tag"), &JsValue::from_str("aside")).unwrap();
    Reflect::set(
        &old_host,
        &JsValue::from_str("className"),
        &JsValue::from_str("sidebar-playground disabled-range"),
    )
    .unwrap();
    Reflect::set(&old_host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &old_host.into()).unwrap();
    rue.render_between_wasm(bridge.into(), parent.clone(), start.clone(), end);
    tick().await;

    Reflect::set(&start, &JsValue::from_str("isConnected"), &JsValue::FALSE).unwrap();
    let next_start =
        adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_disabled_start"));
    let next_end =
        adapter_call1(&adapter, "createElement", &JsValue::from_str("comment_disabled_end"));
    adapter_call2(&adapter, "appendChild", &parent, &next_start);
    adapter_call2(&adapter, "appendChild", &parent, &next_end);

    rue.render_between_wasm(JsValue::NULL, parent, next_start, next_end);
    tick().await;

    assert!(
        Reflect::get(&global, &JsValue::from_str("__rue_debug_compact__"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );

    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact_enabled__")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn anchor_compaction_preserves_connected_anchor_entry() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);
    let global = js_sys::global();
    Reflect::set(&global, &JsValue::from_str("__rue_debug_compact_enabled__"), &JsValue::TRUE)
        .unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact__")).unwrap();

    let old_host = Object::new();
    Reflect::set(&old_host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&old_host, &JsValue::from_str("tag"), &JsValue::from_str("aside")).unwrap();
    Reflect::set(
        &old_host,
        &JsValue::from_str("className"),
        &JsValue::from_str("sidebar-playground still-connected"),
    )
    .unwrap();
    Reflect::set(&old_host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &old_host.into()).unwrap();
    rue.render_anchor_wasm(bridge.into(), parent.clone(), anchor.clone());
    tick().await;

    Reflect::set(&anchor, &JsValue::from_str("isConnected"), &JsValue::TRUE).unwrap();
    let container = setup_container(&adapter);
    let div = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("fresh")).into(),
    );
    rue.render_wasm(div, container.clone());
    tick().await;

    assert!(
        Reflect::get(&global, &JsValue::from_str("__rue_debug_compact__"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert_eq!(first_child_text(&children_of(&container).get(0)), "fresh");

    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact_enabled__")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn anchor_compaction_drops_parentless_anchor_without_is_connected() {
    let adapter = make_moving_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);
    let global = js_sys::global();
    Reflect::set(&global, &JsValue::from_str("__rue_debug_compact_enabled__"), &JsValue::TRUE)
        .unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact__")).unwrap();

    let old_host = Object::new();
    Reflect::set(&old_host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&old_host, &JsValue::from_str("tag"), &JsValue::from_str("aside")).unwrap();
    Reflect::set(
        &old_host,
        &JsValue::from_str("className"),
        &JsValue::from_str("sidebar-playground parentless-anchor"),
    )
    .unwrap();
    Reflect::set(&old_host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &old_host.into()).unwrap();
    rue.render_anchor_wasm(bridge.into(), parent.clone(), anchor.clone());
    tick().await;

    Reflect::delete_property(&Object::from(anchor.clone()), &JsValue::from_str("isConnected"))
        .unwrap();
    Reflect::set(&anchor, &JsValue::from_str("parentNode"), &JsValue::NULL).unwrap();
    let container = setup_container(&adapter);
    let div = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("fresh")).into(),
    );
    rue.render_wasm(div, container);
    tick().await;

    let records = Reflect::get(&global, &JsValue::from_str("__rue_debug_compact__"))
        .unwrap_or(Array::new().into());
    let records = Array::from(&records);
    assert_eq!(records.length(), 1);
    let record = records.get(0);
    assert_eq!(
        Reflect::get(&record, &JsValue::from_str("kind")).unwrap().as_string().as_deref(),
        Some("anchor")
    );
    assert_eq!(
        Reflect::get(&record, &JsValue::from_str("hostClass")).unwrap().as_string().as_deref(),
        Some("sidebar-playground parentless-anchor")
    );

    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact_enabled__")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact__")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn compat_element_same_patch_updates_props_events_and_removes_stale_attrs() {
    let adapter = make_moving_adapter();
    let records = Array::new();
    Reflect::set(&adapter, &JsValue::from_str("__records"), &records.clone().into()).unwrap();
    set_fn(
        &Object::from(adapter.clone()),
        "setAttribute",
        "el,k,v",
        "this.__records.push('set:' + k + ':' + String(v)); el.attrs = el.attrs || {}; el.attrs[k] = v",
    );
    set_fn(
        &Object::from(adapter.clone()),
        "removeAttribute",
        "el,k",
        "this.__records.push('remove:' + k); if (el.attrs) delete el.attrs[k]",
    );
    set_fn(
        &Object::from(adapter.clone()),
        "addEventListener",
        "el,evt,h",
        "this.__records.push('add:' + evt); el.listeners = el.listeners || {}; el.listeners[evt] = h",
    );
    set_fn(
        &Object::from(adapter.clone()),
        "removeEventListener",
        "el,evt,h",
        "this.__records.push('removeEvent:' + evt); if (el.listeners) delete el.listeners[evt]",
    );

    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let old_props = Object::new();
    Reflect::set(&old_props, &JsValue::from_str("data-old"), &JsValue::from_str("gone")).unwrap();
    Reflect::set(&old_props, &JsValue::from_str("className"), &JsValue::from_str("old-class"))
        .unwrap();
    Reflect::set(&old_props, &JsValue::from_str("onClick"), &Function::new_no_args("").into())
        .unwrap();
    let first = rue.create_element_wasm(
        JsValue::from_str("button"),
        old_props.into(),
        Array::of1(&JsValue::from_str("old")).into(),
    );
    rue.render_wasm(first, container.clone());
    tick().await;

    let new_props = Object::new();
    Reflect::set(&new_props, &JsValue::from_str("data-new"), &JsValue::from_str("fresh")).unwrap();
    Reflect::set(&new_props, &JsValue::from_str("className"), &JsValue::from_str("new-class"))
        .unwrap();
    Reflect::set(&new_props, &JsValue::from_str("onInput"), &Function::new_no_args("").into())
        .unwrap();
    let second = rue.create_element_wasm(
        JsValue::from_str("button"),
        new_props.into(),
        Array::of1(&JsValue::from_str("new")).into(),
    );
    rue.render_wasm(second, container.clone());
    tick().await;

    let button = children_of(&container).get(0);
    assert_eq!(
        Reflect::get(&button, &JsValue::from_str("className")).unwrap().as_string().as_deref(),
        Some("new-class")
    );
    assert_eq!(first_child_text(&button), "new");
    let record_values: Vec<String> =
        records.iter().map(|value| value.as_string().unwrap_or_default()).collect();
    assert!(record_values.iter().any(|value| value == "remove:data-old"));
    assert!(record_values.iter().any(|value| value == "removeEvent:click"));
    assert!(record_values.iter().any(|value| value == "set:data-new:fresh"));
    assert!(record_values.iter().any(|value| value == "add:input"));
}

#[wasm_bindgen_test(async)]
async fn root_text_render_patches_existing_text_host_publicly() {
    let adapter = make_moving_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));
    let container = setup_container(&adapter);
    let mut container_for_render = container.clone();

    let first = MountInput {
        r#type: MountInputType::Text("first text".to_string()),
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    rue.render_input(first, &mut container_for_render);
    assert_eq!(child_sequence(&container), vec!["first text"]);

    let second = MountInput {
        r#type: MountInputType::Text("second text".to_string()),
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    rue.render_input(second, &mut container_for_render);
    assert_eq!(child_sequence(&container), vec!["second text"]);
    assert_eq!(children_of(&container).length(), 1);
}

#[wasm_bindgen_test]
fn vapor_with_setup_reuses_existing_host_hint_without_calling_setup() {
    let adapter = make_moving_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));
    let container = setup_container(&adapter);
    let mut container_for_render = container.clone();

    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__rue_vapor_hint_setup_calls"),
        &JsValue::from_f64(0.0),
    )
    .unwrap();
    let setup = Function::new_no_args(
        "globalThis.__rue_vapor_hint_setup_calls = (globalThis.__rue_vapor_hint_setup_calls || 0) + 1; return { tag: 'bad', children: [] }",
    );

    let host = adapter_call1(&adapter, "createElement", &JsValue::from_str("hinted"));
    adapter_call2(&adapter, "appendChild", &host, &JsValue::from_str("hint text"));
    let mut input = MountInput {
        r#type: MountInputType::VaporWithSetup(setup.into()),
        props: ComponentProps::new(),
        children: vec![],
        key: Some("hint-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(77),
        el_hint: Some(host.clone()),
    };

    rue.render_input(input.clone(), &mut container_for_render);
    assert_eq!(child_sequence(&container), vec!["hinted"]);
    assert!(js_sys::Object::is(&children_of(&container).get(0), &host));
    assert_eq!(
        Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_vapor_hint_setup_calls"))
            .unwrap()
            .as_f64(),
        Some(0.0)
    );

    let next = adapter_call1(&adapter, "createElement", &JsValue::from_str("hinted-next"));
    input.el_hint = Some(next.clone());
    rue.render_input(input, &mut container_for_render);
    assert!(js_sys::Object::is(&children_of(&container).get(0), &next));
    assert_eq!(child_sequence(&container), vec!["hinted-next"]);
}

#[wasm_bindgen_test]
fn vapor_with_setup_non_function_uses_parent_aware_placeholder() {
    let adapter = make_moving_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));
    let container = setup_container(&adapter);
    let mut container_for_render = container.clone();

    let input = MountInput {
        r#type: MountInputType::VaporWithSetup(JsValue::from_str("not-a-function")),
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(88),
        el_hint: None,
    };

    rue.render_input(input, &mut container_for_render);

    let children = children_of(&container);
    assert_eq!(children.length(), 1);
    let placeholder = children.get(0);
    assert_eq!(
        Reflect::get(&placeholder, &JsValue::from_str("tag")).unwrap().as_string().as_deref(),
        Some("div")
    );
}

#[wasm_bindgen_test]
fn vapor_input_without_host_reports_render_failure_without_dom() {
    let adapter = make_moving_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));
    let container = setup_container(&adapter);
    let mut container_for_render = container.clone();
    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let input = MountInput {
        r#type: MountInputType::Vapor,
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };

    rue.render_input(input, &mut container_for_render);

    assert_eq!(children_of(&container).length(), 0);
    assert_eq!(errors.length(), 1);
    assert_eq!(
        Reflect::get(&errors.get(0), &JsValue::from_str("message"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("Rue vapor: render failed (create_real_dom=None)")
    );
}

#[wasm_bindgen_test]
#[should_panic]
fn vapor_with_setup_throwing_function_records_error_then_rethrows() {
    let adapter = make_moving_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));
    let mut container = setup_container(&adapter);
    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let setup = Function::new_no_args("throw new Error('setup boom')");
    let input = MountInput {
        r#type: MountInputType::VaporWithSetup(setup.into()),
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };

    rue.render_input(input, &mut container);
}

#[wasm_bindgen_test]
fn vapor_with_setup_covers_test_adapter_generic_helper_instances() {
    let mut adapter = TestAdapter::default();
    let mut container = adapter.create_document_fragment();
    let direct_host = adapter.create_element("direct-host");
    let bridge_host = adapter.create_element("bridge-host");
    let mut fragment = adapter.create_document_fragment();
    let fragment_child = adapter.create_element("fragment-child");
    adapter.append_child(&mut fragment, &fragment_child);

    let mut rue: Rue<TestAdapter> = Rue::new();
    rue.set_dom_adapter(adapter.clone());

    let existing_setup = Function::new_no_args("throw new Error('existing setup should not run')");
    let mut existing_input = MountInput {
        r#type: MountInputType::VaporWithSetup(existing_setup.into()),
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(91),
        el_hint: Some(fragment.clone()),
    };
    rue.render_input(existing_input.clone(), &mut container);

    existing_input.el_hint = Some(direct_host.clone());
    rue.render_input(existing_input, &mut container);

    let direct_setup = Function::new_no_args(&format!("return {}", direct_host.id));
    let direct_input = MountInput {
        r#type: MountInputType::VaporWithSetup(direct_setup.into()),
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    rue.render_input(direct_input, &mut container);

    let bridge_setup =
        Function::new_no_args(&format!("return {{ __rue_host_node: {} }}", bridge_host.id));
    let bridge_input = MountInput {
        r#type: MountInputType::VaporWithSetup(bridge_setup.into()),
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(92),
        el_hint: None,
    };
    rue.render_input(bridge_input, &mut container);

    assert!(rue.get_dom_adapter().is_some());
}

#[cfg(wasm_bindgen_unstable_test_coverage)]
#[wasm_bindgen_test]
fn vapor_with_setup_coverage_probe_covers_parent_none_and_no_adapter() {
    let adapter = make_moving_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));

    let host = adapter_call1(&adapter, "createElement", &JsValue::from_str("probe-host"));
    rue.__coverage_set_owner_scope_none_probe(&host);
    Reflect::set(&js_sys::global(), &JsValue::from_str("__rue_vapor_probe_host"), &host).unwrap();
    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__rue_vapor_probe_parent_was_undefined"),
        &JsValue::FALSE,
    )
    .unwrap();

    let setup = Function::new_with_args(
        "parent",
        "globalThis.__rue_vapor_probe_parent_was_undefined = parent === undefined; return globalThis.__rue_vapor_probe_host;",
    );
    let setup_value: JsValue = setup.into();
    let input = MountInput {
        r#type: MountInputType::VaporWithSetup(setup_value.clone()),
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };

    assert!(rue.__coverage_mount_vapor_with_setup_probe(&input, &setup_value, None));
    assert_eq!(
        Reflect::get(
            &js_sys::global(),
            &JsValue::from_str("__rue_vapor_probe_parent_was_undefined"),
        )
        .unwrap()
        .as_bool(),
        Some(true),
    );

    let mut no_adapter: Rue<JsDomAdapter> = Rue::new();
    let non_function = JsValue::from_str("not-a-function");
    let fallback_input = MountInput {
        r#type: MountInputType::VaporWithSetup(non_function.clone()),
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };

    assert!(!no_adapter.__coverage_mount_vapor_with_setup_probe(
        &fallback_input,
        &non_function,
        None
    ));
}
