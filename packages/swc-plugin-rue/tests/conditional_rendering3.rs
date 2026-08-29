//! 条件渲染转换测试（React 风格，变体 3）
//!
//! 覆盖：ref 状态控制下的嵌套三元渲染与 true 兜底。
use swc_plugin_rue::apply;
mod utils;

#[test]
fn transforms_conditional_jsx_branch3() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const ReactConditionalDemo: FC = () => {
   const show = ref(true)

  return (
    <div className="max-w-2xl mx-auto p-6 rounded-lg border bg-white shadow-sm">
      <h2 className="text-xl font-semibold text-purple-600 mb-3">React 风格条件渲染</h2>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          className="rounded-lg border border-gray-700 bg-gray-700 px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all hover:border-gray-900 hover:bg-gray-900 focus:ring focus:ring-gray-200"
          onClick={() => (show.value = !show.value)}
        >
          {show.value ? '隐藏详情' : '显示详情'}
        </button>
      </div>

      {show.value ? (
        <div className="mt-2">
          <p className="text-gray-700">详情区域：仅在 show 为 true 时显示</p>
        </div>
      ) : true}

      {show.value ? (
        <div className="mt-2">
          <p className="text-gray-700">详情区域：仅在 show 为 true 时显示</p>
        </div>
      ) : false}

      {show.value ? (
        <div className="mt-2">
          <p className="text-gray-700">详情区域：仅在 show 为 true 时显示</p>
        </div>
      ) : undefined}
    </div>
  )
}

export default ReactConditionalDemo;
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { ref, _$vaporWithHookId, useSetup, vapor, renderAnchor, _$createElement, _$template, _$createComment, _$settextContent, _$appendChild, untrack, watchEffect, _$createTextWrapper, _$addEventListener, _$setClassName, _$compiledAppendChild, _$compiledCreateElement, _$compiledCreateTextNode, _$compiledRoot } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const _$getTemplate1 = _$template('<h2 class="text-xl font-semibold text-purple-600 mb-3">React 风格条件渲染</h2>');
const ReactConditionalDemo: FC = ()=>{
    const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{
            const show = _$vaporWithHookId("ref:1:0", ()=>ref(true));
            return {
                show: show
            };
        }));
    const { show: show } = _$useSetup;
    return vapor((__rue_parent_context)=>{
        const _root = _$createElement("div", __rue_parent_context);
        _$setClassName(_root, "max-w-2xl mx-auto p-6 rounded-lg border bg-white shadow-sm");
        _root.appendChild(_$getTemplate1().content.cloneNode(true));
        const _el2 = _$createElement("div", _root);
        _$appendChild(_root, _el2);
        _$setClassName(_el2, "flex flex-wrap justify-center gap-2");
        const _el3 = _$createElement("button", _el2);
        _$appendChild(_el2, _el3);
        _$setClassName(_el3, "rounded-lg border border-gray-700 bg-gray-700 px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all hover:border-gray-900 hover:bg-gray-900 focus:ring focus:ring-gray-200");
        _$addEventListener(_el3, "click", (()=>(show.value = !show.value)));
        const _el4 = _$createTextWrapper(_el3);
        _$appendChild(_el3, _el4);
        watchEffect(()=>{
            _$settextContent(_el4, show.value ? '隐藏详情' : '显示详情');
        });
        const _list1 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list1);
        watchEffect(()=>{
            const __slot = show.value ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _root.className = "mt-2";
                const _el5 = _$compiledCreateElement("p", _root);
                _$compiledAppendChild(_root, _el5);
                _el5.className = "text-gray-700";
                _$compiledAppendChild(_el5, _$compiledCreateTextNode("详情区域：仅在 show 为 true 时显示"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list1));
        });
        const _list2 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list2);
        watchEffect(()=>{
            const __slot = show.value ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _root.className = "mt-2";
                const _el6 = _$compiledCreateElement("p", _root);
                _$compiledAppendChild(_root, _el6);
                _el6.className = "text-gray-700";
                _$compiledAppendChild(_el6, _$compiledCreateTextNode("详情区域：仅在 show 为 true 时显示"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list2));
        });
        const _list3 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list3);
        watchEffect(()=>{
            const __slot = show.value ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _root.className = "mt-2";
                const _el7 = _$compiledCreateElement("p", _root);
                _$compiledAppendChild(_root, _el7);
                _el7.className = "text-gray-700";
                _$compiledAppendChild(_el7, _$compiledCreateTextNode("详情区域：仅在 show 为 true 时显示"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list3));
        });
        return _root;
    });
};
export default ReactConditionalDemo;
"##;

    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/conditional_rendering3.out.js", utils::strip_marker(&out))
        .ok();
    assert_eq!(
        utils::normalize(&utils::strip_marker(&out)),
        utils::normalize(&utils::strip_marker(expected_fragment))
    );
}
