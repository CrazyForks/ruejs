import type { TextApiRequest, TextApiResponse } from 'text'

/**
 * API route that tests text/server imports work.
 * We import TextResponse to verify the shim resolves correctly,
 * but use standard API route style for the response.
 */
export default function handler(_req: TextApiRequest, res: TextApiResponse) {
  // Verify text/server exports are importable
  res.status(200).json({ ok: true, message: 'middleware-test works' })
}
