use swc_plugin_rue::apply;

mod utils;

fn compile(src: &str, name: &str) -> String {
    let (program, cm) = utils::parse(src, &format!("{name}.tsx"));
    let program = apply(program);
    let out = utils::emit(program, cm);

    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write(format!("target/vapor_outputs/{name}.out.js"), utils::strip_marker(&out)).ok();

    utils::normalize(&utils::strip_marker(&out))
}

#[test]
fn injects_slot_source_and_collects_named_slots() {
    let src = r##"
import { type FC, Slot, Template } from '@rue-js/rue'

const Panel: FC = () => (
  <section>
    <header><Slot name="title">Untitled</Slot></header>
    <main><Slot>Empty</Slot></main>
  </section>
)

const Demo: FC = () => (
  <Panel>
    <Template slot="title">
      <strong>Named title</strong>
    </Template>
    <span>Body</span>
  </Panel>
)
"##;

    let out = compile(src, "slots_named_default");

    assert!(out.contains(&utils::normalize(
        "source: getCurrentInstance() && getCurrentInstance().propsRO",
    )));
    assert!(out.contains("__rue_slots"));
    assert!(out.contains(&utils::normalize("\"title\": __child")));
    assert!(out.contains(&utils::normalize("\"default\": __child")));
    assert!(out.contains(&utils::normalize("children: __child")));
}

#[test]
fn lowers_default_scoped_slot_function_into_slot_bag() {
    let src = r##"
import { type FC, Slot } from '@rue-js/rue'

const List: FC = () => (
  <div>
    <Slot props={{ label: 'fallback' }}>missing</Slot>
  </div>
)

const Demo: FC = () => (
  <List>
    {({ label }) => <strong>{label}</strong>}
  </List>
)
"##;

    let out = compile(src, "slots_scoped_default");

    assert!(out.contains("__rue_slots"));
    assert!(out.contains(&utils::normalize("\"default\": ({ label })=>")));
    assert!(out.contains(&utils::normalize(
        "source: getCurrentInstance() && getCurrentInstance().propsRO",
    )));
}

#[test]
fn hoists_conditional_named_slots_into_slot_bag() {
    let src = r##"
import { type FC, Slot, Template, ref } from '@rue-js/rue'

const Panel: FC = () => (
  <section>
    <header><Slot name="title">Untitled</Slot></header>
    <div><Slot name="actions">Fallback action</Slot></div>
    <main><Slot>Body</Slot></main>
  </section>
)

const Demo: FC = () => {
  const showTitle = ref(true)
  const showActions = ref(true)

  return (
    <Panel>
      {showTitle.value && (
        <Template slot="title">
          <strong>Named title</strong>
          <span>Subtitle</span>
        </Template>
      )}
      {showActions.value && <button slot="actions">Run</button>}
      <div>Body</div>
    </Panel>
  )
}
"##;

    let out = compile(src, "slots_conditional_named");

    assert!(out.contains("__rue_slots"));
    assert!(out.contains(&utils::normalize("\"title\": showTitle.value ? __child")));
    assert!(out.contains(&utils::normalize("\"actions\": showActions.value ? __child")));
    assert!(out.contains(&utils::normalize("\"default\": __child")));
    assert!(!out.contains(&utils::normalize("createComponent(Template")));
    assert!(!out.contains(&utils::normalize("\"slot\", \"actions\"")));
}

#[test]
fn lowers_conditional_default_slot_into_optional_children() {
    let src = r##"
import { type FC, Slot, ref } from '@rue-js/rue'

const Panel: FC = () => (
  <section>
    <main><Slot>Fallback body</Slot></main>
  </section>
)

const Demo: FC = () => {
  const showBody = ref(true)

  return (
    <Panel>
      {showBody.value && <div>Body</div>}
    </Panel>
  )
}
"##;

    let out = compile(src, "slots_conditional_default");

    assert!(out.contains(&utils::normalize("children: showBody.value ? __child")));
    assert!(out.contains(&utils::normalize(": undefined")));
    assert!(out.contains(&utils::normalize(
        "source: getCurrentInstance() && getCurrentInstance().propsRO",
    )));
}

#[test]
fn lowers_conditional_default_slot_map_callbacks_without_leaking_jsxdev() {
    let src = r##"
import { type FC, Slot, ref } from '@rue-js/rue'

const Panel: FC = () => (
  <section>
    <main><Slot>Fallback body</Slot></main>
  </section>
)

const Demo: FC = () => {
  const showBody = ref(true)
  const items = ref([
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
  ])

  return (
    <Panel>
      {showBody.value && items.value.map((item) => {
        const label = item.label.toUpperCase()
        return <button key={item.id}>{label}</button>
      })}
    </Panel>
  )
}
"##;

    let out = compile(src, "slots_conditional_default_map");

    assert!(
        out.contains(&utils::normalize("children: showBody.value ? items.value.map((item)=>",))
    );
    assert!(out.contains(&utils::normalize("return vapor(()=>{")));
    assert!(out.contains(&utils::normalize(": undefined")));
    assert!(!out.contains("_jsxDEV("));
}
