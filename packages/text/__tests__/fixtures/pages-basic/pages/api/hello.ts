import type { TextApiRequest, TextApiResponse } from 'text'

export default function handler(req: TextApiRequest, res: TextApiResponse) {
  res.status(200).json({ message: 'Hello from API!' })
}
