// @vitest-environment jsdom

import { afterEach, expect, it } from 'vitest'

import LocalTodoListDemo from '../../../app/pages/examples/home-demos/LocalTodoListDemo'
import { h, setReactiveScheduling } from '@rue-js/rue'
import { renderToString } from '@rue-js/server-renderer'
import { runWithStaticRenderDom } from '@rue-js/server-renderer/static'

afterEach(() => {
  setReactiveScheduling('sync')
})

it('drains reactive SSR work before releasing the static DOM environment', async () => {
  setReactiveScheduling('frame')
  const testDocument = globalThis.document
  Reflect.deleteProperty(globalThis, 'document')

  try {
    const html = await runWithStaticRenderDom('/examples/local-todo-list', () =>
      renderToString(h(LocalTodoListDemo, null)),
    )

    expect(html).toContain('总计: 3 | 已完成: 1')
    await Promise.resolve()
    await Promise.resolve()
  } finally {
    globalThis.document = testDocument
  }
})
