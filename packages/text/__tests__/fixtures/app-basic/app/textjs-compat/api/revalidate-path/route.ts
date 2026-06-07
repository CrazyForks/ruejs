import { revalidatePath } from 'text/cache'
import { TextResponse } from 'text/server'

export async function GET() {
  revalidatePath('/textjs-compat/action-revalidate')
  return TextResponse.json({ revalidated: true })
}
