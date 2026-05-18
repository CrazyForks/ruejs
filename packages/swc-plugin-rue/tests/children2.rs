//! children 转换测试（片段变体 2）
//!
//! 覆盖：children 为嵌套 div+span 的插槽展开与渲染。
use swc_plugin_rue::apply;

mod utils;

#[test]
fn transforms_props_children_fragment2() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Box: FC<{ title: string }> = (props) => (
  <div className="border p-2 rounded-md space-y-1">
    <div className="font-semibold">{props.title}</div>
    <div>{props.children}</div>
  </div>
);

const Children: FC = () => (
    <Box title="外层">
        <div>
            <span>hello</span>
            <span>嵌套子元素</span>
        </div>
    </Box>
);

export default Children;
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { vapor, _$createComponent, renderAnchor, _$createElement, _$createComment, _$createTextNode, _$createDocumentFragment, _$appendChild, untrack, watchEffect, _$setClassName } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const Box: FC<{
    title: string;
}> = (props)=>vapor((__rue_parent_context)=>{
        const _root = _$createElement("div", __rue_parent_context);
        _$setClassName(_root, "border p-2 rounded-md space-y-1");
        const _el1 = _$createElement("div", _root);
        _$appendChild(_root, _el1);
        _$setClassName(_el1, "font-semibold");
        const _list1 = _$createComment("rue:slot:anchor");
        _$appendChild(_el1, _list1);
        watchEffect(()=>{
            const __slot = (props.title);
            untrack(()=>renderAnchor(__slot, _el1, _list1));
        });
        const _el2 = _$createElement("div", _root);
        _$appendChild(_root, _el2);
        const _list2 = _$createComment("rue:children:anchor");
        _$appendChild(_el2, _list2);
        watchEffect(()=>{
            const __slot = (props.children);
            untrack(()=>renderAnchor(__slot, _el2, _list2));
        });
        return _root;
    });
const Children: FC = ()=>vapor((__rue_parent_context)=>{
        const _root = _$createDocumentFragment();
        const _list3 = _$createComment("rue:component:anchor");
        _$appendChild(_root, _list3);
        const __child1 = vapor(()=>{
            const _root = _$createDocumentFragment();
            const _el3 = _$createElement("div", _root);
            _$appendChild(_root, _el3);
            const _el4 = _$createElement("span", _el3);
            _$appendChild(_el3, _el4);
            _$appendChild(_el4, _$createTextNode("hello"));
            const _el5 = _$createElement("span", _el3);
            _$appendChild(_el3, _el5);
            _$appendChild(_el5, _$createTextNode("嵌套子元素"));
            return _root;
        });
        const __slot4 = _$createComponent(Box, {
            title: "外层",
            children: __child1
        });
        renderAnchor(__slot4, _root, _list3);
        return _root;
    });
export default Children;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/children2.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
