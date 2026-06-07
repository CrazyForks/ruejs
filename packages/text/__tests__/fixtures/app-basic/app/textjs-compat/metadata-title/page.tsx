import type { Metadata } from 'text'

export const metadata: Metadata = {
  title: 'this is the page title',
  description: 'this is the layout description',
}

export default function Page() {
  return <div id="title">Title page</div>
}
