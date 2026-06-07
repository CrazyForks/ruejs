import type { TextApiRequest, TextApiResponse } from 'text'

export default function handler(_req: TextApiRequest, res: TextApiResponse) {
  res.status(200).send(Buffer.from([1, 2, 3]))
}
