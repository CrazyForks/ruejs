use super::*;
use std::collections::HashMap;

fn new_vt() -> VaporTransform {
    VaporTransform {
        next_el: 0,
        next_list: 0,
        next_map: 0,
        next_child: 0,
        once_depth: 0,
        did_transform: false,
        el_tag_by_ident: HashMap::new(),
        renderable_local_scopes: Vec::new(),
    }
}

#[test]
fn allocates_stable_incrementing_identifiers() {
    let mut vt = new_vt();

    assert_eq!(vt.next_el_ident().sym.as_ref(), "_el1");
    assert_eq!(vt.next_el_ident().sym.as_ref(), "_el2");
    assert_eq!(vt.next_list_ident().sym.as_ref(), "_list1");
    assert_eq!(vt.next_child_ident().sym.as_ref(), "__child1");
    assert_eq!(vt.next_slot_ident().sym.as_ref(), "__slot2");
    assert_eq!(vt.next_list_ident().sym.as_ref(), "_list3");
    assert_eq!(vt.next_map_base(), "_map1");
    assert_eq!(vt.next_map_base(), "_map2");
}
