//! 条件渲染转换测试（React 风格，变体 2）
//!
//! 覆盖：ref 状态驱动的 ?: 分支切换与按钮事件更新。
use swc_plugin_rue::apply;
mod utils;

#[test]
fn transforms_conditional_jsx_branch2() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const ReactConditionalDemo: FC = () => {
   const show = ref(true)
   const level = ref(1)
   const message = ref('Hello')

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
        <button
          className="rounded-lg border border-blue-500 bg-blue-500 px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all hover:border-blue-700 hover:bg-blue-700 focus:ring focus:ring-blue-200"
          onClick={() => level.value++}
        >
          等级+1
        </button>
        <button
          className="rounded-lg border border-gray-500 bg-gray-500 px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all hover:border-gray-700 hover:bg-gray-700 focus:ring focus:ring-gray-200"
          onClick={() => (message.value = message.value ? '' : 'Hello')}
        >
          {message.value ? <span className="text-red-600">清空消息</span> : '恢复消息'}
        </button>
      </div>

      {show.value ? (
        <div className="mt-2">
          <p className="text-gray-700">详情区域：仅在 show 为 true 时显示</p>
        </div>
      ) : null}

     {show.value &&
        <div className="mt-2">
          <p className="text-gray-700">详情区域2：仅在 show 为 true 时显示</p>
        </div>}

      <p className="text-gray-700">等级状态：{level.value >= 3 ? <span className="text-red-600">高级</span> : <span className="text-green-600">普通</span>}</p>
      {message.value ? <p className="text-gray-700 bg-gray-100 p-2 rounded-md">消息：{message.value}</p> : null}
    </div>
  )
}

export default ReactConditionalDemo;
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { ref, _$vaporWithHookId, useSetup, vapor, renderAnchor, _$createElement, _$template, _$createComment, _$createTextNode, _$settextContent, _$createDocumentFragment, _$appendChild, untrack, watchEffect, _$createTextWrapper, _$addEventListener, _$setClassName, _$compiledAppendChild, _$compiledCreateElement, _$compiledCreateTextNode, _$compiledRoot } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const _$getTemplate1 = _$template('<h2 class="text-xl font-semibold text-purple-600 mb-3">React 风格条件渲染</h2>');
const ReactConditionalDemo: FC = ()=>{
    const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{
            const show = _$vaporWithHookId("ref:1:0", ()=>ref(true));
            const level = _$vaporWithHookId("ref:1:1", ()=>ref(1));
            const message = _$vaporWithHookId("ref:1:2", ()=>ref('Hello'));
            return {
                show: show,
                level: level,
                message: message
            };
        }));
    const { show: show, level: level, message: message } = _$useSetup;
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
        const _el5 = _$createElement("button", _el2);
        _$appendChild(_el2, _el5);
        _$setClassName(_el5, "rounded-lg border border-blue-500 bg-blue-500 px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all hover:border-blue-700 hover:bg-blue-700 focus:ring focus:ring-blue-200");
        _$addEventListener(_el5, "click", (()=>level.value++));
        _$appendChild(_el5, _$createTextNode("等级+1"));
        const _el6 = _$createElement("button", _el2);
        _$appendChild(_el2, _el6);
        _$setClassName(_el6, "rounded-lg border border-gray-500 bg-gray-500 px-5 py-2.5 text-center text-sm font-medium text-white shadow-sm transition-all hover:border-gray-700 hover:bg-gray-700 focus:ring focus:ring-gray-200");
        _$addEventListener(_el6, "click", (()=>(message.value = message.value ? '' : 'Hello')));
        const _list1 = _$createComment("rue:slot:anchor");
        _$appendChild(_el6, _list1);
        watchEffect(()=>{
            const __slot = message.value ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("span", __rue_parent_context);
                _root.className = "text-red-600";
                _$compiledAppendChild(_root, _$compiledCreateTextNode("清空消息"));
                return _root;
            }) : '恢复消息';
            untrack(()=>renderAnchor(__slot, _el6, _list1));
        });
        const _list2 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list2);
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
            untrack(()=>renderAnchor(__slot, _root, _list2));
        });
        const _list3 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list3);
        watchEffect(()=>{
            const __slot = show.value ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("div", __rue_parent_context);
                _root.className = "mt-2";
                const _el8 = _$compiledCreateElement("p", _root);
                _$compiledAppendChild(_root, _el8);
                _el8.className = "text-gray-700";
                _$compiledAppendChild(_el8, _$compiledCreateTextNode("详情区域2：仅在 show 为 true 时显示"));
                return _root;
            }) : "";
            untrack(()=>renderAnchor(__slot, _root, _list3));
        });
        const _el9 = _$createElement("p", _root);
        _$appendChild(_root, _el9);
        _$setClassName(_el9, "text-gray-700");
        _$appendChild(_el9, _$createTextNode("等级状态："));
        const _list4 = _$createComment("rue:slot:anchor");
        _$appendChild(_el9, _list4);
        watchEffect(()=>{
            const __slot = level.value >= 3 ? _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("span", __rue_parent_context);
                _root.className = "text-red-600";
                _$compiledAppendChild(_root, _$compiledCreateTextNode("高级"));
                return _root;
            }) : _$compiledRoot((__rue_parent_context)=>{
                const _root = _$compiledCreateElement("span", __rue_parent_context);
                _root.className = "text-green-600";
                _$compiledAppendChild(_root, _$compiledCreateTextNode("普通"));
                return _root;
            });
            untrack(()=>renderAnchor(__slot, _el9, _list4));
        });
        const _list5 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list5);
        watchEffect(()=>{
            const __slot = message.value ? vapor(()=>{
                const _root = _$createDocumentFragment();
                const _el10 = _$createElement("p", _root);
                _$appendChild(_root, _el10);
                _$setClassName(_el10, "text-gray-700 bg-gray-100 p-2 rounded-md");
                _$appendChild(_el10, _$createTextNode("消息："));
                const _el11 = _$createTextWrapper(_el10);
                _$appendChild(_el10, _el11);
                watchEffect(()=>{
                    _$settextContent(_el11, message.value);
                });
                return _root;
            }, true) : "";
            untrack(()=>renderAnchor(__slot, _root, _list5));
        });
        return _root;
    });
};
export default ReactConditionalDemo;
"##;

    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/conditional_rendering2.out.js", utils::strip_marker(&out))
        .ok();
    assert_eq!(
        utils::normalize(&utils::strip_marker(&out)),
        utils::normalize(&utils::strip_marker(expected_fragment))
    );
}
