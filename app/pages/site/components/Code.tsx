import { type FC } from '@rue-js/rue'

import CodePlain from './CodePlain'
import CodeShiki from './CodeShiki'
import { type CodeProps } from './CodeShared'

function shouldUsePlainCodeBlock(): boolean {
  return (
    import.meta.env?.MODE === 'test' ||
    import.meta.env?.VITEST === true ||
    import.meta.env?.VITEST === 'true' ||
    !!(globalThis as any).vitest
  )
}

const CodeImpl = shouldUsePlainCodeBlock() ? CodePlain : CodeShiki

const Code: FC<CodeProps> = p => {
  return <CodeImpl {...p} />
}

export default Code
