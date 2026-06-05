export type AppBrowserActionReferenceSet = unknown

export type AppBrowserActionCodecOptions = {
  references?: AppBrowserActionReferenceSet
}

export type AppBrowserServerCallback = (id: string, args: unknown[]) => Promise<unknown> | unknown

export type AppBrowserActionProtocol = {
  createActionReferenceSet: () => AppBrowserActionReferenceSet
  encodeActionArgs: (
    value: unknown[],
    options?: AppBrowserActionCodecOptions,
  ) => Promise<string | FormData>
  setServerCallback: (callback: AppBrowserServerCallback) => void
}

export function createAppBrowserActionProtocol(
  protocol: AppBrowserActionProtocol,
): AppBrowserActionProtocol {
  return protocol
}

export const RUE_SERVER_ACTION_ENVELOPE_FIELD = '$RUE_ACTION'

type RueServerActionEncodedValue =
  | { type: 'blob'; key: string; name?: string; contentType?: string }
  | { type: 'form-data'; entries: Array<[string, RueServerActionEncodedValue]> }
  | { type: 'json'; value: unknown }

type RueServerActionEnvelope = {
  args: RueServerActionEncodedValue[]
  protocol: 'rue-server-action'
  version: 1
}

type MultipartEncoder = {
  formData: FormData
  textBlobKey: () => string
}

function isFormDataValue(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData
}

function isBlobValue(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob
}

function encodeActionValue(
  value: unknown,
  multipart?: MultipartEncoder,
): RueServerActionEncodedValue {
  if (isFormDataValue(value)) {
    if (!multipart) {
      const formData = new FormData()
      multipart = {
        formData,
        textBlobKey: createBlobKeyFactory(),
      }
    }
    return {
      type: 'form-data',
      entries: Array.from(value.entries(), ([key, entryValue]) => [
        key,
        encodeActionValue(entryValue, multipart),
      ]),
    }
  }

  if (isBlobValue(value)) {
    if (!multipart) {
      throw new Error('Blob values require multipart server action encoding')
    }
    const key = multipart.textBlobKey()
    multipart.formData.append(key, value)
    return {
      type: 'blob',
      key,
      name: 'name' in value && typeof value.name === 'string' ? value.name : undefined,
      contentType: value.type || undefined,
    }
  }

  return { type: 'json', value }
}

function createBlobKeyFactory(): () => string {
  let index = 0
  return () => `$RUE_ACTION_BLOB_${index++}`
}

function containsMultipartValue(value: unknown): boolean {
  if (isFormDataValue(value) || isBlobValue(value)) return true
  if (!Array.isArray(value)) return false
  return value.some(containsMultipartValue)
}

export async function encodeRueServerActionReply(value: unknown[]): Promise<string | FormData> {
  if (!containsMultipartValue(value)) {
    return JSON.stringify({
      protocol: 'rue-server-action',
      version: 1,
      args: value.map(arg => ({ type: 'json', value: arg })),
    } satisfies RueServerActionEnvelope)
  }

  const formData = new FormData()
  const multipart: MultipartEncoder = {
    formData,
    textBlobKey: createBlobKeyFactory(),
  }
  const envelope: RueServerActionEnvelope = {
    protocol: 'rue-server-action',
    version: 1,
    args: value.map(arg => encodeActionValue(arg, multipart)),
  }
  formData.set(RUE_SERVER_ACTION_ENVELOPE_FIELD, JSON.stringify(envelope))
  return formData
}

export function setRueServerActionCallback(callback: AppBrowserServerCallback): void {
  ;(globalThis as { __viteRscCallServer?: AppBrowserServerCallback }).__viteRscCallServer = callback
}

export function createRueBrowserActionProtocol(): AppBrowserActionProtocol {
  return createAppBrowserActionProtocol({
    createActionReferenceSet() {
      return undefined
    },
    encodeActionArgs(value) {
      return encodeRueServerActionReply(value)
    },
    setServerCallback(callback) {
      setRueServerActionCallback(callback)
    },
  })
}
