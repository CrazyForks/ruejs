'use server'

import { refresh } from 'text/cache'
import { setFlag } from './state'

export async function setFlagAction(value: boolean): Promise<boolean> {
  return setFlag(value)
}

export async function setFlagAndRefreshAction(value: boolean): Promise<boolean> {
  const textValue = setFlag(value)
  refresh()
  return textValue
}
