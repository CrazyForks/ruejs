/*
基础过渡运行器概述
- 设计目标：统一封装进入/离开的过渡行为，兼容 CSS 类名驱动与 JS 钩子接管两种模式。
- 阶段语义：分为 enter/leave/appear 三类阶段；每一阶段包含 from/active/to 三个子状态，用于控制类名增删。
- 时间确定：通过 inferType 推断是 transition 还是 animation，再结合 resolveDuration 计算最终时长；若用户显式提供 duration，则优先使用。
- 事件流转：通过 useEmit(props) 派发生命周期事件（before/after-appear/enter/leave），便于外部监听。
- 可扩展性：用户可覆盖类名或提供 onEnter/onLeave/onAppear 钩子，自行控制动画并在结束时调用 done()。
*/
import { useEmit } from '../rue'
import {
  type TransitionPhase,
  type TransitionType,
  addClass,
  forceReflow,
  inferType,
  nextFrame,
  removeClass,
  resolveDuration,
  whenTransitionEnds,
} from './transitionUtils'

/** Transition 与 TransitionGroup 共享的过渡配置。 */
export interface BaseTransitionProps {
  /** CSS 类名前缀，默认 `rue`。 */
  name?: string
  /** 显式指定监听 transition 还是 animation；未传入时从样式推断。 */
  type?: TransitionType
  /** 是否启用 CSS class 驱动；为 false 时只执行 JS 钩子。 */
  css?: boolean
  /** 首次渲染时是否执行 appear 过渡。 */
  appear?: boolean
  /** 显式过渡时长，优先于样式推断。 */
  duration?: number | { enter: number; leave: number }
  /** enter 阶段初始类名。 */
  enterFromClass?: string
  /** enter 阶段激活类名。 */
  enterActiveClass?: string
  /** enter 阶段结束类名。 */
  enterToClass?: string
  /** leave 阶段初始类名。 */
  leaveFromClass?: string
  /** leave 阶段激活类名。 */
  leaveActiveClass?: string
  /** leave 阶段结束类名。 */
  leaveToClass?: string
  /** appear 阶段初始类名，默认复用 enterFromClass。 */
  appearFromClass?: string
  /** appear 阶段激活类名，默认复用 enterActiveClass。 */
  appearActiveClass?: string
  /** appear 阶段结束类名，默认复用 enterToClass。 */
  appearToClass?: string
  /** enter 前钩子。 */
  onBeforeEnter?: (el: HTMLElement) => void
  /** enter 钩子；接管动画时需要调用 done。 */
  onEnter?: (el: HTMLElement, done: () => void) => void
  /** enter 完成钩子。 */
  onAfterEnter?: (el: HTMLElement) => void
  /** enter 取消钩子，预留给上层兼容。 */
  onEnterCancelled?: (el: HTMLElement) => void
  /** leave 前钩子。 */
  onBeforeLeave?: (el: HTMLElement) => void
  /** leave 钩子；接管动画时需要调用 done。 */
  onLeave?: (el: HTMLElement, done: () => void) => void
  /** leave 完成钩子。 */
  onAfterLeave?: (el: HTMLElement) => void
  /** leave 取消钩子，预留给上层兼容。 */
  onLeaveCancelled?: (el: HTMLElement) => void
  /** appear 前钩子。 */
  onBeforeAppear?: (el: HTMLElement) => void
  /** appear 钩子；接管动画时需要调用 done。 */
  onAppear?: (el: HTMLElement, done: () => void) => void
  /** appear 完成钩子。 */
  onAfterAppear?: (el: HTMLElement) => void
  /** appear 取消钩子，预留给上层兼容。 */
  onAppearCancelled?: (el: HTMLElement) => void
}

/** 单个过渡阶段的最小控制句柄；取消只清理该阶段，不触发完成回调。 */
export interface TransitionPhaseControl {
  cancel: () => void
}

