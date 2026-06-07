import { renderToString } from '@rue-js/server-renderer'
import { createServerApp } from './main'
import './style.css'

export const render = async (url: string) => {
  const { app, router } = createServerApp()

  await router.push(url)
  await router.isReady()

  return {
    html: await renderToString(app),
    status: Number(router.route.get()?.meta?.status || 200),
  }
}
