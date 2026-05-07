import { describe, expect, it } from 'vitest'

import VitePluginRue from '../index.mjs'

if (!(globalThis as any).document) {
  ;(globalThis as any).document = { body: { innerHTML: '' } }
}

const createPlugin = () => VitePluginRue({ include: ['/app/'] })

const invokeTransform = async (source: string, id: string) => {
  const plugin = createPlugin()
  const transformHook = plugin.transform

  if (!transformHook) {
    return null
  }

  if (typeof transformHook === 'function') {
    return transformHook.call({} as any, source, id)
  }

  return transformHook.handler.call({} as any, source, id)
}

describe('vite-plugin-rue model directive preprocessing', () => {
  it('rewrites TSX-safe v-model built-in modifiers before SWC parsing', async () => {
    const source = `
      import { type FC, ref } from '@rue-js/rue'

      type FieldProps = {
        userName?: string
        userNameModifiers?: { lazy?: boolean; trim?: boolean }
        onUpdateUserName?: (value: string) => void
      }

      const Field: FC<FieldProps> = props => (
        <input value={props.userName ?? ''} onInput={event => props.onUpdateUserName?.((event.target as HTMLInputElement).value)} />
      )

      const Demo: FC = () => {
        const text = ref('  rue  ')
        const age = ref<string | number>('18')
        const lazyNote = ref('blur to sync')
        const userName = ref('Rue')

        return (
          <section>
            <input v-model:trim={text.value} />
            <input type="number" r-model:number={age.value} />
            <input v-model:lazy={lazyNote.value} />
            <Field v-model:lazy-trim-user-name={userName.value} />
          </section>
        )
      }

      export default Demo
    `

    const result = await invokeTransform(
      source,
      '/Users/Shared/work/dir/data/codes/rue/app/test-fixtures/ModelDirectiveShorthand.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain('/* RUE_VAPOR_TRANSFORMED */')
    expect(code).not.toContain('v-model:trim')
    expect(code).not.toContain('r-model:number')
    expect(code).not.toContain('v-model:lazy-user-name')
    expect(code).not.toContain('__rue_model__')
    expect(code).toContain('value.trim()')
    expect(code).toContain('parseFloat(value)')
    expect(code).toContain('"change"')
    expect(code).toContain('onUpdateUserName')
    expect(code).toContain('userNameModifiers')
    expect(code).toContain('lazy')
    expect(code).toContain('trim')
  })

  it('keeps model assignment targets intact when source contains non-ASCII text', async () => {
    await invokeTransform(
      `
        import { type FC, ref } from '@rue-js/rue'

        const Warmup: FC = () => {
          const text = ref('warm')
          return <input v-model={text.value} />
        }

        export default Warmup
      `,
      '/Users/Shared/work/dir/data/codes/rue/app/test-fixtures/ModelDirectiveWarmup.tsx',
    )

    const source = `
      import { type FC, ref } from '@rue-js/rue'

      const Demo: FC = () => {
        const message = ref('Rue')

        return (
          <section>
            <p>中文提示：真实指令写法</p>
            <input v-model={message.value} />
          </section>
        )
      }

      export default Demo
    `

    const result = await invokeTransform(
      source,
      '/Users/Shared/work/dir/data/codes/rue/app/test-fixtures/ModelDirectiveUnicodeSpan.tsx',
    )

    const code = typeof result === 'string' ? result : String(result?.code ?? '')

    expect(code).toContain('message.value = value')
    expect(code).not.toContain('undefined = value')
    expect(code).not.toContain('value={undefined}')
  })
})