import type { FC } from '@rue-js/rue'

export interface TextEditorAppProps {
  content: string
  dirty?: boolean
  filePath: string
  mode: 'text' | 'markdown'
  onContentInput?: (event: Event) => void
  onFilePathInput?: (event: Event) => void
  onBold?: () => void
  onCode?: () => void
  onHeading?: () => void
  onItalic?: () => void
  onList?: () => void
  onLoad?: () => void
  onMarkdownMode?: () => void
  onNew?: () => void
  onQuote?: () => void
  onSave?: () => void
  onTextMode?: () => void
  saving?: boolean
  status: string
  title: string
}

export const TextEditorApp: FC<TextEditorAppProps> = props => (
  <main
    className={`rue-text-editor ${props.mode === 'markdown' ? 'is-markdown' : 'is-text'}`}
    data-runtime="deno_core"
  >
    <header className="editor-header">
      <div>
        <h1>{props.title}</h1>
        <p data-editor-status>{props.status}</p>
      </div>
      <div className="editor-actions">
        <div className="mode-tabs">
          <button
            type="button"
            data-editor-mode-text
            className={props.mode === 'text' ? 'active' : ''}
            onClick={props.onTextMode}
          >
            Text
          </button>
          <button
            type="button"
            data-editor-mode-markdown
            className={props.mode === 'markdown' ? 'active' : ''}
            onClick={props.onMarkdownMode}
          >
            Markdown
          </button>
        </div>
        <button type="button" onClick={props.onNew}>
          New
        </button>
        <button type="button" onClick={props.onLoad}>
          Open
        </button>
        <button type="button" data-editor-save onClick={props.onSave} disabled={props.saving}>
          {props.saving ? 'Saving' : props.dirty ? 'Save *' : 'Save'}
        </button>
      </div>
    </header>

    <label className="path-row">
      <span>Document path</span>
      <input
        value={props.filePath}
        placeholder={props.mode === 'markdown' ? 'notes.md' : 'notes.txt'}
        onInput={props.onFilePathInput}
      />
    </label>

    <section className="markdown-tools" aria-label="Markdown shortcuts">
      <span data-editor-mode-label>
        {props.mode === 'markdown' ? 'Markdown shortcuts' : 'Plain text mode'}
      </span>
      <button type="button" title="Bold" onClick={props.onBold}>
        B
      </button>
      <button type="button" title="Italic" onClick={props.onItalic}>
        I
      </button>
      <button type="button" title="Heading" onClick={props.onHeading}>
        H1
      </button>
      <button type="button" title="List" onClick={props.onList}>
        List
      </button>
      <button type="button" title="Quote" onClick={props.onQuote}>
        Quote
      </button>
      <button type="button" title="Code" onClick={props.onCode}>
        Code
      </button>
    </section>

    <section className="editor-workspace">
      <textarea
        data-editor-content
        value={props.content}
        spellCheck={false}
        placeholder={
          props.mode === 'markdown' ? 'Write Markdown here...' : 'Write a plain text note...'
        }
        onInput={props.onContentInput}
      >
        {props.content}
      </textarea>

      <section className="markdown-preview" data-markdown-preview>
        <p className="preview-empty">Markdown preview</p>
      </section>
    </section>
  </main>
)
