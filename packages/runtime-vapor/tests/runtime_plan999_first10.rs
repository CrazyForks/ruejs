#![cfg(feature = "compat")]

use js_sys::{Array, Function, Object, Promise, Reflect, Symbol};
use rue_runtime_vapor::reactive::core::{
    create_detached_effect_scope_wasm, dispose_effect_scope_wasm, pop_effect_scope_wasm,
    push_effect_scope_wasm,
};
use rue_runtime_vapor::reactive::signal::create_ref;
use rue_runtime_vapor::{
    create_effect, create_signal, createRue, next_tick, set_reactive_scheduling,
};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

mod common;

use common::{child_sequence, children_of, first_child_text, setup_anchor, setup_container, tick};

fn set_prop(target: &Object, key: &str, value: JsValue) {
    Reflect::set(target, &JsValue::from_str(key), &value).unwrap();
}

fn set_fn(target: &Object, key: &str, args: &str, body: &str) {
    set_prop(target, key, Function::new_with_args(args, body).into());
}

fn ops() -> Array {
    let key = JsValue::from_str("__plan999_ops");
    let arr = Array::new();
    Reflect::set(&js_sys::global(), &key, &arr).unwrap();
    arr
}

fn recording_adapter() -> JsValue {
    let obj = Object::new();
    let prelude = "\
        const ops = globalThis.__plan999_ops || (globalThis.__plan999_ops = []); \
        function detach(node) { \
          const old = node && node.parentNode; \
          if (old && old.children) old.children = old.children.filter(x => x !== node); \
        } \
        function insertOne(parent, node, before) { \
          parent.children = parent.children || []; \
          detach(node); \
          const idx = before ? parent.children.indexOf(before) : -1; \
          const at = idx >= 0 ? idx : parent.children.length; \
          parent.children.splice(at, 0, node); \
          node.parentNode = parent; \
        }";
    set_fn(
        &obj,
        "createElement",
        "tag",
        "return { tag, tagName: String(tag).toUpperCase(), children: [], nodeType: 1 }",
    );
    set_fn(
        &obj,
        "createTextNode",
        "text",
        "return { tag: '#text', tagName: '#TEXT', text, nodeValue: text, children: [], nodeType: 3 }",
    );
    set_fn(
        &obj,
        "createDocumentFragment",
        "",
        "return { tag: 'fragment', tagName: 'FRAGMENT', children: [], nodeType: 11 }",
    );
    set_fn(&obj, "isFragment", "el", "return !!el && el.tag === 'fragment'");
    set_fn(&obj, "collectFragmentChildren", "el", "return Array.from(el && el.children || [])");
    set_fn(
        &obj,
        "setTextContent",
        "el,text",
        "globalThis.__plan999_ops.push(['text', el.tag, text]); el.text = text; el.nodeValue = text",
    );
    set_fn(
        &obj,
        "appendChild",
        "p,c",
        &format!(
            "{prelude} const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
             for (const item of items) insertOne(p, item, null); \
             if (c && c.tag === 'fragment') c.children = []; \
             ops.push(['append', p.tag, items.map(x => x.tag || x.text).join(',')]);",
        ),
    );
    set_fn(
        &obj,
        "insertBefore",
        "p,c,b",
        &format!(
            "{prelude} const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
             for (const item of items) insertOne(p, item, b); \
             if (c && c.tag === 'fragment') c.children = []; \
             ops.push(['insert', p.tag, items.map(x => x.tag || x.text).join(','), b && (b.tag || b.text)]);",
        ),
    );
    set_fn(
        &obj,
        "removeChild",
        "p,c",
        "globalThis.__plan999_ops.push(['remove', p && p.tag, c && (c.tag || c.text)]); \
         p.children = (p.children || []).filter(x => x !== c); if (c) c.parentNode = null",
    );
    set_fn(
        &obj,
        "contains",
        "p,c",
        "function has(root,node){ return root === node || Array.from(root && root.children || []).some(ch => has(ch,node)); } return has(p,c)",
    );
    set_fn(
        &obj,
        "setClassName",
        "el,v",
        "globalThis.__plan999_ops.push(['class', el.tag, v]); el.className = v; el.class = v",
    );
    set_fn(
        &obj,
        "patchStyle",
        "el,oldv,newv",
        "globalThis.__plan999_ops.push(['style', el.tag, Object.keys(newv || {}).join(',')]); el.style = newv",
    );
    set_fn(
        &obj,
        "setInnerHTML",
        "el,html",
        "globalThis.__plan999_ops.push(['html', el.tag, html]); el.children = []; el.text = html",
    );
    set_fn(
        &obj,
        "setValue",
        "el,v",
        "globalThis.__plan999_ops.push(['value', el.tag, Array.isArray(v) ? 'array' : String(v)]); el.value = v",
    );
    set_fn(
        &obj,
        "setChecked",
        "el,b",
        "globalThis.__plan999_ops.push(['checked', el.tag, !!b]); el.checked = !!b",
    );
    set_fn(
        &obj,
        "setDisabled",
        "el,b",
        "globalThis.__plan999_ops.push(['disabled', el.tag, !!b]); el.disabled = !!b",
    );
    set_fn(&obj, "clearRef", "r", "globalThis.__plan999_ops.push(['clearRef', !!r])");
    set_fn(&obj, "applyRef", "el,r", "globalThis.__plan999_ops.push(['applyRef', el.tag, !!r])");
    set_fn(
        &obj,
        "setAttribute",
        "el,k,v",
        "globalThis.__plan999_ops.push(['attr', el.tag, k, v]); el.attrs = el.attrs || {}; el.attrs[k] = v",
    );
    set_fn(
        &obj,
        "removeAttribute",
        "el,k",
        "globalThis.__plan999_ops.push(['removeAttr', el.tag, k]); if (el.attrs) delete el.attrs[k]",
    );
    set_fn(&obj, "getTagName", "el", "return el && el.tagName || el && el.tag || ''");
    set_fn(
        &obj,
        "addEventListener",
        "el,evt,h",
        "globalThis.__plan999_ops.push(['addEvent', el.tag, evt])",
    );
    set_fn(
        &obj,
        "removeEventListener",
        "el,evt,h",
        "globalThis.__plan999_ops.push(['removeEvent', el.tag, evt])",
    );
    set_fn(
        &obj,
        "hasValueProperty",
        "el",
        "return !!el && ('value' in el || el.tagName === 'INPUT')",
    );
    set_fn(
        &obj,
        "isSelectMultiple",
        "el",
        "return !!el && el.tagName === 'SELECT' && !!el.multiple",
    );
    set_fn(
        &obj,
        "querySelector",
        "sel",
        "return { tag: sel, tagName: String(sel).toUpperCase(), children: [], nodeType: 1 }",
    );
    obj.into()
}

