use swc_plugin_rue::apply;

mod utils;

#[test]
fn lowers_children_slot_to_compiled_slot_mount() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Layout: FC = props => <article>{props.children}</article>
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::normalize(&utils::strip_marker(&utils::emit(program, cm)));

    assert!(out.contains(&utils::normalize("rue:text-hole:0")));
    assert!(!out.contains(&utils::normalize("_$compiledText(")));
    assert!(out.contains(&utils::normalize("_$mountCompiledSlotAt(")), "{out}");
    assert!(out.contains(&utils::normalize("()=>props.children")), "{out}");
    assert!(!out.contains("renderAnchor"), "{out}");
    assert!(!out.contains(&utils::normalize("rue:children:start")));
}

#[test]
fn lowers_conditional_slot_to_render_anchor() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Page: FC<{ ok: boolean }> = props => <section><div>{props.ok ? <span>yes</span> : ''}</div></section>
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::normalize(&utils::strip_marker(&utils::emit(program, cm)));

    assert!(out.contains(&utils::normalize("rue:text-hole:0")));
    assert!(out.contains(&utils::normalize("_$compiledBranchAt(")));
    assert!(out.contains(&utils::normalize("if (props.ok) return")));
    assert!(!out.contains("renderAnchor"));
    assert!(!out.contains(&utils::normalize("renderBetween(__slot")));
}
