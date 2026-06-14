use super::*;
use std::sync::Arc;
use swc_core::common::sync::OnceCell;
use swc_core::common::{FileName, Mark, SourceMap};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_core::plugin::proxies::PluginSourceMapProxy;
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_program(src: &str) -> (Program, Arc<SourceMap>) {
    let cm = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(FileName::Custom("lib-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    let program = Program::Module(parser.parse_module().expect("parse module"));
    (program, cm)
}

fn emit(program: Program, cm: Arc<SourceMap>) -> String {
    let mut buf = Vec::new();
    let mut emitter = Emitter {
        cfg: Default::default(),
        comments: None,
        cm: cm.clone(),
        wr: JsWriter::new(cm, "\n", &mut buf, None),
    };
    emitter.emit_program(&program).expect("emit program");
    String::from_utf8(buf).expect("utf8")
}

fn normalize(src: &str) -> String {
    let mut out = String::new();
    let mut prev_space = false;
    for ch in src.chars() {
        if ch.is_whitespace() {
            if !prev_space {
                out.push(' ');
                prev_space = true;
            }
        } else {
            out.push(ch);
            prev_space = false;
        }
    }
    out.trim().to_string()
}

fn empty_plugin_metadata() -> TransformPluginProgramMetadata {
    TransformPluginProgramMetadata {
        comments: None,
        source_map: PluginSourceMapProxy { source_file: OnceCell::new() },
        unresolved_mark: Mark::from_u32(0),
    }
}

#[test]
fn apply_pre_runs_pre_transform_pipeline_for_function_components() {
    let src = r#"
import { ref } from '@rue-js/rue';

function View(props) {
  const count = ref(0);
  return <template slot="header"><div v-show={props.ok}>{count.value}</div></template>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const count = _$vaporWithHookId("ref:"#)));
    assert!(out.contains(&normalize(
        r#"const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{"#
    )));
    assert!(out.contains(&normalize(r#"return <Template slot="header"><div style={_$vaporShowStyle(undefined, props.ok)}>{count.value}</div></Template>;"#)));
    assert!(!out.contains("vapor(("));
}

#[test]
fn apply_runs_full_pre_and_vapor_pipeline_for_arrow_components() {
    let src = r#"
import { type FC, ref } from '@rue-js/rue';

const View: FC = () => {
  const count = ref(0);
  return <div className="box">{count.value}</div>;
};
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const count = _$vaporWithHookId("ref:"#)));
    assert!(out.contains("vapor("));
    assert!(out.contains(&normalize(r#"_$createElement("div""#)));
    assert!(out.contains(&normalize(r#"_$setClassName(_root, "box")"#)));
    assert!(out.contains(&normalize(r#"_$createComment("rue:slot:anchor")"#)));
    assert!(out.contains(&normalize(r#"renderAnchor(__slot, _root, _list1)"#)));
    assert!(out.contains("watchEffect"));
}

#[test]
fn apply_pre_dedupes_duplicate_use_setup_ids_across_components() {
    let src = r#"
import { ref } from '@rue-js/rue';

function First() {
  const count = ref(0);
  return <div>{count.value}</div>;
}

function Second() {
  const count = ref(1);
  return <div>{count.value}</div>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert_eq!(out.matches(r#"const _$useSetup = _$vaporWithHookId("useSetup:0:0""#).count(), 1);
    assert_eq!(
        out.matches(r#"const _$useSetup = _$vaporWithHookId("useSetup:0:0:dup1""#).count(),
        1
    );
}

#[test]
fn full_transform_pipeline_shared_by_entrypoints_rewrites_pre_and_vapor() {
    let src = r#"
import { ref } from '@rue-js/rue';

const View = () => {
  const count = ref(0);
  return <section>{count.value}</section>;
};
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(run_full_transform(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const count = _$vaporWithHookId("ref:"#)));
    assert!(out.contains("vapor("));
    assert!(out.contains(&normalize(r#"_$createElement("section""#)));
    assert!(out.contains("watchEffect"));
}

#[test]
fn plugin_transform_entry_delegates_to_full_pipeline() {
    let src = r#"
import { ref } from '@rue-js/rue';

const View = () => {
  const count = ref(0);
  return <main>{count.value}</main>;
};
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const count = _$vaporWithHookId("ref:"#)));
    assert!(out.contains("vapor("));
    assert!(out.contains(&normalize(r#"_$createElement("main""#)));
    assert!(out.contains("watchEffect"));
}

#[test]
fn apply_pre_combines_list_show_event_and_model_directives() {
    let src = r#"
import { ref } from '@rue-js/rue';

function View(props) {
  const text = ref('');
  return <section>
    <input v-model:trim={text.value} />
    <button v-on:click-stop="props.save(text.value)" v-show={props.canSave}>Save</button>
    <ul><li v-for="(item, index) in props.items" v-show={item.visible}>{index}:{item.label}</li></ul>
  </section>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const text = _$vaporWithHookId("ref:"#)));
    assert!(out.contains("props.items"));
    assert!(out.contains(".map("));
    assert!(out.contains(&normalize("style={_$vaporShowStyle(undefined, item.visible)}")));
    assert!(out.contains(&normalize("style={_$vaporShowStyle(undefined, props.canSave)}")));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(out.contains(&normalize("\"stop\"")));
    assert!(out.contains(&normalize("value={text.value}")));
    assert!(out.contains("onInput"));
}

#[test]
fn apply_handles_slot_conditionals_lists_and_router_link_together() {
    let src = r#"
import { RouterLink, ref } from '@rue-js/rue';

const View = (props) => {
  const current = ref(null);
  const header = props.ready ? <Header title={props.title} /> : null;
  return <Panel>
    {header}
    <RouterLink to={props.to} replace>Open</RouterLink>
    {props.rows.map(row => <Item key={row.id}>{row.name}</Item>)}
  </Panel>;
};
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains("vapor("));
    assert!(out.contains(&normalize("_$createComponent(Panel")));
    assert!(out.contains(&normalize("_$vaporKeyedList")));
    assert!(out.contains(&normalize("_$createElement(\"a\"")));
    assert!(out.contains(&normalize("_$setAttribute(_el")));
    assert!(out.contains(&normalize(r#"const current = _$vaporWithHookId("ref:"#)));
}

#[test]
fn apply_pre_preserves_broken_else_and_rewrites_component_model_combo() {
    let src = r#"
function View(props) {
  return <section>
    <Header />
    <Fallback v-else />
    <Field v-model:lazy-user-name={props.user.name} />
  </section>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains("v-else"), "{out}");
    assert!(out.contains(&normalize("userName={props.user.name}")));
    assert!(out.contains("onUpdateUserName"));
    assert!(out.contains("props.user.name = value"));
    assert!(out.contains("userNameModifiers"));
    assert!(out.contains(&normalize("\"lazy\": true")));
    assert!(!out.contains("v-model"));
}

#[test]
fn apply_handles_transition_group_complex_map_control_flow() {
    let src = r#"
const View = (props) => {
  return <TransitionGroup>
    {props.rows.map(row => {
      try {
        if (row.hidden) return <li key={row.id}>Hidden</li>;
      } finally {
        props.touch(row.id);
      }
      return <li key={row.id}>{row.label}</li>;
    })}
  </TransitionGroup>;
};
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize("_$createComponent(TransitionGroup")));
    assert!(out.contains("_$vaporWithKey"));
    assert!(out.contains("props.touch(row.id)"));
    assert!(out.contains("row.hidden"));
    assert!(out.contains("Hidden"));
}

#[test]
fn apply_handles_fragment_slots_lists_and_pre_directives_together() {
    let src = r#"
import { ref } from '@rue-js/rue';

function View(props) {
  const selected = ref(null);
  const renderFooter = (row) => row.ready ? <Footer key={row.id}>{row.label}</Footer> : null;
  return <>
    <Panel>
      <Template slot="footer">{props.rows.map(renderFooter)}</Template>
      {(row) => <Item active={row.id === selected.value}>{row.label}</Item>}
    </Panel>
    <section v-show={props.visible}>
      {props.rows.map(row => <article key={row.id}>{row.label}</article>)}
    </section>
  </>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const selected = _$vaporWithHookId("ref:"#)));
    assert!(out.contains(&normalize("_$createComponent(Panel")));
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("footer"));
    assert!(out.contains("_$vaporKeyedList"));
    assert!(out.contains("_$vaporShowStyle"));
    assert!(out.contains("props.visible"));
    assert!(out.contains(&normalize("_$createElement(\"article\"")));
}

#[test]
fn apply_handles_dense_control_directive_and_component_slot_pipeline() {
    let src = r#"
import { RouterLink, ref } from '@rue-js/rue';

function View({ rows, activeId, to, visible }) {
  const draft = ref('');
  const badge = (row) => row.hot ? <Badge key={row.id}>{row.label}</Badge> : null;
  return <>
    <Shell>
      <Template slot="toolbar">
        <input v-model:trim={draft.value} />
        <RouterLink to={to} v-show={visible}>Go</RouterLink>
      </Template>
      {(ctx) => <Footer>{ctx.label}</Footer>}
    </Shell>
    <TransitionGroup>
      {rows.map((row, index) => {
        const selected = row.id === activeId;
        if (row.hidden) return <li key={row.id} v-on:click-stop={() => row.open()}>{index}</li>;
        return <li key={row.id} className={selected ? 'on' : 'off'}>{badge(row)}</li>;
      })}
    </TransitionGroup>
  </>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const draft = _$vaporWithHookId("ref:"#)));
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("toolbar"));
    assert!(out.contains(&normalize("_$createComponent(Shell")));
    assert!(out.contains(&normalize("_$createComponent(TransitionGroup")));
    assert!(out.contains("_$vaporWithKey"));
    assert!(out.contains("__rue_props.rows"), "{out}");
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(out.contains("_$vaporShowStyle"));
    assert!(out.contains(&normalize("_$createElement(\"a\"")));
    assert!(out.contains("selected"));
}

#[test]
fn apply_pre_keeps_pre_directive_islands_while_rewriting_adjacent_directives() {
    let src = r#"
function View(props) {
  return <section>
    <div v-pre v-if={props.skip} v-show={props.skipVisible} v-on:click="props.skip()">{props.raw}</div>
    <div v-if={props.ok}>Ready</div>
    <div v-else-if={props.waiting}>Waiting</div>
    <div v-else>Done</div>
    <Field v-model:lazy-user-name={props.user.name} />
  </section>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains("v-pre"));
    assert!(out.contains("v-if={props.skip}"));
    assert!(out.contains("v-show={props.skipVisible}"));
    assert!(out.contains("v-on:click"));
    assert!(out.contains("props.ok ?"));
    assert!(out.contains("props.waiting ?"));
    assert!(out.contains(&normalize("userName={props.user.name}")));
    assert!(out.contains("onUpdateUserName"));
    assert!(out.contains("userNameModifiers"));
    assert!(!out.contains("v-model"));
}

#[test]
fn apply_pre_rewrites_text_html_memo_model_and_event_modifiers_together() {
    let src = r#"
import { ref } from '@rue-js/rue';

function View(props) {
  const draft = ref('');
  return <form v-on:submit-prevent="props.save(draft.value)">
    <h1 v-text={props.title}>old</h1>
    <article v-html="props.markup"><span /></article>
    <input v-model:trim={draft.value} />
    <Badge v-memo={[props.title]}>{draft.value}</Badge>
  </form>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const draft = _$vaporWithHookId("ref:"#)));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(out.contains(&normalize("\"prevent\"")));
    assert!(out.contains(&normalize("<h1>{props.title}</h1>")));
    assert!(out.contains("dangerouslySetInnerHTML"));
    assert!(out.contains("__html"));
    assert!(out.contains("useMemo"));
    assert!(out.contains("value={draft.value}"));
    assert!(!out.contains("v-text"));
    assert!(!out.contains("v-html"));
    assert!(!out.contains("v-model"));
    assert!(!out.contains("v-memo"));
}

#[test]
fn apply_handles_component_native_events_dynamic_slots_and_fragment_lists() {
    let src = r#"
function View(props) {
  const renderRow = (row) => row.kind === 'link'
    ? <RouterLink key={row.id} to={row.to}>{row.label}</RouterLink>
    : <Card key={row.id} __rueNativeOnClick={() => props.pick(row.id)}>{row.label}</Card>;

  return <Shell __rueNativeOnMouseEnter={props.enter}>
    <Template slot={props.slotName}>
      <>{props.rows.map(renderRow)}</>
    </Template>
    {props.ready && <Footer key="footer">{props.summary}</Footer>}
  </Shell>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize("_$vaporWithNativeEvents(_$createComponent(Shell")));
    assert!(out.contains(&normalize("\"mouseenter\": props.enter")));
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("[props.slotName]"));
    assert!(out.contains("_$createDocumentFragment"));
    assert!(out.contains("RouterLink"));
    assert!(out.contains("__rueNativeOnClick"));
    assert!(out.contains("props.rows.map(renderRow)"));
}

#[test]
fn transform_entry_handles_multiple_components_without_cross_component_slot_leakage() {
    let src = r#"
import { ref } from '@rue-js/rue';

function First(props) {
  const count = ref(0);
  return <Panel>
    <Template slot="header"><span>{count.value}</span></Template>
    {props.items.map(item => <Item key={item.id}>{item.label}</Item>)}
  </Panel>;
}

const Second = (props) => {
  return <Panel>
    <Template slot="footer"><small>{props.footer}</small></Template>
    {props.ready ? <span>Ready</span> : null}
  </Panel>;
};
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const count = _$vaporWithHookId("ref:"#)));
    assert!(out.contains(&normalize(r#"const _$useSetup = _$vaporWithHookId("useSetup:0:0""#)));
    assert_eq!(out.matches("__rue_slots").count(), 2);
    assert!(out.contains("\"header\""));
    assert!(out.contains("\"footer\""));
    assert!(out.contains("_$vaporKeyedList"));
    assert!(out.contains("_$createComponent(Panel"));
}

#[test]
fn transform_entry_handles_props_destructure_dynamic_slots_and_keyed_component_lists() {
    let src = r#"
import { ref } from '@rue-js/rue';

function View({ rows, selectedId, to, slotName, visible }) {
  const draft = ref('');
  const label = selectedId + ':' + rows.length;
  return <Dashboard>
    <Template slot={slotName}>
      <RouterLink to={to} v-show={visible} v-on:click-prevent="console.log(label)">{label}</RouterLink>
    </Template>
    {rows.map(([id, title], index) => (
      <Card key={id} active={id === selectedId} index={index}>{title ?? draft.value}</Card>
    ))}
  </Dashboard>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const draft = _$vaporWithHookId("ref:"#)));
    assert!(out.contains("__rue_props.rows"), "{out}");
    assert!(out.contains("__rue_props.selectedId"));
    assert!(out.contains("__rue_props.slotName"));
    assert!(out.contains("__rue_props.visible"));
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("_$vaporKeyedList"));
    assert!(out.contains("getKey"));
    assert!(out.contains("_$vaporShowStyle"));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(!out.contains("v-on:click"));
}

#[test]
fn apply_pre_rewrites_template_for_condition_text_html_and_native_models_together() {
    let src = r#"
function View(props) {
  return <section>
    <template v-for="(row, index) in props.rows">
      <article v-if={row.visible} v-text={row.title} />
      <article v-else v-html="row.html" />
      <input v-model:trim-number={props.form[index].value} />
    </template>
  </section>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains("Array.isArray(__rue_v_for_source)"), "{out}");
    assert!(out.contains("(props.rows).map"), "{out}");
    assert!(out.contains("([row, index])"));
    assert!(out.contains("row.visible ?"));
    assert!(out.contains("<article/>{row.title}"));
    assert!(out.contains("dangerouslySetInnerHTML"));
    assert!(out.contains("__html"));
    assert!(out.contains("value={props.form[index].value}"));
    assert!(out.contains("onInput"));
    assert!(!out.contains("v-for"));
    assert!(!out.contains("v-text"));
    assert!(!out.contains("v-html"));
    assert!(!out.contains("v-model"));
}

#[test]
fn transform_entry_hardens_nested_slot_setup_model_and_transition_pipeline() {
    let src = r#"
import { ref, computed } from '@rue-js/rue';

function View({ rows, form, activeId, slotName, ...rest }) {
  const draft = ref('');
  const activeLabel = computed(() => activeId + ':' + rows.length);
  return <Shell data-kind={rest.kind}>
    <Template slot={slotName}>
      <input v-model:trim={form.title} v-on:keyup-enter-prevent="rest.submit(form.title)" />
      {rows.map(({ id, title }, index) => (
        <Card key={id} active={id === activeId} index={index}>{title ?? draft.value}</Card>
      ))}
    </Template>
    <Template slot="footer"><span v-show={rest.ready}>{activeLabel.value}</span></Template>
    <TransitionGroup>
      {rows.map(row => {
        const rowKey = row.id ?? activeId;
        if (row.hidden) return <li key={rowKey}>Hidden</li>;
        return <li key={rowKey}>{row.label}</li>;
      })}
    </TransitionGroup>
  </Shell>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const draft = _$vaporWithHookId("ref:"#)));
    assert!(out.contains(&normalize(r#"const activeLabel = _$vaporWithHookId("computed:"#)));
    assert!(out.contains("__rue_props.rows"), "{out}");
    assert!(out.contains("__rue_props.form"), "{out}");
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("[__rue_props.slotName]"));
    assert!(out.contains("_$vaporKeyedList"));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(out.contains("_$vaporShowStyle"));
    assert!(out.contains("_$createComponent(Shell"));
    assert!(out.contains("_$createComponent(TransitionGroup"));
}

#[test]
fn apply_pre_hardens_template_directives_safe_model_and_event_combo() {
    let src = r#"
function View(props) {
  return <section>
    <template v-for="{ item, index } in props.entries">
      <Field __rue_model__user_name__mods__lazy__trim={item.user.name} v-on:update-user-name-native="props.touch(index)" />
      <span v-if={item.visible} v-text={item.title} />
      <span v-else-if={item.html} v-html="item.html" />
      <span v-else>Empty</span>
    </template>
  </section>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains("(props.entries).map"), "{out}");
    assert!(out.contains("([{ item, index }])"), "{out}");
    assert!(out.contains("userName={item.user.name}"), "{out}");
    assert!(out.contains("onUpdateUserName"));
    assert!(out.contains("userNameModifiers"));
    assert!(out.contains("onUpdateUserNameNative"));
    assert!(out.contains("item.visible ?"));
    assert!(out.contains("dangerouslySetInnerHTML"));
    assert!(!out.contains("v-for"));
    assert!(!out.contains("v-text"));
    assert!(!out.contains("v-html"));
}

#[test]
fn apply_hardens_slot_fallbacks_router_link_and_fragment_list_boundaries() {
    let src = r#"
const View = (props) => {
  const extra = props.ready ? <Badge>{props.count}</Badge> : null;
  return <Layout>
    {props.header ?? <Header title={props.title} />}
    <Template slot="nav">
      <RouterLink to={props.to} replace={props.replace}>{props.label}</RouterLink>
    </Template>
    <>
      {props.groups.map(group => <Fragment key={group.id}>
        <h2>{group.title}</h2>
        {group.items.map(item => <Item key={item.id}>{item.name}</Item>)}
      </Fragment>)}
    </>
    {extra}
  </Layout>;
};
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply(program), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains("_$createComponent(Layout"));
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("\"nav\""));
    assert!(out.contains("RouterLink"));
    assert!(out.contains("_$vaporKeyedList"));
    assert!(out.contains("_$createDocumentFragment"));
    assert!(out.contains("props.header ??"));
    assert!(out.contains("Badge"));
}

#[test]
fn transform_entry_hardens_rest_props_block_keys_and_dynamic_slot_fallbacks() {
    let src = r#"
import { computed } from '@rue-js/rue';

function Dashboard({ rows, slotName, visible = true, ...rest }) {
  const total = computed(() => rows.length);
  return <Frame data-kind={rest.kind}>
    <Template slot={slotName ?? "main"}>
      {rows.map(row => {
        const label = row.label ?? rest.fallback;
        return <article key={row.id} v-on:click-prevent={() => rest.pick(row.id)}>{label}</article>;
      })}
    </Template>
    {visible && <aside v-show={rest.open}>{total.value}</aside>}
  </Frame>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains("__rue_props.rows"), "{out}");
    assert!(out.contains("__rue_props.slotName"), "{out}");
    assert!(out.contains("__rue_props.visible"), "{out}");
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("_$vaporKeyedList"));
    assert!(out.contains("getKey"));
    assert!(out.contains("row.id"));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(out.contains("_$vaporShowStyle"));
    assert!(out.contains("_$createComponent(Frame"));
}

#[test]
fn apply_pre_hardens_r_prefixed_template_show_model_and_event_directives() {
    let src = r#"
function View(props) {
  return <>
    <input r-model:trim={props.form.name} r-on:keyup-enter-prevent="props.submit(props.form.name)" />
    <section>
      <span r-for="(item, index) of props.items" r-show={props.ready} r-text={item.visible ? index : item.name} />
    </section>
  </>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains("(props.items).map"), "{out}");
    assert!(out.contains("([item, index])"), "{out}");
    assert!(out.contains("value={props.form.name}"), "{out}");
    assert!(out.contains("onKeyup"));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(out.contains("item.visible ? index : item.name"));
    assert!(out.contains("_$vaporShowStyle"));
    assert!(!out.contains("r-for"));
    assert!(!out.contains("r-text"));
    assert!(!out.contains("r-model"));
}

#[test]
fn apply_pre_hardens_nested_template_model_event_show_and_else_boundaries() {
    let src = r#"
function View(props) {
  return <Panel>
    <template v-for="(row, index) in props.rows">
      <Field v-model:title-trim={row.title} v-on:update-title-native="props.touch(row.id)" />
      <span v-if={row.visible} v-show={props.ready} v-text={row.label ?? index} />
      <span v-else-if={row.html} v-html="row.html" />
      <span v-else>{props.empty}</span>
    </template>
    <template slot="actions">
      <button r-on:click-stop-prevent="props.cancel()">Cancel</button>
    </template>
  </Panel>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains("(props.rows).map"), "{out}");
    assert!(out.contains("([row, index])"), "{out}");
    assert!(out.contains("titleTrim={row.title}"), "{out}");
    assert!(out.contains("onUpdateTitleTrim"));
    assert!(out.contains("onUpdateTitleNative"));
    assert!(out.contains("row.visible ?"));
    assert!(out.contains("_$vaporShowStyle"));
    assert!(out.contains("dangerouslySetInnerHTML"));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(!out.contains("v-for"));
    assert!(!out.contains("v-if"));
    assert!(!out.contains("v-text"));
    assert!(!out.contains("v-html"));
}

#[test]
fn transform_entry_hardens_routerlink_member_components_and_nested_fragment_lists() {
    let src = r#"
import { ref } from '@rue-js/rue';

const View = ({ groups, route, active, slotName, ...rest }) => {
  const draft = ref('');
  return <Shell.Root data-kind={rest.kind}>
    <Template slot={slotName || "main"}>
      <RouterLink to={route.to} replace={route.replace}>{route.label}</RouterLink>
      <>
        {groups.map(group => <Fragment key={group.id}>
          <h2 v-show={active === group.id}>{group.title}</h2>
          {group.items.map(item => <Item.Card key={item.id} v-on:click-once={() => rest.pick(item.id)}>{item.label ?? draft.value}</Item.Card>)}
        </Fragment>)}
      </>
    </Template>
    {rest.footer ?? <Footer value={draft.value} />}
  </Shell.Root>;
};
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize(r#"const draft = _$vaporWithHookId("ref:"#)));
    assert!(out.contains("__rue_props.groups"), "{out}");
    assert!(out.contains("__rue_props.route"), "{out}");
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("[__rue_props.slotName || \"main\"]"), "{out}");
    assert!(out.contains("RouterLink"));
    assert!(out.contains("_$vaporKeyedList"));
    assert!(out.contains("_$createDocumentFragment"));
    assert!(out.contains("_$vaporShowStyle"));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(out.contains("_$createComponent(Shell.Root"));
    assert!(out.contains("_$createComponent(Item.Card"));
    assert!(out.contains("_$createComponent(Footer"));
}

#[test]
fn apply_hardens_component_models_native_events_and_transition_slots_together() {
    let src = r#"
function View(props) {
  return <Layout>
    <Template slot="editor">
      <Editor v-model:content-lazy-trim={props.doc.content} __rue_on__save__mods__native__prevent={props.save} />
      <input v-model:number={props.doc.count} v-on:keydown-enter="props.commit(props.doc.count)" />
    </Template>
    <TransitionGroup>
      {props.rows.map(row => {
        if (row.loading) return <li key={row.id}>Loading</li>;
        return row.visible ? <li key={row.id}>{row.label}</li> : null;
      })}
    </TransitionGroup>
  </Layout>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply(program), cm));

    assert!(out.contains("_$createComponent(Layout"));
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("contentLazyTrim: props.doc.content"), "{out}");
    assert!(out.contains("onUpdateContentLazyTrim"));
    assert!(out.contains("\"save\": _$vaporWithEventModifiers"));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(out.contains("HTMLInputElement"));
    assert!(out.contains("parseFloat(value)"));
    assert!(out.contains("_$createComponent(TransitionGroup"));
    assert!(out.contains("_$vaporWithKey"));
    assert!(!out.contains("v-model"));
    assert!(!out.contains("v-on"));
}

#[test]
fn transform_entry_preserves_loop_shadowing_after_props_phase2_lowering() {
    let src = r#"
function View({ count, rows }) {
  const total = count * 2;
  const renderTotal = () => {
    for (let total = 0; total < 2; total++) console.log(total);
    for (const total of rows) console.log(total);
    return total;
  };
  return <Panel>
    <span>{renderTotal()}</span>
    {rows.map(row => <Item key={row.id}>{row.label ?? total}</Item>)}
  </Panel>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains(&normalize("@rue-js/rue/vapor")));
    assert!(out.contains(&normalize("computed(()=>__rue_props.count * 2)")), "{out}");
    assert!(
        out.contains(&normalize("for(let total = 0; total < 2; total++)console.log(total);")),
        "{out}"
    );
    assert!(out.contains("const total of __rue_props.rows"), "{out}");
    assert!(out.contains("console.log(total)"), "{out}");
    assert!(out.contains("__rue_phase2_total.get()"), "{out}");
    assert!(out.contains("_$vaporKeyedList"), "{out}");
    assert!(out.contains("__rue_props.rows"), "{out}");
}

#[test]
fn apply_pre_hardens_object_for_source_component_model_and_native_event_combo() {
    let src = r#"
function View(props) {
  return <Form>
    <template v-for="(entry, name) in props.fields">
      <Field v-model:value-trim={entry.value} v-on:blur-native-capture="props.touch(name)" />
      <button v-if={entry.dirty} r-on:click-stop-prevent="props.save(name)">Save</button>
      <button v-else disabled>Clean</button>
    </template>
  </Form>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains("Object.entries(__rue_v_for_source"), "{out}");
    assert!(out.contains("([entry, name])"), "{out}");
    assert!(out.contains("valueTrim={entry.value}"), "{out}");
    assert!(out.contains("onUpdateValueTrim"));
    assert!(out.contains("__rueNativeOnBlur"));
    assert!(out.contains("\"capture\""));
    assert!(out.contains("entry.dirty ?"));
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(!out.contains("v-for"));
    assert!(!out.contains("v-model"));
    assert!(!out.contains("r-on"));
}

#[test]
fn apply_hardens_nested_dynamic_slots_with_router_links_and_keyed_fragments() {
    let src = r#"
function View(props) {
  return <Shell>
    <Template slot={props.primarySlot ?? "main"}>
      <RouterLink to={props.route.to} replace={props.route.replace}>{props.route.label}</RouterLink>
      {props.sections.map(section => <Fragment key={section.id}>
        <Header.Title>{section.title}</Header.Title>
        {section.rows.map(row => row.url
          ? <RouterLink key={row.id} to={row.url}>{row.label}</RouterLink>
          : <Card.Item key={row.id} __rueNativeOnClick={() => props.pick(row.id)}>{row.label}</Card.Item>)}
      </Fragment>)}
    </Template>
    {props.footer ? <Footer>{props.footer}</Footer> : null}
  </Shell>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply(program), cm));

    assert!(out.contains("_$createComponent(Shell"));
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("[props.primarySlot ?? \"main\"]"), "{out}");
    assert!(out.contains("_$createElement(\"a\""), "{out}");
    assert!(out.contains("_$vaporKeyedList"));
    assert!(out.contains("_$createDocumentFragment"));
    assert!(out.contains("_$createComponent(Header.Title"));
    assert!(out.contains("_$vaporWithNativeEvents(_$createComponent(Card.Item"));
    assert!(out.contains("_$createComponent(Footer"));
}

#[test]
fn apply_pre_hardens_pre_islands_inside_template_lists() {
    let src = r#"
function View(props) {
  return <section>
    <template v-for="row in props.rows">
      <article v-pre v-if={row.skip} v-show={row.visible} v-html="row.raw">{row.raw}</article>
      <article v-if={row.visible} v-text={row.title} />
      <article v-else>Hidden</article>
    </template>
  </section>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains("(props.rows).map"), "{out}");
    assert!(out.contains("([row])"), "{out}");
    assert!(out.contains("v-pre"));
    assert!(out.contains("v-if={row.skip}"));
    assert!(out.contains("v-show={row.visible}"));
    assert!(out.contains("v-html"));
    assert!(out.contains("row.visible ?"));
    assert!(out.contains("{row.title}"));
    assert!(!out.contains("v-for"));
}

#[test]
fn transform_entry_hardens_component_slot_models_lists_and_show_together() {
    let src = r#"
function View({ rows, form, ready, slotName }) {
  return <Dialog v-show={ready}>
    <Template slot={slotName}>
      <Editor v-model:body-lazy={form.body} />
      {rows.map(({ id, label }, index) => <Row key={id} index={index}>{label ?? form.body}</Row>)}
    </Template>
    {ready && <Footer>{form.body}</Footer>}
  </Dialog>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains("__rue_props.rows"), "{out}");
    assert!(out.contains("__rue_props.form"), "{out}");
    assert!(out.contains("_$createComponent(Dialog"));
    assert!(out.contains("_$vaporShowStyle"));
    assert!(out.contains("__rue_slots"));
    assert!(out.contains("[__rue_props.slotName]"));
    assert!(out.contains("bodyLazy: __rue_props.form.body"), "{out}");
    assert!(out.contains("onUpdateBodyLazy"));
    assert!(out.contains("_$vaporKeyedList"));
    assert!(out.contains("_$createComponent(Footer"));
}

#[test]
fn transform_entry_hardens_defaulted_list_params_without_dangling_aliases() {
    let src = r#"
function View(props) {
  return <ul>
    {props.rows.map((row = props.fallback) => <li key={row.id}>{row.label}</li>)}
  </ul>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains("_$vaporKeyedList"), "{out}");
    assert!(out.contains("(item === undefined ? props.fallback : item).id"), "{out}");
    assert!(out.contains("(item === undefined ? props.fallback : item).label"), "{out}");
    assert!(!out.contains("=>row.id"), "{out}");
    assert!(!out.contains("(row.label)"), "{out}");
}

#[test]
fn transform_entry_hardens_defaulted_destructured_lists_and_native_key_scan() {
    let src = r#"
function View(props) {
  return <ul>
    {props.rows.map(({ id, label } = props.fallback, index) => {
      const text = label ?? props.empty;
      return <li key={id}>{text}:{index}</li>;
    })}
  </ul>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains("_$vaporKeyedList"), "{out}");
    assert!(
        out.contains("getKey: (item, index)=>(item === undefined ? props.fallback : item).id"),
        "{out}"
    );
    assert!(
        out.contains(
            "const text = (item === undefined ? props.fallback : item).label ?? props.empty"
        ),
        "{out}"
    );
    assert!(!out.contains("row."), "{out}");
}

#[test]
fn transform_entry_hardens_bare_loop_shadowing_and_post_return_phase2() {
    let src = r#"
function View({ count, records, totals }) {
  const total = count * 2;
  const render = () => {
    for (total in records) {
      console.log(total);
    }
    for (total of totals) {
      console.log(total);
    }
    return { total };
  };
  return <Panel value={render().total}>{total}</Panel>;
  after(total);
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains("computed(()=>__rue_props.count * 2)"), "{out}");
    assert!(out.contains("for(total in __rue_props.records)"), "{out}");
    assert!(out.contains("total of __rue_props.totals"), "{out}");
    assert!(out.contains("console.log(total)"), "{out}");
    assert!(out.contains("{ total: __rue_phase2_total.get() }"), "{out}");
    assert!(out.contains("after(total.get())"), "{out}");
}

#[test]
fn apply_pre_hardens_duplicate_show_for_model_if_and_pre_boundaries() {
    let src = r#"
function View(props) {
  return <section>
    <input v-model:number={props.count} v-show={props.visible} r-show={props.enabled} />
    <template v-for="item in props.items">
      <span v-if={item.ready}>{item.label}</span>
      <span v-pre v-else>{item.raw}</span>
    </template>
    <button r-on:click-once-capture="props.save()">Save</button>
  </section>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(apply_pre(program), cm));

    assert!(out.contains("value={props.count}"), "{out}");
    assert!(out.contains("onInput"), "{out}");
    assert!(out.contains("_$vaporShowStyle"), "{out}");
    assert!(out.contains("props.enabled"), "{out}");
    assert!(out.contains("v-show={props.visible}"), "{out}");
    assert!(out.contains("(props.items).map"), "{out}");
    assert!(out.contains("([item])"), "{out}");
    assert!(out.contains("item.ready ?"), "{out}");
    assert!(out.contains("v-pre"), "{out}");
    assert!(out.contains("v-else"), "{out}");
    assert!(out.contains("_$vaporWithEventModifiers"));
    assert!(out.contains("\"once\""));
    assert!(out.contains("\"capture\""));
}

#[test]
fn transform_entry_hardens_array_default_lists_for_loops_and_transition_finalizers() {
    let src = r#"
function View({ rows, fallback, count, limit }) {
  const total = count + 1;
  const render = () => {
    for (let i = total; i < limit; i++) {
      report(i, total);
    }
    return total;
  };
  return <section data-total={render()}>
    {rows.map(([id, meta] = fallback, index) => <li key={id}>{meta.label}:{index}</li>)}
    <TransitionGroup>
      {rows.map(row => {
        try {
          touch(row);
        } finally {
          return <li key={row.id}>{row.name}</li>;
        }
      })}
    </TransitionGroup>
  </section>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains("_$vaporKeyedList"), "{out}");
    assert!(
        out.contains(
            "getKey: (item, index)=>(item === undefined ? __rue_props.fallback : item)[0]"
        ),
        "{out}"
    );
    assert!(out.contains("(item === undefined ? __rue_props.fallback : item)[1].label"), "{out}");
    assert!(
        out.contains("for(let i = __rue_phase2_total.get(); i < __rue_props.limit; i++)"),
        "{out}"
    );
    assert!(out.contains("report(i, __rue_phase2_total.get())"), "{out}");
    assert!(out.contains("finally"), "{out}");
    assert!(!out.contains("meta.label"), "{out}");
}

#[test]
fn transform_entry_hardens_member_children_type_alias_imports_and_ts_wrappers() {
    let src = r#"
import { "ref" as localRef, "FC" as RueFC } from '@rue-js/rue';

type ViewType = RueFC;

const View: ViewType = (props) => {
  const count = localRef(0);
  return <section>
    {props.children}
    {ctx.children}
    <Panel><Card title={'ok' as const} count={(1 as number)} onReady={props.ready} /></Panel>
    <span>{count.value}</span>
  </section>;
};
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains("@rue-js/rue/vapor"), "{out}");
    assert!(out.contains("type \"FC\" as RueFC"), "{out}");
    assert!(out.contains("ref as localRef"), "{out}");
    assert_eq!(out.matches("rue:children:anchor").count(), 2, "{out}");
    assert!(out.contains("const __slot = props.children;"), "{out}");
    assert!(out.contains("const __slot = ctx.children;"), "{out}");
    assert!(out.contains("_$createComponent(Card"), "{out}");
    assert!(out.contains("title: 'ok'"), "{out}");
    assert!(out.contains("count: 1"), "{out}");
    assert!(out.contains("vapor("), "{out}");
}

#[test]
fn transform_entry_routes_accessor_get_children_as_renderable_slots() {
    let src = r#"
import { computed } from '@rue-js/rue';

function View(props) {
  const indicator = computed(() => props.done ? <span className="ok">ok</span> : `${props.percent}%`);
  return <section>
    <div>{indicator.get()}</div>
    <div>{(indicator.get() as any) ?? props.fallback}</div>
    <div>{props.ready && indicator.get()}</div>
    <span>{String(indicator.get())}</span>
    <span>{props.reader.get(0)}</span>
  </section>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains("@rue-js/rue/vapor"), "{out}");
    assert!(out.contains("const __slot = indicator.get();"), "{out}");
    assert!(out.contains("indicator.get() as any) ?? props.fallback"), "{out}");
    assert!(out.contains("props.ready ? indicator.get() : \"\""), "{out}");
    assert!(out.matches("renderAnchor(__slot").count() >= 3, "{out}");
    assert!(!out.contains("_$settextContent(_") || !out.contains(", indicator.get());"), "{out}");
    assert!(out.contains("String(indicator.get())"), "{out}");
    assert!(out.contains("props.reader.get(0)"), "{out}");
}

#[test]
fn transform_entry_hardens_slot_routerlink_modelled_lists_and_show_combo() {
    let src = r#"
function View(props) {
  return <Panel>
    {(ctx) => <span>{ctx.label}</span>}
    {props.ready && <Template slot={props.slotName}><RouterLink to={props.href} replace>Go</RouterLink></Template>}
    {props.rows.map((row = props.fallback, idx) => (
      <Field key={row.id} v-model:value-trim={row.value} v-show={row.visible}>{idx}</Field>
    ))}
  </Panel>;
}
"#;
    let (program, cm) = parse_program(src);
    let out = normalize(&emit(transform(program, empty_plugin_metadata()), cm));

    assert!(out.contains("__rue_slots"), "{out}");
    assert!(out.contains("props.slotName"), "{out}");
    assert!(out.contains("_$vaporKeyedList"), "{out}");
    assert!(
        out.contains("getKey: (item, idx)=>(item === undefined ? props.fallback : item).id"),
        "{out}"
    );
    assert!(out.contains("onUpdateValueTrim"), "{out}");
    assert!(out.contains("_$vaporShowStyle"), "{out}");
    assert!(out.contains("RouterLink"), "{out}");
    assert!(!out.contains("v-model"), "{out}");
    assert!(!out.contains("v-show"), "{out}");
}
