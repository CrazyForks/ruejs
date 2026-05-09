import { afterEach, describe, expect, it } from 'vitest'
import { h } from '@rue-js/rue'
import { render } from '@rue-js/rue'
import { Avatar } from '@rue-js/design'

const waitAvatarRender = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Avatar', () => {
  it('renders with base class and children', async () => {
    const c = document.createElement('div')
    render(h(Avatar, null, h('div', { className: 'w-12 rounded' }, h('img', { src: 'x' }))), c)
    await waitAvatarRender()
    const el = c.querySelector('.avatar') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('avatar')).toBe(true)
  })

  it('applies status classes', async () => {
    const c = document.createElement('div')
    render(h(Avatar, { status: 'online' }, h('div', { className: 'w-12' })), c)
    await waitAvatarRender()
    let el = c.querySelector('.avatar') as HTMLElement
    expect(el.classList.contains('avatar-online')).toBe(true)

    render(h(Avatar, { status: 'offline' }, h('div', { className: 'w-12' })), c)
    await waitAvatarRender()
    el = c.querySelector('.avatar') as HTMLElement
    expect(el.classList.contains('avatar-offline')).toBe(true)

    render(h(Avatar, { status: 'placeholder' }, h('div', { className: 'w-12' })), c)
    await waitAvatarRender()
    el = c.querySelector('.avatar') as HTMLElement
    expect(el.classList.contains('avatar-placeholder')).toBe(true)
  })

  it('appends custom className', async () => {
    const c = document.createElement('div')
    render(h(Avatar, { className: 'mx-2' }, 'x'), c)
    await waitAvatarRender()
    const el = c.querySelector('.avatar') as HTMLElement
    expect(el.classList.contains('mx-2')).toBe(true)
  })

  it('renders group container', async () => {
    const c = document.createElement('div')
    render(
      h(
        Avatar.Group,
        { className: '-space-x-6' },
        h(Avatar, null, h('div', { className: 'w-12' })),
        h(Avatar, null, h('div', { className: 'w-12' })),
      ),
      c,
    )
    await waitAvatarRender()
    const el = c.querySelector('.avatar-group') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('-space-x-6')).toBe(true)
    expect(c.querySelectorAll('.avatar').length).toBe(2)
  })

  it('renders group via items array', async () => {
    const c = document.createElement('div')
    const items = [
      { children: h('div', { className: 'w-12' }, h('img', { src: 'a' })) },
      { children: h('div', { className: 'w-12' }, h('img', { src: 'b' })) },
      { status: 'placeholder', children: h('div', { className: 'w-12' }, h('span', null, '+3')) },
    ]
    render(h(Avatar.Group, { className: '-space-x-6', items }, null), c)
    await waitAvatarRender()
    const el = c.querySelector('.avatar-group') as HTMLElement
    expect(el).toBeTruthy()
    const avatars = c.querySelectorAll('.avatar')
    expect(avatars.length).toBe(3)
    expect((avatars[2] as HTMLElement).classList.contains('avatar-placeholder')).toBe(true)
  })

  it('renders semantic avatar props with image, size and shape', async () => {
    const c = document.createElement('div')
    render(h(Avatar, { src: 'demo.png', alt: 'Rue', size: 'lg', shape: 'square' }), c)
    await waitAvatarRender()
    const body = c.querySelector('[data-rue-avatar-body="true"]') as HTMLElement
    const image = c.querySelector('[data-rue-avatar-image="true"]') as HTMLImageElement
    expect(body).toBeTruthy()
    expect(body.classList.contains('h-12')).toBe(true)
    expect(body.classList.contains('w-12')).toBe(true)
    expect(body.classList.contains('rounded-2xl')).toBe(true)
    expect(image.getAttribute('src')).toBe('demo.png')
    expect(image.getAttribute('alt')).toBe('Rue')
  })

  it('falls back to icon or text when image loading fails', async () => {
    const c = document.createElement('div')
    render(
      h(
        Avatar,
        {
          src: 'broken.png',
          text: 'AI',
        },
        null,
      ),
      c,
    )
    await waitAvatarRender()
    const image = c.querySelector('[data-rue-avatar-image="true"]') as HTMLImageElement
    const fallback = c.querySelector('[data-rue-avatar-fallback="true"]') as HTMLElement
    expect(fallback.classList.contains('hidden')).toBe(true)
    image.dispatchEvent(new Event('error'))
    expect(image.classList.contains('hidden')).toBe(true)
    expect(fallback.classList.contains('flex')).toBe(true)
    expect(fallback.textContent).toContain('AI')
  })

  it('respects onError returning false to keep image visible', async () => {
    const c = document.createElement('div')
    render(
      h(Avatar, {
        src: 'broken.png',
        onError: () => false,
      }),
      c,
    )
    await waitAvatarRender()
    const image = c.querySelector('[data-rue-avatar-image="true"]') as HTMLImageElement
    const fallback = c.querySelector('[data-rue-avatar-fallback="true"]') as HTMLElement
    image.dispatchEvent(new Event('error'))
    expect(image.classList.contains('hidden')).toBe(false)
    expect(fallback.classList.contains('hidden')).toBe(true)
  })

  it('renders grouped overflow avatar with max config', async () => {
    const c = document.createElement('div')
    render(
      h(Avatar.Group, {
        size: 'sm',
        max: { count: 2 },
        items: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
      }),
      c,
    )
    await waitAvatarRender()
    const avatars = c.querySelectorAll('.avatar')
    expect(avatars.length).toBe(3)
    const overflow = avatars[2] as HTMLElement
    expect(overflow.classList.contains('avatar-placeholder')).toBe(true)
    expect(overflow.textContent).toContain('+2')
  })
})
