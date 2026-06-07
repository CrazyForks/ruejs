import { revalidateTag } from 'text/cache'
import { TextResponse } from 'text/server'

export async function GET() {
  revalidateTag('test-data')
  return TextResponse.json({ revalidated: true })
}
