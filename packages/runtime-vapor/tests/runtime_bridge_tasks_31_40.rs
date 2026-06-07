use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{JsDomAdapter, Rue, createRue};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

mod common;

use common::{
    child_sequence, children_of, first_child_text, setup_anchor, setup_container, tick,
    update_siblings,
};

fn set_prop(target: &Object, key: &str, value: &JsValue) {
    Reflect::set(target, &JsValue::from_str(key), value).unwrap();
}

fn set_fn(target: &Object, key: &str, args: &str, body: &str) {
    set_prop(target, key, &Function::new_with_args(args, body).into());
}

fn get_prop(target: &JsValue, key: &str) -> JsValue {
    Reflect::get(target, &JsValue::from_str(key)).unwrap_or(JsValue::UNDEFINED)
}

fn host_node(tag: &str) -> Object {
    let host = Object::new();
    set_prop(&host, "tag", &JsValue::from_str(tag));
    set_prop(&host, "tagName", &JsValue::from_str(&tag.to_ascii_uppercase()));
    set_prop(&host, "children", &Array::new().into());
    set_prop(&host, "nodeType", &JsValue::from_f64(1.0));
    host
}

fn host_bridge(host: &Object) -> Object {
    let bridge = Object::new();
    set_prop(&bridge, "__rue_host_node", &JsValue::from(host.clone()));
    bridge
}

fn make_observing_adapter() -> JsValue {
    let obj = Object::new();
    let calls = Array::new();
    set_prop(&obj, "__calls", &calls.into());
    set_fn(&obj, "__record", "name,value", "this.__calls.push({ name, value }); return;");
    set_fn(
        &obj,
        "createElement",
        "tag,parent",
        "const doc = globalThis.document || {}; \
         const el = { tag, tagName: String(tag).toUpperCase(), children: [], nodeType: 1, ownerDocument: doc }; \
         if (parent) el.createdIn = parent.tag || 'parent'; \
         this.__record('createElement', tag); \
         return el;",
    );
    set_fn(
        &obj,
        "createTextNode",
        "text",
        "this.__record('createTextNode', text); \
         return { tag: '#text', text, children: [], nodeType: 3 };",
    );
    set_fn(
        &obj,
        "createDocumentFragment",
        "",
        "return { tag: 'fragment', tagName: 'FRAGMENT', children: [], nodeType: 11 };",
    );
    set_fn(&obj, "isFragment", "el", "return !!el && el.tag === 'fragment';");
    set_fn(&obj, "collectFragmentChildren", "el", "return Array.from(el && el.children || []);");
    set_fn(&obj, "setTextContent", "el,text", "el.text = text; this.__record('text', text);");
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
            "{} for (const item of items) insertOne(p, item, null); this.__record('append', c && c.tag);",
            move_helpers
        ),
    );
    set_fn(
        &obj,
        "insertBefore",
        "p,c,b",
        &format!(
            "{} for (const item of items) insertOne(p, item, b); this.__record('insertBefore', c && c.tag);",
            move_helpers
        ),
    );
    set_fn(
        &obj,
        "removeChild",
        "p,c",
        "p.children = (p.children || []).filter(x => x !== c); if (c) c.parentNode = null; this.__record('remove', c && c.tag);",
    );
    set_fn(
        &obj,
        "contains",
        "p,c",
        "function has(root, node) { return root === node || Array.from(root && root.children || []).some(ch => has(ch, node)); } return has(p, c);",
    );
    set_fn(&obj, "setClassName", "el,v", "el.class = v; this.__record('class', v);");
    set_fn(
        &obj,
        "patchStyle",
        "el,oldv,newv",
        "el.style = newv; this.__record('style', Object.keys(newv || {}).join(','));",
    );
    set_fn(
        &obj,
        "setInnerHTML",
        "el,html",
        "el.children = []; el.text = html; this.__record('html', html);",
    );
    set_fn(&obj, "setValue", "el,v", "el.value = v; this.__record('value', v);");
    set_fn(&obj, "setChecked", "el,b", "el.checked = !!b; this.__record('checked', !!b);");
    set_fn(&obj, "setDisabled", "el,b", "el.disabled = !!b; this.__record('disabled', !!b);");
    set_fn(&obj, "clearRef", "r", "this.__record('clearRef', !!r);");
    set_fn(&obj, "applyRef", "el,r", "this.__record('applyRef', !!r);");
    set_fn(
        &obj,
        "setAttribute",
        "el,k,v",
        "el.attrs = el.attrs || {}; el.attrs[k] = v; this.__record('attr:' + k, v);",
    );
    set_fn(
        &obj,
        "removeAttribute",
        "el,k",
        "if (el.attrs) delete el.attrs[k]; this.__record('removeAttr', k);",
    );
    set_fn(&obj, "getTagName", "el", "return el && (el.tagName || el.tag || '') || '';");
    set_fn(
        &obj,
        "addEventListener",
        "el,evt,h",
        "el.events = el.events || {}; el.events[evt] = h; this.__record('add:' + evt, true);",
    );
    set_fn(
        &obj,
        "removeEventListener",
        "el,evt,h",
        "if (el.events) delete el.events[evt]; this.__record('remove:' + evt, true);",
    );
    set_fn(
        &obj,
        "hasValueProperty",
        "el",
        "return 'value' in el || el.tag === 'input' || el.tag === 'select';",
    );
    set_fn(
        &obj,
        "isSelectMultiple",
        "el",
        "return el && el.tagName === 'SELECT' && !!el.multiple;",
    );
    set_fn(
        &obj,
        "querySelector",
        "sel",
        "return { tag: sel, tagName: String(sel).toUpperCase(), children: [], nodeType: 1 };",
    );
    obj.into()
}

