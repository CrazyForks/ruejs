'use server'

import { revalidatePath } from 'text/cache'

export async function revalidateAction() {
  revalidatePath('/textjs-compat/action-revalidate')
}
