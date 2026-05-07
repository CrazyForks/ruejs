use std::cell::{Cell, RefCell};
use wasm_bindgen::JsValue;

thread_local! {
    static RUNTIME_CRASHED: Cell<bool> = Cell::new(false);
    static LAST_HOOK_ERROR: RefCell<Option<JsValue>> = RefCell::new(None);
}

pub fn mark_crashed_from_hook(err: &JsValue) {
    RUNTIME_CRASHED.with(|flag| flag.set(true));
    LAST_HOOK_ERROR.with(|cell| {
        *cell.borrow_mut() = Some(err.clone());
    });
}

pub fn is_runtime_crashed() -> bool {
    RUNTIME_CRASHED.with(|flag| flag.get())
}

pub fn last_hook_error() -> Option<JsValue> {
    LAST_HOOK_ERROR.with(|cell| cell.borrow().clone())
}
