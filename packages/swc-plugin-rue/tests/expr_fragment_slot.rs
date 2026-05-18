use swc_plugin_rue::apply;

mod utils;

fn compile(src: &str, name: &str) -> String {
    let (program, cm) = utils::parse(src, &format!("{name}.tsx"));
    let program = apply(program);
    let out = utils::emit(program, cm);

    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write(format!("target/vapor_outputs/{name}.out.js"), utils::strip_marker(&out)).ok();

    utils::normalize(&utils::strip_marker(&out))
}

#[test]
fn lowers_bare_fragment_expression_container_to_slot_render() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Demo: FC<{ label: string }> = props => (
  <div>{<><span>{props.label}</span></>}</div>
)
"##;

    let out = compile(src, "expr_fragment_slot_bare");

    assert!(out.contains(&utils::normalize("const __slot = vapor(()=>{")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, _root, _list1)")));
    assert!(out.contains(&utils::normalize("_$createElement(\"span\", _root)")));
}

#[test]
fn lowers_conditional_fragment_branches_to_slot_render() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Demo: FC<{ ok: boolean; label: string }> = props => (
  <div>{props.ok ? <><span>{props.label}</span></> : <><em>fallback</em></>}</div>
)
"##;

    let out = compile(src, "expr_fragment_slot_conditional");

    assert!(out.contains(&utils::normalize("const __slot = props.ok ? vapor(()=>{")));
    assert!(out.contains(&utils::normalize("_$createElement(\"span\", _root)")));
    assert!(out.contains(&utils::normalize("_$createElement(\"em\", _root)")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, _root, _list1)")));
}

#[test]
fn lowers_logical_and_fragment_rhs_to_slot_render() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Demo: FC<{ ok: boolean; label: string }> = props => (
  <div>{props.ok && <><span>{props.label}</span></>}</div>
)
"##;

    let out = compile(src, "expr_fragment_slot_logical_and");

    assert!(out.contains(&utils::normalize("const __slot = props.ok ? vapor(()=>{")));
    assert!(out.contains(&utils::normalize(": \"\";")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, _root, _list1)")));
}

#[test]
fn lowers_bare_identifier_inside_fragment_to_slot_render() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Demo: FC<{ holder: any }> = ({ holder }) => (
  <div><>{holder}</></div>
)
"##;

    let out = compile(src, "expr_fragment_slot_bare_identifier");

    assert!(out.contains(&utils::normalize("const _list1 = _$createComment(\"rue:slot:anchor\")")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, _root, _list1)")));
    assert!(!out.contains(&utils::normalize("_$settextContent(_el1, holder)")));
    assert!(!out.contains(&utils::normalize("_$settextContent(_el2, holder)")));
}

#[test]
fn lowers_memoized_jsx_child_to_slot_render() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const Demo: FC = () => {
  const msg = ref('initial')
  return <div><span v-once>{msg.value}</span></div>
}
"##;

    let out = compile(src, "expr_memoized_jsx_child_slot");

    assert!(out.contains("_$vaporWithHookId(\"useMemo:"));
    assert!(out.contains(&utils::normalize("const __slot2 = _$vaporWithHookId(")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot2, _root, _list1);")));
    assert!(out.contains(&utils::normalize("_$settextContent(_el2, msg.value);")));
    assert!(
        !out.contains(&utils::normalize("watchEffect(()=>{ const __slot = _$vaporWithHookId("))
    );
    assert!(!out.contains(&utils::normalize("watchEffect(()=>{ _$settextContent")));
    assert!(!out.contains("_$settextContent(_el1, _$vaporWithHookId"));
}

