'use server'

import { redirect } from 'text/navigation'

export async function redirectToReceipt() {
  redirect('../receipt')
}
