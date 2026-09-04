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
fn safe_jsx_uses_only_the_compiled_runtime_boundary() {
    let src = r##"
import { type FC } from '@rue-js/rue';

const Demo: FC = () => <div id="safe">hello</div>;
"##;

    let (program, cm) = utils::parse(src, "safe-compiled-boundary.tsx");
    let program = apply(program);
    let out = utils::strip_marker(&utils::emit(program, cm));
    let normalized = utils::normalize(&out);

    assert!(out.contains("@rue-js/rue/internal/compiler"));
    assert!(!out.contains("from \"@rue-js/rue/internal\""));
    assert!(!out.contains(concat!("@rue-js", "/jsx-runtime")));
    assert!(!out.contains(concat!("@rue-js", "/jsx-dev-runtime")));
    assert!(!normalized.contains(&utils::normalize("import { h } from '@rue-js/rue';")));
    assert!(!normalized.contains(&utils::normalize(", h } from '@rue-js/rue';")));
    assert!(!normalized.contains(&utils::normalize("h(")));
    assert!(!normalized.contains(&utils::normalize("jsx(")));
    assert!(!normalized.contains(&utils::normalize("jsxs(")));
}

#[test]
fn safe_fragment_uses_only_the_compiled_runtime_boundary() {
    let src = r##"
import { type FC } from '@rue-js/rue';
const Demo: FC = () => <><h1>safe</h1><span>ready</span></>;
"##;

    let (program, cm) = utils::parse(src, "safe-fragment-boundary.tsx");
    let out = utils::strip_marker(&utils::emit(apply(program), cm));

    assert!(out.contains("@rue-js/rue/internal/compiler"), "{out}");
    assert!(!out.contains("from \"@rue-js/rue/internal\""), "{out}");
    assert!(out.contains("_$compiledRoot"), "{out}");
    assert!(!utils::normalize(&out).contains(&utils::normalize("vapor(")), "{out}");
}

#[test]
fn compiler_consumes_jsx_in_every_expression_container() {
    let src = r##"
const moduleNode = <main>module</main>;
const record = { node: <aside>field</aside> };

function withDefault(node = <header>default</header>) {
  const nested = () => () => <section>nested</section>;
  return [node, nested()];
}

async function loadView() {
  const body = <><UI.Card>member</UI.Card><footer>async</footer></>;
  return body;
}
"##;

    let (program, cm) = utils::parse(src, "all-expression-containers.tsx");
    let out = utils::strip_marker(&utils::emit(apply(program), cm));
    let normalized = utils::normalize(&out);

    assert!(!out.contains(concat!("@rue-js", "/jsx-runtime")), "{out}");
    assert!(!out.contains(concat!("@rue-js", "/jsx-dev-runtime")), "{out}");
    assert!(!normalized.contains("jsx("), "{out}");
    assert!(!normalized.contains("jsxs("), "{out}");
    assert!(!normalized.contains("jsxDEV("), "{out}");
    assert!(!out.contains("<main"), "{out}");
    assert!(!out.contains("<aside"), "{out}");
    assert!(!out.contains("<header"), "{out}");
    assert!(!out.contains("<section"), "{out}");
    assert!(!out.contains("<UI.Card"), "{out}");
    assert!(!out.contains("<footer"), "{out}");
    assert!(out.contains("_$createComponent(UI.Card"), "{out}");
}

#[test]
fn mixed_fragment_module_keeps_compiled_owner_on_vapor_graph() {
    let src = r##"
import { type FC } from '@rue-js/rue';
const Child: FC = () => <i />;
const Safe: FC = () => <><span>ready</span></>;
const Mixed: FC = () => <Child />;
"##;

    let (program, cm) = utils::parse(src, "mixed-fragment-boundary.tsx");
    let out = utils::strip_marker(&utils::emit(apply(program), cm));
    let vapor_import =
        out.lines().find(|line| line.contains("from \"@rue-js/rue/internal\"")).unwrap_or_default();

    assert!(vapor_import.contains("_$compiledRoot"), "{out}");
    assert!(!out.contains("@rue-js/rue/internal/compiler"), "{out}");
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

    assert!(first_line.contains("from \"@rue-js/rue/internal/compiler\""), "{out}");
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

    assert!(first_line.contains("from \"@rue-js/rue/internal/compiler\""), "{out}");
    assert!(first_line.contains("ref"));
    assert!(first_line.contains("useApp"));
    assert!(normalized.contains(&utils::normalize("import { type FC } from '@rue-js/rue';")));
    assert!(
        !normalized
            .contains(&utils::normalize("import { type FC, ref, useApp } from '@rue-js/rue';",))
    );
}

#[test]
fn routes_component_and_reactive_values_to_vapor() {
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
    let internal_import = out.lines().find(|line| {
        line.contains("from \"@rue-js/rue/internal\"")
            && !line.contains("@rue-js/rue/internal/compiler")
    });
    let compiler_import =
        out.lines().find(|line| line.contains("from \"@rue-js/rue/internal/compiler\""));

    assert!(internal_import.is_some_and(|line| line.contains("ref")), "{out}");
    assert!(compiler_import.is_some_and(|line| line.contains("TransitionGroup")), "{out}");
    assert!(normalized.contains(&utils::normalize("import { type FC } from '@rue-js/rue';")));
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
    let internal_import = out.lines().find(|line| {
        line.contains("from \"@rue-js/rue/internal\"")
            && !line.contains("@rue-js/rue/internal/compiler")
    });
    let compiler_import =
        out.lines().find(|line| line.contains("from \"@rue-js/rue/internal/compiler\""));

    assert!(internal_import.is_some_and(|line| line.contains("ref")), "{out}");
    assert!(compiler_import.is_some_and(|line| line.contains("Transition")), "{out}");
    assert!(normalized.contains(&utils::normalize("import { type FC } from '@rue-js/rue';")));
    assert!(
        !normalized.contains(&utils::normalize(
            "import { type FC, Transition, ref } from '@rue-js/rue';",
        ))
    );
}

#[test]
fn reactive_compiled_bindings_keep_helpers_on_one_vapor_graph() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue';
const message = ref('ready');
const Demo: FC = () => <div title={message.value}>{message.value}</div>;
"##;

    let (program, cm) = utils::parse(src, "reactive-compiled-import.tsx");
    let out = utils::strip_marker(&utils::emit(apply(program), cm));
    let vapor_import = out
        .lines()
        .find(|line| line.contains("@rue-js/rue/internal/compiler"))
        .expect("compiled runtime import");

    for helper in ["ref", "_$compiledRoot", "_$compiledText", "effect"] {
        assert!(vapor_import.contains(helper), "missing {helper}: {out}");
    }
    assert!(!out.contains("from \"@rue-js/rue/internal\""), "{out}");
}

#[test]
fn explicit_compiled_signal_keeps_pure_compiled_module_on_compiled_graph() {
    let src = r##"
import { signal } from '@rue-js/rue/internal/compiler';
const message = signal('ready');
export const Demo = () => <div>{message.get()}</div>;
"##;

    let (program, cm) = utils::parse(src, "explicit-compiled-signal.tsx");
    let out = utils::strip_marker(&utils::emit(apply(program), cm));
    let compiled_import = out
        .lines()
        .find(|line| line.contains("@rue-js/rue/internal/compiler"))
        .expect("compiled runtime import");

    assert!(compiled_import.contains("signal"), "{out}");
    assert!(compiled_import.contains("_$compiledRoot"), "{out}");
    assert!(compiled_import.contains("_$compiledText"), "{out}");
    assert!(!out.contains("from \"@rue-js/rue/internal\""), "{out}");
}
