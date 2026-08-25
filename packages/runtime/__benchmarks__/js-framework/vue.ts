import { createApp, h, nextTick, ref, shallowRef, version } from 'vue'

type Row = {
  id: number
  label: string
}

type OperationName =
  | 'create1k'
  | 'replace1k'
  | 'update10th'
  | 'select1k'
  | 'swap1k'
  | 'remove1k'
  | 'create10k'
  | 'append1k'
  | 'clear1k'

declare global {
  interface Window {
    __RUE_BENCHMARK__?: {
      variant: 'rue' | 'rue-signal' | 'vue'
      runtimeVersion: string
      prepare: (operation: OperationName) => void | Promise<void>
      perform: (operation: OperationName) => void | Promise<void>
      measure: (operation: OperationName) =>
        | {
            durationMs: number
            mutations: number
            rowCount: number
          }
        | Promise<{
            durationMs: number
            mutations: number
            rowCount: number
          }>
    }
  }
}

const adjectives = ['pretty', 'large', 'big', 'small']
const colours = ['red', 'yellow', 'blue', 'green']
const nouns = ['table', 'chair', 'house', 'bbq']
let nextId = 1

const buildData = (count = 1_000): Row[] =>
  Array.from({ length: count }, (_, index) => ({
    id: nextId++,
    label: `${adjectives[index % adjectives.length]} ${colours[index % colours.length]} ${nouns[index % nouns.length]}`,
  }))

const rows = shallowRef<Row[]>([])
const selected = ref<number>()
const run = (count = 1_000) => {
  rows.value = buildData(count)
  selected.value = undefined
}
const add = () => {
  rows.value = [...rows.value, ...buildData()]
}
const update = () => {
  rows.value = rows.value.map((row, index) =>
    index % 10 === 0 ? { ...row, label: `${row.label} !!!` } : row,
  )
}
const clear = () => {
  rows.value = []
  selected.value = undefined
}
const swap = () => {
  if (rows.value.length <= 998) return
  const next = rows.value.slice()
  const row = next[1]
  next[1] = next[998]
  next[998] = row
  rows.value = next
}
const select = (id: number) => {
  selected.value = id
}
const remove = (id: number) => {
  rows.value = rows.value.filter(row => row.id !== id)
}

const button = (id: string, label: string, onClick: () => void) =>
  h('button', { id, onClick }, label)

createApp({
  name: 'VueJsFrameworkBenchmark',
  setup() {
    return () =>
      h('div', { class: 'container' }, [
        h('h1', 'Vue js-framework benchmark'),
        h('div', [
          button('run', 'Create 1,000 rows', () => run()),
          button('runlots', 'Create 10,000 rows', () => run(10_000)),
          button('add', 'Append 1,000 rows', add),
          button('update', 'Update every 10th row', update),
          button('clear', 'Clear', clear),
          button('swaprows', 'Swap Rows', swap),
        ]),
        h('table', { class: 'table table-hover table-striped test-data' }, [
          h(
            'tbody',
            rows.value.map(row =>
              h('tr', { key: row.id, class: row.id === selected.value ? 'danger' : '' }, [
                h('td', { class: 'col-md-1' }, String(row.id)),
                h('td', { class: 'col-md-4' }, [
                  h('a', { 'data-action': 'select', onClick: () => select(row.id) }, row.label),
                ]),
                h('td', { class: 'col-md-1' }, [
                  h('a', { 'data-action': 'remove', onClick: () => remove(row.id) }, [
                    h('span', {
                      class: 'glyphicon glyphicon-remove',
                      'aria-hidden': 'true',
                    }),
                  ]),
                ]),
                h('td', { class: 'col-md-6' }),
              ]),
            ),
          ),
        ]),
      ])
  },
}).mount('#app')

const click = (selector: string) => {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) throw new Error(`Missing benchmark target: ${selector}`)
  element.click()
}

const perform = async (operation: OperationName) => {
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
  await nextTick()
}

const prepare = async (operation: OperationName) => {
  clear()
  await nextTick()
  if (!['create1k', 'create10k'].includes(operation)) {
    run()
    await nextTick()
  }
}

window.__RUE_BENCHMARK__ = {
  variant: 'vue',
  runtimeVersion: version,
  prepare,
  perform,
  async measure(operation) {
    const root = document.querySelector('#app')!
    const observer = new MutationObserver(() => {})
    observer.observe(root, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    })
    const startedAt = performance.now()
    await perform(operation)
    const durationMs = performance.now() - startedAt
    const mutations = observer.takeRecords().length
    observer.disconnect()
    return { durationMs, mutations, rowCount: document.querySelectorAll('tbody > tr').length }
  },
}
