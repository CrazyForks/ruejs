import { expect, it, vi } from 'vitest'
import { mount, onBeforeMount, onMounted, render, useRef } from '@rue-js/rue'
import { _$serverElement, renderToString } from '@rue-js/server-renderer'

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

it('leaves refs detached in SSR protocol elements and attaches them on client mount', async () => {
  const callbackRef = vi.fn((element: HTMLElement | null) => {
    if (element) element.style.setProperty('--ready', '1')
  })
  const objectRef = { current: undefined as HTMLElement | undefined }
  const Page = () => (
    <section ref={objectRef}>
      <div ref={callbackRef}>Ref content</div>
    </section>
  )

  // Match the protocol emitted by the SSR compiler (this test file uses the client compiler).
  const ServerPage = () =>
    _$serverElement('section', { ref: objectRef }, [
      _$serverElement('div', { ref: callbackRef }, ['Ref content']),
    ])
  expect(await renderToString(ServerPage)).toContain('Ref content</div>')
  expect(callbackRef).not.toHaveBeenCalled()
  expect(objectRef.current).toBeUndefined()

  const container = document.createElement('div')
  mount(Page, container)
  try {
    await Promise.resolve()
    expect(objectRef.current).toBe(container.firstElementChild)
    expect(callbackRef).toHaveBeenCalledWith(container.querySelector('div'))
    expect(container.querySelector('div')?.style.getPropertyValue('--ready')).toBe('1')
  } finally {
    render(null, container)
  }
})
