import { render } from '@rue-js/rue'

import { TextEditorApp } from './TextEditorApp'

type EditorMode = 'markdown' | 'text'

let content = '# Rue Desktop Notes\n\nWrite Markdown or switch back to plain text.'
let dirty = false
let filePath = '~/.rue-text-editor/notes.md'
let mode: EditorMode = 'markdown'
let saving = false
let status = 'Rue frontend, Rust file backend.'
const container = document.querySelector('#app') as HTMLElement | null

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`)
  }
  return data
}

const syncEditorChrome = () => {
  const statusNode = document.querySelector('[data-editor-status]')
  const saveButton = document.querySelector('[data-editor-save]') as HTMLButtonElement | null
  const modeLabel = document.querySelector('[data-editor-mode-label]')
  const textMode = document.querySelector('[data-editor-mode-text]') as HTMLButtonElement | null
  const markdownMode = document.querySelector(
    '[data-editor-mode-markdown]',
  ) as HTMLButtonElement | null
  const preview = document.querySelector('[data-markdown-preview]')

  if (statusNode) {
    statusNode.textContent = status
  }

  if (saveButton) {
    saveButton.disabled = saving
    saveButton.textContent = saving ? 'Saving' : dirty ? 'Save *' : 'Save'
  }

  if (modeLabel) {
    modeLabel.textContent = mode === 'markdown' ? 'Markdown shortcuts' : 'Plain text mode'
  }

  textMode?.classList.toggle('active', mode === 'text')
  markdownMode?.classList.toggle('active', mode === 'markdown')

  if (preview) {
    preview.innerHTML = renderMarkdown(content)
  }
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const renderInlineMarkdown = (value: string) =>
  escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

const renderMarkdown = (value: string) => {
  const lines = value.split(/\r?\n/)
  const html: string[] = []
  let listOpen = false

  const closeList = () => {
    if (listOpen) {
      html.push('</ul>')
      listOpen = false
    }
  }

  for (const line of lines) {
    if (!line.trim()) {
      closeList()
      continue
    }

    if (line.startsWith('# ')) {
      closeList()
      html.push(`<h1>${renderInlineMarkdown(line.slice(2))}</h1>`)
    } else if (line.startsWith('## ')) {
      closeList()
      html.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`)
    } else if (line.startsWith('> ')) {
      closeList()
      html.push(`<blockquote>${renderInlineMarkdown(line.slice(2))}</blockquote>`)
    } else if (line.startsWith('- ')) {
      if (!listOpen) {
        html.push('<ul>')
        listOpen = true
      }
      html.push(`<li>${renderInlineMarkdown(line.slice(2))}</li>`)
    } else {
      closeList()
      html.push(`<p>${renderInlineMarkdown(line)}</p>`)
    }
  }

  closeList()

  return html.join('') || '<p class="preview-empty">Markdown preview</p>'
}

const markDirty = (nextStatus = 'Unsaved changes') => {
  dirty = true
  status = nextStatus
  syncEditorChrome()
}

const replaceTextareaSelection = (
  transform: (
    selected: string,
    before: string,
    after: string,
  ) => {
    next: string
    selectEnd?: number
    selectStart?: number
  },
) => {
  const textarea = document.querySelector('[data-editor-content]') as HTMLTextAreaElement | null
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = textarea.value.slice(0, start)
  const selected = textarea.value.slice(start, end)
  const after = textarea.value.slice(end)
  const result = transform(selected, before, after)

  textarea.value = `${before}${result.next}${after}`
  content = textarea.value
  textarea.focus()
  textarea.setSelectionRange(
    start + (result.selectStart ?? result.next.length),
    start + (result.selectEnd ?? result.next.length),
  )
  markDirty('Markdown shortcut inserted')
}

const wrapSelection = (left: string, right = left, fallback = 'text') => {
  replaceTextareaSelection(selected => {
    const body = selected || fallback
    return {
      next: `${left}${body}${right}`,
      selectEnd: left.length + body.length,
      selectStart: left.length,
    }
  })
}