fn props(entries: &[(&str, JsValue)]) -> JsValue {
    let obj = Object::new();
    for (key, value) in entries {
        set_prop(&obj, key, value.clone());
    }
    obj.into()
}

fn op_seen(ops: &Array, name: &str, detail: &str) -> bool {
    ops.iter().any(|entry| {
        let arr = Array::from(&entry);
        arr.get(0).as_string().as_deref() == Some(name)
            && arr.iter().any(|value| {
                value.as_string().as_deref() == Some(detail)
                    || value.as_bool().map(|b| b.to_string()) == Some(detail.to_string())
            })
    })
}

fn op_seen_for_tag(ops: &Array, name: &str, tag: &str, detail: &str) -> bool {
    ops.iter().any(|entry| {
        let arr = Array::from(&entry);
        arr.get(0).as_string().as_deref() == Some(name)
            && arr.get(1).as_string().as_deref() == Some(tag)
            && arr.iter().any(|value| value.as_string().as_deref() == Some(detail))
    })
}

fn throwing_getter_object(prop: &str) -> JsValue {
    let obj = Object::new();
    let define = Function::new_with_args(
        "target,name",
        "Object.defineProperty(target, name, { enumerable: true, get() { throw new Error('plan999 getter'); } }); return target;",
    );
    define.call2(&JsValue::UNDEFINED, &obj, &JsValue::from_str(prop)).unwrap()
}

