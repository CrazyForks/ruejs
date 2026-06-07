import type { TextApiRequest, TextApiResponse } from 'text'

export default function handler(_req: TextApiRequest, res: TextApiResponse) {
  res.status(200).json({ message: 'Hello from standalone API!' })
}
