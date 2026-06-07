import { notFound } from 'text/navigation'

// Route that calls notFound() — tests notFound catch in route handlers
export async function GET() {
  notFound()
}
