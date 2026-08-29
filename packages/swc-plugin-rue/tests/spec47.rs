//! SWC 插件转换行为测试（spec47）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply;

mod utils;

#[test]
fn transforms_spec47() {
    let src = r##"
import { type FC } from '@rue-js/rue'

const About: FC = () => {
  return (
    <div className="max-w-[900px] mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">空白字符处理 Demo（参考 React 行为）</h1>
      <p className="text-base-content/70">
        本页演示浏览器与 JSX 对空白字符（空格、Tab、换行）的处理方式：默认会折叠连续空白；某些场景可用
        {' '}<code className="bg-base-200 px-1 rounded">{'{'}' '{'}'}</code>{' '}或{' '}
        <code className="bg-base-200 px-1 rounded">&nbsp;</code>{' '}来显式插入空格；也可用 CSS
        {' '}<code className="bg-base-200 px-1 rounded">white-space</code>{' '}控制。
      </p>

      <div className="card bg-base-100 border">
        <div className="card-body">
          <h2 className="text-lg font-semibold">1) 默认空白折叠</h2>
          <p className="text-sm text-base-content/70">
            连续空格与换行会被折叠为单个空格，行首/行尾空白通常被忽略。
          </p>
          <div className="mt-3 rounded-box border p-4">
            <p>AA    BB      CC</p>
            <p>
              行首空白：
              {'     '}
              Start
            </p>
            <p>
              多行文本：
              AA
              BB
              CC
            </p>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border">
        <div className="card-body">
          <h2 className="text-lg font-semibold">2) JSX 显式空格 {'{'}' '{'}'}</h2>
          <p className="text-sm text-base-content/70">
            在 JSX 中，跨行或相邻内联元素之间的空白可能被裁剪；可用
            {' '}<code className="bg-base-200 px-1 rounded">{'{'}' '{'}'}</code>{' '}插入一个明确的空格。
          </p>
          <div className="mt-3 rounded-box border p-4">
            <div>
              <span>Foo</span>
              <span>Bar</span>
              <span>Baz</span>
            </div>
            <div className="opacity-70 text-sm">上面三个相邻元素通常会连在一起</div>
            <div className="mt-2">
              <span>Foo</span>
              {' '}
              <span>Bar</span>
              {' '}
              <span>Baz</span>
            </div>
            <div className="opacity-70 text-sm">使用 {'{'}' '{'}'} 显式空格分隔</div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border">
        <div className="card-body">
          <h2 className="text-lg font-semibold">3) 不换行空格 &nbsp;</h2>
          <p className="text-sm text-base-content/70">
            使用 HTML 实体 <code className="bg-base-200 px-1 rounded">&amp;nbsp;</code>{' '}
            可以插入一个不换行空格，避免被折叠或在换行处断开。
          </p>
          <div className="mt-3 rounded-box border p-4">
            <p>
              价格：100&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;USD，编号：AB&nbsp;&nbsp;1234
            </p>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border">
        <div className="card-body">
          <h2 className="text-lg font-semibold">4) CSS white-space 控制</h2>
          <p className="text-sm text-base-content/70">
            通过 CSS 的 <code className="bg-base-200 px-1 rounded">white-space</code>{' '}
            可改变空白处理策略。
          </p>
          <div className="mt-3 grid md:grid-cols-3 gap-3">
            <div className="rounded-box border p-3">
              <div className="text-sm font-semibold mb-1">normal（默认）</div>
              <div style={{ whiteSpace: 'normal' }}>
                A    B      C
                {'\n'}
                line-1
                {'\n'}
                line-2
              </div>
            </div>
            <div className="rounded-box border p-3">
              <div className="text-sm font-semibold mb-1">pre</div>
              <div style={{ whiteSpace: 'pre' }}>
                A    B      C
                {'\n'}
                line-1
                {'\n'}
                line-2
              </div>
            </div>
            <div className="rounded-box border p-3">
              <div className="text-sm font-semibold mb-1">pre-wrap</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                A    B      C
                {'\n'}
                line-1
                {'\n'}
                line-2
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border">
        <div className="card-body">
          <h2 className="text-lg font-semibold">5) inline-block 间隙</h2>
          <p className="text-sm text-base-content/70">
            内联块（inline-block）之间如果在源码里有空格/换行，会产生可见间隙；可通过删除空白或使用
            {' '}<code className="bg-base-200 px-1 rounded">{'{'}' '{'}'}</code>{' '}精控。
          </p>
          <div className="mt-3">
            <div className="rounded-box border p-4">
              <span className="inline-block bg-primary/20 px-3 py-2">Box A</span>
              <span className="inline-block bg-primary/20 px-3 py-2">Box B</span>
            </div>
            <div className="rounded-box border p-4">
              <span className="inline-block bg-primary/20 px-3 py-2">Box A</span> <span className="inline-block bg-primary/20 px-3 py-2">Box B</span>
            </div>
            <div className="opacity-70 text-sm mt-1">上面 A 与 B 之间存在由空白产生的间隙</div>
            <div className="rounded-box border p-4 mt-2">
              <span className="inline-block bg-accent/20 px-3 py-2">Box A</span>{' '}
              <span className="inline-block bg-accent/20 px-3 py-2">Box B</span>
            </div>
            <div className="opacity-70 text-sm mt-1">使用 {'{'}' '{'}'} 显式控制间隙大小</div>
          </div>
        </div>

        <div>
          © {new Date().getFullYear()} Rue.js
        </div>
      </div>
    </div>
  )
}

