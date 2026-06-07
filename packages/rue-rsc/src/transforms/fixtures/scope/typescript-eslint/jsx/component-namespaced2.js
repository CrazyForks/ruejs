import { jsx as _jsx } from '@rue-js/jsx-runtime'
const x = {
  Foo() {},
}
const Foo = 1 // should be unreferenced
_jsx(x.Foo, {}) // lower cased namespaces should still create a reference
