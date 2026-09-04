import { describe, expect, it } from 'vitest'

import { attachRouter, createMemoryHistory, createRouter, RouterView } from '@rue-js/router'

import { render, useComponent } from '../src'
import { flush, mountContainer, waitForContent } from './page-test-utils'
import {
  clickByText,
  defineSplitHomeExampleActualSpec,
  inputValueAt,
} from './splitHomeExampleTestUtils'

defineSplitHomeExampleActualSpec({
  name: 'MapListRendering',
  route: '/examples/map-list-rendering',
  importPage: () => import('../../../app/pages/examples/MapListRendering'),
  expectedTexts: ['map 列表渲染', 'map 列表渲染', '苹果', '香蕉'],
  interaction: async container => {
    await inputValueAt(container, 0, '西瓜')
    await clickByText(container, '添加')
  },
  interactionExpectedTexts: ['西瓜'],
})

describe('MapListRendering route lifecycle', () => {
  it('switches away from and back to the lazy route after a list update', async () => {
    const MapRoute = useComponent(() => import('../../../app/pages/examples/MapListRendering'))
    const OtherRoute = () => <section>other route</section>
    const router = createRouter({
      history: createMemoryHistory('/examples/map-list-rendering'),
      routes: [
        { path: '/examples/map-list-rendering', component: MapRoute },
        { path: '/other', component: OtherRoute },
      ],
    })
    attachRouter(router)
    const container = mountContainer()

    render(<RouterView />, container)
    await router.isReady()
    await waitForContent(() => expect(container.textContent).toContain('map 列表渲染'))

    await inputValueAt(container, 0, '西瓜')
    await clickByText(container, '添加')
    expect(container.textContent).toContain('西瓜')

    await router.push('/other')
    await flush()
    expect(container.textContent).toContain('other route')
    expect(container.textContent).not.toContain('map 列表渲染')

    await router.push('/examples/map-list-rendering')
    await flush()
    await waitForContent(() => expect(container.textContent).toContain('map 列表渲染'))

    render(null as any, container)
  })
})
