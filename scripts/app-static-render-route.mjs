import { readFile } from 'node:fs/promises'
import path from 'node:path'

import {
  formatStaticError,
  normalizeStaticRoute,
  renderServerBundleRoute,
} from '@rue-js/server-renderer/static'

const [serverBundleFile, route, outputFile] = process.argv.slice(2)
const docHtmlFile = process.env.APP_STATIC_RENDER_DOC_HTML_FILE
const staticDocHtmlByRouteKey = '__RUE_STATIC_DOC_HTML_BY_ROUTE__'

if (!serverBundleFile || !route || !outputFile) {
  console.error(
    'Usage: node scripts/app-static-render-route.mjs <server-bundle> <route> <output-file>',
  )
  process.exit(1)
}

try {
  const extraGlobals = {}

  if (docHtmlFile) {
    const docHtml = await readFile(path.resolve(docHtmlFile), 'utf-8')
    extraGlobals[staticDocHtmlByRouteKey] = {
      [normalizeStaticRoute(route)]: docHtml,
    }
  }

  await renderServerBundleRoute({
    serverBundleFile,
    route,
    outputFile,
    extraGlobals,
  })
} catch (error) {
  console.error(formatStaticError(error))
  process.exit(1)
}
