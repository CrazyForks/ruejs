// Route that uses TextResponse.redirect() helper
import { TextResponse } from 'text/server'

export async function GET() {
  return TextResponse.redirect('https://textjs.org/')
}
