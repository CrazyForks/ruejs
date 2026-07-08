import { formatStaticError, snapshotClientRoute } from '@rue-js/server-renderer/static'

const [outDir, route, outputFile] = process.argv.slice(2)
const clientTemplateFile = process.env.APP_STATIC_CLIENT_TEMPLATE_FILE
const snapshotSettleMs = Number(process.env.APP_STATIC_SNAPSHOT_SETTLE_MS || 750)
const snapshotWaitMs = Number(process.env.APP_STATIC_SNAPSHOT_WAIT_MS || 9000)

if (!outDir || !route || !outputFile) {
  console.error('Usage: node scripts/app-static-snapshot-route.mjs <out-dir> <route> <output-file>')
  process.exit(1)
}

try {
  await snapshotClientRoute({
    outDir,
    route,
    outputFile,
    templateFile: clientTemplateFile,
    settleMs: snapshotSettleMs,
    waitMs: snapshotWaitMs,
  })
} catch (error) {
  console.error(formatStaticError(error))
  process.exit(1)
}
