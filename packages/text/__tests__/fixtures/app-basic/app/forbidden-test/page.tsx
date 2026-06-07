import { forbidden } from 'text/navigation'

export default function ForbiddenTestPage() {
  // This page always triggers a 403
  forbidden()
}
