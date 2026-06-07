import type { Metadata } from 'text'
import Link from 'text/link'

export const metadata: Metadata = {
  title: 'Static Field Guide',
  description: 'A tiny text static export demo.',
}

const stylesheet = `
:root {
  color: #191d24;
  background: #fbfbfd;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; }
a { color: inherit; }
.topbar {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 20px clamp(20px, 6vw, 72px);
  border-bottom: 1px solid #e3e6ec;
  font-weight: 750;
}
.topbar nav { display: flex; gap: 18px; font-size: 14px; }
main {
  width: min(960px, calc(100% - 40px));
  margin: 0 auto;
  padding: 56px 0 72px;
}
.narrow { max-width: 700px; }
.hero { max-width: 760px; }
.eyebrow {
  margin: 0 0 10px;
  color: #526070;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
}
h1 { margin: 0; font-size: 42px; line-height: 1.08; }
h2 { margin: 0 0 10px; font-size: 22px; }
p, li { line-height: 1.7; }
.guide-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-top: 34px;
}
.guide-card {
  border: 1px solid #e3e6ec;
  border-radius: 8px;
  background: #fff;
  padding: 20px;
}
.back { display: inline-block; margin-bottom: 24px; }
.steps { display: grid; gap: 10px; margin-top: 24px; padding-left: 22px; }
@media (max-width: 640px) {
  .topbar { flex-direction: column; }
  h1 { font-size: 34px; }
}
`

export default function RootLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <html lang="en">
      <head>
        <style>{stylesheet}</style>
      </head>
      <body>
        <header className="topbar">
          <Link href="/">Static Field Guide</Link>
          <nav>
            <Link href="/about">About</Link>
            <Link href="/guides/plan-routes">Guide</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}
