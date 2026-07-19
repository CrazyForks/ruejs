import { fork } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const defaultWorkerFile = path.resolve(process.cwd(), 'scripts/app-static-render-worker.mjs')
const defaultOutputLimit = 12000

const parsePositiveInteger = (value, fallback, label) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    if (fallback !== undefined) return fallback
    throw new TypeError(`${label} must be a positive integer.`)
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

export const createAppStaticRenderWorkerPool = options => {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object.')
  }

  const {
    cwd = process.cwd(),
    env = {},
    maxOutputLength = defaultOutputLimit,
    serverBundleFile,
    size = 1,
    timeoutMs = 30000,
    workerFile = defaultWorkerFile,
  } = options
  assertPath(cwd, 'cwd')
  assertPath(serverBundleFile, 'serverBundleFile')
  assertPath(workerFile, 'workerFile')
  const workerCount = parsePositiveInteger(size, undefined, 'size')
  const taskTimeoutMs = parsePositiveInteger(timeoutMs, undefined, 'timeoutMs')
  const outputLimit = parsePositiveInteger(maxOutputLength, defaultOutputLimit, 'maxOutputLength')

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

  const dispatch = worker => {
    if (closing || worker.stopping || !worker.ready || worker.task) return
    const task = taskQueue.shift()
    if (!task) {
      if (!idleWorkers.includes(worker)) idleWorkers.push(worker)
      return
    }

    worker.task = task
    worker.stdout = ''
    worker.stderr = ''
    task.timer = setTimeout(() => {
      if (worker.task !== task) return
      rejectTask(task, new Error(`${task.label} timed out after ${task.timeoutMs}ms`))
      worker.task = null
      worker.stopping = true
      worker.child.kill('SIGKILL')
    }, task.timeoutMs)

    worker.child.send(
      {
        type: 'render',
        id: task.id,
        route: task.route,
        outputFile: task.outputFile,
        docHtmlFile: task.docHtmlFile,
      },
      error => {
        if (!error || worker.task !== task) return
        clearTimeout(task.timer)
        rejectTask(task, error)
        worker.task = null
        worker.stopping = true
        worker.child.kill('SIGKILL')
      },
    )
  }

  const spawnWorker = () => {
    if (closing) return null
    const child = fork(path.resolve(workerFile), [path.resolve(serverBundleFile)], {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      execArgv: [],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    })
    const worker = {
      child,
      ready: false,
      stopping: false,
      task: null,
      stdout: '',
      stderr: '',
    }
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
        worker.ready = true
        dispatch(worker)
        return
      }
      if (message.type !== 'result' || worker.task?.id !== message.id) return

      const task = worker.task
      clearTimeout(task.timer)
      worker.task = null
      if (message.ok) void resolveTask(task)
      else rejectTask(task, new Error(message.error || `${task.label} failed.`))
      dispatch(worker)
    })

    child.on('error', error => {
      if (worker.task) {
        clearTimeout(worker.task.timer)
        rejectTask(worker.task, error)
        worker.task = null
      }
    })

    child.on('exit', (code, signal) => {
      const exitedBeforeReady = !worker.ready && !worker.stopping
      const idleIndex = idleWorkers.indexOf(worker)
      if (idleIndex >= 0) idleWorkers.splice(idleIndex, 1)
      workers.delete(worker)
      if (worker.task) {
        clearTimeout(worker.task.timer)
        rejectTask(worker.task, createWorkerExitError(worker, code, signal))
        worker.task = null
      }

      if (exitedBeforeReady && !fatalError) {
        fatalError = createWorkerExitError(worker, code, signal)
        for (const task of taskQueue.splice(0)) rejectTask(task, fatalError)
        for (const sibling of workers) {
          sibling.stopping = true
          sibling.child.kill('SIGKILL')
        }
      }

      if (!closing && !fatalError) spawnWorker()
      settleCloseIfDone()
    })

    return worker
  }

  for (let index = 0; index < workerCount; index += 1) {
    spawnWorker()
  }

  return {
    render({ docHtmlFile, label = 'SSR', outputFile, route, timeoutMs: renderTimeoutMs }) {
      if (closing) {
        return Promise.reject(new Error('Static render worker pool is closed.'))
      }
      if (fatalError) return Promise.reject(fatalError)
      assertPath(route, 'route')
      assertPath(outputFile, 'outputFile')
      if (docHtmlFile !== undefined) assertPath(docHtmlFile, 'docHtmlFile')
      const timeout = parsePositiveInteger(renderTimeoutMs, taskTimeoutMs, 'timeoutMs')

      return new Promise((resolve, reject) => {
        const task = {
          id: ++nextTaskId,
          route,
          outputFile: path.resolve(outputFile),
          docHtmlFile: docHtmlFile ? path.resolve(docHtmlFile) : undefined,
          label,
          timeoutMs: timeout,
          resolve,
          reject,
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
        const idleIndex = idleWorkers.indexOf(worker)
        if (idleIndex >= 0) idleWorkers.splice(idleIndex, 1)
        if (worker.task) {
          clearTimeout(worker.task.timer)
          rejectTask(worker.task, closeError)
          worker.task = null
          worker.stopping = true
          worker.child.kill('SIGKILL')
        } else if (worker.child.connected) {
          worker.stopping = true
          worker.child.send({ type: 'shutdown' })
        } else {
          worker.stopping = true
          worker.child.kill('SIGKILL')
        }
      }
      settleCloseIfDone()
      return closePromise
    },
  }
}
