import { TextResponse } from 'text/server'

export function GET() {
  return TextResponse.json({ ok: true })
}
