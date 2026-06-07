// Route that uses TextResponse.json() helper
import { TextResponse } from 'text/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ping = url.searchParams.get('ping') || 'pong'
  return TextResponse.json({ ping }, { status: 200 })
}
