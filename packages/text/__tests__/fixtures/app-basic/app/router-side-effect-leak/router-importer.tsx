'use client'

import { useEffect } from '@rue-js/rue'
import Router from 'text/router'

declare global {
  interface Window {
    __TEXT_ROUTER_IMPORTED__?: boolean
  }
}

export function RouterImporter() {
  useEffect(() => {
    window.__TEXT_ROUTER_IMPORTED__ = typeof Router.beforePopState === 'function'
  }, [])

  return <p id="router-shim-imported">router shim imported</p>
}
