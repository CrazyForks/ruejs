use super::*;
use std::sync::Arc;
use swc_core::common::{FileName, SourceMap};
use swc_core::ecma::codegen::{Emitter, text_writer::JsWriter};
use swc_ecma_parser::{Parser, StringInput, Syntax, TsSyntax};

fn parse_module(src: &str) -> (Module, Arc<SourceMap>) {
    let cm = Arc::new(SourceMap::default());
    let fm =
        cm.new_source_file(FileName::Custom("imports-test.tsx".into()).into(), src.to_string());
    let mut parser = Parser::new(
        Syntax::Typescript(TsSyntax { tsx: true, ..Default::default() }),
        StringInput::from(&*fm),
        None,
    );
    (parser.parse_module().expect("parse module"), cm)
}

fn emit_module(module: &Module, cm: Arc<SourceMap>) -> String {
    let mut buf = Vec::new();
    let mut emitter = Emitter {
        cfg: Default::default(),
        comments: None,
        cm: cm.clone(),
        wr: JsWriter::new(cm, "\n", &mut buf, None),
    };
    emitter.emit_module(module).expect("emit module");
    String::from_utf8(buf).expect("utf8")
}

fn compact(src: &str) -> String {
    src.chars().filter(|ch| !ch.is_whitespace()).collect()
}

fn ensure_and_emit(src: &str) -> String {
    let (mut module, cm) = parse_module(src);
    ensure_runtime_imports(&mut module);
    compact(&emit_module(&module, cm))
}

fn import_source_count(src: &str, source: &str) -> usize {
    src.matches(&format!("'{source}'")).count() + src.matches(&format!("\"{source}\"")).count()
}

#[test]
fn converts_named_import_specs_for_ident_and_string_exports() {
    let ident_name = ModuleExportName::Ident(Ident::new(
        Atom::from("computed"),
        DUMMY_SP,
        SyntaxContext::empty(),
    ));
    assert_eq!(module_export_name_to_string(&ident_name), "computed");

    let string_name = ModuleExportName::Str(Str {
        span: DUMMY_SP,
        value: Atom::from("dash-name").into(),
        raw: None,
    });
    assert_eq!(module_export_name_to_string(&string_name), "dash-name");

    let named = ImportNamedSpecifier {
        span: DUMMY_SP,
        local: Ident::new(Atom::from("dash"), DUMMY_SP, SyntaxContext::empty()),
        imported: Some(string_name),
        is_type_only: true,
    };
    let spec = named_import_to_spec(&named);
    assert_eq!(spec.local, "dash");
    assert_eq!(spec.imported.as_deref(), Some("dash-name"));
    assert!(spec.is_type_only);

    let specifier = spec_to_named_import(&NamedImportSpec {
        local: "localComputed".to_string(),
        local_ctxt: SyntaxContext::empty(),
        imported: Some("computed".to_string()),
        is_type_only: false,
    });
    let ImportSpecifier::Named(named) = specifier else {
        panic!("expected named import");
    };
    assert_eq!(named.local.sym.as_ref(), "localComputed");
    assert_eq!(
        named.imported.as_ref().map(module_export_name_to_string).as_deref(),
        Some("computed"),
    );
}

#[test]
fn ensure_runtime_imports_moves_safe_root_values_and_marks_used_root_types() {
    let out = ensure_and_emit(
        r#"
import RueDefault, { FC, createApp, ref as localRef, watchEffect } from '@rue-js/rue';
import { vapor } from '@rue-js/rue/vapor';

type View = FC;
const state = localRef(0);
watchEffect(() => state.value);
_$createElement;
"#,
    );

    assert!(out.contains("@rue-js/rue/vapor"));
    assert!(out.contains("vapor"));
    assert!(out.contains("refaslocalRef"));
    assert!(out.contains("watchEffect"));
    assert!(out.contains("_$createElement"));
    assert!(out.contains("importRueDefault,{typeFC,createApp}from"));
    assert_eq!(import_source_count(&out, "@rue-js/rue"), 1);
    assert_eq!(import_source_count(&out, "@rue-js/rue/vapor"), 1);
}

