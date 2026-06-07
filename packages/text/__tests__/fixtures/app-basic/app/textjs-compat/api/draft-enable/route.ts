import { draftMode } from 'text/headers'
import { TextResponse } from 'text/server'

export async function GET() {
  const draft = await draftMode()
  draft.enable()
  return TextResponse.json({ enabled: true })
}
