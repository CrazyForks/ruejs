// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import { installDocCodeTabsEnhancer } from '../../../app/pages/site/docCodeTabsEnhancer'

const renderTabs = () => {
  document.body.innerHTML = `
    <div class="doc-code-tabs" data-rue-doc-code-tabs>
      <div role="tablist">
        <button id="tab-npm" role="tab" aria-selected="true" aria-controls="panel-npm" tabindex="0" class="tab tab-active">npm</button>
        <button id="tab-pnpm" role="tab" aria-selected="false" aria-controls="panel-pnpm" tabindex="-1" class="tab">pnpm</button>
        <button id="tab-bun" role="tab" aria-selected="false" aria-controls="panel-bun" tabindex="-1" class="tab">bun</button>
      </div>
      <div id="panel-npm" role="tabpanel" aria-hidden="false">npm install</div>
      <div id="panel-pnpm" role="tabpanel" aria-hidden="true" class="hidden">pnpm install</div>
      <div id="panel-bun" role="tabpanel" aria-hidden="true" class="hidden">bun install</div>
    </div>
  `

  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('doc CodeTabs progressive enhancement', () => {
  it('switches tabs and panels after a click', () => {
    const cleanup = installDocCodeTabsEnhancer(document)
    const [npm, pnpm] = renderTabs()

    pnpm.click()

    expect(npm.getAttribute('aria-selected')).toBe('false')
    expect(npm.tabIndex).toBe(-1)
    expect(npm.classList.contains('tab-active')).toBe(false)
    expect(pnpm.getAttribute('aria-selected')).toBe('true')
    expect(pnpm.tabIndex).toBe(0)
    expect(pnpm.classList.contains('tab-active')).toBe(true)
    expect(document.querySelector('#panel-npm')?.getAttribute('aria-hidden')).toBe('true')
    expect(document.querySelector('#panel-npm')?.classList.contains('hidden')).toBe(true)
    expect(document.querySelector('#panel-pnpm')?.getAttribute('aria-hidden')).toBe('false')
    expect(document.querySelector('#panel-pnpm')?.classList.contains('hidden')).toBe(false)

    cleanup()
  })

  it('supports arrow, Home, and End keyboard navigation', () => {
    const cleanup = installDocCodeTabsEnhancer(document)
    const [npm, pnpm, bun] = renderTabs()

    npm.focus()
    npm.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(pnpm)
    expect(pnpm.getAttribute('aria-selected')).toBe('true')

    pnpm.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(bun)
    expect(bun.getAttribute('aria-selected')).toBe('true')

    bun.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(document.activeElement).toBe(npm)
    expect(npm.getAttribute('aria-selected')).toBe('true')

    cleanup()
  })
})
