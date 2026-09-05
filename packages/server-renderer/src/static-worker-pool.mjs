import { fork } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, URL as NodeURL } from 'node:url'

// This is a Node entry point, not a browser asset for Vite to inline.
const defaultWorkerUrl = new NodeURL('../src/static-worker.mjs', import.meta.url)
const defaultWorkerPathname = decodeURIComponent(defaultWorkerUrl.pathname)
const defaultWorkerFile = (() => {
  if (defaultWorkerUrl.protocol === 'file:') return fileURLToPath(defaultWorkerUrl)
  if (existsSync(defaultWorkerPathname)) return defaultWorkerPathname

  return path.resolve(process.cwd(), defaultWorkerPathname.replace(/^\/+/, ''))
})()
const defaultOutputLimit = 12000
const defaultStartupTimeoutMs = 30000

const parsePositiveInteger = (value, fallback, label) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    if (fallback !== undefined) return fallback
    throw new TypeError(`${label} must be a positive integer.`)
  }
  return parsed
}

const parseNonNegativeInteger = (value, fallback, label) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    if (fallback !== undefined) return fallback
    throw new TypeError(`${label} must be a non-negative integer.`)
  }
  return parsed
}

const assertPath = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`)
  }
}

const limitOutput = (value, maxLength) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n... truncated ...`

