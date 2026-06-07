import { cookies } from 'text/headers'
import { TextResponse } from 'text/server'

export async function GET() {
  const jar = await cookies()
  jar.delete('session')
  return TextResponse.json({ deleted: true })
}
