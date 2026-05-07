//! SWC 插件转换行为测试：v-text / r-text / v-html / r-html
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn transforms_text_directives_inside_if_chain() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Chain: FC<{ ok: boolean; msg: string; fallback: string }> = (props) => {
  return (
    <div>
      <span v-if={props.ok} v-text="props.msg"></span>
      <span r-else r-text={props.fallback}></span>
    </div>
  )
}

export default Chain
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { type FC } from '@rue-js/rue';
const Chain: FC<{
    ok: boolean;
    msg: string;
    fallback: string;
}> = (props)=>{
    return (<div>
      {props.ok ? <span>{props.msg}</span> : <span>{props.fallback}</span>}</div>);
};
export default Chain;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/text_directive.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}

#[test]
fn transforms_html_directives_inside_if_chain() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Chain: FC<{ ok: boolean; html: string; fallback: string }> = (props) => {
  return (
    <div>
      <section v-if={props.ok} v-html="props.html" className="prose">ignored</section>
      <section r-else r-html={props.fallback} className="prose"></section>
    </div>
  )
}

export default Chain
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { type FC } from '@rue-js/rue';
const Chain: FC<{
    ok: boolean;
    html: string;
    fallback: string;
}> = (props)=>{
    return (<div>
      {props.ok ? <section className="prose" dangerouslySetInnerHTML={{
        __html: props.html
    }}></section> : <section className="prose" dangerouslySetInnerHTML={{
        __html: props.fallback
    }}></section>}</div>);
};
export default Chain;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/html_directive.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
