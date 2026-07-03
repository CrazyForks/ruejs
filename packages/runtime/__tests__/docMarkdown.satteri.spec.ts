import { describe, expect, it } from 'vitest'

import { mdToHtml } from '../../../app/pages/site/docMarkdown'

const renderMarkdown = async (source: string) => {
  const html = await mdToHtml(source)
  const root = document.createElement('div')
  root.innerHTML = html
  return { html, root }
}

describe('docMarkdown satteri rendering', () => {
  it('keeps document markdown features and code wrapping behavior', async () => {
    const { root } = await renderMarkdown(`## 标题 {#intro .lead}

- [x] done

Footnote here.[^note]

[^note]: footnote text

:::tip
Helpful tip
:::

\`\`\`ts
const answer: number = 42
\`\`\`
`)

    const heading = root.querySelector('h2#intro.lead')
    expect(heading?.textContent).toBe('标题')

    const checkbox = root.querySelector('li input[type="checkbox"]') as HTMLInputElement | null
    expect(checkbox?.checked).toBe(true)
    expect(checkbox?.disabled).toBe(true)
    expect(root.querySelector('li')?.textContent).toContain('done')

    expect(root.textContent).toContain('footnote text')
    expect(root.querySelector('a[href^="#"][aria-label*="Back"]')).not.toBeNull()

    const tip = root.querySelector('div.tip')
    expect(tip?.textContent).toContain('Helpful tip')

    const wrapper = root.querySelector('.doc-code-wrapper')
    expect(wrapper?.querySelector('.copy-code-btn')?.textContent).toBe('复制')
    expect(wrapper?.querySelector('pre code')?.textContent).toContain('answer')
  })
})
