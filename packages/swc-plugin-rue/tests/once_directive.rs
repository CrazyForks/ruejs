//! SWC plugin transform tests: v-once / r-once
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn transforms_once_directives_to_empty_dep_memo() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const OnceDemo: FC = () => {
  const msg = ref('initial')
  const alt = ref('fallback')
  return (
    <div>
      <span v-once>{msg.value}</span>
      <strong r-once>{alt.value}</strong>
    </div>
  )
}

export default OnceDemo
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"import { ref, useMemo, _$vaporWithHookId, useSetup } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const OnceDemo: FC = ()=>{
    const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{
            const msg = _$vaporWithHookId("ref:1:0", ()=>ref('initial'));
            const alt = _$vaporWithHookId("ref:1:1", ()=>ref('fallback'));
            return {
                msg: msg,
                alt: alt
            };
        }));
    const { msg: msg, alt: alt } = _$useSetup;
    return (<div>
      {_$vaporWithHookId("useMemo:161:192", ()=>useMemo(()=><span>{msg.value}</span>, []))}
      {_$vaporWithHookId("useMemo:199:234", ()=>useMemo(()=><strong>{alt.value}</strong>, []))}
    </div>);
};
export default OnceDemo;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/once_directive.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}

#[test]
fn transforms_once_directive_inside_if_chain() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Chain: FC<{ ok: boolean; msg: string; fallback: string }> = (props) => {
  return (
    <div>
      <span v-if={props.ok} v-once>{props.msg}</span>
      <span r-else r-once>{props.fallback}</span>
    </div>
  )
}

export default Chain
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"import { useMemo, _$vaporWithHookId } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const Chain: FC<{
    ok: boolean;
    msg: string;
    fallback: string;
}> = (props)=>{
    return (<div>
      {props.ok ? _$vaporWithHookId("useMemo:147:194", ()=>useMemo(()=><span>{props.msg}</span>, [])) : _$vaporWithHookId("useMemo:201:244", ()=>useMemo(()=><span>{props.fallback}</span>, []))}</div>);
};
export default Chain;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/once_if_directive.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
