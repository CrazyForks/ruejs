//! SWC 插件转换行为测试：v-memo / r-memo
use swc_plugin_rue::{apply, apply_pre};

mod utils;

#[test]
fn transforms_memo_directives() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const MemoDemo: FC<{ ok: boolean; valueA: number; valueB: string; fallback: string }> = (props) => {
  return (
    <div>
      <section v-memo={[props.valueA, props.valueB]}>{props.valueA}</section>
      <article r-if={props.ok} r-memo="[props.valueB]">{props.valueB}</article>
      <article r-else r-memo={[]}>{props.fallback}</article>
    </div>
  )
}

export default MemoDemo
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/memo_directive.out.js", strip_marker(&out)).ok();
    let normalized = normalize(&strip_marker(&out));
    assert!(
        normalized.contains("import { useMemo, _$vaporWithHookId } from \"@rue-js/rue/vapor\";")
    );
    assert!(normalized.contains(
        "_$vaporWithHookId(\"useMemo:169:240\", ()=>useMemo(()=><section>{props.valueA}</section>, [ props.valueA, props.valueB ]))"
    ));
    assert!(normalized.contains(
        "props.ok ? _$vaporWithHookId(\"useMemo:247:320\", ()=>useMemo(()=><article>{props.valueB}</article>, [ props.valueB ])) : _$vaporWithHookId(\"useMemo:327:381\", ()=>useMemo(()=><article>{props.fallback}</article>, []))"
    ));
    assert!(!normalized.contains("v-memo"));
    assert!(!normalized.contains("r-memo"));
}

#[test]
fn transforms_root_memo_directive() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const RootMemo: FC<{ value: number }> = (props) => {
  return <main v-memo={[props.value]}>{props.value}</main>
}

export default RootMemo
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/root_memo_directive.out.js", strip_marker(&out)).ok();
    let normalized = normalize(&strip_marker(&out));
    assert!(normalized.contains(
        "return _$vaporWithHookId(\"useMemo:103:152\", ()=>useMemo(()=><main>{props.value}</main>, [ props.value ]));"
    ));
    assert!(!normalized.contains("v-memo"));
}

#[test]
fn compiles_memo_directive_to_renderable_slot() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const MemoDemo: FC<{ selected: boolean; label: string }> = (props) => {
  return (
    <div>
      <section v-memo={[props.selected]}>
        <span>{props.label}</span>
      </section>
    </div>
  )
}

export default MemoDemo
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/memo_directive_full.out.js", strip_marker(&out)).ok();
    let normalized = normalize(&strip_marker(&out));
    assert!(normalized.contains("useMemo(()=>vapor(()=>"));
    assert!(normalized.contains("renderAnchor"));
    assert!(normalized.contains("watchEffect(()=>{ const __slot = _$vaporWithHookId"));
    assert!(!normalized.contains("watchEffect(()=>{ const __slot = (props.label);"));
    assert!(!normalized.contains("()=><section"));
    assert!(!normalized.contains("v-memo"));
}

#[test]
fn keeps_memoized_list_item_render_body_when_lowering_map() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const ListMemoDemo: FC<{ selectedId: number }> = (props) => {
  const rows = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Beta' },
  ]

  return (
    <div>
      {rows.map(row => (
        <div key={row.id} v-memo={[row.id === props.selectedId]}>
          <span>{row.name}</span>
        </div>
      ))}
    </div>
  )
}

export default ListMemoDemo
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/memo_directive_list_item.out.js", strip_marker(&out)).ok();
    let normalized = normalize(&strip_marker(&out));
    assert!(normalized.contains("const __slot = _$vaporWithHookId"));
    assert!(normalized.contains("useMemo(()=>vapor(()=>"));
    assert!(normalized.contains("renderBetween(__slot, parent, start, end)"));
    assert!(!normalized.contains("const __slot = vapor(()=>{ const _root = _$createDocumentFragment(); return _root; }); renderBetween(__slot, parent, start, end);"));
}