#[wasm_bindgen_test(async)]
async fn replace_patch_replaces_vapor_host_with_matching_active_input_shape() {
    let adapter = make_observing_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let document = Object::new();
    let old_root = host_node("section");
    set_prop(&old_root, "className", &JsValue::from_str("sidebar-playground old"));
    let old_input = host_node("input");
    set_prop(&old_input, "type", &JsValue::from_str("text"));
    set_prop(&old_input, "selectionStart", &JsValue::from_f64(2.0));
    set_prop(&old_input, "selectionEnd", &JsValue::from_f64(4.0));
    set_prop(&old_input, "selectionDirection", &JsValue::from_str("forward"));
    set_prop(&old_input, "ownerDocument", &document.clone().into());
    set_prop(&document, "activeElement", &old_input.clone().into());
    set_prop(&js_sys::global(), "document", &document.clone().into());
    let old_children = Array::new();
    old_children.push(&old_input);
    set_prop(&old_root, "children", &old_children.into());

    rue.render_wasm(host_bridge(&old_root).into(), container.clone());
    tick().await;

    let new_root = host_node("section");
    set_prop(&new_root, "className", &JsValue::from_str("sidebar-playground new"));
    let new_input = host_node("input");
    set_prop(&new_input, "type", &JsValue::from_str("text"));
    set_prop(&new_input, "ownerDocument", &document.clone().into());
    set_prop(
        &new_input,
        "focus",
        &Function::new_no_args("this.ownerDocument.activeElement = this; this.focused = true;")
            .into(),
    );
    let new_children = Array::new();
    new_children.push(&new_input);
    set_prop(&new_root, "children", &new_children.into());

    set_prop(&js_sys::global(), "__rue_debug_component_patch_enabled__", &JsValue::TRUE);
    rue.render_wasm(host_bridge(&new_root).into(), container.clone());
    tick().await;
    tick().await;

    assert_eq!(child_sequence(&container), vec!["section"]);
    assert!(js_sys::Object::is(&children_of(&container).get(0), &new_root));
    assert!(!js_sys::Object::is(&children_of(&container).get(0), &old_root));
    let records =
        Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_debug_component_patch__"))
            .unwrap_or(JsValue::UNDEFINED);
    if Array::is_array(&records) {
        assert!(Array::from(&records).length() >= 1);
    }
    Reflect::delete_property(
        &js_sys::global(),
        &JsValue::from_str("__rue_debug_component_patch_enabled__"),
    )
    .unwrap();
    Reflect::delete_property(
        &js_sys::global(),
        &JsValue::from_str("__rue_debug_component_patch__"),
    )
    .unwrap();
}