const prefixCurrentLine = (prefix: string, fallback = 'text') => {
  const textarea = document.querySelector('[data-editor-content]') as HTMLTextAreaElement | null
  if (!textarea) return

  const cursor = textarea.selectionStart
  const lineStart = textarea.value.lastIndexOf('\n', cursor - 1) + 1
  const lineEndIndex = textarea.value.indexOf('\n', cursor)
  const lineEnd = lineEndIndex === -1 ? textarea.value.length : lineEndIndex
  const line = textarea.value.slice(lineStart, lineEnd) || fallback
  const nextLine = line.startsWith(prefix) ? line : `${prefix}${line}`

  textarea.value = `${textarea.value.slice(0, lineStart)}${nextLine}${textarea.value.slice(lineEnd)}`
  content = textarea.value
  textarea.focus()
  textarea.setSelectionRange(lineStart + prefix.length, lineStart + nextLine.length)
  markDirty('Markdown shortcut inserted')
}

const mount = () => {
  if (!container) return

  render(
    <TextEditorApp
      content={content}
      dirty={dirty}
      filePath={filePath}
      mode={mode}
      saving={saving}
      status={status}
      title="Rue Text Editor"
      onBold={() => wrapSelection('**', '**', 'bold text')}
      onCode={() => wrapSelection('`', '`', 'code')}
      onContentInput={event => {
        content = String((event.target as HTMLTextAreaElement | null)?.value ?? '')
        markDirty()
      }}
      onFilePathInput={event => {
        filePath = String((event.target as HTMLInputElement | null)?.value ?? '')
        markDirty()
      }}
      onHeading={() => prefixCurrentLine('# ', 'Heading')}
      onItalic={() => wrapSelection('*', '*', 'italic text')}
      onList={() => prefixCurrentLine('- ', 'List item')}
      onLoad={async () => {
        try {
          status = 'Opening file...'
          mount()
          const next = await postJson<{
            content: string
            mode: EditorMode
            path: string
            status: string
          }>('/api/open', { mode, path: filePath })
          content = next.content
          filePath = next.path
          mode = next.mode
          dirty = false
          status = next.status
        } catch (error) {
          status = error instanceof Error ? error.message : String(error)
        }
        mount()
      }}
      onQuote={() => prefixCurrentLine('> ', 'Quote')}
      onNew={async () => {
        try {
          status = 'Creating new document...'
          mount()
          const next = await postJson<{
            content: string
            mode: EditorMode
            path: string
            status: string
          }>('/api/new-path', { mode, path: filePath })
          content = next.content
          filePath = next.path
          mode = next.mode
          dirty = false
          status = next.status
        } catch (error) {
          status = error instanceof Error ? error.message : String(error)
        }
        mount()
      }}
      onMarkdownMode={() => {
        mode = 'markdown'
        if (!filePath.match(/\.(md|markdown)$/i)) {
          filePath = '~/.rue-text-editor/notes.md'
        }
        status = 'Markdown mode'
        mount()
      }}
      onSave={async () => {
        try {
          saving = true
          status = 'Saving file...'
          mount()
          const next = await postJson<{ mode: EditorMode; path: string; status: string }>(
            '/api/save',
            {
              content,
              mode,
              path: filePath,
            },
          )
          filePath = next.path
          mode = next.mode
          dirty = false
          status = next.status
        } catch (error) {
          status = error instanceof Error ? error.message : String(error)
        } finally {
          saving = false
          mount()
        }
      }}
      onTextMode={() => {
        mode = 'text'
        if (!filePath.match(/\.txt$/i)) {
          filePath = '~/.rue-text-editor/notes.txt'
        }
        status = 'Plain text mode'
        mount()
      }}
    />,
    container,
  )

  syncEditorChrome()
}

mount()
