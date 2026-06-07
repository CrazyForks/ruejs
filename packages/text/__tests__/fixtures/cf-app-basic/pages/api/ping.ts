import type { TextApiRequest, TextApiResponse } from 'text'

export default function handler(_req: TextApiRequest, res: TextApiResponse) {
  res.json({ ok: true })
}
