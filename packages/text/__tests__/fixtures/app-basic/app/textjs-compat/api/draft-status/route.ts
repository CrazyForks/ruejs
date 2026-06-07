import { draftMode } from 'text/headers'
import { TextResponse } from 'text/server'

export async function GET() {
  const draft = await draftMode()
  return TextResponse.json({ isEnabled: draft.isEnabled })
}
