/**
 * onErrorCaptured 运行时测试。
 *
 * 覆盖子组件 render 抛错时的父级捕获、阻止全局传播和继续冒泡行为。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { h, onError, onErrorCaptured, render, type FC } from '../src'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('onErrorCaptured', () => {
  it('captures descendant component render errors and can stop global propagation', () => {
    const container = document.createElement('div')
    const captured: string[] = []
    const globalError = vi.fn()
    const stopGlobalError = onError(globalError)

    const Child: FC = () => {
      throw new Error('planned child failure')
    }

    const Parent: FC = () => {
      onErrorCaptured(error => {
        captured.push(error.message)
        return false
      })
      return h('section', null, h(Child, null))
    }

    render(h(Parent, null), container)

    expect(captured).toEqual(['planned child failure'])
    expect(globalError).not.toHaveBeenCalled()

    stopGlobalError?.()
  })

  it('continues to global error handlers when capture does not stop propagation', () => {
    const container = document.createElement('div')
    const captured: string[] = []
    const globalError = vi.fn()
    const stopGlobalError = onError(globalError)

    const Child: FC = () => {
      throw new Error('bubble child failure')
    }

    const Parent: FC = () => {
      onErrorCaptured(error => {
        captured.push(error.message)
      })
      return h(Child, null)
    }

    expect(() => render(h(Parent, null), container)).toThrow('bubble child failure')

    expect(captured).toEqual(['bubble child failure'])
    expect(globalError).toHaveBeenCalledTimes(1)
    expect(globalError.mock.calls[0]?.[0]?.message).toBe('bubble child failure')

    stopGlobalError?.()
  })
})
