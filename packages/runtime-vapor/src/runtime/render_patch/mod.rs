use super::Rue;
use super::types::{MountInput, MountedSubtreeState};
#[cfg(feature = "dev")]
use crate::log::{log, want_log};
use crate::runtime::dom_adapter::DomAdapter;
#[cfg(feature = "dev")]
use js_sys::Function;
#[cfg(feature = "dev")]
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

#[cfg(feature = "compat")]
mod children;
#[cfg(feature = "compat")]
mod compat;
mod component;
mod replace;
mod replace_utils;
mod text;

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    fn patch_core_same(
        &mut self,
        old: &mut MountedSubtreeState<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        match old {
            MountedSubtreeState::Text(text) => {
                let mounted_text = self.patch_text(text.host.clone(), new);
                *old = MountedSubtreeState::Text(mounted_text);
            }
            MountedSubtreeState::Patch(node) => {
                self.patch_component_same(node, new, parent);
            }
            MountedSubtreeState::Vapor(_) => {
                self.patch_replace(old, new, parent);
            }
        }
    }

    pub(crate) fn patch(
        &mut self,
        old: &mut MountedSubtreeState<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let keys_changed = match (old.key(), &new.key) {
            (Some(ko), Some(kn)) => ko != kn,
            (None, Some(_)) | (Some(_), None) => true,
            _ => false,
        };
        let type_changed = !old.matches_input_type(&new.r#type);
        #[cfg(feature = "dev")]
        {
            if want_log("debug", "runtime:patch type_check") {
                let parent_desc = if let Some(adapter) = self.get_dom_adapter() {
                    adapter.get_tag_name(parent)
                } else {
                    String::from("<no-adapter>")
                };
                log("debug", &format!("runtime:patch type_check parent_tag={}", parent_desc));
                let old_key = old.key().cloned().unwrap_or_default();
                let new_key = new.key.clone().unwrap_or_default();
                if let (Some(of), super::types::MountInputType::Component(nf)) =
                    (old.component_render_fn(), &new.r#type)
                {
                    let old_name = of
                        .dyn_ref::<Function>()
                        .map(|f| String::from(f.name()))
                        .unwrap_or_else(|| String::from("<non-fn>"));
                    let new_name = nf
                        .dyn_ref::<Function>()
                        .map(|f| String::from(f.name()))
                        .unwrap_or_else(|| String::from("<non-fn>"));
                    log(
                        "debug",
                        &format!(
                            "runtime:patch type_check component of_name={} nf_name={} ptr_eq={}",
                            old_name,
                            new_name,
                            of.eq(nf)
                        ),
                    );
                }
                log(
                    "debug",
                    &format!(
                        "runtime:patch type_check old_type={} new_type={} keys_changed={} type_changed={} old_key={} new_key={}",
                        old.debug_type_name(),
                        new.r#type.debug_name(),
                        keys_changed,
                        type_changed,
                        old_key,
                        new_key
                    ),
                );
            }
        }
        if keys_changed || type_changed {
            self.patch_replace(old, new, parent);
            return;
        }

        #[cfg(feature = "compat")]
        {
            match self.patch_compat_boundary(old, new, parent) {
                compat::CompatPatchBoundaryOutcome::Handled => return,
                compat::CompatPatchBoundaryOutcome::Replaced(mounted) => {
                    *old = mounted;
                    return;
                }
                compat::CompatPatchBoundaryOutcome::NotCompat => {}
            }
        }

        self.patch_core_same(old, new, parent);
    }
}