#[wasm_bindgen_test(async)]
async fn anchor_compaction_records_sidebar_debug_for_detached_anchor() {
    let adapter = make_observing_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let global = js_sys::global();
    set_prop(&global, "__rue_debug_compact_enabled__", &JsValue::TRUE);
    let _ = Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact__"));

    let old_host = host_node("aside");
    set_prop(&old_host, "className", &JsValue::from_str("sidebar-playground compacted"));
    rue.render_anchor_wasm(host_bridge(&old_host).into(), parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);
    assert_eq!(child_sequence(&parent), vec!["aside", "comment_anchor"]);

    Reflect::set(&parent, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&anchor, &JsValue::from_str("parentNode"), &JsValue::NULL).unwrap();

    let (next_parent, next_anchor) = setup_anchor(&adapter);
    let next_host = host_node("main");
    rue.render_anchor_wasm(host_bridge(&next_host).into(), next_parent, next_anchor);
    tick().await;

    let records = Reflect::get(&global, &JsValue::from_str("__rue_debug_compact__"))
        .unwrap_or(JsValue::UNDEFINED);
    let records = Array::from(&records);
    assert_eq!(records.length(), 1);
    let record = records.get(0);
    assert_eq!(get_prop(&record, "kind").as_string().as_deref(), Some("anchor"));
    assert_eq!(
        get_prop(&record, "hostClass").as_string().as_deref(),
        Some("sidebar-playground compacted")
    );

    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact_enabled__")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_compact__")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn real_dom_element_mounts_props_events_children_and_removes_unsupported_props() {
    let adapter = make_observing_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let first_props = Object::new();
    set_prop(&first_props, "className", &JsValue::from_str("primary"));
    set_prop(&first_props, "data-info", &Object::new().into());
    set_prop(&first_props, "onClick", &Function::new_no_args("return 'first';").into());
    let first = rue.create_element_wasm(
        JsValue::from_str("button"),
        first_props.into(),
        Array::of1(&JsValue::from_str("save")).into(),
    );
    rue.render_wasm(first, container.clone());
    tick().await;

    let button = children_of(&container).get(0);
    assert_eq!(get_prop(&button, "class").as_string().as_deref(), Some("primary"));
    assert_eq!(first_child_text(&button), "save");
    let attrs = get_prop(&button, "attrs");
    assert_eq!(
        Reflect::get(&attrs, &JsValue::from_str("data-info")).unwrap().as_string().as_deref(),
        Some("[object Object]")
    );

    let second_props = Object::new();
    set_prop(&second_props, "className", &JsValue::from_str("secondary"));
    set_prop(&second_props, "onClick", &Function::new_no_args("return 'second';").into());
    let second = rue.create_element_wasm(
        JsValue::from_str("button"),
        second_props.into(),
        Array::of1(&JsValue::from_str("saved")).into(),
    );
    rue.render_wasm(second, container.clone());
    tick().await;

    let updated = children_of(&container).get(0);
    assert_eq!(get_prop(&updated, "class").as_string().as_deref(), Some("secondary"));
    assert_eq!(first_child_text(&updated), "saved");
    let calls = Array::from(&get_prop(&adapter, "__calls"));
    let names: Vec<String> = calls
        .iter()
        .map(|entry| get_prop(&entry, "name").as_string().unwrap_or_default())
        .collect();
    assert!(names.iter().any(|name| name == "add:click"));
    assert!(names.iter().any(|name| name == "remove:click"));
    assert!(names.iter().any(|name| name == "removeAttr"));
}

