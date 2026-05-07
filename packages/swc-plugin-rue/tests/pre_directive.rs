//! SWC plugin transform tests: v-pre / r-pre
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn v_pre_skips_element_and_descendant_pre_transforms() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Demo: FC<{ ok: boolean; show: boolean; msg: string }> = (props) => {
  return (
    <div>
      <section v-pre v-show={props.show}>
        <span v-if={props.ok} v-text="props.msg"></span>
      </section>
      <p v-if={props.ok}>A</p>
      <p v-else>B</p>
    </div>
  )
}

export default Demo
"##;
    let (program, cm) = utils::parse(src, "pre_directive.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    use utils::{normalize, strip_marker};
    let out = strip_marker(&out);
    assert!(out.contains("v-pre"));
    assert!(out.contains("v-show"));
    assert!(out.contains("v-if"));
    assert!(out.contains("v-text"));
    assert!(normalize(&out).contains(normalize("{props.ok ? <p>A</p> : <p>B</p>}").as_str()));
}

#[test]
fn r_pre_breaks_if_chain_on_same_element() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Demo: FC<{ ok: boolean }> = (props) => {
  return (
    <div>
      <p r-pre r-if={props.ok}>raw</p>
      <p r-else>fallback</p>
    </div>
  )
}

export default Demo
"##;
    let (program, cm) = utils::parse(src, "pre_directive_r.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    assert!(out.contains("r-pre"));
    assert!(out.contains("r-if"));
    assert!(out.contains("r-else"));
    assert!(!out.contains("props.ok ?"));
}