#[wasm_bindgen_test(async)]
async fn plan999_props_patch_sets_and_removes_special_dom_props() {
    let ops = ops();
    let adapter = recording_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let style = Object::new();
    set_prop(&style, "width", JsValue::from_f64(12.0));
    let html = Object::new();
    set_prop(&html, "__html", JsValue::from_str("<b>old</b>"));
    let on_click = Function::new_no_args("return undefined");
    let ref_obj = Object::new();
    let old = rue.create_element_wasm(
        JsValue::from_str("input"),
        props(&[
            ("className", JsValue::from_str("old")),
            ("style", style.into()),
            ("dangerouslySetInnerHTML", html.into()),
            ("value", JsValue::from_str("typed")),
            ("checked", JsValue::TRUE),
            ("disabled", JsValue::TRUE),
            ("ref", ref_obj.into()),
            ("onClick", on_click.into()),
            ("data-id", JsValue::from_str("one")),
        ]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(old, container.clone());
    tick().await;

    let next = rue.create_element_wasm(
        JsValue::from_str("input"),
        props(&[
            ("data-null", JsValue::NULL),
            ("data-undef", JsValue::UNDEFINED),
            ("data-object", Object::new().into()),
        ]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(next, container.clone());
    tick().await;

    assert!(op_seen(&ops, "removeEvent", "click"));
    assert!(op_seen(&ops, "class", ""));
    assert!(op_seen(&ops, "html", ""));
    assert!(op_seen(&ops, "value", ""));
    assert!(op_seen(&ops, "checked", "false"));
    assert!(op_seen(&ops, "disabled", "false"));
    assert!(op_seen(&ops, "clearRef", "true"));
    assert!(op_seen(&ops, "removeAttr", "data-id"));
    assert!(op_seen(&ops, "attr", "null"));
    assert!(op_seen(&ops, "removeAttr", "data-undef"));
    assert_eq!(child_sequence(&container), vec!["input"]);

    let odd_props = rue.create_element_wasm(
        JsValue::from_str("input"),
        props(&[
            ("style", JsValue::from_str("not-an-object")),
            ("dangerouslySetInnerHTML", JsValue::from_str("not-an-object")),
        ]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(odd_props, container.clone());
    tick().await;

    assert!(op_seen_for_tag(&ops, "style", "input", ""));
    assert!(op_seen_for_tag(&ops, "html", "input", ""));
}

#[wasm_bindgen_test(async)]
async fn plan999_props_patch_covers_getter_errors_and_string_fallbacks() {
    let ops = ops();
    let adapter = recording_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let base = rue.create_element_wasm(JsValue::from_str("div"), props(&[]), JsValue::UNDEFINED);
    rue.render_wasm(base, container.clone());
    tick().await;

    let throwing_style = rue.create_element_wasm(
        JsValue::from_str("div"),
        props(&[("style", throwing_getter_object("width"))]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(throwing_style, container.clone());
    tick().await;

    let throwing_html = rue.create_element_wasm(
        JsValue::from_str("div"),
        props(&[("dangerouslySetInnerHTML", throwing_getter_object("__html"))]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(throwing_html, container.clone());
    tick().await;

    let global = js_sys::global();
    let string_key = JsValue::from_str("String");
    let original_string = Reflect::get(&global, &string_key).unwrap_or(JsValue::UNDEFINED);

    let custom_string = Function::new_with_args("_value", "return 'custom-string';");
    Reflect::set(&global, &string_key, &custom_string).unwrap();
    let object_attr = rue.create_element_wasm(
        JsValue::from_str("div"),
        props(&[("data-object", Object::new().into())]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(object_attr, container.clone());
    tick().await;

    let non_string = Function::new_with_args("_value", "return ({ label: 'not-a-string' });");
    Reflect::set(&global, &string_key, &non_string).unwrap();
    let fallback_attr = rue.create_element_wasm(
        JsValue::from_str("div"),
        props(&[("data-fallback", Object::new().into())]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(fallback_attr, container.clone());
    tick().await;

    let throwing_string = Function::new_with_args("_value", "throw new Error('string failed');");
    Reflect::set(&global, &string_key, &throwing_string).unwrap();
    let throwing_attr = rue.create_element_wasm(
        JsValue::from_str("div"),
        props(&[("data-throwing-string", Object::new().into())]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(throwing_attr, container.clone());
    tick().await;

    Reflect::set(&global, &string_key, &original_string).unwrap();

    assert_eq!(child_sequence(&container), vec!["div"]);
    assert!(op_seen_for_tag(&ops, "attr", "div", "custom-string"));
    assert!(op_seen_for_tag(&ops, "attr", "div", ""));
}

#[wasm_bindgen_test(async)]
async fn plan999_select_value_removal_covers_multiple_and_single_paths() {
    let ops = ops();
    let adapter = recording_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let old = rue.create_element_wasm(
        JsValue::from_str("SELECT"),
        props(&[("value", JsValue::from_str("a")), ("multiple", JsValue::TRUE)]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(old, container.clone());
    tick().await;
    let select = children_of(&container).get(0);
    set_prop(&Object::from(select.clone()), "multiple", JsValue::TRUE);

    let next = rue.create_element_wasm(JsValue::from_str("SELECT"), props(&[]), JsValue::UNDEFINED);
    rue.render_wasm(next, container.clone());
    tick().await;
    assert!(op_seen(&ops, "value", "array"));

    let single_container = setup_container(&adapter);
    let single_old = rue.create_element_wasm(
        JsValue::from_str("SELECT"),
        props(&[("value", JsValue::from_str("single"))]),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(single_old, single_container.clone());
    tick().await;

    let single_next =
        rue.create_element_wasm(JsValue::from_str("SELECT"), props(&[]), JsValue::UNDEFINED);
    rue.render_wasm(single_next, single_container);
    tick().await;
    assert!(op_seen_for_tag(&ops, "value", "SELECT", ""));
}

#[wasm_bindgen_test(async)]
async fn plan999_compat_component_fragment_children_replacements_keep_boundaries_clean() {
    let adapter = recording_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let first_component = Function::new_no_args(
        "return { type: 'div', props: { key: 'root' }, children: [ \
          { type: 'span', props: { key: 'a' }, children: ['A'] }, \
          { type: 'fragment', props: { key: 'f' }, children: ['F1', 'F2'] } \
        ] }",
    );
    let second_component = Function::new_no_args(
        "return { type: 'div', props: { key: 'root' }, children: [ \
          { type: 'fragment', props: { key: 'f' }, children: ['N1'] }, \
          { type: 'em', props: { key: 'b' }, children: ['B'] }, \
          'tail' \
        ] }",
    );

    let first =
        rue.create_element_wasm(first_component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_anchor_wasm(first, parent.clone(), anchor.clone());
    tick().await;

    let second =
        rue.create_element_wasm(second_component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_anchor_wasm(second, parent.clone(), anchor.clone());
    tick().await;

    assert_eq!(child_sequence(&parent), vec!["div", "comment_anchor"]);
    let root = children_of(&parent).get(0);
    let nested = children_of(&root)
        .iter()
        .map(|child| {
            let tag = Reflect::get(&child, &JsValue::from_str("tag"))
                .unwrap_or(JsValue::UNDEFINED)
                .as_string()
                .unwrap_or_default();
            if tag == "#text" { first_child_text(&child) } else { tag }
        })
        .collect::<Vec<_>>();
    assert!(nested.iter().any(|tag| tag == "em"));
}

#[wasm_bindgen_test]
fn plan999_reactive_scopes_next_tick_and_signal_symbol_paths() {
    set_reactive_scheduling("sync");
    let outer = create_detached_effect_scope_wasm();
    push_effect_scope_wasm(outer);
    assert_eq!(pop_effect_scope_wasm().as_f64(), Some(outer as f64));
    assert!(pop_effect_scope_wasm().is_undefined());
    dispose_effect_scope_wasm(outer);

    let callback_hits = Array::new();
    let callback_hits_for_cb = callback_hits.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        callback_hits_for_cb.push(&JsValue::from_str("tick"));
    }) as Box<dyn FnMut()>);
    let promise = next_tick(Some(cb.as_ref().clone().unchecked_into()));
    assert!(Promise::resolve(&promise).is_object());
    cb.forget();

    let symbol = Symbol::for_("plan999");
    let root = Object::new();
    set_prop(&root, "plain", JsValue::from_f64(1.0));
    set_prop(&root, "symbol", symbol.clone().into());
    let sig = create_signal(root.into(), None);
    let path = Array::new();
    path.push(&JsValue::from_str("symbol"));
    assert!(sig.get_path_js(path.clone().into()).is_symbol());
    assert!(sig.peek_path_js(path.into()).is_symbol());

    let ref_with_equals = create_ref(
        JsValue::from_f64(1.0),
        Some({
            let opts = Object::new();
            set_prop(&opts, "equals", Function::new_with_args("a,b", "return a === b").into());
            opts.into()
        }),
    );
    let value = Reflect::get(&ref_with_equals, &JsValue::from_str("value")).unwrap();
    assert_eq!(value.as_f64(), Some(1.0));

    let hits = Array::new();
    let hits_for_effect = hits.clone();
    let sig_for_effect = sig.clone();
    let effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        hits_for_effect.push(&sig_for_effect.get_js());
    }) as Box<dyn FnMut()>);
    let _handle = create_effect(effect.as_ref().clone().unchecked_into(), None);
    effect.forget();
    assert!(hits.length() >= 1);
}
