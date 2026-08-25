//! js-framework-benchmark row-shape resource-budget regressions.
//!
//! These tests intentionally stay ignored until the single-root list codegen
//! optimization lands. Run them explicitly to capture the current baseline.

use swc_plugin_rue::apply;

mod utils;

const MAX_RENDER_ITEM_EFFECTS: usize = 0;

fn transform_benchmark_row() -> String {
    let source = r##"
import { type FC, ref, shallowRef, triggerRef } from '@rue-js/rue';

type Row = { id: number; label: string };
declare function buildData(count?: number): Row[];

const App: FC = () => {
  const rows = shallowRef<Row[]>([]);
  const selected = ref<number | undefined>(undefined);

  const runLots = () => {
    rows.value = buildData(10_000);
    selected.value = undefined;
  };

  const update = () => {
    for (let i = 0, length = rows.value.length; i < length; i += 10) {
      const row = rows.value[i];
      rows.value[i] = { ...row, label: `${row.label} !!!` };
    }
    triggerRef(rows);
  };

  const swapRows = () => {
    if (rows.value.length > 998) {
      const row = rows.value[1];
      rows.value[1] = rows.value[998];
      rows.value[998] = row;
      triggerRef(rows);
    }
  };

  const select = (id: number) => {
    selected.value = id;
  };

  const remove = (id: number) => {
    const index = rows.value.findIndex((row) => row.id === id);
    rows.value.splice(index, 1);
    triggerRef(rows);
  };

  return (
    <table className="table table-hover table-striped test-data">
      <tbody>
        {rows.value.map((row) => (
          <tr
            key={row.id}
            data-row-id={row.id}
            className={row.id === selected.value ? 'danger' : ''}
          >
            <td className="col-md-1">{row.id}</td>
            <td className="col-md-4">
              <a onClick={() => select(row.id)}>{row.label}</a>
            </td>
            <td className="col-md-1">
              <a onClick={() => remove(row.id)}>
                <span className="glyphicon glyphicon-remove" aria-hidden="true"></span>
              </a>
            </td>
            <td className="col-md-6"></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
"##;

    let (program, cm) = utils::parse(source, "js-framework-benchmark.tsx");
    let output = utils::emit(apply(program), cm);
    utils::normalize(&utils::strip_marker(&output))
}

fn transform_signal_benchmark_row() -> String {
    let source = r##"
import { type FC, signal } from '@rue-js/rue';

type Row = { id: number; label: string };

const App: FC = () => {
  const rows = signal<Row[]>([]);
  const selected = signal<number | undefined>(undefined);

  return (
    <table className="table table-hover table-striped test-data">
      <tbody>
        {rows.get().map((row) => (
          <tr
            key={row.id}
            data-row-id={row.id}
            className={row.id === selected.get() ? 'danger' : ''}
          >
            <td className="col-md-1">{row.id}</td>
            <td className="col-md-4"><a>{row.label}</a></td>
            <td className="col-md-6"></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
"##;

    let (program, cm) = utils::parse(source, "js-framework-benchmark-signal.tsx");
    let output = utils::emit(apply(program), cm);
    utils::normalize(&utils::strip_marker(&output))
}

#[test]
fn benchmark_key_is_structural_only() {
    let output = transform_benchmark_row();
    let key_attribute_writes = output.matches(", \"key\",").count();

    assert!(
        output.contains("getKey: (row, idx)=>row.id"),
        "benchmark key must remain available to the list reconciler"
    );
    assert_eq!(
        key_attribute_writes, 0,
        "benchmark key must be structural metadata only; transformed output emitted {key_attribute_writes} key DOM attribute write(s)"
    );
}

#[test]
fn benchmark_row_codegen_stays_within_effect_budget() {
    let output = transform_benchmark_row();
    let total_effects = output.matches("watchEffect(").count();
    let render_item_effects = total_effects
        .checked_sub(1)
        .expect("benchmark output must contain the list entry watchEffect");

    assert!(
        output.contains("singleRoot: true"),
        "benchmark row must keep the single-root list fast-path marker"
    );
    assert!(
        output.contains("directRoot: true"),
        "benchmark row must mount through the direct-root list path without per-text wrapper elements: {output}"
    );
    assert!(
        output.contains("compiledRowPatch: true"),
        "benchmark row must opt into the runtime compiled-row protocol: {output}"
    );
    assert!(
        output.contains("return { patch:"),
        "benchmark renderItem must return a compiled patch record: {output}"
    );
    assert!(
        output.contains("_$settextContent("),
        "benchmark row-local text must use direct text writes instead of renderAnchor wrappers: {output}"
    );
    assert!(
        !output.contains("_$createTextWrapper("),
        "benchmark row-local text must not leave HTML wrapper elements in the table row: {output}"
    );
    assert!(
        !output.contains("_$renderAnchor("),
        "benchmark row must not emit per-row or per-text renderAnchor mounts: {output}"
    );
    assert!(
        render_item_effects <= MAX_RENDER_ITEM_EFFECTS,
        "benchmark renderItem emitted {render_item_effects} watchEffect calls; expected at most {MAX_RENDER_ITEM_EFFECTS} (total including the list entry effect: {total_effects})"
    );
    assert!(
        output.contains("Object.is("),
        "compiled class/text/attribute bindings must guard equal DOM writes: {output}"
    );
}

#[test]
fn signal_benchmark_row_uses_the_same_direct_root_budget() {
    let output = transform_signal_benchmark_row();
    let total_effects = output.matches("watchEffect(").count();
    let render_item_effects = total_effects
        .checked_sub(1)
        .expect("signal benchmark output must contain the list entry watchEffect");

    assert!(
        output.contains("directRoot: true"),
        "signal.get() bindings must retain the direct-root list path: {output}"
    );
    assert!(
        output.contains("compiledRowPatch: true"),
        "signal.get() rows must opt into the compiled-row protocol: {output}"
    );
    assert!(
        output.contains("return { patch:"),
        "signal.get() renderItem must return a compiled patch record: {output}"
    );
    assert!(
        output.contains("selected.get()"),
        "signal getter dependency reads must survive effect coalescing: {output}"
    );
    assert!(
        !output.contains("_$createTextWrapper("),
        "signal benchmark row-local text must not create wrapper elements: {output}"
    );
    assert!(
        !output.contains("_$renderAnchor("),
        "signal benchmark rows must not register per-row anchors: {output}"
    );
    assert!(
        render_item_effects <= MAX_RENDER_ITEM_EFFECTS,
        "signal benchmark renderItem emitted {render_item_effects} watchEffect calls; expected at most {MAX_RENDER_ITEM_EFFECTS} (total: {total_effects})"
    );
}

#[test]
fn signal_benchmark_stays_on_native_signal_apis() {
    let output = transform_signal_benchmark_row();

    assert!(
        output.contains("signal<Row[]>([])"),
        "native signal construction must survive compilation: {output}"
    );
    assert!(
        output.contains("rows.get()"),
        "native signal list reads must remain on SignalHandle::get: {output}"
    );
    assert!(
        output.contains("selected.get()"),
        "native signal scalar reads must remain on SignalHandle::get: {output}"
    );

    for forbidden in ["shallowRef(", "triggerRef(", "rows.value", "selected.value"] {
        assert!(
            !output.contains(forbidden),
            "native signal codegen must not fall back to `{forbidden}`: {output}"
        );
    }
}
