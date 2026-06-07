// API route used by i18n locale-prefix tests.
// Mirrors Text.js test/e2e/middleware-redirects/app/pages/api/ok.js.
import type { TextApiRequest, TextApiResponse } from 'text'

export default function handler(_req: TextApiRequest, res: TextApiResponse) {
  res.status(200).send('ok')
}
