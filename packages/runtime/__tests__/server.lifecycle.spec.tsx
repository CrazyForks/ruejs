import { expect, it, vi } from 'vitest'
import { mount, onBeforeMount, onMounted, render, useRef } from '@rue-js/rue'
import { renderToString } from '@rue-js/server-renderer'

it('keeps browser mount callbacks out of SSR and runs them on client mount', async () => {
  const beforeMount = vi.fn()
  const mounted = vi.fn()
  const Page = () => {
    const root = useRef<HTMLElement>()
    onBeforeMount(beforeMount)
    onMounted(() => {
      mounted(root.current?.querySelectorAll('a').length)
    })
    return (
      <nav ref={root}>
        <a href="/">Home</a>
      </nav>
    )
  }

  expect(await renderToString(Page)).toContain('Home</a>')
  expect(beforeMount).not.toHaveBeenCalled()
  expect(mounted).not.toHaveBeenCalled()

  const container = document.createElement('div')
  mount(Page, container)
  try {
    await Promise.resolve()
    expect(beforeMount).toHaveBeenCalledTimes(1)
    expect(mounted).toHaveBeenCalledWith(1)
  } finally {
    render(null, container)
  }
})
