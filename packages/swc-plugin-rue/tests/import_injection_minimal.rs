use swc_plugin_rue::apply;

mod utils;

#[test]
fn does_not_auto_inject_signal_user_api() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const count = signal(0);

const Demo: FC = () => <div>{count.value}</div>;
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::strip_marker(&utils::emit(program, cm));
    let normalized = utils::normalize(&out);

    assert!(normalized.contains("signal(0)"));
    assert!(!normalized.contains(&utils::normalize(", signal } from '@rue-js/rue'")));
    assert!(!normalized.contains(&utils::normalize(" signal, ")));
}

#[test]
fn does_not_auto_inject_h_user_api() {
    let src = r##"
const node = h('div', null, 'hello');
"##;

    let (program, cm) = utils::parse(src, "h-test.tsx");
    let program = apply(program);
    let out = utils::strip_marker(&utils::emit(program, cm));
    let normalized = utils::normalize(&out);

    assert!(normalized.contains(&utils::normalize("const node = h('div', null, 'hello');")));
    assert!(!normalized.contains(&utils::normalize("import { h } from '@rue-js/rue';")));
    assert!(!normalized.contains(&utils::normalize(", h } from '@rue-js/rue'")));
}

#[test]
fn rewrites_safe_value_imports_to_vapor_entry() {
    let src = r##"
import { type FC, ref, useState } from '@rue-js/rue';

const Demo: FC = () => {
  const count = ref(0);
  const [label] = useState('ok');
  return <div>{count.value}-{label.value}</div>;
};
"##;

    let (program, cm) = utils::parse(src, "rewrite-safe.tsx");
    let program = apply(program);
    let out = utils::strip_marker(&utils::emit(program, cm));
    let normalized = utils::normalize(&out);
    let first_line = out.lines().next().unwrap_or_default();

    assert!(first_line.contains("from \"@rue-js/rue/vapor\""));
    assert!(first_line.contains("ref"));
    assert!(first_line.contains("useState"));
    assert!(normalized.contains(&utils::normalize("import { type FC } from '@rue-js/rue';")));
    assert!(
        !normalized
            .contains(&utils::normalize("import { type FC, ref, useState } from '@rue-js/rue';",))
    );
}

#[test]
fn rewrites_use_app_to_vapor_entry() {
    let src = r##"
import { type FC, ref, useApp } from '@rue-js/rue';

const count = ref(0);
const App: FC = () => <button>{count.value}</button>;

useApp(App).mount('#app');
"##;

    let (program, cm) = utils::parse(src, "rewrite-use-app.tsx");
    let program = apply(program);
    let out = utils::strip_marker(&utils::emit(program, cm));
    let normalized = utils::normalize(&out);
    let first_line = out.lines().next().unwrap_or_default();

    assert!(first_line.contains("from \"@rue-js/rue/vapor\""));
    assert!(first_line.contains("ref"));
    assert!(first_line.contains("useApp"));
    assert!(normalized.contains(&utils::normalize("import { type FC } from '@rue-js/rue';")));
    assert!(
        !normalized
            .contains(&utils::normalize("import { type FC, ref, useApp } from '@rue-js/rue';",))
    );
}

#[test]
fn keeps_unsafe_root_values_and_moves_safe_values() {
    let src = r##"
import { type FC, TransitionGroup, ref } from '@rue-js/rue';

const Demo: FC = () => {
  const items = ref([1, 2, 3]);
  return <TransitionGroup>{items.value.map(item => <div key={item}>{item}</div>)}</TransitionGroup>;
};
"##;

    let (program, cm) = utils::parse(src, "rewrite-mixed.tsx");
    let program = apply(program);
    let out = utils::strip_marker(&utils::emit(program, cm));
    let normalized = utils::normalize(&out);

    assert!(
        normalized.contains(&utils::normalize("import { ref, _$vaporWithHookId, useSetup, vapor",))
    );
    assert!(
        normalized.contains(&utils::normalize(
            "import { type FC, TransitionGroup } from '@rue-js/rue';",
        ))
    );
    assert!(!normalized.contains(&utils::normalize(
        "import { type FC, TransitionGroup, ref } from '@rue-js/rue';",
    )));
}

#[test]
fn rewrites_transition_import_to_vapor_entry() {
    let src = r##"
import { type FC, Transition, ref } from '@rue-js/rue';

const Demo: FC = () => {
  const open = ref(true);
  return (
    <Transition>
      {open.value ? <div>hello</div> : null}
    </Transition>
  );
};
"##;

    let (program, cm) = utils::parse(src, "rewrite-transition.tsx");
    let program = apply(program);
    let out = utils::strip_marker(&utils::emit(program, cm));
    let normalized = utils::normalize(&out);
    let first_line = out.lines().next().unwrap_or_default();

    assert!(first_line.contains("from \"@rue-js/rue/vapor\""));
    assert!(first_line.contains("Transition"));
    assert!(first_line.contains("ref"));
    assert!(normalized.contains(&utils::normalize("import { type FC } from '@rue-js/rue';")));
    assert!(
        !normalized.contains(&utils::normalize(
            "import { type FC, Transition, ref } from '@rue-js/rue';",
        ))
    );
}
