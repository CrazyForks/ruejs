use super::*;
use std::sync::Arc;
use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
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
