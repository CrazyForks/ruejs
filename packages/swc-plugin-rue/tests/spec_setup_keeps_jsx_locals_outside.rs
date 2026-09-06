//! SWC 插件转换行为测试（spec_setup_keeps_jsx_locals_outside）
//!
//! 覆盖：含 JSX 的本地声明不应被搬进 useSetup，否则会把 render 期依赖冻结为首次值。
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn keeps_jsx_locals_outside_use_setup() {
    let src = r##"
import { type FC, useState } from '@rue-js/rue'

const Comp: FC = () => {
  const [open, setOpen] = useState(false)
  const content = <>{open ? <span>open</span> : null}</>
  return <div onClick={() => setOpen(true)}>{content}</div>
}
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);
    let normalized = utils::normalize(&utils::strip_marker(&out));

    assert!(normalized.contains("_$compiledSetup(\"useSetup:0:0\""), "{normalized}");
    assert!(normalized.contains("const [open, setOpen] = useState(false)"), "{normalized}");
    assert!(normalized.contains("return { open: open, setOpen: setOpen }"), "{normalized}");

    assert!(normalized.contains(&utils::normalize(
        r#"const content = <>{open ? <span>open</span> : null}</>;"#,
    )));

    let setup_destructure = normalized.find("const { open: open, setOpen: setOpen }").unwrap();
    let content = normalized.find("const content =").unwrap();
    assert!(content > setup_destructure, "{normalized}");
}
