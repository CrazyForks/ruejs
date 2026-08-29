//! SWC 插件转换行为测试（spec25）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply;

mod utils;

#[test]
fn transforms_spec25() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Chain: FC = () => {
  return (
    <div>
      【{0 && <div>A</div>}】
      【{' ' && <div>B</div>}】
      【{'' && <div>C</div>}】
      【 {NaN && <div>D</div>}】
      【 {{} && <div>E</div>}】
      【{false && <div>F</div>}】
      【{null && <div>G</div>}】
      【{undefined && <div>H</div>}】

      ===

      【{!!0 && <div>A</div>}】
      【{!!' ' && <div>B</div>}】
      【{!!'' && <div>C</div>}】
      【 {!!NaN && <div>D</div>}】
      【 {!!{} && <div>E</div>}】
      【{!!false && <div>F</div>}】
      【{!!null && <div>G</div>}】
      【{!!undefined && <div>H</div>}】
    </div>
  )
}

export default Chain

"##;
    std::fs::create_dir_all("target/vapor_outputs").ok();
    let (program, cm) = utils::parse(src, "Refs.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { vapor, renderAnchor, _$createElement, _$createComment, _$createTextNode, _$appendChild, untrack, watchEffect, _$compiledAppendChild, _$compiledCreateElement, _$compiledCreateTextNode, _$compiledRoot } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const Chain: FC = ()=>{
    return vapor((__rue_parent_context)=>{
        const _root = _$createElement("div", __rue_parent_context);
        _$appendChild(_root, _$createTextNode("【"));
        const _list1 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list1);
        watchEffect(()=>{
            const __slot = 0 ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("A"));
                return _root;
            }) : 0;
            untrack(()=>renderAnchor(__slot, _root, _list1));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list2 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list2);
        watchEffect(()=>{
            const __slot = ' ' ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("B"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list2));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list3 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list3);
        watchEffect(()=>{
            const __slot = '' ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("C"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list3));
        });
        _$appendChild(_root, _$createTextNode("】 【 "));
        const _list4 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list4);
        watchEffect(()=>{
            const __slot = NaN ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("D"));
                return _root;
            }) : NaN;
            untrack(()=>renderAnchor(__slot, _root, _list4));
        });
        _$appendChild(_root, _$createTextNode("】 【 "));
        const _list5 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list5);
        watchEffect(()=>{
            const __slot = {} ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("E"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list5));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list6 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list6);
        watchEffect(()=>{
            const __slot = false ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("F"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list6));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list7 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list7);
        watchEffect(()=>{
            const __slot = null ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("G"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list7));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list8 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list8);
        watchEffect(()=>{
            const __slot = undefined ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("H"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list8));
        });
        _$appendChild(_root, _$createTextNode("】 === 【"));
        const _list9 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list9);
        watchEffect(()=>{
            const __slot = !!0 ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("A"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list9));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list10 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list10);
        watchEffect(()=>{
            const __slot = !!' ' ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("B"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list10));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list11 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list11);
        watchEffect(()=>{
            const __slot = !!'' ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("C"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list11));
        });
        _$appendChild(_root, _$createTextNode("】 【 "));
        const _list12 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list12);
        watchEffect(()=>{
            const __slot = !!NaN ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("D"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list12));
        });
        _$appendChild(_root, _$createTextNode("】 【 "));
        const _list13 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list13);
        watchEffect(()=>{
            const __slot = !!{} ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("E"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list13));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list14 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list14);
        watchEffect(()=>{
            const __slot = !!false ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("F"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list14));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list15 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list15);
        watchEffect(()=>{
            const __slot = !!null ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("G"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list15));
        });
        _$appendChild(_root, _$createTextNode("】 【"));
        const _list16 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list16);
        watchEffect(()=>{
            const __slot = !!undefined ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _$compiledAppendChild(_root, _$compiledCreateTextNode("H"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list16));
        });
        _$appendChild(_root, _$createTextNode("】"));
        return _root;
    });
};
export default Chain;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec25.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
