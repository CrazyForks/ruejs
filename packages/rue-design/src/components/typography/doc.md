---
title: Typography
desc: Typography provides semantic text building blocks such as Text, Link, Title and Paragraph for Rue Design.
layout: components
---

## Typography

```tsx
import { Typography } from '@rue-js/design'

<Typography>
  <Typography.Title level={3}>Build clearer docs</Typography.Title>
  <Typography.Paragraph>
    Use <Typography.Text strong>Text</Typography.Text> and{' '}
    <Typography.Link href="https://rue.dev" target="_blank">
      Link
    </Typography.Link>{' '}
    to express inline semantics.
  </Typography.Paragraph>
</Typography>
```

## Text styles

```tsx
<Typography.Text type="secondary">Secondary</Typography.Text>
<Typography.Text type="success" strong>
  Success
</Typography.Text>
<Typography.Text mark>Highlight</Typography.Text>
<Typography.Text code>pnpm dev</Typography.Text>
<Typography.Text keyboard>Esc</Typography.Text>
```

## API

### Typography.Text / Typography.Link

| Prop | Description | Type | Default |
| --- | --- | --- | --- |
| type | Semantic tone for inline content. | `'default' \| 'secondary' \| 'success' \| 'warning' \| 'danger'` | `'default'` |
| disabled | Adds disabled semantics and muted visual state. | `boolean` | `false` |
| mark / code / keyboard | Wrap content with highlight, code or keyboard styles. | `boolean` | `false` |
| underline / delete / strong / italic | Inline emphasis helpers. | `boolean` | `false` |
| as | Only for `Typography.Text`, controls rendered tag. | `'span' \| 'div' \| 'p'` | `'span'` |
| href / target / rel | Only for `Typography.Link`, native anchor attributes. | `string` | - |

### Typography.Title / Typography.Paragraph

| Prop | Description | Type | Default |
| --- | --- | --- | --- |
| level | Only for `Typography.Title`, maps to `h1` through `h5`. | `1 \| 2 \| 3 \| 4 \| 5` | `1` |
| type | Semantic tone for block content. | `'default' \| 'secondary' \| 'success' \| 'warning' \| 'danger'` | `'default'` |
| disabled | Adds disabled semantics and muted visual state. | `boolean` | `false` |
| mark / code / keyboard | Wrap content with highlight, code or keyboard styles. | `boolean` | `false` |
| underline / delete / strong / italic | Inline emphasis helpers. | `boolean` | `false` |