export const createServerBundleRenderPool = options => {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object.')
  }

  const {
    cwd = process.cwd(),
    env = {},
    maxOutputLength = defaultOutputLimit,
    maxTaskRetries = 0,
    maxTasksPerWorker,
    serverBundleFile,
    size = 1,
    startupTimeoutMs = defaultStartupTimeoutMs,
    timeoutMs = 30000,
    workerFile = defaultWorkerFile,
  } = options
  assertPath(cwd, 'cwd')
  assertPath(serverBundleFile, 'serverBundleFile')
  assertPath(workerFile, 'workerFile')
  const workerCount = parsePositiveInteger(size, undefined, 'size')
  const taskTimeoutMs = parsePositiveInteger(timeoutMs, undefined, 'timeoutMs')
  const startupTimeout = parsePositiveInteger(
    startupTimeoutMs,
    defaultStartupTimeoutMs,
    'startupTimeoutMs',
  )
  const outputLimit = parsePositiveInteger(maxOutputLength, defaultOutputLimit, 'maxOutputLength')
  const taskRetryLimit = parseNonNegativeInteger(maxTaskRetries, 0, 'maxTaskRetries')
  const workerTaskLimit =
    maxTasksPerWorker === undefined
      ? Number.POSITIVE_INFINITY
      : parsePositiveInteger(maxTasksPerWorker, undefined, 'maxTasksPerWorker')

  const workers = new Set()
  const idleWorkers = []
  const taskQueue = []
  let closing = false
  let closePromise = null
  let fatalError = null
  let resolveClose = null
  let nextTaskId = 0

  const settleCloseIfDone = () => {
    if (closing && workers.size === 0 && resolveClose) {
      resolveClose()
      resolveClose = null
    }
  }

  const rejectTask = (task, error) => {
    if (!task || task.settled) return
    task.settled = true
    task.reject(error)
  }

  const failPoolStartup = error => {
    if (closing || fatalError) return
    fatalError = error
    for (const task of taskQueue.splice(0)) rejectTask(task, fatalError)
    for (const worker of workers) {
      clearTimeout(worker.startupTimer)
      if (worker.task) {
        clearTimeout(worker.task.timer)
        rejectTask(worker.task, fatalError)
        worker.task = null
      }
      if (worker.reservedTask) {
        rejectTask(worker.reservedTask, fatalError)
        worker.reservedTask = null
      }
      worker.stopping = true
      worker.child.kill('SIGKILL')
    }
  }

  const resolveTask = async task => {
    if (!task || task.settled) return
    try {
      const html = await readFile(task.outputFile, 'utf-8')
      task.settled = true
      task.resolve(html)
    } catch (error) {
      rejectTask(task, error)
    }
  }

  const createWorkerExitError = (worker, code, signal) => {
    const detail = worker.stderr || worker.stdout
    if (detail) return new Error(detail.trim())
    if (signal) return new Error(`Static render worker exited with signal ${signal}.`)
    return new Error(`Static render worker exited with code ${code}.`)
  }

  const preserveTaskForFreshWorker = (worker, error) => {
    const task = worker.task
    if (!task) return
    clearTimeout(task.timer)
    worker.task = null

    if (!closing && task.retryCount < taskRetryLimit) {
      task.retryCount += 1
      worker.reservedTask = task
      return
    }

    rejectTask(task, error)
  }

  const stopFailedWorker = worker => {
    worker.stopping = true
    worker.child.kill('SIGKILL')
  }

  const retireWorker = worker => {
    worker.stopping = true
    if (!worker.child.connected) {
      worker.child.kill('SIGKILL')
      return
    }
    worker.child.send({ type: 'shutdown' }, error => {
      if (error) worker.child.kill('SIGKILL')
    })
  }

  const dispatch = worker => {
    if (closing || worker.stopping || !worker.ready || worker.task) return
    const task = worker.reservedTask || taskQueue.shift()
    if (!task) {
      if (!idleWorkers.includes(worker)) idleWorkers.push(worker)
      return
    }
    worker.reservedTask = null

    worker.task = task
    worker.stdout = ''
    worker.stderr = ''
    task.timer = setTimeout(() => {
      if (worker.task !== task) return
      preserveTaskForFreshWorker(
        worker,
        new Error(`${task.label} timed out after ${task.timeoutMs}ms`),
      )
      stopFailedWorker(worker)
    }, task.timeoutMs)

    worker.child.send(
      {
        type: 'render',
        id: task.id,
        route: task.route,
        outputFile: task.outputFile,
        renderOptions: task.renderOptions,
      },
      error => {
        if (!error || worker.task !== task) return
        preserveTaskForFreshWorker(worker, error)
        stopFailedWorker(worker)
      },
    )
  }

  const spawnWorker = (reservedTask = null) => {
    if (closing || fatalError) return null
    const child = fork(path.resolve(workerFile), [path.resolve(serverBundleFile)], {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      execArgv: [],
      serialization: 'advanced',
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })
    const worker = {
      child,
      ready: false,
      stopping: false,
      task: null,
      reservedTask,
      completedTasks: 0,
      stdout: '',
      stderr: '',
      startupTimer: null,
    }
    worker.startupTimer = setTimeout(() => {
      if (worker.ready || worker.stopping) return
      failPoolStartup(
        new Error(`Static render worker did not become ready within ${startupTimeout}ms`),
      )
    }, startupTimeout)
    workers.add(worker)

    child.stdout.on('data', chunk => {
      worker.stdout = limitOutput(worker.stdout + String(chunk), outputLimit)
    })
    child.stderr.on('data', chunk => {
      worker.stderr = limitOutput(worker.stderr + String(chunk), outputLimit)
    })

    child.on('message', message => {
      if (!message || typeof message !== 'object') return
      if (message.type === 'ready') {
        clearTimeout(worker.startupTimer)
        worker.ready = true
        dispatch(worker)
        return
      }
      if (message.type !== 'result' || worker.task?.id !== message.id) return

      const task = worker.task
      clearTimeout(task.timer)
      worker.task = null
      worker.completedTasks += 1
      if (message.ok) void resolveTask(task)
      else rejectTask(task, new Error(message.error || `${task.label} failed.`))
      if (!message.ok || worker.completedTasks >= workerTaskLimit) {
        retireWorker(worker)
      } else {
        dispatch(worker)
      }
    })

    child.on('error', error => {
      if (!worker.ready) {
        failPoolStartup(error)
        return
      }
      if (worker.task) {
        preserveTaskForFreshWorker(worker, error)
      }
      stopFailedWorker(worker)
    })

    // `close` fires after stdout/stderr have closed, while `exit` may run before their final
    // chunks are delivered. Waiting for `close` preserves the actual worker exception instead
    // of degrading it to an unhelpful "exited with code 1" message.
    child.on('close', (code, signal) => {
      clearTimeout(worker.startupTimer)
      const exitedBeforeReady = !worker.ready && !worker.stopping
      const idleIndex = idleWorkers.indexOf(worker)
      if (idleIndex >= 0) idleWorkers.splice(idleIndex, 1)
      workers.delete(worker)
      if (worker.task) {
        preserveTaskForFreshWorker(worker, createWorkerExitError(worker, code, signal))
      }

      const retryTask = worker.reservedTask
      worker.reservedTask = null

      if (exitedBeforeReady) {
        const startupError = createWorkerExitError(worker, code, signal)
        if (retryTask) rejectTask(retryTask, startupError)
        failPoolStartup(startupError)
      }
      if (!closing && !fatalError) spawnWorker(retryTask)
      else if (retryTask) rejectTask(retryTask, fatalError || new Error('Worker pool is closing.'))
      settleCloseIfDone()
    })

    return worker
  }

  for (let index = 0; index < workerCount; index += 1) {
    spawnWorker()
  }

  return {
    render({
      baseUrl,
      extraGlobals,
      html,
      installCanvasShim,
      installObserverShims,
      label = 'SSR',
      outputFile,
      route,
      timeoutMs: renderTimeoutMs,
    }) {
      if (closing) {
        return Promise.reject(new Error('Static render worker pool is closed.'))
      }
      if (fatalError) return Promise.reject(fatalError)
      assertPath(route, 'route')
      assertPath(outputFile, 'outputFile')
      const timeout = parsePositiveInteger(renderTimeoutMs, taskTimeoutMs, 'timeoutMs')

      return new Promise((resolve, reject) => {
        const task = {
          id: ++nextTaskId,
          route,
          outputFile: path.resolve(outputFile),
          label,
          timeoutMs: timeout,
          renderOptions: {
            baseUrl,
            extraGlobals,
            html,
            installCanvasShim,
            installObserverShims,
          },
          resolve,
          reject,
          retryCount: 0,
          settled: false,
          timer: null,
        }
        taskQueue.push(task)
        const worker = idleWorkers.shift()
        if (worker) dispatch(worker)
      })
    },

    close() {
      if (closePromise) return closePromise
      closing = true
      closePromise = new Promise(resolve => {
        resolveClose = resolve
      })

      const closeError = new Error('Static render worker pool closed before the task completed.')
      for (const task of taskQueue.splice(0)) rejectTask(task, closeError)
      for (const worker of workers) {
        clearTimeout(worker.startupTimer)
        const idleIndex = idleWorkers.indexOf(worker)
        if (idleIndex >= 0) idleWorkers.splice(idleIndex, 1)
        if (worker.task) {
          clearTimeout(worker.task.timer)
          rejectTask(worker.task, closeError)
          worker.task = null
          worker.stopping = true
          worker.child.kill('SIGKILL')
        } else if (worker.reservedTask) {
          rejectTask(worker.reservedTask, closeError)
          worker.reservedTask = null
          worker.stopping = true
          worker.child.kill('SIGKILL')
        } else if (!worker.ready || !worker.child.connected) {
          worker.stopping = true
          worker.child.kill('SIGKILL')
        } else {
          worker.stopping = true
          worker.child.send({ type: 'shutdown' })
        }
      }
      settleCloseIfDone()
      return closePromise
    },
  }
}