#[wasm_bindgen_test(async)]
async fn patch_dispatcher_covers_text_fragment_component_and_replacement_pairs() {
    let adapter = make_observing_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let first = rue.create_element_wasm(
        JsValue::from_str("p"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("one")).into(),
    );
    rue.render_wasm(first, container.clone());
    tick().await;
    let second = rue.create_element_wasm(
        JsValue::from_str("p"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("two")).into(),
    );
    rue.render_wasm(second, container.clone());
    tick().await;
    assert_eq!(first_child_text(&children_of(&container).get(0)), "two");

    let fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of2(&JsValue::from_str("left"), &JsValue::from_str("right")).into(),
    );
    rue.render_wasm(fragment, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["left", "right"]);

    let component = Function::new_no_args(
        "return { __rue_host_node: { tag: 'article', tagName: 'ARTICLE', nodeType: 1, children: [] } };",
    );
    let component_vnode = rue.create_component_wasm(component.into(), JsValue::UNDEFINED);
    rue.render_wasm(component_vnode, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["article"]);

    let raw_unsupported = Object::new();
    set_prop(&raw_unsupported, "type", &JsValue::from_str("legacy-raw"));
    rue.render_wasm(raw_unsupported.into(), container.clone());
    tick().await;
    assert_eq!(children_of(&container).length(), 0);
}

#[wasm_bindgen_test(async)]
async fn patch_dispatcher_replaces_when_existing_key_is_removed() {
    let adapter = make_observing_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let keyed_props = Object::new();
    set_prop(&keyed_props, "key", &JsValue::from_str("stable-before"));
    let keyed = rue.create_element_wasm(
        JsValue::from_str("section"),
        keyed_props.into(),
        Array::of1(&JsValue::from_str("keyed")).into(),
    );
    rue.render_wasm(keyed, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["section"]);

    let unkeyed = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("unkeyed")).into(),
    );
    rue.render_wasm(unkeyed, container.clone());
    tick().await;

    let root = children_of(&container).get(0);
    assert_eq!(get_prop(&root, "tag").as_string().as_deref(), Some("section"));
    assert_eq!(first_child_text(&root), "unkeyed");
}

#[wasm_bindgen_test(async)]
async fn shared_bridge_and_get_current_container_cover_success_missing_throw_and_fallbacks() {
    let adapter = make_observing_adapter();
    let rue = createRue(adapter.clone());
    let bridge_container = host_node("bridge-container");
    let bridge = Object::new();
    set_prop(&bridge, "calls", &Array::new().into());
    set_prop(
        &bridge,
        "getCurrentContainer",
        &Function::new_no_args("return this.current || null").into(),
    );
    set_prop(&bridge, "current", &bridge_container.clone().into());
    set_prop(
        &bridge,
        "beginComponentRender",
        &Function::new_with_args("instance", "this.calls.push('begin');").into(),
    );
    set_prop(
        &bridge,
        "endComponentRender",
        &Function::new_no_args("this.calls.push('end');").into(),
    );
    set_prop(
        &bridge,
        "pushCurrentContainer",
        &Function::new_with_args("container", "this.calls.push('push'); this.current = container;")
            .into(),
    );
    set_prop(
        &bridge,
        "popCurrentContainer",
        &Function::new_no_args("this.calls.push('pop'); this.current = null;").into(),
    );
    set_prop(
        &bridge,
        "propsReactive",
        &Function::new_with_args("initial", "initial.fromBridge = true; return initial;").into(),
    );
    set_prop(&js_sys::global(), "__rue_runtime_vapor_shared_bridge", &bridge.clone().into());

    assert!(js_sys::Object::is(
        &rue.get_current_container_wasm(),
        &bridge_container.clone().into()
    ));

    let container = setup_container(&adapter);
    let component = Function::new_with_args(
        "props",
        "return { __rue_host_node: { tag: props.fromBridge ? 'bridged' : 'plain', tagName: 'BRIDGED', nodeType: 1, children: [] } };",
    );
    let vnode = rue.create_component_wasm(component.into(), Object::new().into());
    rue.render_wasm(vnode, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["bridged"]);
    let calls: Vec<String> = Array::from(&get_prop(&bridge.clone().into(), "calls"))
        .iter()
        .map(|value| value.as_string().unwrap_or_default())
        .collect();
    assert!(calls.iter().any(|call| call == "begin"));
    assert!(calls.iter().any(|call| call == "push"));
    assert!(calls.iter().any(|call| call == "pop"));
    assert!(calls.iter().any(|call| call == "end"));

    set_prop(
        &bridge,
        "getCurrentContainer",
        &Function::new_no_args("throw new Error('no current container');").into(),
    );
    assert!(rue.get_current_container_wasm().is_object());

    Reflect::delete_property(
        &js_sys::global(),
        &JsValue::from_str("__rue_runtime_vapor_shared_bridge"),
    )
    .unwrap();
    let fresh = createRue(adapter.clone());
    assert!(fresh.get_current_container_wasm().is_undefined());
    let host = host_node("main");
    fresh.render_wasm(host_bridge(&host).into(), container.clone());
    tick().await;
    assert!(js_sys::Object::is(&fresh.get_current_container_wasm(), &container));
    fresh.render_wasm(JsValue::NULL, container.clone());
    tick().await;
    assert!(js_sys::Object::is(&fresh.get_current_container_wasm(), &container));
}

