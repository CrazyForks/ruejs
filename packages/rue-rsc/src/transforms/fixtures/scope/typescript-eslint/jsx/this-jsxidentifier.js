import { jsx as _jsx } from '@rue-js/jsx-runtime'
class Foo {
  constructor() {
    this.Div = {
      Element: () => _jsx('div', {}),
    }
  }
  method() {
    _jsx(this.foo, {})
    _jsx(Div.Element, {})(_jsx(this, {}))
  }
}
