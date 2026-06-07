export { redirect } from 'rue-router/rsc'
import { redirect } from 'rue-router/rsc'

export default () => {
  const f = /* #__PURE__ */ $$register($$hoist_0_f, '<id>', '$$hoist_0_f')
}

export async function $$hoist_0_f() {
  'use server'
  throw redirect()
}
/* #__PURE__ */ Object.defineProperty($$hoist_0_f, 'name', { value: 'f' })
