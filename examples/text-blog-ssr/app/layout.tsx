import type { Metadata } from 'text'

export const metadata: Metadata = {
  title: 'Rue Notes',
  description: 'A text SSR blog demo with server routes and client islands.',
}

const stylesheet = `
:root {
  color: #18201d;
  background: #f7f8f4;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; }
a { color: inherit; }
[hidden] { display: none !important; }
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px clamp(20px, 5vw, 64px);
  border-bottom: 1px solid #dfe3d9;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  text-decoration: none;
}
.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 7px;
  object-fit: cover;
}
.site-header nav { display: flex; gap: 18px; font-size: 14px; }
main {
  width: min(1040px, calc(100% - 40px));
  margin: 0 auto;
  padding: 48px 0 72px;
}
.intro, .page-heading { max-width: 760px; }
.eyebrow, .meta {
  margin: 0 0 10px;
  color: #607064;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}
h1 { margin: 0; font-size: 44px; line-height: 1.05; }
h2 { margin: 0 0 10px; font-size: 22px; }
p { line-height: 1.7; }
.intro-actions, .filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
}
.button, .chip, .like-button {
  border: 1px solid #202820;
  border-radius: 6px;
  background: #202820;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  padding: 10px 14px;
  text-decoration: none;
}
.button.secondary {
  background: #c8f169;
  color: #202820;
}
.button.ghost {
  background: #fff;
  color: #202820;
}
.chip { background: transparent; color: #202820; }
.chip.active, .like-button.liked { background: #c8f169; color: #202820; }
.filter-tabs {
  display: inline-flex;
  gap: 4px;
  border: 1px solid #b8c0b2;
  border-radius: 7px;
  background: #fff;
  padding: 4px;
}
.tab-button {
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #4d5c51;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  padding: 8px 12px;
}
.tab-button.active {
  background: #202820;
  color: #fff;
}
.rendered-at { color: #607064; font-size: 14px; }
.ref-demo {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
  gap: 18px;
  align-items: end;
  margin-top: 44px;
  border: 1px solid #dfe3d9;
  border-radius: 8px;
  background: #fff;
  padding: 22px;
}
.ref-demo h2 { margin-bottom: 8px; }
.ref-demo p { margin-bottom: 0; }
.ref-demo code {
  border: 1px solid #dfe3d9;
  border-radius: 4px;
  background: #f7f8f4;
  padding: 1px 5px;
}
.field {
  display: grid;
  gap: 8px;
  font-weight: 700;
}
.field input {
  width: 100%;
  border: 1px solid #b8c0b2;
  border-radius: 6px;
  color: #202820;
  font: inherit;
  padding: 11px 12px;
}
.field input:focus {
  border-color: #202820;
  outline: 3px solid #c8f169;
  outline-offset: 2px;
}
.ref-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.ref-readout {
  display: grid;
  gap: 4px;
  grid-column: 1 / -1;
  border-top: 1px solid #dfe3d9;
  padding-top: 16px;
}
.ref-readout span { font-weight: 800; }
.ref-readout small { color: #607064; line-height: 1.5; }
.todo-app {
  margin-top: 36px;
}
.todo-panel {
  display: grid;
  gap: 20px;
  border: 1px solid #dfe3d9;
  border-radius: 8px;
  background: #fff;
  padding: 24px;
}
.todo-panel h2 {
  margin-bottom: 8px;
}
.todo-panel p {
  margin-bottom: 0;
}
.todo-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}
.todo-field {
  min-width: 0;
}
.todo-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.todo-list {
  display: grid;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border: 1px solid #dfe3d9;
  border-radius: 7px;
  background: #f7f8f4;
  padding: 12px 14px;
}
.todo-item label {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.todo-item input {
  accent-color: #202820;
}
.todo-item span {
  overflow-wrap: anywhere;
}
.todo-item.completed span {
  color: #607064;
  text-decoration: line-through;
}
.todo-remove {
  border: 1px solid #b8c0b2;
  border-radius: 6px;
  background: #fff;
  color: #202820;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  padding: 8px 10px;
}
.todo-summary {
  color: #607064;
  font-size: 14px;
  font-weight: 800;
}
.browser-panel {
  display: grid;
  gap: 16px;
  margin-top: 44px;
}
.post-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
.post-card, .list-row {
  border: 1px solid #dfe3d9;
  border-radius: 8px;
  background: #fff;
  padding: 20px;
}
.list { display: grid; gap: 14px; margin-top: 28px; }
.list-row { display: flex; justify-content: space-between; gap: 20px; }
.pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
}
.compact-pagination { margin-top: 0; }
.pager-pages {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pager-link, .pager-page {
  border: 1px solid #202820;
  border-radius: 6px;
  background: #fff;
  color: #202820;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  min-height: 38px;
  padding: 8px 12px;
  text-decoration: none;
}
.pager-page {
  display: inline-grid;
  min-width: 38px;
  place-items: center;
  padding: 8px;
}
.pager-link.disabled,
.pager-link:disabled {
  border-color: #c9d0c4;
  color: #879083;
  cursor: not-allowed;
}
.pager-page.active {
  background: #202820;
  color: #fff;
}
.pager-readout {
  color: #607064;
  font-size: 14px;
  font-weight: 800;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 14px;
}
.tag-pill {
  border: 1px solid #b7d6e6;
  border-radius: 999px;
  background: #eef8fc;
  color: #215164;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  padding: 6px 8px;
}
.article { max-width: 720px; }
.article-tags { margin-bottom: 18px; }
.back-link { display: inline-block; margin-bottom: 24px; }
.lede { color: #4d5c51; font-size: 20px; }
@media (max-width: 640px) {
  .site-header, .list-row { align-items: flex-start; flex-direction: column; }
  .ref-demo { grid-template-columns: 1fr; }
  .todo-composer { grid-template-columns: 1fr; }
  .todo-composer .button { width: 100%; }
  .todo-item { align-items: flex-start; flex-direction: column; }
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
      <body>{children}</body>
    </html>
  )
}
