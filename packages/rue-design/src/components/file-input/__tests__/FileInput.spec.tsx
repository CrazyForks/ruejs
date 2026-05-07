import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import FileInput from '../index'
import { click, mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

const assignFiles = (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  })
}

describe('FileInput', () => {
  it('renders with the base class and enforces type=file', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<FileInput />, container)

    await waitForContent(() => {
      const element = container.querySelector('input.file-input') as HTMLInputElement
      expect(element).toBeTruthy()
      expect(element.type).toBe('file')
    })
  })

  it('applies color, size, and ghost modifiers', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<FileInput variant="primary" size="lg" ghost />, container)

    await waitForContent(() => {
      const element = container.querySelector('input.file-input') as HTMLInputElement
      expect(element.classList.contains('file-input-primary')).toBe(true)
      expect(element.classList.contains('file-input-lg')).toBe(true)
      expect(element.classList.contains('file-input-ghost')).toBe(true)
    })
  })

  it('forwards native attrs and appends className', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(
      <FileInput
        id="resume"
        accept=".pdf"
        multiple
        disabled
        className="w-full"
      />,
      container,
    )

    await waitForContent(() => {
      const element = container.querySelector('input.file-input') as HTMLInputElement
      expect(element.id).toBe('resume')
      expect(element.accept).toBe('.pdf')
      expect(element.multiple).toBe(true)
      expect(element.disabled).toBe(true)
      expect(element.classList.contains('w-full')).toBe(true)
    })
  })

  it('renders upload-style list and supports removing files', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleRemove = vi.fn()

    render(
      <FileInput
        defaultFileList={[
          {
            uid: 'resume',
            name: 'resume.pdf',
            status: 'done',
            description: '已同步',
          },
        ]}
        onRemove={file => {
          handleRemove(file.name)
        }}
        title="Upload assets"
      />,
      container,
    )

    await waitForContent(() => {
      expect(container.textContent).toContain('resume.pdf')
      expect(container.querySelector('button[aria-label="Remove resume.pdf"]')).toBeTruthy()
    })

    await click(container.querySelector('button[aria-label="Remove resume.pdf"]'))

    await waitForContent(() => {
      expect(container.textContent).not.toContain('resume.pdf')
    })

    expect(handleRemove).toHaveBeenCalledWith('resume.pdf')
  })

  it('supports beforeUpload ignore and maxCount in enhanced mode', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleChange = vi.fn()

    render(
      <FileInput
        title="Upload gallery"
        listType="picture"
        maxCount={1}
        beforeUpload={file => {
          if (file.name.endsWith('.txt')) {
            return FileInput.LIST_IGNORE
          }
          return true
        }}
        onChange={info => handleChange(info)}
      />,
      container,
    )

    await waitForContent(() => {
      expect(container.querySelector('input[type="file"]')).toBeTruthy()
    })

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    assignFiles(input, [
      new File(['image'], 'cover.png', { type: 'image/png' }),
      new File(['ignored'], 'notes.txt', { type: 'text/plain' }),
    ])
    input.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      expect(container.textContent).toContain('cover.png')
      expect(container.textContent).not.toContain('notes.txt')
    })

    expect(handleChange).toHaveBeenCalledTimes(1)
    expect(handleChange.mock.calls[0][0].fileList).toHaveLength(1)
    expect(handleChange.mock.calls[0][0].file.name).toBe('cover.png')

    assignFiles(input, [new File(['new'], 'next.png', { type: 'image/png' })])
    input.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      expect(container.textContent).not.toContain('cover.png')
      expect(container.textContent).toContain('next.png')
    })

    expect(handleChange).toHaveBeenCalledTimes(2)
    expect(handleChange.mock.calls[1][0].fileList).toHaveLength(1)
    expect(handleChange.mock.calls[1][0].file.name).toBe('next.png')
  })
})
