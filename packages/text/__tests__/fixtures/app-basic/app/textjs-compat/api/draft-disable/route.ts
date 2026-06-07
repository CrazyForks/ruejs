import { draftMode } from 'text/headers'
import { TextResponse } from 'text/server'

export async function GET() {
  const draft = await draftMode()
  draft.disable()
  return TextResponse.json({ disabled: true })
}
