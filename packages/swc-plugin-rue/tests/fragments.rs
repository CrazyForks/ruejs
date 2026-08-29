//! 片段（Fragment）转换测试
//!
//! 覆盖：<>...</> 展开为顺序插入的子节点，以及组件插入的锚点管理。
use swc_plugin_rue::apply;
mod utils;

#[test]
fn transforms_fragments_tsx() {
    let src = r##"
import { type FC } from '@rue-js/rue';
import { RouterLink } from '@rue-js/router';

const Fragments: FC = () => (
  <div className="max-w-4xl mx-auto p-6 space-y-4 rounded-lg border bg-white shadow-sm">
    <h3 className="text-xl font-semibold mb-2">Fragments</h3>
    <>
      <span>片段 1</span>
      <span>片段 2</span>
    </>
    <RouterLink to="/jsx" className="text-blue-600 hover:underline">返回目录</RouterLink>
  </div>
);

export default Fragments;
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    // 输出到目标目录便于调试
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/fragments.out.js", utils::strip_marker(&out)).ok();

    // 期望输出要点对照：
    // - 片段：<>...</> 被展开为两个 span 节点顺序插入
    // - 组件：RouterLink 被快速路径重写为原生 <a> 元素
    let expected = r##"
import { vapor, _$createElement, _$template, _$createTextNode, _$appendChild, watchEffect, _$setAttribute, _$addEventListener, _$setClassName } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
import { RouterLink } from '@rue-js/router';
const _$getTemplate1 = _$template('<h3 class="text-xl font-semibold mb-2">Fragments</h3>');
const _$getTemplate2 = _$template("<span>片段 1</span>");
const _$getTemplate3 = _$template("<span>片段 2</span>");
const Fragments: FC = ()=>vapor((__rue_parent_context)=>{
        const _root = _$createElement("div", __rue_parent_context);
        _$setClassName(_root, "max-w-4xl mx-auto p-6 space-y-4 rounded-lg border bg-white shadow-sm");
        _root.appendChild(_$getTemplate1().content.cloneNode(true));
        _root.appendChild(_$getTemplate2().content.cloneNode(true));
        _root.appendChild(_$getTemplate3().content.cloneNode(true));
        const _el4 = _$createElement("a", _root);
        _$appendChild(_root, _el4);
        watchEffect(()=>{
            _$setAttribute(_el4, "href", String(RouterLink.__rueHref("/jsx")));
        });
        _$addEventListener(_el4, "click", ((e)=>RouterLink.__rueOnClick(e, "/jsx", false)));
        _$addEventListener(_el4, "pointerenter", ((e)=>RouterLink.__rueOnPrefetch(e, "/jsx", "hover")));
        _$addEventListener(_el4, "focus", ((e)=>RouterLink.__rueOnPrefetch(e, "/jsx", "hover")));
        _$addEventListener(_el4, "pointerdown", ((e)=>RouterLink.__rueOnPrefetch(e, "/jsx", "hover")));
        _$addEventListener(_el4, "touchstart", ((e)=>RouterLink.__rueOnPrefetch(e, "/jsx", "hover")));
        _$setClassName(_el4, "text-blue-600 hover:underline");
        _$appendChild(_el4, _$createTextNode("返回目录"));
        return _root;
    });
export default Fragments;
"##;

    let norm_out = utils::normalize(&utils::strip_marker(&out));
    let norm_exp = utils::normalize(&utils::strip_marker(expected));
    assert_eq!(norm_out, norm_exp, "Fragments.tsx should transform as expected");
}
