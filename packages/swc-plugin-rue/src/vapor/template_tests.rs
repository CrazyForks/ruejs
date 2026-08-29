use std::process::Command;
use std::sync::Arc;

use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::ast::Program;
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn transform_module(src: &str) -> String {
    let cm = Arc::new(SourceMap::default());
    let fm = cm.new_source_file(
        FileName::Custom("static-template-test.tsx".into()).into(),
        src.to_string(),
    );
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    let program = Program::Module(parser.parse_module().expect("parse module"));
    let output = crate::apply(program);

    let mut buf = Vec::new();
    let mut emitter = Emitter {
        cfg: Default::default(),
        comments: None,
        cm: cm.clone(),
        wr: JsWriter::new(cm, "\n", &mut buf, None),
    };
    emitter.emit_program(&output).expect("emit transformed module");
    String::from_utf8(buf).expect("utf8")
}

fn compact(src: &str) -> String {
    src.chars().filter(|ch| !ch.is_whitespace()).collect()
}

#[test]
fn hoists_and_deduplicates_static_html_with_the_shared_template_helper() {
    let output = transform_module(
        r#"
const First = () => <div class="a"><span>hello</span></div>;
const Second = () => <div class="a"><span>hello</span></div>;
"#,
    );
    let compact = compact(&output);

    assert_eq!(compact.matches("const_$getTemplate1=_$template(").count(), 1, "{output}");
    assert_eq!(compact.matches(r#"<divclass="a"><span>hello</span></div>"#).count(), 1, "{output}");
    assert_eq!(compact.matches("__rue_vapor_setup").count(), 2, "{output}");
    assert!(output.contains("@rue-js/rue/compiled"), "{output}");
    assert!(compact.contains("import{_$template}"), "{output}");
    assert!(compact.contains(".content.cloneNode(true)"), "{output}");
    assert!(!compact.contains("document.createElement(\"template\")"), "{output}");
    assert!(!compact.contains(".innerHTML="), "{output}");
    assert!(!compact.contains("_$createElement"), "{output}");
    assert!(!compact.contains("_$appendChild"), "{output}");
    assert!(!compact.contains("_$compiledRoot"), "{output}");
    assert!(!compact.contains("vapor("), "{output}");
}

#[test]
fn rejects_unsafe_templates_while_routing_direct_owned_roots_to_the_mixed_vapor_graph() {
    let output = transform_module(
        r#"
const SvgView = () => <svg><circle /></svg>;
const CustomView = () => <x-card>hello</x-card>;
const SpreadView = () => <div {...props}>hello</div>;
const EventView = () => <button onClick={handle}>hello</button>;
const RefView = () => <input ref={inputRef} />;
"#,
    );
    let compact = compact(&output);

    assert!(output.contains("@rue-js/rue/vapor"), "{output}");
    assert!(!output.contains("@rue-js/rue/compiled"), "{output}");
    assert!(compact.matches("_$createElement(").count() >= 4, "{output}");
    assert!(compact.contains("_$spreadAttributes"), "{output}");
    assert_eq!(compact.matches("_$compiledRoot(").count(), 2, "{output}");
    assert!(compact.contains(".addEventListener(\"click\""), "{output}");
    assert!(compact.contains(".removeEventListener(\"click\""), "{output}");
    assert!(compact.contains("onCleanup("), "{output}");
    assert!(!compact.contains("_$addEventListener"), "{output}");
    assert!(!compact.contains("_$vaporBindUseRef"), "{output}");
    assert!(!compact.contains("_$template"), "{output}");
    assert!(!compact.contains(".content.cloneNode(true)"), "{output}");
}

#[test]
fn clones_static_nested_html_inside_a_dynamic_native_root() {
    let output = transform_module(
        r#"
const View = props => <section id={props.id}><span className="label">hello</span></section>;
"#,
    );
    let compact = compact(&output);

    assert!(output.contains("@rue-js/rue/vapor"), "{output}");
    assert!(compact.contains("_$createElement(\"section\""), "{output}");
    assert!(
        compact.contains("const_$getTemplate1=_$template('<spanclass=\"label\">hello</span>')"),
        "{output}"
    );
    assert!(
        compact.contains("_root.appendChild(_$getTemplate1().content.cloneNode(true))"),
        "{output}"
    );
    assert!(!compact.contains("_$createElement(\"span\""), "{output}");
}

#[test]
fn avoids_user_template_identifier_collisions() {
    let output = transform_module(
        r#"
const _$template1 = "user-cache";
const _$getTemplate1 = () => "user-getter";
const View = () => <div>hello</div>;
"#,
    );
    let compact = compact(&output);

    assert!(compact.contains("const_$getTemplate2=_$template("), "{output}");
    assert!(compact.contains("_$getTemplate2().content.cloneNode(true)"), "{output}");
    assert_eq!(compact.matches("const_$template1=\"user-cache\"").count(), 1, "{output}");
}

#[test]
fn preserves_directive_prologues_and_rejects_parser_sensitive_html() {
    let output = transform_module(
        r#"
"use client";
import { type FC } from "@rue-js/rue";
const View: FC = () => <div>hello</div>;
const Textarea = () => <textarea value={"hello"} />;
const Select = label => <select value={"a"}><option value="a">{label}</option></select>;
const Body = content => <body>{content}</body>;
"#,
    );
    let compact = compact(&output);
    let directive = compact.find("\"useclient\";").expect("directive prologue");
    let type_import = compact.find("from\"@rue-js/rue\";").expect("type import");
    let hoist = compact.find("const_$getTemplate1=_$template(").expect("template hoist");

    assert!(directive < type_import && type_import < hoist, "{output}");
    assert_eq!(compact.matches("const_$getTemplate1=_$template(").count(), 1, "{output}");
    assert!(compact.matches("_$createElement(").count() >= 4, "{output}");
    assert!(compact.contains("_$setValue(_root,\"hello\")"), "{output}");
    assert!(compact.contains("_$setValue(_root,\"a\")"), "{output}");
    assert!(compact.contains("_$createElement(\"body\""), "{output}");
}

#[test]
fn executes_lazy_static_template_mount_and_idempotent_dispose_in_jsdom() {
    let output = transform_module(
        r#"
const View = () => <div class="a"><span>hello</span></div>;
"#,
    );
    let executable = output
        .lines()
        .filter(|line| !line.starts_with("import { _$template }"))
        .collect::<Vec<_>>()
        .join("\n");
    let script = format!(
        r#"
const {{ JSDOM }} = require("jsdom");
const _$template = html => {{
  let cached;
  return () => {{
    if (!cached) {{
      cached = document.createElement("template");
      cached.innerHTML = html;
    }}
    return cached;
  }};
}};
{executable}
if (typeof document !== "undefined") throw new Error("module evaluation touched document");
const dom = new JSDOM("<!doctype html><body></body>");
global.document = dom.window.document;
let templateCreates = 0;
const createElement = document.createElement.bind(document);
document.createElement = tag => {{
  if (tag === "template") templateCreates += 1;
  return createElement(tag);
}};
const first = View();
if (templateCreates !== 0) throw new Error("template initialized before setup");
const firstContainer = document.createElement("main");
const firstRoot = first.__rue_vapor_setup(firstContainer);
firstContainer.appendChild(firstRoot);
if (firstContainer.innerHTML !== '<div class="a"><span>hello</span></div>') {{
  throw new Error(`unexpected DOM: ${{firstContainer.innerHTML}}`);
}}
if (templateCreates !== 1) throw new Error(`expected one template, got ${{templateCreates}}`);
first.dispose();
first.dispose();
if (firstContainer.innerHTML !== "") throw new Error("dispose was not idempotent");
const second = View();
const secondContainer = document.createElement("main");
secondContainer.appendChild(second.__rue_vapor_setup(secondContainer));
if (templateCreates !== 1) throw new Error("deduplicated cache was not reused");
delete global.document;
"#,
    );

    let result = Command::new("node")
        .args(["-e", &script])
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .expect("run generated JavaScript in jsdom");
    assert!(
        result.status.success(),
        "node failed\nstdout:\n{}\nstderr:\n{}\ngenerated:\n{}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr),
        executable,
    );
}
