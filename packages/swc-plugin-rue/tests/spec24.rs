//! SWC 插件转换行为测试（spec24）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply;

mod utils;

#[test]
fn transforms_spec24() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const Chain: FC = () => {
  return <div>
    【<div>A </div>】
    【<div>B</div>】
    【<div>C d</div>】
    【<div> D </div>】
    【<div>E g</div>】
    【<div>F</div>】
    【<div>
      E
    </div>】
  </div>
}

export default Chain
"##;
    std::fs::create_dir_all("target/vapor_outputs").ok();
    let (program, cm) = utils::parse(src, "Refs.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { _$template } from "@rue-js/rue/compiled";
import { type FC } from '@rue-js/rue';
const _$getTemplate1 = _$template("<div>【<div>A</div>】 【<div>B</div>】 【<div>C d</div>】 【<div>D</div>】 【<div>E g</div>】 【<div>F</div>】 【<div>E</div>】</div>");
const Chain: FC = ()=>{
    return (()=>{
        let _root;
        let _disposed = false;
        const _dispose = ()=>{
            if (_disposed) return;
            _disposed = true;
            if (_root && _root.parentNode) {
                _root.parentNode.removeChild(_root);
            }
        };
        return {
            __rue_cleanup_bucket: [
                _dispose
            ],
            __rue_vapor_setup: (__rue_parent_context)=>{
                if (_disposed) {
                    throw new Error("Cannot mount a disposed static root");
                }
                if (_root) {
                    throw new Error("A static root can only be mounted once");
                }
                const _fragment = _$getTemplate1().content.cloneNode(true);
                _root = _fragment.firstChild;
                return _root;
            },
            dispose: _dispose
        };
    })();
};
export default Chain;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec24.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
