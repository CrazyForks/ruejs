import net from 'node:net'

export const findAvailablePort = async (preferredPort, { host } = {}) => {
  let port = Number(preferredPort)

  if (!Number.isFinite(port) || port <= 0) {
    port = 0
  }

  while (true) {
    const available = await new Promise(resolve => {
      const server = net.createServer()

      server.once('error', () => {
        resolve(false)
      })

      server.once('listening', () => {
        server.close(() => {
          resolve(true)
        })
      })

      if (host) {
        server.listen(port, host)
      } else {
        server.listen(port)
      }
    })

    if (available) {
      return port
    }

    port += 1
  }
}
