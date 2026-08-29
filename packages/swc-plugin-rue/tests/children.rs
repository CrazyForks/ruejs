//! children 与插槽相关转换测试
//!
//! 覆盖：props.children、嵌套 children、多层 Box 组件下的插槽展开。
use swc_plugin_rue::apply;

mod utils;

#[test]
fn transforms_props_children_fragment1() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Box: FC<{ title: string }> = (props) => (
  <div className="border p-2 rounded-md space-y-1">
    <div className="font-semibold">{props.title}</div>
    <div>{props.children}</div>
  </div>
);

const Children: FC = () => (
  <div className="max-w-4xl mx-auto p-6 space-y-4 rounded-lg border bg-white shadow-sm">
    <h3 className="text-xl font-semibold">children 插槽与嵌套</h3>
    <Box title="外层">
      <Box title="内层">
        <span>嵌套子元素</span>
      </Box>
    </Box>
    <RouterLink to="/jsx" className="text-blue-600 hover:underline">返回目录</RouterLink>
  </div>
);

export default Children;
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { vapor, _$createComponent, renderAnchor, _$createElement, _$template, _$createComment, _$createTextNode, _$createDocumentFragment, _$appendChild, untrack, watchEffect, _$setAttribute, _$addEventListener, _$setClassName } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const _$getTemplate1 = _$template('<h3 class="text-xl font-semibold">children 插槽与嵌套</h3>');
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
        const _root = _$createElement("div", __rue_parent_context);
        _$setClassName(_root, "max-w-4xl mx-auto p-6 space-y-4 rounded-lg border bg-white shadow-sm");
        _root.appendChild(_$getTemplate1().content.cloneNode(true));
        const _list3 = _$createComment("rue:component:anchor");
        _$appendChild(_root, _list3);
        const __child1 = vapor(()=>{
            const _root = _$createDocumentFragment();
            const _el4 = _$createElement("span", _root);
            _$appendChild(_root, _el4);
            _$appendChild(_el4, _$createTextNode("嵌套子元素"));
            return _root;
        });
        const __child2 = _$createComponent(Box, {
            title: "内层",
            children: __child1
        });
        const __slot4 = _$createComponent(Box, {
            title: "外层",
            children: __child2
        });
        renderAnchor(__slot4, _root, _list3);
        const _el5 = _$createElement("a", _root);
        _$appendChild(_root, _el5);
        watchEffect(()=>{
            _$setAttribute(_el5, "href", String(RouterLink.__rueHref("/jsx")));
        });
        _$addEventListener(_el5, "click", ((e)=>RouterLink.__rueOnClick(e, "/jsx", false)));
        _$addEventListener(_el5, "pointerenter", ((e)=>RouterLink.__rueOnPrefetch(e, "/jsx", "hover")));
        _$addEventListener(_el5, "focus", ((e)=>RouterLink.__rueOnPrefetch(e, "/jsx", "hover")));
        _$addEventListener(_el5, "pointerdown", ((e)=>RouterLink.__rueOnPrefetch(e, "/jsx", "hover")));
        _$addEventListener(_el5, "touchstart", ((e)=>RouterLink.__rueOnPrefetch(e, "/jsx", "hover")));
        _$setClassName(_el5, "text-blue-600 hover:underline");
        _$appendChild(_el5, _$createTextNode("返回目录"));
        return _root;
    });
export default Children;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/children.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
