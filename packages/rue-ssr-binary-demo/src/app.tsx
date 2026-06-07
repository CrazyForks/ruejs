import { renderToString } from '@rue-js/server-renderer'

import { TextEditorApp } from './TextEditorApp'

declare global {
  var __RUE_SSR_HTML: string | undefined
}

async function main() {
  globalThis.__RUE_SSR_HTML = await renderToString(TextEditorApp, {
    props: {
      content: '# Rue Desktop Notes\n\nWrite Markdown or switch back to plain text.',
      filePath: '~/.rue-text-editor/notes.md',
      mode: 'markdown',
      status: 'Rue frontend, Rust file backend.',
      title: 'Rue Text Editor',
    },
  })
}

main().catch(error => {
  throw error
})
