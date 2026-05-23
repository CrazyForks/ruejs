import { type FC, ref, watchEffect } from '@rue-js/rue'

import { CodeFrame, type CodeProps, getPlainCodeHtml, useCodeCopy } from './CodeShared'

const CodePlain: FC<CodeProps> = p => {
  const html = ref(getPlainCodeHtml(p.code || ''))
  const { copied, handleCopy } = useCodeCopy(() => p.code)

  watchEffect(() => {
    html.value = getPlainCodeHtml(p.code || '')
  })

  return <CodeFrame {...p} html={html.value} copied={copied.value} onCopy={handleCopy} />
}

export default CodePlain
