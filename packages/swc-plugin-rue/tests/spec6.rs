//! SWC 插件转换行为测试（spec6）
//!
//! 覆盖：更复杂 JSX 结构的降解与重写。
use swc_plugin_rue::apply;

mod utils;

#[test]
fn transforms_spec6() {
    let src = r##"
import { type FC, ref, h } from '@rue-js/rue';
const count = ref(22);
const Comp: FC = () => (
  <div>
    {count.value === 0 ? (
      <p id="empty">empty</p>
    ) : (
      <ul>
        <li>ok</li>
      </ul>
    )}
    <span id="n">{count.value}</span>
  </div>
);
export default Comp;
"##;
    std::fs::create_dir_all("target/vapor_outputs").ok();
    let (program, cm) = utils::parse(src, "Refs.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"import { ref, _$vaporWithHookId, vapor, renderAnchor, _$createElement, _$createComment, _$settextContent, _$appendChild, untrack, watchEffect, _$createTextWrapper, _$setAttribute, _$compiledAppendChild, _$compiledCreateElement, _$compiledCreateTextNode, _$compiledRoot } from "@rue-js/rue/vapor";
import { type FC, h } from '@rue-js/rue';
const count = _$vaporWithHookId("ref:1:0", ()=>ref(22));
const Comp: FC = ()=>vapor((__rue_parent_context)=>{
        const _root = _$createElement("div", __rue_parent_context);
        const _list1 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list1);
        watchEffect(()=>{
            const __slot = count.value === 0 ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("p", __rue_parent_context);
                _root.setAttribute("id", "empty");
                _$compiledAppendChild(_root, _$compiledCreateTextNode("empty"));
                return _root;
            }) : _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("ul", __rue_parent_context);
                const _el1 = _$compiledCreateElement("li", _root);
                _$compiledAppendChild(_root, _el1);
                _$compiledAppendChild(_el1, _$compiledCreateTextNode("ok"));
                return _root;
            });
            untrack(()=>renderAnchor(__slot, _root, _list1));
        });
        const _el2 = _$createElement("span", _root);
        _$appendChild(_root, _el2);
        _$setAttribute(_el2, "id", "n");
        const _el3 = _$createTextWrapper(_el2);
        _$appendChild(_el2, _el3);
        watchEffect(()=>{
            _$settextContent(_el3, count.value);
        });
        return _root;
    });
export default Comp;"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec6.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
