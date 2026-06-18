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

  it('prevents native submit navigation for submit buttons', async () => {
    const container = mountContainer()
    const handleSubmit = vi.fn()
    const handleFinish = vi.fn()
    resetActiveRuntime()

    render(
      <Form
        initialValues={{ profile: { name: 'Rue' } }}
        onSubmit={handleSubmit}
        onFinish={handleFinish}
        render={form => (
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
        )}
      />,
      container,
    )

    await waitForContent(() => {
      expect(container.querySelector('form')).toBeTruthy()
    })

    const formElement = container.querySelector('form') as HTMLFormElement
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true })

    expect(formElement.dispatchEvent(submitEvent)).toBe(false)
    expect(submitEvent.defaultPrevented).toBe(true)
    expect(handleSubmit).toHaveBeenCalledWith(submitEvent)

    await waitForContent(() => {
      expect(handleFinish).toHaveBeenCalledWith({ profile: { name: 'Rue' } })
    })
  })

  it('does not duplicate item content or errors after repeated failed submits', async () => {
    const container = mountContainer()
    const handleFinishFailed = vi.fn()
    let formApi: any
    resetActiveRuntime()

    render(
      <Form
        onFinishFailed={handleFinishFailed}
        initialValues={{
          profile: {
            name: '',
            email: 'team@rue.dev',
          },
          agree: true,
        }}
        render={form => {
          formApi = form
          return (
            <>
              <Form.Item
                form={form}
                name={['profile', 'name']}
                label="名称"
                rules={[{ required: true }]}
                extra="名称字段会直接参与 submit payload。"
                render={control => <Input {...control} />}
              />
              <Form.Item
                form={form}
                name={['profile', 'email']}
                label="邮箱"
                rules={[{ required: true }, { type: 'email' }]}
                hasFeedback={true}
                extra="这里演示 Rue Form 当前支持的校验消息、反馈图标和 scrollToFirstError 行为。"
                render={control => <Input {...control} />}
              />
              <Form.Item
                form={form}
                name="agree"
                label="发布确认"
                valuePropName="checked"
                render={control => <Checkbox {...control}>允许直接覆盖 staging 配置</Checkbox>}
              />
              <Button htmlType="submit">提交</Button>
            </>
          )
        }}
      />,
      container,
    )

    await waitForContent(() => {
      expect(container.querySelectorAll('.rue-form-item')).toHaveLength(3)
    })

    formApi.submit()
    formApi.submit()
    formApi.submit()

    await waitForContent(() => {
      expect(container.querySelectorAll('.rue-form-item')).toHaveLength(3)
      expect(container.querySelectorAll('input[type="text"], input:not([type])')).toHaveLength(2)
      expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
      expect(handleFinishFailed).toHaveBeenCalledTimes(3)
    })

    const latestFailure = handleFinishFailed.mock.calls[handleFinishFailed.mock.calls.length - 1][0]
    expect(latestFailure.errorFields).toHaveLength(1)
    expect(latestFailure.errorFields[0].name).toEqual(['profile', 'name'])
  })

  it('scrolls named forms to fields with generated item ids', async () => {
    const container = mountContainer()
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    let formApi: any
    resetActiveRuntime()

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    try {
      render(
        <Form
          name="profile-form"
          render={form => {
            formApi = form
            return (
              <Form.Item
                form={form}
                name={['profile', 'name']}
                label="名称"
                render={control => <Input {...control} />}
              />
            )
          }}
        />,
        container,
      )

      await waitForContent(() => {
        expect(container.querySelector('#profile__name')).toBeTruthy()
      })

      formApi.scrollToField(['profile', 'name'], { block: 'center', focus: true })

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', focus: true })
      expect(document.activeElement).toBe(container.querySelector('#profile__name'))
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        })
      } else {
        delete (HTMLElement.prototype as any).scrollIntoView
      }
    }
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