export default About
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { vapor, _$createElement, _$template, _$createTextNode, _$setStyle, _$settextContent, _$appendChild, watchEffect, _$createTextWrapper, _$setClassName } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const _$getTemplate1 = _$template('<h1 class="text-2xl font-semibold">空白字符处理 Demo（参考 React 行为）</h1>');
const _$getTemplate2 = _$template('<code class="bg-base-200 px-1 rounded"></code>');
const _$getTemplate3 = _$template('<code class="bg-base-200 px-1 rounded">white-space</code>');
const _$getTemplate4 = _$template('<h2 class="text-lg font-semibold">1) 默认空白折叠</h2>');
const _$getTemplate5 = _$template('<p class="text-sm text-base-content/70">连续空格与换行会被折叠为单个空格，行首/行尾空白通常被忽略。</p>');
const _$getTemplate6 = _$template("<p>AA    BB      CC</p>");
const _$getTemplate7 = _$template("<p>多行文本： AA BB CC</p>");
const _$getTemplate8 = _$template("<div><span>Foo</span><span>Bar</span><span>Baz</span></div>");
const _$getTemplate9 = _$template('<div class="opacity-70 text-sm">上面三个相邻元素通常会连在一起</div>');
const _$getTemplate10 = _$template("<span>Foo</span>");
const _$getTemplate11 = _$template("<span>Bar</span>");
const _$getTemplate12 = _$template("<span>Baz</span>");
const _$getTemplate13 = _$template('<h2 class="text-lg font-semibold">3) 不换行空格</h2>');
const _$getTemplate14 = _$template('<code class="bg-base-200 px-1 rounded">&amp;nbsp;</code>');
const _$getTemplate15 = _$template('<div class="mt-3 rounded-box border p-4"><p>价格：100      USD，编号：AB  1234</p></div>');
const _$getTemplate16 = _$template('<h2 class="text-lg font-semibold">4) CSS white-space 控制</h2>');
const _$getTemplate17 = _$template('<div class="text-sm font-semibold mb-1">normal（默认）</div>');
const _$getTemplate18 = _$template('<div class="text-sm font-semibold mb-1">pre</div>');
const _$getTemplate19 = _$template('<div class="text-sm font-semibold mb-1">pre-wrap</div>');
const _$getTemplate20 = _$template('<h2 class="text-lg font-semibold">5) inline-block 间隙</h2>');
const _$getTemplate21 = _$template('<div class="rounded-box border p-4"><span class="inline-block bg-primary/20 px-3 py-2">Box A</span><span class="inline-block bg-primary/20 px-3 py-2">Box B</span></div>');
const _$getTemplate22 = _$template('<div class="rounded-box border p-4"><span class="inline-block bg-primary/20 px-3 py-2">Box A</span> <span class="inline-block bg-primary/20 px-3 py-2">Box B</span></div>');
const _$getTemplate23 = _$template('<div class="opacity-70 text-sm mt-1">上面 A 与 B 之间存在由空白产生的间隙</div>');
const _$getTemplate24 = _$template('<span class="inline-block bg-accent/20 px-3 py-2">Box A</span>');
const _$getTemplate25 = _$template('<span class="inline-block bg-accent/20 px-3 py-2">Box B</span>');
const About: FC = ()=>{
    return vapor((__rue_parent_context)=>{
        const _root = _$createElement("div", __rue_parent_context);
        _$setClassName(_root, "max-w-[900px] mx-auto space-y-8");
        _root.appendChild(_$getTemplate1().content.cloneNode(true));
        const _el2 = _$createElement("p", _root);
        _$appendChild(_root, _el2);
        _$setClassName(_el2, "text-base-content/70");
        _$appendChild(_el2, _$createTextNode("本页演示浏览器与 JSX 对空白字符（空格、Tab、换行）的处理方式：默认会折叠连续空白；某些场景可用"));
        const _el3 = _$createTextWrapper(_el2);
        _$appendChild(_el2, _el3);
        _$settextContent(_el3, ' ');
        const _el4 = _$createElement("code", _el2);
        _$appendChild(_el2, _el4);
        _$setClassName(_el4, "bg-base-200 px-1 rounded");
        const _el5 = _$createTextWrapper(_el4);
        _$appendChild(_el4, _el5);
        _$settextContent(_el5, '{');
        _$appendChild(_el4, _$createTextNode("' '"));
        const _el6 = _$createTextWrapper(_el4);
        _$appendChild(_el4, _el6);
        _$settextContent(_el6, '}');
        const _el7 = _$createTextWrapper(_el2);
        _$appendChild(_el2, _el7);
        _$settextContent(_el7, ' ');
        _$appendChild(_el2, _$createTextNode("或"));
        const _el8 = _$createTextWrapper(_el2);
        _$appendChild(_el2, _el8);
        _$settextContent(_el8, ' ');
        _el2.appendChild(_$getTemplate2().content.cloneNode(true));
        const _el10 = _$createTextWrapper(_el2);
        _$appendChild(_el2, _el10);
        _$settextContent(_el10, ' ');
        _$appendChild(_el2, _$createTextNode("来显式插入空格；也可用 CSS"));
        const _el11 = _$createTextWrapper(_el2);
        _$appendChild(_el2, _el11);
        _$settextContent(_el11, ' ');
        _el2.appendChild(_$getTemplate3().content.cloneNode(true));
        const _el13 = _$createTextWrapper(_el2);
        _$appendChild(_el2, _el13);
        _$settextContent(_el13, ' ');
        _$appendChild(_el2, _$createTextNode("控制。"));
        const _el14 = _$createElement("div", _root);
        _$appendChild(_root, _el14);
        _$setClassName(_el14, "card bg-base-100 border");
        const _el15 = _$createElement("div", _el14);
        _$appendChild(_el14, _el15);
        _$setClassName(_el15, "card-body");
        _el15.appendChild(_$getTemplate4().content.cloneNode(true));
        _el15.appendChild(_$getTemplate5().content.cloneNode(true));
        const _el18 = _$createElement("div", _el15);
        _$appendChild(_el15, _el18);
        _$setClassName(_el18, "mt-3 rounded-box border p-4");
        _el18.appendChild(_$getTemplate6().content.cloneNode(true));
        const _el20 = _$createElement("p", _el18);
        _$appendChild(_el18, _el20);
        _$appendChild(_el20, _$createTextNode("行首空白： "));
        const _el21 = _$createTextWrapper(_el20);
        _$appendChild(_el20, _el21);
        _$settextContent(_el21, '     ');
        _$appendChild(_el20, _$createTextNode(" Start"));
        _el18.appendChild(_$getTemplate7().content.cloneNode(true));
        const _el23 = _$createElement("div", _root);
        _$appendChild(_root, _el23);
        _$setClassName(_el23, "card bg-base-100 border");
        const _el24 = _$createElement("div", _el23);
        _$appendChild(_el23, _el24);
        _$setClassName(_el24, "card-body");
        const _el25 = _$createElement("h2", _el24);
        _$appendChild(_el24, _el25);
        _$setClassName(_el25, "text-lg font-semibold");
        _$appendChild(_el25, _$createTextNode("2) JSX 显式空格 "));
        const _el26 = _$createTextWrapper(_el25);
        _$appendChild(_el25, _el26);
        _$settextContent(_el26, '{');
        _$appendChild(_el25, _$createTextNode("' '"));
        const _el27 = _$createTextWrapper(_el25);
        _$appendChild(_el25, _el27);
        _$settextContent(_el27, '}');
        const _el28 = _$createElement("p", _el24);
        _$appendChild(_el24, _el28);
        _$setClassName(_el28, "text-sm text-base-content/70");
        _$appendChild(_el28, _$createTextNode("在 JSX 中，跨行或相邻内联元素之间的空白可能被裁剪；可用"));
        const _el29 = _$createTextWrapper(_el28);
        _$appendChild(_el28, _el29);
        _$settextContent(_el29, ' ');
        const _el30 = _$createElement("code", _el28);
        _$appendChild(_el28, _el30);
        _$setClassName(_el30, "bg-base-200 px-1 rounded");
        const _el31 = _$createTextWrapper(_el30);
        _$appendChild(_el30, _el31);
        _$settextContent(_el31, '{');
        _$appendChild(_el30, _$createTextNode("' '"));
        const _el32 = _$createTextWrapper(_el30);
        _$appendChild(_el30, _el32);
        _$settextContent(_el32, '}');
        const _el33 = _$createTextWrapper(_el28);
        _$appendChild(_el28, _el33);
        _$settextContent(_el33, ' ');
        _$appendChild(_el28, _$createTextNode("插入一个明确的空格。"));
        const _el34 = _$createElement("div", _el24);
        _$appendChild(_el24, _el34);
        _$setClassName(_el34, "mt-3 rounded-box border p-4");
        _el34.appendChild(_$getTemplate8().content.cloneNode(true));
        _el34.appendChild(_$getTemplate9().content.cloneNode(true));
        const _el40 = _$createElement("div", _el34);
        _$appendChild(_el34, _el40);
        _$setClassName(_el40, "mt-2");
        _el40.appendChild(_$getTemplate10().content.cloneNode(true));
        const _el42 = _$createTextWrapper(_el40);
        _$appendChild(_el40, _el42);
        _$settextContent(_el42, ' ');
        _el40.appendChild(_$getTemplate11().content.cloneNode(true));
        const _el44 = _$createTextWrapper(_el40);
        _$appendChild(_el40, _el44);
        _$settextContent(_el44, ' ');
        _el40.appendChild(_$getTemplate12().content.cloneNode(true));
        const _el46 = _$createElement("div", _el34);
        _$appendChild(_el34, _el46);
        _$setClassName(_el46, "opacity-70 text-sm");
        _$appendChild(_el46, _$createTextNode("使用 "));
        const _el47 = _$createTextWrapper(_el46);
        _$appendChild(_el46, _el47);
        _$settextContent(_el47, '{');
        _$appendChild(_el46, _$createTextNode("' '"));
        const _el48 = _$createTextWrapper(_el46);
        _$appendChild(_el46, _el48);
        _$settextContent(_el48, '}');
        _$appendChild(_el46, _$createTextNode(" 显式空格分隔"));
        const _el49 = _$createElement("div", _root);
        _$appendChild(_root, _el49);
        _$setClassName(_el49, "card bg-base-100 border");
        const _el50 = _$createElement("div", _el49);
        _$appendChild(_el49, _el50);
        _$setClassName(_el50, "card-body");
        _el50.appendChild(_$getTemplate13().content.cloneNode(true));
        const _el52 = _$createElement("p", _el50);
        _$appendChild(_el50, _el52);
        _$setClassName(_el52, "text-sm text-base-content/70");
        _$appendChild(_el52, _$createTextNode("使用 HTML 实体 "));
        _el52.appendChild(_$getTemplate14().content.cloneNode(true));
        const _el54 = _$createTextWrapper(_el52);
        _$appendChild(_el52, _el54);
        _$settextContent(_el54, ' ');
        _$appendChild(_el52, _$createTextNode("可以插入一个不换行空格，避免被折叠或在换行处断开。"));
        _el50.appendChild(_$getTemplate15().content.cloneNode(true));
        const _el57 = _$createElement("div", _root);
        _$appendChild(_root, _el57);
        _$setClassName(_el57, "card bg-base-100 border");
        const _el58 = _$createElement("div", _el57);
        _$appendChild(_el57, _el58);
        _$setClassName(_el58, "card-body");
        _el58.appendChild(_$getTemplate16().content.cloneNode(true));
        const _el60 = _$createElement("p", _el58);
        _$appendChild(_el58, _el60);
        _$setClassName(_el60, "text-sm text-base-content/70");
        _$appendChild(_el60, _$createTextNode("通过 CSS 的 "));
        _el60.appendChild(_$getTemplate3().content.cloneNode(true));
        const _el62 = _$createTextWrapper(_el60);
        _$appendChild(_el60, _el62);
        _$settextContent(_el62, ' ');
        _$appendChild(_el60, _$createTextNode("可改变空白处理策略。"));
        const _el63 = _$createElement("div", _el58);
        _$appendChild(_el58, _el63);
        _$setClassName(_el63, "mt-3 grid md:grid-cols-3 gap-3");
        const _el64 = _$createElement("div", _el63);
        _$appendChild(_el63, _el64);
        _$setClassName(_el64, "rounded-box border p-3");
        _el64.appendChild(_$getTemplate17().content.cloneNode(true));
        const _el66 = _$createElement("div", _el64);
        _$appendChild(_el64, _el66);
        _$setStyle(_el66, {
            whiteSpace: 'normal'
        });
        _$appendChild(_el66, _$createTextNode("A    B      C "));
        const _el67 = _$createTextWrapper(_el66);
        _$appendChild(_el66, _el67);
        _$settextContent(_el67, '\n');
        _$appendChild(_el66, _$createTextNode(" line-1 "));
        const _el68 = _$createTextWrapper(_el66);
        _$appendChild(_el66, _el68);
        _$settextContent(_el68, '\n');
        _$appendChild(_el66, _$createTextNode(" line-2"));
        const _el69 = _$createElement("div", _el63);
        _$appendChild(_el63, _el69);
        _$setClassName(_el69, "rounded-box border p-3");
        _el69.appendChild(_$getTemplate18().content.cloneNode(true));
        const _el71 = _$createElement("div", _el69);
        _$appendChild(_el69, _el71);
        _$setStyle(_el71, {
            whiteSpace: 'pre'
        });
        _$appendChild(_el71, _$createTextNode("A    B      C "));
        const _el72 = _$createTextWrapper(_el71);
        _$appendChild(_el71, _el72);
        _$settextContent(_el72, '\n');
        _$appendChild(_el71, _$createTextNode(" line-1 "));
        const _el73 = _$createTextWrapper(_el71);
        _$appendChild(_el71, _el73);
        _$settextContent(_el73, '\n');
        _$appendChild(_el71, _$createTextNode(" line-2"));
        const _el74 = _$createElement("div", _el63);
        _$appendChild(_el63, _el74);
        _$setClassName(_el74, "rounded-box border p-3");
        _el74.appendChild(_$getTemplate19().content.cloneNode(true));
        const _el76 = _$createElement("div", _el74);
        _$appendChild(_el74, _el76);
        _$setStyle(_el76, {
            whiteSpace: 'pre-wrap'
        });
        _$appendChild(_el76, _$createTextNode("A    B      C "));
        const _el77 = _$createTextWrapper(_el76);
        _$appendChild(_el76, _el77);
        _$settextContent(_el77, '\n');
        _$appendChild(_el76, _$createTextNode(" line-1 "));
        const _el78 = _$createTextWrapper(_el76);
        _$appendChild(_el76, _el78);
        _$settextContent(_el78, '\n');
        _$appendChild(_el76, _$createTextNode(" line-2"));
        const _el79 = _$createElement("div", _root);
        _$appendChild(_root, _el79);
        _$setClassName(_el79, "card bg-base-100 border");
        const _el80 = _$createElement("div", _el79);
        _$appendChild(_el79, _el80);
        _$setClassName(_el80, "card-body");
        _el80.appendChild(_$getTemplate20().content.cloneNode(true));
        const _el82 = _$createElement("p", _el80);
        _$appendChild(_el80, _el82);
        _$setClassName(_el82, "text-sm text-base-content/70");
        _$appendChild(_el82, _$createTextNode("内联块（inline-block）之间如果在源码里有空格/换行，会产生可见间隙；可通过删除空白或使用"));
        const _el83 = _$createTextWrapper(_el82);
        _$appendChild(_el82, _el83);
        _$settextContent(_el83, ' ');
        const _el84 = _$createElement("code", _el82);
        _$appendChild(_el82, _el84);
        _$setClassName(_el84, "bg-base-200 px-1 rounded");
        const _el85 = _$createTextWrapper(_el84);
        _$appendChild(_el84, _el85);
        _$settextContent(_el85, '{');
        _$appendChild(_el84, _$createTextNode("' '"));
        const _el86 = _$createTextWrapper(_el84);
        _$appendChild(_el84, _el86);
        _$settextContent(_el86, '}');
        const _el87 = _$createTextWrapper(_el82);
        _$appendChild(_el82, _el87);
        _$settextContent(_el87, ' ');
        _$appendChild(_el82, _$createTextNode("精控。"));
        const _el88 = _$createElement("div", _el80);
        _$appendChild(_el80, _el88);
        _$setClassName(_el88, "mt-3");
        _el88.appendChild(_$getTemplate21().content.cloneNode(true));
        _el88.appendChild(_$getTemplate22().content.cloneNode(true));
        _el88.appendChild(_$getTemplate23().content.cloneNode(true));
        const _el96 = _$createElement("div", _el88);
        _$appendChild(_el88, _el96);
        _$setClassName(_el96, "rounded-box border p-4 mt-2");
        _el96.appendChild(_$getTemplate24().content.cloneNode(true));
        const _el98 = _$createTextWrapper(_el96);
        _$appendChild(_el96, _el98);
        _$settextContent(_el98, ' ');
        _el96.appendChild(_$getTemplate25().content.cloneNode(true));
        const _el100 = _$createElement("div", _el88);
        _$appendChild(_el88, _el100);
        _$setClassName(_el100, "opacity-70 text-sm mt-1");
        _$appendChild(_el100, _$createTextNode("使用 "));
        const _el101 = _$createTextWrapper(_el100);
        _$appendChild(_el100, _el101);
        _$settextContent(_el101, '{');
        _$appendChild(_el100, _$createTextNode("' '"));
        const _el102 = _$createTextWrapper(_el100);
        _$appendChild(_el100, _el102);
        _$settextContent(_el102, '}');
        _$appendChild(_el100, _$createTextNode(" 显式控制间隙大小"));
        const _el103 = _$createElement("div", _el79);
        _$appendChild(_el79, _el103);
        _$appendChild(_el103, _$createTextNode("© "));
        const _el104 = _$createTextWrapper(_el103);
        _$appendChild(_el103, _el104);
        watchEffect(()=>{
            _$settextContent(_el104, new Date().getFullYear());
        });
        _$appendChild(_el103, _$createTextNode(" Rue.js"));
        return _root;
    });
};
export default About;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec47.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
