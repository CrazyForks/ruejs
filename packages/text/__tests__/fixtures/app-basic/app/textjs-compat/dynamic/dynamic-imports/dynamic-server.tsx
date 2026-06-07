'use client'

import dynamic from 'text/dynamic'

export const TextDynamicServerComponent = dynamic(() => import('../text-dynamic-server'))

export const TextDynamicServerImportClientComponent = dynamic(
  () => import('../text-dynamic-server-import-client'),
)
