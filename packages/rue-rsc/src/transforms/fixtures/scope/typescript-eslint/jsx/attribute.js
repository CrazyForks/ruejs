import { jsx as _jsx } from '@rue-js/jsx-runtime'
const x = 1
const attr = 2 // should be unreferenced
_jsx(Foo, { attr: x })
