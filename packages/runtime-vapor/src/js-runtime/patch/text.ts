/*
文本 patch

文本节点同类型更新时直接设置 textContent；缺失旧 host 时不做更新。
这是最轻量的 patch 分支。
*/

import type { DOMHost, Mounted, MountedText, MountInput } from '../types.js'

/** Reuse an existing text host for a same-kind text MountInput. */
export const patchText = <HostNode>(
  host: DOMHost<HostNode>,
  mounted: Mounted<HostNode> | null | undefined,
  input: MountInput<HostNode> | null | undefined,
): MountedText<HostNode> | undefined => {
  const value = input?.type?.kind === 'text' ? String(input.type.value ?? '') : ''
  if (!mounted?.host) return undefined
  host.setTextContent(mounted.host, value)
  return {
    kind: 'text',
    host: mounted.host,
    value,
  }
}
