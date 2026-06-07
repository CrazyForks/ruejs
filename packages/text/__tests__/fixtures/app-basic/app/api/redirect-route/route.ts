import { redirect } from 'text/navigation'

// Route that calls redirect() — tests redirect catch in route handlers
export async function GET() {
  redirect('/about')
}
