---
title: Breadcrumbs
desc: Breadcrumbs helps users to navigate through the website.
source: https://raw.githubusercontent.com/saadeghi/daisyui/refs/heads/master/packages/daisyui/src/components/breadcrumbs.css
layout: components
classnames:
  component:
    - class: breadcrumbs
      desc: Wrapper around a <ul>
---

<script>
  import Component from "$components/Component.svelte"
  import Translate from "$components/Translate.svelte"
</script>

> Rue enhancement: besides the static breadcrumb markup below, the component API also supports `items`, `routes`, `params`, `itemRender`, `menu`, and a breadcrumb-level `separator` while keeping the default Rue arrow separator look.

### ~Breadcrumbs

<div class="text-sm breadcrumbs">
  <ul>
    <li><a href="/home">Home</a></li>
    <li><a href="/docs">Documents</a></li>
    <li><span aria-current="page">Add Document</span></li>
  </ul>
</div>

```html
<div class="$$breadcrumbs text-sm">
  <ul>
    <li><a href="/home">Home</a></li>
    <li><a href="/docs">Documents</a></li>
    <li><span aria-current="page">Add Document</span></li>
  </ul>
</div>
```

### ~Breadcrumbs with icons

<div class="text-sm breadcrumbs">
  <ul>
    <li>
      <a href="/workspace">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10.5 12 3l9 7.5"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 9.5V20h14V9.5"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20v-6h4v6"></path></svg>
        Workspace
      </a>
    </li>
    <li>
      <a href="/workspace/assets">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h5l2 2h11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"></path></svg>
        Assets
      </a>
    </li>
    <li>
      <span aria-current="page">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 3v5h5"></path></svg>
        Hero Banner
      </span>
    </li>
  </ul>
</div>

```html
<div class="$$breadcrumbs text-sm">
  <ul>
    <li>
      <a href="/workspace">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="h-4 w-4 stroke-current"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 10.5 12 3l9 7.5"
          ></path>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 9.5V20h14V9.5"
          ></path>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 20v-6h4v6"
          ></path>
        </svg>
        Workspace
      </a>
    </li>
    <li>
      <a href="/workspace/assets">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="h-4 w-4 stroke-current"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 7h5l2 2h11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
          ></path>
        </svg>
        Assets
      </a>
    </li>
    <li>
      <span aria-current="page">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="h-4 w-4 stroke-current"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          ></path>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M14 3v5h5"
          ></path>
        </svg>
        Hero Banner
      </span>
    </li>
  </ul>
</div>
```

### ~Breadcrumbs with custom separator and quick menu

<div class="text-sm breadcrumbs [&amp;>ul>li+li]:before:hidden">
  <ul>
    <li><a href="/control">Control Center</a></li>
    <li>
      <span class="pointer-events-none inline-flex shrink-0 items-center justify-center ms-2 me-3 text-base-content/40">·</span>
      <a href="/content">Content</a>
      <div class="dropdown ms-1">
        <div tabindex="0" role="button" class="inline-flex items-center justify-center rounded-full text-base-content/60">v</div>
        <ul tabindex="-1" class="dropdown-content menu mt-2 min-w-40 rounded-box border border-base-300/60 bg-base-100 p-2 shadow-sm">
          <li><a href="/content">Overview</a></li>
          <li><button>Drafts</button></li>
          <li><button>Scheduled</button></li>
        </ul>
      </div>
    </li>
    <li>
      <span class="pointer-events-none inline-flex shrink-0 items-center justify-center ms-2 me-3 text-base-content/40">/</span>
      <span aria-current="page">Breadcrumbs</span>
    </li>
  </ul>
</div>

```html
<div class="$$breadcrumbs text-sm [&>ul>li+li]:before:hidden">
  <ul>
    <li><a href="/control">Control Center</a></li>
    <li>
      <span
        class="pointer-events-none inline-flex shrink-0 items-center justify-center ms-2 me-3 text-base-content/40"
        >·</span
      >
      <a href="/content">Content</a>
      <div class="dropdown ms-1">
        <div
          tabindex="0"
          role="button"
          class="inline-flex items-center justify-center rounded-full text-base-content/60"
        >
          v
        </div>
        <ul
          tabindex="-1"
          class="$$dropdown-content $$menu mt-2 min-w-40 rounded-box border border-base-300/60 bg-base-100 p-2 shadow-sm"
        >
          <li><a href="/content">Overview</a></li>
          <li><button>Drafts</button></li>
          <li><button>Scheduled</button></li>
        </ul>
      </div>
    </li>
    <li>
      <span
        class="pointer-events-none inline-flex shrink-0 items-center justify-center ms-2 me-3 text-base-content/40"
        >/</span
      >
      <span aria-current="page">Breadcrumbs</span>
    </li>
  </ul>
</div>
```

### ~Breadcrumbs with max-width

#### If you set max-width or the list gets larger than the container it will scroll

<div class="max-w-xs text-sm breadcrumbs">
  <ul>
    <li>Workspace / Growth / Launch / Sprint 03</li>
    <li>Assets / Homepage / Experiment</li>
    <li>Hero Banner / Copy Review</li>
  </ul>
</div>

```html
<div class="$$breadcrumbs max-w-xs text-sm">
  <ul>
    <li>Workspace / Growth / Launch / Sprint 03</li>
    <li>Assets / Homepage / Experiment</li>
    <li>Hero Banner / Copy Review</li>
  </ul>
</div>
```
