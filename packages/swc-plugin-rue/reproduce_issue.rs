use swc_plugin_rue::transform;
use swc_ecma_ast::Pass;

#[test]
fn test_output() {
    let src = r##"
import { type FC } from '@rue-js/rue';
const TransitionGroup: FC<{ children?: any }> = props => <div>{props.children}</div>
const Page: FC<{ items: string[] }> = props => (
  <TransitionGroup>
    {props.items.map(item => <span key={item}>{item}</span>)}
  </TransitionGroup>
)
"##;
    // Note: This is a conceptual representation as I don't have the full test harness.
    // I will try to use the existing tests/component_anchor_optimization.rs but print 'out'.
}
