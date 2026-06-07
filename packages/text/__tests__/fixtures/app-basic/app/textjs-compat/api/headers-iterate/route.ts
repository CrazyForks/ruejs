import { headers } from 'text/headers'
import { TextResponse } from 'text/server'

const PREFIX = 'x-iterate-'

export async function GET() {
  const syncHeaders = headers() as Promise<Headers> & Headers
  const awaitedHeaders = await headers()

  const syncEntries = Array.from(syncHeaders).filter(([key]) => key.startsWith(PREFIX))
  const awaitedEntries = Array.from(awaitedHeaders.entries()).filter(([key]) =>
    key.startsWith(PREFIX),
  )
  const keys = Array.from(awaitedHeaders.keys()).filter(key => key.startsWith(PREFIX))
  const values = Array.from(awaitedHeaders.values())
  const object = Object.fromEntries(awaitedEntries)

  return TextResponse.json({
    syncEntries,
    awaitedEntries,
    keys,
    values,
    object,
  })
}