#[test]
fn ensure_runtime_imports_inserts_only_missing_sources() {
    let type_only = ensure_and_emit("type View = FC;");
    assert!(type_only.starts_with("import{typeFC}from"));
    assert_eq!(import_source_count(&type_only, "@rue-js/rue"), 1);
    assert_eq!(import_source_count(&type_only, "@rue-js/rue/vapor"), 0);

    let helper_only = ensure_and_emit("const node = _$createComment('anchor');");
    assert!(helper_only.starts_with("import{_$createComment}from"));
    assert_eq!(import_source_count(&helper_only, "@rue-js/rue"), 0);
    assert_eq!(import_source_count(&helper_only, "@rue-js/rue/vapor"), 1);

    let unused = ensure_and_emit("const value = 1;");
    assert_eq!(unused, "constvalue=1;");
}

#[test]
fn ensure_runtime_imports_skips_existing_specs_and_local_collisions() {
    let with_default_collision = ensure_and_emit(
        r#"
import watchEffect, { ref } from '@rue-js/rue/vapor';

watchEffect(() => {});
ref(0);
computed(() => 1);
"#,
    );
    assert_eq!(with_default_collision.matches("watchEffect").count(), 2);
    assert_eq!(with_default_collision.matches("ref").count(), 2);
    assert!(with_default_collision.contains("computed"));
    assert!(with_default_collision.contains("importwatchEffect,{ref,computed}from"));
    assert!(with_default_collision.contains("@rue-js/rue/vapor"));

    let with_namespace_collision = ensure_and_emit(
        r#"
import * as computed from '@rue-js/rue/vapor';

computed(() => 1);
"#,
    );
    assert_eq!(with_namespace_collision.matches("computed").count(), 2);
    assert!(!with_namespace_collision.contains("{computed}"));
}

#[test]
fn mark_root_type_only_imports_leaves_unused_forced_root_types_as_values() {
    let (mut module, cm) = parse_module("import { FC } from '@rue-js/rue'; type Other = string;");
    let used_types = ["Other".to_string()].into_iter().collect();

    mark_root_type_only_imports(&mut module, &used_types);

    let out = compact(&emit_module(&module, cm));
    assert!(out.contains("import{FC}from"));
    assert!(!out.contains("typeFC"));
}

#[test]
fn ensure_runtime_imports_moves_string_named_root_aliases_and_keeps_type_aliases() {
    let out = ensure_and_emit(
        r#"
import { "ref" as localRef, "computed" as localComputed, "FC" as RueFC, createApp } from '@rue-js/rue';

type View = RueFC;
const state = localRef(0);
const doubled = localComputed(() => state.value * 2);
createApp(View);
"#,
    );

    assert_eq!(import_source_count(&out, "@rue-js/rue"), 1);
    assert_eq!(import_source_count(&out, "@rue-js/rue/vapor"), 1);
    assert!(out.contains("import{type\"FC\"asRueFC,createApp}from"), "{out}");
    assert!(out.contains("import{refaslocalRef,computedaslocalComputed}from"), "{out}");
    assert!(out.contains("conststate=localRef(0);"), "{out}");
    assert!(out.contains("constdoubled=localComputed(()=>state.value*2);"), "{out}");
}

#[test]
fn ensure_runtime_imports_merges_helpers_without_duplicate_string_named_aliases() {
    let out = ensure_and_emit(
        r#"
import { ref as localRef } from '@rue-js/rue/vapor';
import { "ref" as localRef, watchEffect } from '@rue-js/rue';

const state = localRef(0);
watchEffect(() => state.value);
"#,
    );

    assert_eq!(import_source_count(&out, "@rue-js/rue"), 0);
    assert_eq!(import_source_count(&out, "@rue-js/rue/vapor"), 1);
    assert_eq!(out.matches("refaslocalRef").count(), 1, "{out}");
    assert!(out.contains("watchEffect"), "{out}");
}
