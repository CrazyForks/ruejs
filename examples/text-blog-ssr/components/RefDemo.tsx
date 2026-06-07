const refDemoScript = `
(() => {
  if (window.__rueTextBlogRefDemo) return
  window.__rueTextBlogRefDemo = true

  const syncReadout = root => {
    const input = root.querySelector('[data-ref-demo-input]')
    const title = root.querySelector('[data-ref-demo-title]')
    if (input && title) title.textContent = input.value || 'Untitled draft'
  }

  document.addEventListener('input', event => {
    const input = event.target.closest('[data-ref-demo-input]')
    if (!input) return
    syncReadout(input.closest('[data-ref-demo]'))
  })

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-ref-demo-action]')
    if (!action) return

    const root = action.closest('[data-ref-demo]')
    const input = root.querySelector('[data-ref-demo-input]')
    const status = root.querySelector('[data-ref-demo-status]')
    if (!input || !status) return

    if (action.dataset.refDemoAction === 'reset') {
      input.value = root.dataset.initialDraft || ''
      syncReadout(root)
      status.textContent = 'Reset the draft and focused the field through the same reference.'
    } else {
      status.textContent = 'Focused input through a Rue DOM reference.'
    }
    input.focus()
  })
})()
`

export default function RefDemo() {
  const initialDraft = 'A note from Rue'

  return (
    <section
      className="ref-demo"
      aria-labelledby="ref-demo-title"
      data-ref-demo="true"
      data-initial-draft={initialDraft}
    >
      <div>
        <p className="eyebrow">Enhanced ref demo</p>
        <h2 id="ref-demo-title">Reactive ref plus DOM ref</h2>
        <p>
          Edit the field to update a reactive <code>ref()</code>, or use the buttons to touch the
          input through <code>useRef()</code>.
        </p>
      </div>

      <label className="field">
        <span>Draft title</span>
        <input data-ref-demo-input="true" defaultValue={initialDraft} />
      </label>

      <div className="ref-actions">
        <button className="button" type="button" data-ref-demo-action="focus">
          Focus input
        </button>
        <button className="chip" type="button" data-ref-demo-action="reset">
          Reset draft
        </button>
      </div>

      <div className="ref-readout" aria-live="polite">
        <span data-ref-demo-title="true">{initialDraft}</span>
        <small data-ref-demo-status="true">The input DOM node is held by useRef().</small>
      </div>
      <script dangerouslySetInnerHTML={{ __html: refDemoScript }} />
    </section>
  )
}
