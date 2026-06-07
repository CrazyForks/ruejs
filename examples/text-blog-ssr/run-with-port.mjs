import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findAvailablePort } from '../shared/ports.mjs'

const [command, preferredPortRaw, ...extraArgs] = process.argv.slice(2)
const root = path.dirname(fileURLToPath(import.meta.url))

if (!command || !preferredPortRaw) {
  console.error('Usage: node run-with-port.mjs <ruetext-command> <preferred-port> [args...]')
  process.exit(1)
}

const defaultPort = Number(preferredPortRaw)

if (!Number.isInteger(defaultPort) || defaultPort < 0 || defaultPort > 65535) {
  console.error(`Invalid port: "${preferredPortRaw}". Must be an integer between 0 and 65535.`)
  process.exit(1)
}

function getPort(args, fallback) {
  let port = fallback

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--port' || arg === '-p') {
      const nextPort = Number(args[i + 1])
      if (Number.isInteger(nextPort)) port = nextPort
      i++
    } else if (arg.startsWith('--port=')) {
      const nextPort = Number(arg.slice('--port='.length))
      if (Number.isInteger(nextPort)) port = nextPort
    }
  }

  return port
}

function getHostname(args, fallback) {
  let hostname = fallback

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--hostname' || arg === '-H') {
      const nextHostname = args[i + 1]
      if (nextHostname && !nextHostname.startsWith('-')) hostname = nextHostname
      i++
    } else if (arg.startsWith('--hostname=')) {
      hostname = arg.slice('--hostname='.length) || hostname
    }
  }

  return hostname
}

const preferredPort = getPort(extraArgs, defaultPort)
const hostname = getHostname(extraArgs, command === 'dev' ? 'localhost' : '0.0.0.0')
const port = await findAvailablePort(preferredPort, { host: hostname })

if (port !== preferredPort) {
  console.log(`Port ${preferredPort} is already in use; using ${port} instead.`)
}

const pathKey = Object.keys(process.env).find(key => key.toLowerCase() === 'path') ?? 'PATH'
const env = {
  ...process.env,
  [pathKey]: [path.join(root, 'node_modules', '.bin'), process.env[pathKey]]
    .filter(Boolean)
    .join(path.delimiter),
}

const child = spawn('ruetext', [command, ...extraArgs, '--port', String(port)], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.once('error', error => {
  console.error(error)
  process.exit(1)
})

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
