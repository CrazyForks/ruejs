'use server'

import { redirect } from 'text/navigation'

export async function relativeRedirect() {
  redirect('./subpage')
}

export async function multiRelativeRedirect() {
  redirect('../subpage')
}

export async function absoluteRedirect() {
  redirect('/textjs-compat/server-actions-relative-redirect/subpage')
}
