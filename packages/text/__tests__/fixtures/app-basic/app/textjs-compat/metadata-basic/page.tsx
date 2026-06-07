import type { Metadata } from 'text'

export const metadata: Metadata = {
  generator: 'text.js',
  applicationName: 'test',
  referrer: 'origin-when-cross-origin',
  keywords: ['text.js', 'rue', 'javascript'],
  authors: [{ name: 'huozhi' }, { name: 'tree', url: 'https://tree.com' }],
  creator: 'shu',
  publisher: 'vercel',
  robots: 'index, follow',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

export default function Page() {
  return <div id="basic">Basic metadata page</div>
}
