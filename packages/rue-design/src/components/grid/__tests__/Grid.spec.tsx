import { afterEach, describe, expect, it } from 'vitest'
import { h, render, setReactiveScheduling } from '@rue-js/rue'
import Grid from '../index'

setReactiveScheduling('sync')

const waitGridRender = () => new Promise(resolve => setTimeout(resolve, 0))
const initialViewportWidth = window.innerWidth

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  window.dispatchEvent(new Event('resize'))
}

afterEach(() => {
  document.body.innerHTML = ''
  setViewportWidth(initialViewportWidth)
})

describe('Grid', () => {
  it('renders row and col with base classes', async () => {
    const container = document.createElement('div')
    render(
      h(Grid, null, h(Grid.Col, { span: 12 }, 'Alpha'), h(Grid.Col, { span: 12 }, 'Beta')),
      container,
    )
    await waitGridRender()

    const row = container.querySelector('[data-rue-grid-row]') as HTMLElement
    const cols = container.querySelectorAll('[data-rue-grid-col]')

    expect(row).toBeTruthy()
    expect(row.classList.contains('rue-grid-row')).toBe(true)
    expect(cols).toHaveLength(2)
    expect(container.textContent).toContain('Alpha')
    expect(container.textContent).toContain('Beta')
  })

  it('applies gutter, justify, and align styles on row', async () => {
    const container = document.createElement('div')
    render(
      h(
        Grid,
        {
          gutter: [16, 24],
          justify: 'space-between',
          align: 'middle',
        },
        h(Grid.Col, { span: 12 }, 'Metrics'),
      ),
      container,
    )
    await waitGridRender()

    const row = container.querySelector('[data-rue-grid-row]') as HTMLElement
    const col = container.querySelector('[data-rue-grid-col]') as HTMLElement
    const rowStyle = row.getAttribute('style') ?? ''
    const colStyle = col.getAttribute('style') ?? ''

    expect(rowStyle).toContain('justify-content:space-between')
    expect(rowStyle).toContain('align-items:center')
    expect(rowStyle).toContain('margin-left:-8px')
    expect(rowStyle).toContain('margin-top:-12px')
    expect(rowStyle).toContain('--rue-grid-gutter-x:16px')
    expect(rowStyle).toContain('--rue-grid-gutter-y:24px')
    expect(colStyle).toContain('padding-left:calc(var(--rue-grid-gutter-x, 0px) / 2)')
  })

  it('applies span, offset, order, and flex values on col', async () => {
    const container = document.createElement('div')
    render(
      h(
        Grid,
        null,
        h(Grid.Col, { span: 12, offset: 6, order: 2 }, 'Content'),
        h(Grid.Col, { flex: '280px' }, 'Aside'),
      ),
      container,
    )
    await waitGridRender()

    const [contentCol, asideCol] = Array.from(
      container.querySelectorAll('[data-rue-grid-col]'),
    ) as HTMLElement[]

    expect(contentCol.style.flex).toBe('0 0 50%')
    expect(contentCol.style.maxWidth).toBe('50%')
    expect(contentCol.style.marginLeft).toBe('25%')
    expect(contentCol.style.order).toBe('2')
    expect(asideCol.style.flex).toBe('0 0 280px')
  })

  it('updates responsive span after resize', async () => {
    setViewportWidth(480)

    const container = document.createElement('div')
    render(h(Grid.Col, { span: 8, xs: 24, md: 12 }, 'Responsive'), container)
    await waitGridRender()

    const col = container.querySelector('[data-rue-grid-col]') as HTMLElement
    expect(col.style.maxWidth).toBe('100%')

    setViewportWidth(960)
    await waitGridRender()
    await waitGridRender()

    expect(col.style.maxWidth).toBe('50%')
  })

  it('updates responsive gutter after resize', async () => {
    setViewportWidth(520)

    const container = document.createElement('div')
    render(
      h(
        Grid,
        {
          gutter: [
            { xs: 8, md: 24 },
            { xs: 12, md: 32 },
          ],
        },
        h(Grid.Col, { span: 12 }, 'A'),
      ),
      container,
    )
    await waitGridRender()

    const row = container.querySelector('[data-rue-grid-row]') as HTMLElement
    let rowStyle = row.getAttribute('style') ?? ''
    expect(rowStyle).toContain('margin-left:-4px')
    expect(rowStyle).toContain('margin-top:-6px')

    setViewportWidth(960)
    await waitGridRender()
    await waitGridRender()

    rowStyle = row.getAttribute('style') ?? ''
    expect(rowStyle).toContain('margin-left:-12px')
    expect(rowStyle).toContain('margin-top:-16px')
  })
})
