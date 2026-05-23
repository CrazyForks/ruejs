// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { type FC, render, useApp } from '@rue-js/rue'

import { I18nProvider, createI18n, useI18n } from '../src'

const flushRender = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('rue i18n', () => {
  it('exposes the global composer through app.use and translates with source text', async () => {
    const i18n = createI18n({
      locale: 'fr',
      fallbackLocale: 'en',
      messages: {
        en: {
          '你好，{name}！': 'Hello, {name}!',
        },
        fr: {},
      },
    })

    expect(i18n.global._('你好，{name}！', { name: 'Rue' })).toBe('Hello, Rue!')
    expect(i18n.global._('未翻译文本')).toBe('未翻译文本')

    const App: FC = () => {
      const { _ } = useI18n()
      return <p data-testid="reader">{_('你好，{name}！', { name: 'Rue' })}</p>
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    useApp(App).use(i18n).mount(container)
    await flushRender()

    expect(container.querySelector('[data-testid="reader"]')?.textContent).toBe('Hello, Rue!')
  })

  it('provides subtree-specific messages through I18nProvider', async () => {
    const Reader: FC = () => {
      const { _ } = useI18n()
      return <p data-testid="reader">{_('你好，{name}！', { name: 'Rue' })}</p>
    }

    const App: FC = () => {
      return (
        <I18nProvider
          locale="zh-CN"
          messages={{
            'zh-CN': {
              '你好，{name}！': '你好，{name}！',
            },
          }}
        >
          <Reader />
        </I18nProvider>
      )
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    useApp(App).mount(container)
    await flushRender()

    expect(container.querySelector('[data-testid="reader"]')?.textContent).toBe('你好，Rue！')
  })

  it('creates a component-local composer when useI18n is called with local scope', async () => {
    let switchedLocale = ''
    let switchedHello = ''

    const LocalReader: FC = () => {
      const composer = useI18n({
        useScope: 'local',
        locale: 'en',
        messages: {
          en: {
            切换语言: 'Switch Locale',
            你好: 'Hello',
          },
          'zh-CN': {
            切换语言: '切换语言',
            你好: '你好',
          },
        },
      })
      const { _, locale } = composer
      const currentLocale = locale.value

      return (
        <button
          data-testid="reader"
          onClick={() => {
            locale.value = locale.value === 'en' ? 'zh-CN' : 'en'
            switchedLocale = locale.value
            switchedHello = composer._('你好', undefined, locale.value)
          }}
        >
          {_('切换语言', undefined, currentLocale)} / {_('你好', undefined, currentLocale)}
        </button>
      )
    }

    const container = document.createElement('div')
    document.body.appendChild(container)

    render(<LocalReader />, container)
    await flushRender()

    const button = container.querySelector('[data-testid="reader"]') as HTMLButtonElement | null
    expect(button?.textContent).toBe('Switch Locale / Hello')

    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushRender()

    expect(switchedLocale).toBe('zh-CN')
    expect(switchedHello).toBe('你好')
  })

  it('loads locale messages lazily, merges results, and dedupes concurrent loads', async () => {
    let loadCount = 0
    let resolveLoader: ((value: { default: { '你好，{name}！': string } }) => void) | undefined

    const i18n = createI18n({
      locale: 'en',
      messages: {
        en: {
          '你好，{name}！': 'Hello, {name}!',
        },
        'ja-JP': {
          页面标题: '既存タイトル',
        },
      },
      messageLoader: {
        'ja-JP': () => {
          loadCount += 1

          return new Promise(resolve => {
            resolveLoader = resolve
          })
        },
      },
    })

    const firstLoad = i18n.global.loadLocaleMessages('ja-JP')
    const secondLoad = i18n.global.loadLocaleMessages('ja-JP')

    expect(loadCount).toBe(1)
    expect(i18n.global.isLocaleLoading('ja-JP')).toBe(true)
    expect(i18n.global.loadingLocales.value).toContain('ja-JP')

    resolveLoader?.({
      default: {
        '你好，{name}！': 'こんにちは、{name}！',
      },
    })

    await expect(firstLoad).resolves.toEqual({
      页面标题: '既存タイトル',
      '你好，{name}！': 'こんにちは、{name}！',
    })
    await expect(secondLoad).resolves.toEqual({
      页面标题: '既存タイトル',
      '你好，{name}！': 'こんにちは、{name}！',
    })

    expect(i18n.global.isLocaleLoading('ja-JP')).toBe(false)
    expect(i18n.global.loadingLocales.value).not.toContain('ja-JP')
    expect(i18n.global._('你好，{name}！', { name: 'Rue' }, 'ja-JP')).toBe('こんにちは、Rue！')

    await i18n.global.loadLocaleMessages('ja-JP')
    expect(loadCount).toBe(1)
  })

  it('keeps source-text interpolation working for existing locales after lazy locale loads', async () => {
    const i18n = createI18n({
      locale: 'zh-CN',
      fallbackLocale: 'en',
      messages: {
        'zh-CN': {
          '你好，{name}！': '你好，{name}！',
        },
        en: {
          '你好，{name}！': 'Hello, {name}!',
        },
      },
      messageLoader: {
        'ja-JP': async () => ({
          default: {
            '你好，{name}！': 'こんにちは、{name}！',
          },
        }),
      },
    })

    expect(i18n.global.messages.value['zh-CN']?.['你好，{name}！']).toBe('你好，{name}！')
    expect(i18n.global.messages.value.en?.['你好，{name}！']).toBe('Hello, {name}!')

    expect(i18n.global._('你好，{name}！', { name: 'Rue' }, 'zh-CN')).toBe('你好，Rue！')
    expect(i18n.global._('你好，{name}！', { name: 'Rue' }, 'en')).toBe('Hello, Rue!')

    await i18n.global.loadLocaleMessages('ja-JP')

    expect(i18n.global._('你好，{name}！', { name: 'Rue' }, 'ja-JP')).toBe('こんにちは、Rue！')
    expect(i18n.global._('你好，{name}！', { name: 'Rue' }, 'zh-CN')).toBe('你好，Rue！')
    expect(i18n.global._('你好，{name}！', { name: 'Rue' }, 'en')).toBe('Hello, Rue!')
  })
})
