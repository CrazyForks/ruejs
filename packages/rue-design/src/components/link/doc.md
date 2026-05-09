---
title: Link
desc: Link renders text links with Rue's link visual style plus Typography-style text actions.
source: https://raw.githubusercontent.com/saadeghi/daisyui/refs/heads/master/packages/daisyui/src/components/link.css
layout: components
classnames:
  component:
    - class: link
      desc: Adds underline
  style:
    - class: link-hover
      desc: Only shows underline on hover
  color:
    - class: link-neutral
      desc: neutral color
    - class: link-primary
      desc: primary color
    - class: link-secondary
      desc: secondary color
    - class: link-accent
      desc: accent color
    - class: link-success
      desc: success color
    - class: link-info
      desc: info color
    - class: link-warning
      desc: warning color
    - class: link-error
      desc: error color
---

## Link

```tsx
import { Link } from '@rue-js/design'

<Link>Click me</Link>
<Link href="https://example.com" target="_blank">
  External link
</Link>
<Link to="/examples/hello-world">Router link</Link>
```

## Colors and hover

```tsx
<Link variant="primary">Primary</Link>
<Link variant="secondary">Secondary</Link>
<Link variant="accent">Accent</Link>
<Link variant="success">Success</Link>
<Link variant="info">Info</Link>
<Link variant="warning">Warning</Link>
<Link variant="error">Error</Link>
<Link hover>Show underline only on hover</Link>
```

## Typography-style text

```tsx
<Link type="secondary">Secondary text</Link>
<Link type="success">Success link</Link>
<Link type="warning">Warning link</Link>
<Link type="danger">Danger link</Link>

<Link strong>Strong</Link>
<Link italic>Italic</Link>
<Link underline>Underline</Link>
<Link delete>Deleted</Link>
<Link mark>Marked</Link>
<Link code>Inline code</Link>
<Link keyboard>Ctrl K</Link>
```

## Ellipsis, copy and edit

```tsx
<Link ellipsis>
  A very long link that truncates in a narrow container
</Link>

<Link ellipsis={{ rows: 2 }}>
  A longer documentation link that can clamp to two lines
</Link>

<Link
  ellipsis={{
    suffix: '.md',
    expandable: 'collapsible',
    symbol: expanded => (expanded ? 'Collapse' : 'Expand'),
  }}
>
  Architecture decision record for billing-service rollback procedure
</Link>

<Link copyable={{ text: 'https://rue.dev/docs/link' }}>
  Copy docs link
</Link>

<Link editable={{ text: label.value, onChange: value => (label.value = value) }}>
  {label.value}
</Link>

<Link
  editable={{
    text: notes.value,
    autoSize: { minRows: 2, maxRows: 5 },
    onChange: value => (notes.value = value),
  }}
>
  {notes.value}
</Link>
```

## API

| Prop                                 | Description                                                                                                     | Type                                                                                                                                                                                                                                                                                         | Default   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| href                                 | Native anchor href.                                                                                             | `string`                                                                                                                                                                                                                                                                                     | `'#'`     |
| to                                   | Router target. Renders hash href and navigates through Rue Router on click.                                     | `string`                                                                                                                                                                                                                                                                                     | -         |
| replace                              | Replace history entry when used with `to`.                                                                      | `boolean`                                                                                                                                                                                                                                                                                    | `false`   |
| target / rel                         | Native anchor attributes. `target="_blank"` automatically receives `noopener noreferrer` when `rel` is omitted. | `string`                                                                                                                                                                                                                                                                                     | -         |
| variant                              | Rue link color, mapped to `link-*`.                                                                             | `'neutral' \| 'primary' \| 'secondary' \| 'accent' \| 'success' \| 'info' \| 'warning' \| 'error'`                                                                                                                                                                                           | -         |
| color                                | Color alias. `danger` maps to error.                                                                            | `LinkVariant \| 'danger'`                                                                                                                                                                                                                                                                    | -         |
| type                                 | Typography tone.                                                                                                | `'secondary' \| 'success' \| 'warning' \| 'danger'`                                                                                                                                                                                                                                          | -         |
| hover                                | Adds `link-hover`.                                                                                              | `boolean`                                                                                                                                                                                                                                                                                    | `false`   |
| disabled                             | Removes link navigation and outputs disabled semantics.                                                         | `boolean`                                                                                                                                                                                                                                                                                    | `false`   |
| ellipsis                             | Single or multi-line truncation with tooltip, suffix and expandable controls.                                   | `boolean \| { rows?: number; tooltip?: boolean \| string; suffix?: string; expandable?: boolean \| 'collapsible'; symbol?: any \| ((expanded: boolean) => any); defaultExpanded?: boolean; expanded?: boolean; onExpand?: (event, info) => void; onEllipsis?: (ellipsis: boolean) => void }` | `false`   |
| copyable                             | Shows a copy action.                                                                                            | `boolean \| LinkCopyConfig`                                                                                                                                                                                                                                                                  | `false`   |
| editable                             | Shows an edit action or allows text-triggered editing, including multi-line `autoSize`.                         | `boolean \| LinkEditConfig`                                                                                                                                                                                                                                                                  | `false`   |
| mark / code / keyboard               | Inline decoration wrappers.                                                                                     | `boolean`                                                                                                                                                                                                                                                                                    | `false`   |
| underline / delete / strong / italic | Inline text styles.                                                                                             | `boolean`                                                                                                                                                                                                                                                                                    | `false`   |
| icon / iconPlacement                 | Optional icon and its position.                                                                                 | `any / 'start' \| 'end'`                                                                                                                                                                                                                                                                     | `'start'` |
| onClick                              | Click callback. Calling `preventDefault` stops navigation.                                                      | `(event: MouseEvent) => void`                                                                                                                                                                                                                                                                | -         |
