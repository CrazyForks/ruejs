import { notFound } from 'text/navigation'

// Server component that calls notFound() — should produce 404
export default function Page() {
  notFound()
}
