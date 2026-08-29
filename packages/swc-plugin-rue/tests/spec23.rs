//! SWC 插件转换行为测试（spec23）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply;

mod utils;

#[test]
fn transforms_spec23_logical_or() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const show = false
const a = false
const b = false

const OrCases: FC = () => {
  return <div>
    {show || <div>Alt</div>}
    {a ? <div>A</div> : (b || <div>B</div>)}
  </div>
}

export default OrCases
"##;
    std::fs::create_dir_all("target/vapor_outputs").ok();
    let (program, cm) = utils::parse(src, "Refs.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { vapor, renderAnchor, _$createElement, _$createComment, _$appendChild, untrack, watchEffect, _$compiledAppendChild, _$compiledCreateElement, _$compiledCreateTextNode, _$compiledRoot } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const show = false;
const a = false;
const b = false;
const OrCases: FC = ()=>{
    return vapor((__rue_parent_context)=>{
        const _root = _$createElement("div", __rue_parent_context);
        const _list1 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list1);
        watchEffect(()=>{
            const __slot = show || _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("Alt"));
                return _root;
            });
            untrack(()=>renderAnchor(__slot, _root, _list1));
        });
        const _list2 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list2);
        watchEffect(()=>{
            const __slot = a ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("A"));
                return _root;
            }) : b || _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("B"));
                return _root;
            });
            untrack(()=>renderAnchor(__slot, _root, _list2));
        });
        return _root;
    });
};
export default OrCases;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec23.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
