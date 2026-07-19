import { startRueServerIslandLoader } from '@rue-js/runtime/server-island'

startRueServerIslandLoader({
  onError(error, island) {
    console.error('Rue server island failed', island.getAttribute('data-rue-server-island'), error)
  },
})
