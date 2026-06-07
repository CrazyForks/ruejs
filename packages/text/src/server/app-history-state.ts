import type { TraverseDirection } from './navigation-planner.js'

const TEXT_PREVIOUS_TEXT_URL_HISTORY_STATE_KEY = '__text_previousTextUrl'
const TEXT_HISTORY_INDEX_HISTORY_STATE_KEY = '__text_historyIndex'

type HistoryStateRecord = {
  [key: string]: unknown
}

export type HistoryTraversalIntent = {
  direction: TraverseDirection
  historyState: unknown
  targetHistoryIndex: number | null
}

function cloneHistoryState(state: unknown): HistoryStateRecord {
  if (!state || typeof state !== 'object') {
    return {}
  }

  const textState: HistoryStateRecord = {}
  for (const [key, value] of Object.entries(state)) {
    textState[key] = value
  }
  return textState
}

export function createHistoryStateWithPreviousTextUrl(
  state: unknown,
  previousTextUrl: string | null,
): HistoryStateRecord | null {
  return createHistoryStateWithNavigationMetadata(state, { previousTextUrl })
}

export function createHistoryStateWithNavigationMetadata(
  state: unknown,
  metadata: {
    previousTextUrl: string | null
    traversalIndex?: number | null
  },
): HistoryStateRecord | null {
  const textState = cloneHistoryState(state)

  if (metadata.previousTextUrl === null) {
    delete textState[TEXT_PREVIOUS_TEXT_URL_HISTORY_STATE_KEY]
  } else {
    textState[TEXT_PREVIOUS_TEXT_URL_HISTORY_STATE_KEY] = metadata.previousTextUrl
  }

  if (metadata.traversalIndex !== undefined) {
    if (isValidHistoryTraversalIndex(metadata.traversalIndex)) {
      textState[TEXT_HISTORY_INDEX_HISTORY_STATE_KEY] = metadata.traversalIndex
    } else {
      delete textState[TEXT_HISTORY_INDEX_HISTORY_STATE_KEY]
    }
  }

  return Object.keys(textState).length > 0 ? textState : null
}

export function createExternalHistoryStatePreservingMetadata(
  callerState: unknown,
  currentHistoryState: unknown,
): unknown {
  const previousTextUrl = readHistoryStatePreviousTextUrl(currentHistoryState)
  const traversalIndex = readHistoryStateTraversalIndex(currentHistoryState)

  if (previousTextUrl === null && traversalIndex === null) {
    return callerState
  }

  return createHistoryStateWithNavigationMetadata(callerState, {
    previousTextUrl,
    traversalIndex,
  })
}

export function readHistoryStatePreviousTextUrl(state: unknown): string | null {
  const value = cloneHistoryState(state)[TEXT_PREVIOUS_TEXT_URL_HISTORY_STATE_KEY]
  return typeof value === 'string' ? value : null
}

function isValidHistoryTraversalIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function readHistoryStateTraversalIndex(state: unknown): number | null {
  const value = cloneHistoryState(state)[TEXT_HISTORY_INDEX_HISTORY_STATE_KEY]
  return isValidHistoryTraversalIndex(value) ? value : null
}

export function resolveHistoryTraversalIntent(options: {
  currentHistoryIndex: number | null
  historyState: unknown
}): HistoryTraversalIntent {
  const targetHistoryIndex = readHistoryStateTraversalIndex(options.historyState)
  let direction: TraverseDirection = 'unknown'

  if (options.currentHistoryIndex !== null && targetHistoryIndex !== null) {
    if (targetHistoryIndex < options.currentHistoryIndex) {
      direction = 'back'
    } else if (targetHistoryIndex > options.currentHistoryIndex) {
      direction = 'forward'
    }
  }

  return {
    direction,
    historyState: options.historyState,
    targetHistoryIndex,
  }
}