#[test]
fn lowers_conditional_map_callbacks_to_slot_render() {
    let src = r##"
import { computed, ref, type FC } from '@rue-js/rue'

const Demo: FC = () => {
    const items = computed(() => [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
    ])
    const showList = ref(true)

    return (
        <section>
            {showList.value
                ? items.get().map((item) => {
                        const label = item.label.toUpperCase()
                        return <button key={item.id}>{label}</button>
                    })
                : <span>empty</span>}
        </section>
    )
}
"##;

    let out = compile(src, "expr_fragment_slot_conditional_map_callback");

    assert!(out.contains(&utils::normalize("const __slot = showList.value ? vapor(()=>{")));
    assert!(out.contains(&utils::normalize("_$vaporKeyedList({")));
    assert!(out.contains(&utils::normalize("getKey: (item, idx)=>item.id")));
    assert!(out.contains(&utils::normalize("const label = item.label.toUpperCase();")));
    assert!(out.contains(&utils::normalize("renderItem: (item, parent, start, end, idx)=>{")));
    assert!(out.contains(&utils::normalize("_$createElement(\"button\", _root)")));
    assert!(out.contains(&utils::normalize("_$createElement(\"span\", _root)")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, _root, _list1)")));
    assert!(!out.contains("_jsxDEV("));
}

#[test]
fn lowers_logical_and_map_callbacks_to_slot_render() {
    let src = r##"
import { computed, ref, type FC } from '@rue-js/rue'

const Demo: FC = () => {
    const items = computed(() => [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
    ])
    const showList = ref(true)

    return (
        <section>
            {showList.value && items.get().map((item) => {
                const label = item.label.toUpperCase()
                return <button key={item.id}>{label}</button>
            })}
        </section>
    )
}
"##;

    let out = compile(src, "expr_fragment_slot_logical_and_map_callback");

    assert!(out.contains(&utils::normalize("const __slot = showList.value ? vapor(()=>{")));
    assert!(out.contains(&utils::normalize("_$vaporKeyedList({")));
    assert!(out.contains(&utils::normalize("getKey: (item, idx)=>item.id")));
    assert!(out.contains(&utils::normalize(": \"\";")));
    assert!(out.contains(&utils::normalize("const label = item.label.toUpperCase();")));
    assert!(out.contains(&utils::normalize("renderItem: (item, parent, start, end, idx)=>{")));
    assert!(out.contains(&utils::normalize("renderAnchor(__slot, _root, _list1)")));
    assert!(!out.contains("_jsxDEV("));
}

#[test]
fn preserves_key_expr_for_simple_block_map_callbacks_in_conditional_slots() {
    let src = r##"
import { computed, ref, type FC } from '@rue-js/rue'

const STATUS_META = {
    todo: {
        cardClass: 'todo-card',
        badgeClass: 'todo-badge',
        dotClass: 'todo-dot',
        label: 'Todo',
    },
}

const Demo: FC = () => {
    const editingId = ref<string | null>(null)
    const visibleTodos = computed(() => [
        { id: 'a', title: 'Alpha', status: 'todo', archived: false },
        { id: 'b', title: 'Beta', status: 'todo', archived: true },
    ])

    return (
        <div className="grid gap-4">
            {visibleTodos.get().length
                ? visibleTodos.get().map((item) => {
                        const meta = STATUS_META[item.status]
                        const isEditing = editingId.value === item.id

                        return (
                            <div
                                key={item.id}
                                className={`card ${meta.cardClass} ${item.archived ? 'archived' : 'active'}`}
                            >
                                <div className="card-body">
                                    <span className={meta.badgeClass}>{meta.label}</span>
                                    {!isEditing && <h3>{item.title}</h3>}
                                    {isEditing && <input value={item.title} />}
                                </div>
                            </div>
                        )
                    })
                : <div>empty</div>}
        </div>
    )
}
"##;

    let out = compile(src, "expr_fragment_slot_conditional_map_preserves_key");

    assert!(out.contains(&utils::normalize("_$vaporKeyedList({")));
    assert!(out.contains(&utils::normalize("getKey: (item, idx)=>item.id")));
    assert!(out.contains(&utils::normalize("STATUS_META[item.status].cardClass")));
    assert!(out.contains(&utils::normalize("STATUS_META[item.status].badgeClass")));
    assert!(out.contains(&utils::normalize("!(editingId.value === item.id) ? vapor(()=>{")));
    assert!(out.contains(&utils::normalize("(editingId.value === item.id) ? vapor(()=>{")));
    assert!(!out.contains(&utils::normalize("const meta = STATUS_META[item.status];")));
    assert!(!out.contains(&utils::normalize("const isEditing = editingId.value === item.id;")));
    assert!(!out.contains(&utils::normalize("getKey: (item, idx)=>idx")));
}
