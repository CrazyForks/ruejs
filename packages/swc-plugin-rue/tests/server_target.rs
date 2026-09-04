//! Server JSX target code-generation contract.
use swc_plugin_rue::{apply, apply_server};
mod utils;

#[test]
fn server_target_uses_only_server_renderer_operations_and_preserves_directives() {
    let source = r#"
"use server";
import { type FC, createContext } from '@rue-js/rue';

const Theme = createContext('light');
const Card: FC<{ title: string }> = props => <article>{props.title}</article>;
const Page: FC = () => (
  <>
    <Theme.Provider value="dark"><Card title="Rue" /></Theme.Provider>
    <main data-ready>{['safe', <strong>server</strong>]}</main>
  </>
);
"#;

    let (program, cm) = utils::parse(source, "server-target.tsx");
    let output = utils::emit(apply_server(program), cm);

    assert!(output.trim_start().starts_with("\"use server\";"));
    assert!(output.contains("from \"@rue-js/server-renderer\""));
    assert!(output.contains("_$serverElement"));
    assert!(output.contains("_$serverComponent"));
    assert!(output.contains("_$serverFragment"));
    assert!(!output.contains("@rue-js/rue/internal"));
    assert!(!output.contains("@rue-js/rue/internal"));
    assert!(!output.contains("jsx-runtime"));
    assert!(!output.contains("<article"));
    assert!(!output.contains("<main"));
}

#[test]
fn client_target_does_not_import_server_renderer() {
    let (program, cm) = utils::parse("export const App = () => <main>client</main>", "client.tsx");
    let output = utils::emit(apply(program), cm);

    assert!(output.contains("@rue-js/rue/"));
    assert!(!output.contains("@rue-js/server-renderer"));
}

#[test]
fn server_target_preserves_inline_whitespace_before_expressions() {
    let (program, cm) = utils::parse(
        "export const Page = ({ id }) => <div>params.id is {id}</div>",
        "server-inline-whitespace.tsx",
    );
    let output = utils::emit(apply_server(program), cm);

    assert!(output.contains("\"params.id is \""), "{output}");
}
