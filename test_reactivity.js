import {
  ref,
  watchEffect,
  nextTick,
  setReactiveScheduling,
} from './packages/runtime-vapor/reactive.node.js'

async function run() {
  try {
    setReactiveScheduling('microtask')

    console.log('Creating ref...')
    const count = ref(1, null, true)
    let runs = 0
    let latest

    console.log('Setting up watchEffect...')
    watchEffect(() => {
      runs += 1
      latest = count.value
      console.log('Effect running: runs = ' + runs + ', value = ' + latest)
    })

    console.log('Incrementing count...')
    count.value += 1
    console.log('Sync state: runs = ' + runs + ', count.value = ' + count.value)

    console.log('Waiting for nextTick...')
    await nextTick()
    console.log('After nextTick: runs = ' + runs + ', latest = ' + latest)

    if (runs === 2 && latest === 2) {
      console.log('SUCCESS')
      process.exit(0)
    } else {
      console.log('FAILURE')
      process.exit(1)
    }
  } catch (err) {
    console.error('Caught error:', err)
    process.exit(1)
  }
}

run()
