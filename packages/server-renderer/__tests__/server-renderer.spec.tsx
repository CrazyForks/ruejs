// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { type FC } from '@rue-js/rue'
import {
  _$appendChild,
  _$createComment,
  _$createElement,
  _$createTextNode,
  _$setClassName,
} from '@rue-js/runtime'
import * as runtimeServer from '@rue-js/runtime/server'

import {
  renderToString,
  runWithServerDOMAdapter,
  ServerCommentNode,
  ServerDOMAdapter,
  ServerElementNode,
  ServerFragmentNode,
  ServerTextNode,
} from '../src'

describe('rue server-renderer', () => {
  it('re-exports the runtime server renderer APIs', () => {
    expect(renderToString).toBe(runtimeServer.renderToString)
    expect(runWithServerDOMAdapter).toBe(runtimeServer.runWithServerDOMAdapter)
    expect(ServerDOMAdapter).toBe(runtimeServer.ServerDOMAdapter)
    expect(ServerElementNode).toBe(runtimeServer.ServerElementNode)
    expect(ServerTextNode).toBe(runtimeServer.ServerTextNode)
    expect(ServerCommentNode).toBe(runtimeServer.ServerCommentNode)
    expect(ServerFragmentNode).toBe(runtimeServer.ServerFragmentNode)
  })

  it('renders JSX component trees to escaped HTML strings', async () => {
    const App: FC<{ disabled: boolean; title: string }> = props => (
      <section
        className="hero"
        data-title={props.title}
        style={{ color: 'red', backgroundColor: 'white' }}
      >
        <h1>{props.title}</h1>
        <p>{'Rue <SSR> & friends'}</p>
        <input disabled={props.disabled} value="ready" />
      </section>
    )

    await expect(
      renderToString(App, { props: { disabled: true, title: 'Rue "SSR" & <friends>' } }),
    ).resolves.toBe(
      '<section class="hero" data-title="Rue &quot;SSR&quot; &amp; &lt;friends&gt;" style="color: red; background-color: white"><h1>Rue "SSR" &amp; &lt;friends&gt;</h1><p>Rue &lt;SSR&gt; &amp; friends</p><input disabled value="ready"></section>',
    )
  })

  it('renders explicit boolean data and aria attributes as stable string booleans', async () => {
    const App: FC = () => (
      <section data-editor-content={true} data-ready={true} data-off={false} aria-hidden={true} />
    )

    await expect(renderToString(App)).resolves.toBe(
      '<section data-editor-content="true" data-ready="true" data-off="false" aria-hidden="true"></section>',
    )
  })

  it('defaults no-value data-editor-content to true', async () => {
    const App: FC = () => <section data-editor-content />

    await expect(renderToString(App)).resolves.toBe(
      '<section data-editor-content="true"></section>',
    )
  })

  it('honors the includeComments render option', async () => {
    const WithComment: FC = () => _$createComment('rue:ssr') as any

    await expect(renderToString(WithComment)).resolves.toBe('')
    await expect(renderToString(WithComment, { includeComments: true })).resolves.toBe(
      '<!--rue:ssr-->',
    )
  })

  it('installs and restores the server DOM adapter for low-level runtime helpers', async () => {
    const button = await runWithServerDOMAdapter(() => {
      const el = _$createElement('button') as ServerElementNode

      _$setClassName(el, 'primary')
      _$appendChild(el, _$createTextNode('Save <draft>'))

      return el
    })

    expect(button).toBeInstanceOf(ServerElementNode)
    expect(button.innerHTML).toBe('Save &lt;draft&gt;')
    expect(button.attributes.get('class')).toBe('primary')

    expect(_$createElement('span')).toBeInstanceOf(HTMLSpanElement)
  })
})
