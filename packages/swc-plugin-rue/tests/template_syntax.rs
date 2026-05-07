use swc_plugin_rue::{apply, apply_pre};

mod utils;

#[test]
fn pre_transform_lowers_special_lowercase_template_elements() {
    let src = r##"
import { type FC, Slot } from '@rue-js/rue'

const Panel: FC = () => (
  <section>
    <header><Slot name="title">Fallback</Slot></header>
    <main><Slot>Body</Slot></main>
  </section>
)

const Demo: FC<{ ok: boolean; items: string[] }> = (props) => (
  <Panel>
    <template slot="title">
      <strong>Named</strong>
    </template>
    <div>
      <template v-if={props.ok}>
        <span>A</span>
        <span>B</span>
      </template>
    </div>
    <ul>
      <template v-for="item in props.items" key={item}>
        <li>{item}</li>
        <li>{item}-meta</li>
      </template>
    </ul>
  </Panel>
)
"##;

    let (program, cm) = utils::parse(src, "template_syntax_pre.tsx");
    let program = apply_pre(program);
    let emitted = utils::strip_marker(&utils::emit(program, cm));
    let out = utils::normalize(&emitted);

    assert!(!out.contains("<template"));
    assert!(out.contains(&utils::normalize("<Template slot=\"title\">")));
    assert!(out.contains(&utils::normalize("props.ok ? <Template>")));
    assert!(out.contains(&utils::normalize("))(props.items).map(")));
}

#[test]
fn full_transform_reuses_existing_template_component_paths() {
    let src = r##"
import { type FC, Slot, ref } from '@rue-js/rue'

const Panel: FC = () => (
  <section>
    <header><Slot name="title">Fallback</Slot></header>
    <main><Slot>Body</Slot></main>
  </section>
)

const Demo: FC = () => {
  const show = ref(true)
  const items = ref([
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
  ])

  return (
    <Panel>
      <template slot="title">
        <strong>Named title</strong>
      </template>
      <div>
        <template v-if={show.value}>
          <span>Summary A</span>
          <span>Summary B</span>
        </template>
      </div>
      <ul>
        <template v-for="item in items.value" key={item.id}>
          <li>{item.label}</li>
          <li>{item.label}-meta</li>
        </template>
      </ul>
    </Panel>
  )
}

export default Demo
"##;

    let (program, cm) = utils::parse(src, "template_syntax_apply.tsx");
    let program = apply(program);
    let emitted = utils::strip_marker(&utils::emit(program, cm));
    let out = utils::normalize(&emitted);

    assert!(!out.contains(&utils::normalize("_$createElement(\"template\")")));
    assert!(
        out.contains(&utils::normalize("import { Template"))
            || out.contains(&utils::normalize(", Template,"))
            || out.contains(&utils::normalize(", Template } from \"@rue-js/rue/vapor\";"))
    );
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("renderAnchor"));
    assert!(out.contains("_$vaporKeyedList"));
}