#[wasm_bindgen_test(async)]
async fn shared_bridge_public_paths_ignore_non_function_methods() {
    let adapter = make_observing_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let bridge = Object::new();
    for method in [
        "beginComponentRender",
        "endComponentRender",
        "pushCurrentContainer",
        "popCurrentContainer",
        "disposeComponent",
        "propsReactive",
        "getCurrentContainer",
    ] {
        set_prop(&bridge, method, &JsValue::from_str("not-a-function"));
    }
    set_prop(&js_sys::global(), "__rue_runtime_vapor_shared_bridge", &bridge.into());

    assert!(rue.get_current_container_wasm().is_undefined());

    let component = Function::new_with_args(
        "props",
        "return { __rue_host_node: { tag: props.fromBridge ? 'bridged' : 'plain', tagName: 'PLAIN', nodeType: 1, children: [] } };",
    );
    let vnode = rue.create_component_wasm(component.into(), Object::new().into());
    rue.render_wasm(vnode, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["plain"]);

    rue.render_wasm(JsValue::NULL, container.clone());
    tick().await;
    assert!(child_sequence(&container).is_empty());

    Reflect::delete_property(
        &js_sys::global(),
        &JsValue::from_str("__rue_runtime_vapor_shared_bridge"),
    )
    .unwrap();
}

#[wasm_bindgen_test(async)]
async fn core_runtime_handles_create_repeat_mount_unmount_and_empty_container_paths() {
    let core = Rue::<JsDomAdapter>::new();
    assert_eq!(core.container_mount_count(), 0);
    assert_eq!(core.anchor_mount_count(), 0);
    assert_eq!(core.range_mount_count(), 0);
    assert!(core.get_dom_adapter().is_none());

    let adapter = make_observing_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let app = Function::new_no_args(
        "return { __rue_host_node: { tag: 'root', tagName: 'ROOT', nodeType: 1, children: [] } };",
    );

    rue.mount_wasm(app.clone().into(), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["root"]);

    rue.mount_wasm(app.into(), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["root"]);

    rue.unmount_wasm(container.clone());
    assert_eq!(children_of(&container).length(), 0);
    rue.unmount_wasm(container.clone());
    assert_eq!(children_of(&container).length(), 0);

    let empty = setup_container(&adapter);
    rue.mount_wasm(JsValue::UNDEFINED, empty.clone());
    tick().await;
    assert_eq!(children_of(&empty).length(), 0);
}
