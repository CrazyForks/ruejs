// @vitest-environment jsdom

// Keep the raw SWC codegen harness out of Rue's Vite JSX transform. The imported
// TypeScript module compiles its JSX source strings explicitly with the release WASM.
import './compiledKeyedList.codegen.case'