/** 属性详解与行为说明：
 * - name：类名前缀，默认 'rue'；例如 enter-from 类为 `${name}-enter-from`
 * - type：显式指定过渡类型（'transition' 或 'animation'），影响结束事件与时长解析
 * - css：是否启用 CSS 类名驱动；为 false 时仅执行 JS 钩子，不触碰类名
 * - appear：首次渲染时是否执行出现动画（appear）；否则按 enter 处理
 * - duration：过渡时长（毫秒）。可为数字或对象 { enter, leave }，优先于样式推断
 * - enter/leave/appearXXXClass：覆盖三阶段的 from/active/to 类名
 * - onBeforeXXX/onXXX/onAfterXXX：进入/出现/离开钩子。提供 onEnter/onLeave/onAppear 时必须在完成时调用 done()
 */
/** 根据阶段返回类名集合（支持 appear 覆盖） */
function getPhaseClasses(name: string, props: BaseTransitionProps, phase: TransitionPhase) {
  if (phase === 'appear') {
    // Rue 默认 appear 复用 enter 类；若用户提供 appear 覆盖，则使用覆盖
    return {
      from: props.appearFromClass ?? props.enterFromClass ?? `${name}-enter-from`,
      active: props.appearActiveClass ?? props.enterActiveClass ?? `${name}-enter-active`,
      to: props.appearToClass ?? props.enterToClass ?? `${name}-enter-to`,
    }
  }
  if (phase === 'enter') {
    return {
      from: props.enterFromClass ?? `${name}-enter-from`,
      active: props.enterActiveClass ?? `${name}-enter-active`,
      to: props.enterToClass ?? `${name}-enter-to`,
    }
  }
  return {
    from: props.leaveFromClass ?? `${name}-leave-from`,
    active: props.leaveActiveClass ?? `${name}-leave-active`,
    to: props.leaveToClass ?? `${name}-leave-to`,
  }
}

/** 创建过渡运行器
 * @param props 过渡属性配置
 * @returns 过渡执行函数集合：runEnter/runLeave
 */
export function createTransitionRunner(props: BaseTransitionProps) {
  const name = props.name || 'rue'
  const css = props.css !== false
  const em = useEmit(props)

  function runPhase(
    el: HTMLElement,
    phase: TransitionPhase,
    onDone?: () => void,
  ): TransitionPhaseControl {
    const cls = getPhaseClasses(name, props, phase)
    const entering = phase !== 'leave'
    let active = true
    let stopFrame = () => {}
    let stopEnd = () => {}

    const emitPhaseEvent = (stage: 'before' | 'after') => {
      if (phase === 'appear') em(`${stage}-enter`, el)
      em(`${stage}-${phase}`, el)
    }

    const cleanup = () => {
      stopFrame()
      stopEnd()
      if (css) {
        removeClass(el, cls.from)
        removeClass(el, cls.active)
        removeClass(el, cls.to)
      }
    }

    const done = () => {
      if (!active) return
      active = false
      cleanup()
      emitPhaseEvent('after')
      if (onDone) onDone()
    }

    const cancel = () => {
      if (!active) return
      active = false
      cleanup()
      em(`${phase}-cancelled`, el)
    }

    emitPhaseEvent('before')

    if (css) {
      addClass(el, cls.from)
      addClass(el, cls.active)
      forceReflow(el)
      stopFrame = nextFrame(() => {
        removeClass(el, cls.from)
        addClass(el, cls.to)
      })
    }

    const userHook = phase === 'appear' ? props.onAppear : entering ? props.onEnter : props.onLeave

    if (userHook) {
      userHook(el, done)
    } else {
      const type = props.type ?? inferType(el)
      const timeout = resolveDuration(el, props.type, props.duration, phase)
      stopEnd = whenTransitionEnds(el, type ?? null, timeout, done)
    }

    return { cancel }
  }

  const runEnter = (el: HTMLElement, phase: TransitionPhase = 'enter', onDone?: () => void) =>
    runPhase(el, phase, onDone)

  const runLeave = (el: HTMLElement, onDone?: () => void) => runPhase(el, 'leave', onDone)

  return { runEnter, runLeave }
}
