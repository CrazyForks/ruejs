import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import Form from '../index'
import Input from '../../input'
import Checkbox from '../../checkbox'
import Button from '../../button'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active =
    (globalThis as any).__rue_vapor_preferred ?? (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Form', () => {
  it('collects field values and submits successfully', async () => {
    const container = mountContainer()
    const handleFinish = vi.fn()
    let formApi: any
    resetActiveRuntime()

    render(
      <Form
        initialValues={{ profile: { name: 'Rue' } }}
        onFinish={handleFinish}
        render={form => {
          formApi = form
          return (
            <>
              <Form.Item
                form={form}
                name={['profile', 'name']}
                label="名称"
                rules={[{ required: true }]}
                render={control => <Input {...control} />}
              />
              <Button htmlType="submit">提交</Button>
            </>
          )
        }}
      />,
      container,
    )

    await waitForContent(() => {
      const input = container.querySelector('input') as HTMLInputElement | null
      expect(input?.value).toBe('Rue')
    })

    formApi.submit()

    await waitForContent(() => {
      expect(handleFinish).toHaveBeenCalledWith({ profile: { name: 'Rue' } })
    })
  })

  it('shows validation errors and emits finish failed info', async () => {
    const container = mountContainer()
    const handleFinishFailed = vi.fn()
    let formApi: any
    resetActiveRuntime()

    render(
      <Form
        onFinishFailed={handleFinishFailed}
        render={form => {
          formApi = form
          return (
            <>
              <Form.Item
                form={form}
                name="email"
                label="邮箱"
                rules={[{ required: true }, { type: 'email' }]}
                render={control => <Input {...control} />}
              />
              <Button htmlType="submit">提交</Button>
            </>
          )
        }}
      />,
      container,
    )

    formApi.submit()

    await waitForContent(() => {
      expect(container.textContent).toContain('邮箱 为必填项')
      expect(handleFinishFailed).toHaveBeenCalled()
      const payload = handleFinishFailed.mock.calls[0][0]
      expect(payload.errorFields[0].name).toEqual(['email'])
    })
  })

  it('supports checkbox binding through checked valuePropName', async () => {
    const container = mountContainer()
    const handleFinish = vi.fn()
    let formApi: any
    resetActiveRuntime()

    render(
      <Form
        initialValues={{ agree: true }}
        onFinish={handleFinish}
        render={form => {
          formApi = form
          return (
            <>
              <Form.Item
                form={form}
                name="agree"
                valuePropName="checked"
                label="协议"
                render={control => <Checkbox {...control}>同意协议</Checkbox>}
              />
              <Button htmlType="submit">提交</Button>
            </>
          )
        }}
      />,
      container,
    )

    await waitForContent(() => {
      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null
      expect(checkbox?.checked).toBe(true)
    })

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    checkbox.click()
    formApi.submit()

    await waitForContent(() => {
      expect(handleFinish).toHaveBeenCalledWith({ agree: false })
    })
  })

  it('exposes form instance methods and rerenders render consumers', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    const Demo = () => {
      const [form] = Form.useForm()

      return (
        <Form
          form={form}
          initialValues={{ role: 'viewer' }}
          render={formInstance => (
            <>
              <Form.Item
                form={formInstance}
                name="role"
                label="角色"
                render={control => <Input {...control} />}
              />
              <button
                type="button"
                onClick={() => {
                  form.setFieldValue('role', 'editor')
                }}
              >
                set-role
              </button>
              <span data-testid="watch-role">{formInstance.getFieldValue('role')}</span>
            </>
          )}
        />
      )
    }

    render(<Demo />, container)

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="watch-role"]')?.textContent).toBe('viewer')
    })

    ;(
      Array.from(container.querySelectorAll('button')).find(
        node => node.textContent === 'set-role',
      ) as HTMLButtonElement
    ).click()

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="watch-role"]')?.textContent).toBe('editor')
      expect((container.querySelector('input') as HTMLInputElement).value).toBe('editor')
    })
  })

  it('supports dynamic list operations', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    const Demo = () => {
      return (
        <Form
          initialValues={{ members: [{ name: 'A' }] }}
          render={form => (
            <Form.List
              form={form}
              name="members"
              render={(fields, operation) => (
                <div>
                  {fields.map(field => (
                    <Form.Item
                      key={field.key}
                      form={form}
                      name={['members', field.name, 'name']}
                      label={`成员 ${field.name + 1}`}
                      render={control => <Input {...control} />}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      operation.add({ name: 'B' })
                    }}
                  >
                    add-member
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      operation.remove(0)
                    }}
                  >
                    remove-first
                  </button>
                </div>
              )}
            />
          )}
        />
      )
    }

    render(<Demo />, container)

    await waitForContent(() => {
      expect(container.querySelectorAll('input')).toHaveLength(1)
      expect(container.textContent).toContain('成员 1')
    })

    ;(
      Array.from(container.querySelectorAll('button')).find(
        node => node.textContent === 'add-member',
      ) as HTMLButtonElement
    ).click()

    await waitForContent(() => {
      expect(container.querySelectorAll('input')).toHaveLength(2)
      expect(container.textContent).toContain('成员 2')
    })

    ;(
      Array.from(container.querySelectorAll('button')).find(
        node => node.textContent === 'remove-first',
      ) as HTMLButtonElement
    ).click()

    await waitForContent(() => {
      const inputs = container.querySelectorAll('input')
      expect(inputs).toHaveLength(1)
      expect((inputs[0] as HTMLInputElement).value).toBe('B')
    })
  })
})
