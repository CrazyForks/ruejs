export type Row = {
  id: number
  label: string
}

export type OperationName =
  | 'create1k'
  | 'replace1k'
  | 'update10th'
  | 'select1k'
  | 'swap1k'
  | 'remove1k'
  | 'create10k'
  | 'append1k'
  | 'clear1k'

export type BenchmarkVariant = 'rue' | 'rue-signal' | 'vue'

export type BenchmarkApi = {
  variant: BenchmarkVariant
  runtimeVersion: string
  prepare: (operation: OperationName) => Promise<void>
  perform: (operation: OperationName) => Promise<void>
  measure: (operation: OperationName) => Promise<{
    durationMs: number
    mutations: number
    rowCount: number
  }>
}

export type BenchmarkState = {
  run: (count?: number) => void
  add: () => void
  update: () => void
  clear: () => void
  swap: () => void
  select: (id: number) => void
  remove: (id: number) => void
}

declare global {
  interface Window {
    __RUE_BENCHMARK__?: BenchmarkApi
  }
}

const adjectives = ['pretty', 'large', 'big', 'small']
const colours = ['red', 'yellow', 'blue', 'green']
const nouns = ['table', 'chair', 'house', 'bbq']
let nextId = 1

export const buildData = (count = 1_000): Row[] =>
  Array.from({ length: count }, (_, index) => ({
    id: nextId++,
    label: `${adjectives[index % adjectives.length]} ${colours[index % colours.length]} ${nouns[index % nouns.length]}`,
  }))

const click = (selector: string): void => {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) throw new Error(`Missing benchmark target: ${selector}`)
  element.click()
}

const clickOperation = (operation: OperationName): void => {
  switch (operation) {
    case 'create1k':
    case 'replace1k':
      click('#run')
      break
    case 'update10th':
      click('#update')
      break
    case 'select1k':
      click('tbody > tr:first-child [data-action="select"]')
      break
    case 'swap1k':
      click('#swaprows')
      break
    case 'remove1k':
      click('tbody > tr:first-child [data-action="remove"]')
      break
    case 'create10k':
      click('#runlots')
      break
    case 'append1k':
      click('#add')
      break
    case 'clear1k':
      click('#clear')
      break
  }
}

export const installBenchmarkApi = (
  state: BenchmarkState,
  variant: BenchmarkVariant,
  runtimeVersion: string,
  settle: () => void | Promise<void>,
): void => {
  const perform = async (operation: OperationName): Promise<void> => {
    clickOperation(operation)
    await settle()
  }

  const prepare = async (operation: OperationName): Promise<void> => {
    state.clear()
    await settle()
    if (!['create1k', 'create10k'].includes(operation)) {
      click('#run')
      await settle()
    }
  }

  window.__RUE_BENCHMARK__ = {
    variant,
    runtimeVersion,
    prepare,
    perform,
    async measure(operation) {
      const iterations = ['replace1k', 'update10th', 'swap1k'].includes(operation) ? 10 : 1
      const root = document.querySelector('#app')!
      const observer = new MutationObserver(() => {})
      observer.observe(root, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      })
      const startedAt = performance.now()
      for (let iteration = 0; iteration < iterations; iteration += 1) await perform(operation)
      const durationMs = (performance.now() - startedAt) / iterations
      const mutations = observer.takeRecords().length / iterations
      observer.disconnect()
      return { durationMs, mutations, rowCount: document.querySelectorAll('tbody > tr').length }
    },
  }
}
