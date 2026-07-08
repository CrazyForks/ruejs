import { afterEach, describe, expect, it } from 'vitest'
import { render } from '@rue-js/rue'

import SimpleDoc from './fixtures/simple-doc.mdx'

const flushRender = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('doc MDX Vite transform', () => {
  it('imports an MDX document as a Rue component', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<SimpleDoc />, container)
    await flushRender()

    expect(container.querySelector('h1')?.textContent).toBe('Rue MDX')
    expect(container.querySelector('strong')?.textContent).toBe('strong text')
    expect(Array.from(container.querySelectorAll('li')).map(li => li.textContent)).toEqual([
      'First item',
      'Second item',
    ])
  })
})
