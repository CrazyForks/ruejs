export { redirect } from 'rue-router/rsc'
import { redirect } from 'rue-router/rsc'

export default () => {
  const f = async () => {
    'use server'
    throw redirect()
  }
}
