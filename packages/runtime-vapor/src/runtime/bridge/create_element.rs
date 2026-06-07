/*
createElement/createComponent 桥接入口

JS/TSX 编译产物会通过这里把“标签、组件函数、props、children”收敛为默认 MountInput 句柄。
默认路径不直接运输旧式 vnode 树，而是写入注册表并返回轻量 handle，后续 render 再消费该 handle。
*/
use super::WasmRue;
#[cfg(feature = "dev")]
#[cfg(feature = "compat")]
use crate::runtime::js_adapter::JsDomAdapter;
#[cfg(feature = "compat")]
use crate::runtime::transport::DefaultMountHandleStorePolicy;
#[cfg(feature = "dev")]
#[cfg(feature = "compat")]
use crate::runtime::types::MountInputType;
use crate::runtime::vnode_helpers::props_with_children;
#[cfg(feature = "dev")]
#[cfg(feature = "compat")]
use js_sys::Array;
use js_sys::Function;
#[cfg(feature = "dev")]
#[cfg(feature = "compat")]
use js_sys::Object;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;
#[cfg(not(feature = "compat"))]
use wasm_bindgen::throw_str;

mod create_element_handle_out;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "createComponent")]
    pub fn create_component_wasm(&self, type_tag: JsValue, props: JsValue) -> JsValue {
        if !type_tag.is_function() {
            #[cfg(feature = "compat")]
            return self.create_element_wasm(type_tag, props, JsValue::UNDEFINED);

            #[cfg(not(feature = "compat"))]
            {
                let _ = props;
                let _ = type_tag;
                throw_str("Rue vapor runtime: createComponent expects a function component");
            }
        }

        let props_map = props_with_children(&props, &JsValue::UNDEFINED);
        let func = type_tag.dyn_ref::<Function>().unwrap().clone();
        create_element_handle_out::create_function_component_out(self, func, props_map, true)
    }

    #[cfg(feature = "compat")]
    #[wasm_bindgen(js_name = "createElement")]
    /// 创建元素/组件的默认挂载输入句柄（tagged mount handle）。
    ///
    /// - 默认主路径写入的是 MountInput 注册表句柄
    /// - 组件函数：构建组件输入并输出注册表 ID
    /// - 普通标签：解析类型与 children，输出注册表句柄
    pub fn create_element_wasm(
        &self,
        type_tag: JsValue,
        props: JsValue,
        children: JsValue,
    ) -> JsValue {
        #[cfg(feature = "dev")]
        {
            if crate::log::want_log("debug", "runtime:createElement") {
                let tt_s = type_tag.as_string().unwrap_or_default();
                let mut ck = 0usize;
                if props.is_object() {
                    let obj = Object::from(props.clone());
                    ck = Object::keys(&obj).length() as usize;
                }
                let mut clen = 0usize;
                if Array::is_array(&children) {
                    let arr = Array::from(&children);
                    clen = arr.length() as usize;
                }
                crate::log::log(
                    "debug",
                    &format!(
                        "runtime:createElement type_tag={} props_keys={} children_count={}",
                        tt_s, ck, clen
                    ),
                );
            }
        }
        // 组件函数：解析 props+children，输出组件 MountInput 的注册表引用
        if type_tag.is_function() {
            #[cfg(feature = "dev")]
            {
                if crate::log::want_log("debug", "runtime:createElement function_component") {
                    crate::log::log("debug", "runtime:createElement function_component");
                }
            }
            let props_map = props_with_children(&props, &children);
            let func = type_tag.dyn_ref::<Function>().unwrap().clone();
            return create_element_handle_out::create_function_component_out(
                self, func, props_map, false,
            );
        }
        // 普通标签：走共享 compat normalize 边界，避免 createElement 自己重做旧协议解析。
        let input = self.compat_mount_input_from_create_element(&type_tag, &props, &children);
        #[cfg(feature = "dev")]
        {
            if crate::log::want_log("debug", "runtime:createElement mount_input_build") {
                crate::log::log("debug", "runtime:createElement mount_input_build");
            }
            if crate::log::want_log("debug", "runtime:createElement tag_resolved") {
                let ty = match &input.r#type {
                    MountInputType::<JsDomAdapter>::Text(_) => "Text",
                    MountInputType::<JsDomAdapter>::Fragment => "Fragment",
                    MountInputType::<JsDomAdapter>::Vapor => "Vapor",
                    MountInputType::<JsDomAdapter>::VaporWithSetup(_) => "VaporWithSetup",
                    MountInputType::<JsDomAdapter>::Element(s) => s.as_str(),
                    MountInputType::<JsDomAdapter>::Component(_) => "Component",
                    MountInputType::<JsDomAdapter>::_Phantom(_) => "_Phantom",
                };
                crate::log::log(
                    "debug",
                    &format!("runtime:createElement tag_resolved type={}", ty),
                );
            }
        }
        let handle = crate::runtime::transport::store_default_mount_input(
            input,
            DefaultMountHandleStorePolicy::ReuseEmptySlot,
        );
        #[cfg(feature = "dev")]
        {
            if crate::log::want_log("debug", "runtime:createElement id") {
                crate::log::log("debug", &format!("runtime:createElement id={}", handle.id));
            }
            if crate::log::want_log("debug", "runtime:createElement id_info") {
                crate::log::log(
                    "debug",
                    &format!("runtime:createElement id_info id={}", handle.id),
                );
            }
        }
        handle.value
    }
}
