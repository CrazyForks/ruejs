---
title: Chat bubble
desc: Chat bubbles are used to show one line of conversation and all its data, including the author image, author name, time, etc.
source: https://raw.githubusercontent.com/saadeghi/daisyui/refs/heads/master/packages/daisyui/src/components/chat.css
layout: components
classnames:
  component:
    - class: chat
      desc: Container for one line of conversation and its data
  part:
    - class: chat-image
      desc: Author image
    - class: chat-header
      desc: Text above the chat bubble
    - class: chat-footer
      desc: Text below the chat bubble
    - class: chat-bubble
      desc: Chat bubble
  placement:
    - class: chat-start
      desc: Aligns chat to start horizontally (required)
    - class: chat-end
      desc: Aligns chat to end horizontally (required)
  color:
    - class: chat-bubble-neutral
      desc: neutral color for chat-bubble
    - class: chat-bubble-primary
      desc: primary color for chat-bubble
    - class: chat-bubble-secondary
      desc: secondary color for chat-bubble
    - class: chat-bubble-accent
      desc: accent color for chat-bubble
    - class: chat-bubble-info
      desc: info color for chat-bubble
    - class: chat-bubble-success
      desc: success color for chat-bubble
    - class: chat-bubble-warning
      desc: warning color for chat-bubble
    - class: chat-bubble-error
      desc: error color for chat-bubble
---

<script>
  import Component from "$components/Component.svelte"
  import Translate from "$components/Translate.svelte"
</script>

> Rue enhancement: besides the static chat markup below, the Rue Chat component now also supports semantic props such as `message`, `author`, `timestamp`, `avatar`, `typing`, and `items`, while still rendering to the same `chat-*` class structure.

### ~chat-start and chat-end

<div class="w-full">
  <div class="chat chat-start">
    <div class="chat-bubble">It's over Anakin, <br/>I have the high ground.</div>
  </div>
  <div class="chat chat-end">
    <div class="chat-bubble">You underestimate my power!</div>
  </div>
</div>

```html
<div class="$$chat $$chat-start">
  <div class="$$chat-bubble">
    It's over Anakin,
    <br />
    I have the high ground.
  </div>
</div>
<div class="$$chat $$chat-end">
  <div class="$$chat-bubble">You underestimate my power!</div>
</div>
```

### ~Semantic message with typing

<div class="w-full">
  <div class="chat chat-start">
    <div class="chat-image avatar">
      <div class="w-10 rounded-full bg-neutral text-neutral-content grid place-items-center text-xs font-semibold">AI</div>
    </div>
    <div class="chat-header">
      Rue Agent
      <time class="text-xs opacity-50">09:28</time>
    </div>
    <div class="chat-bubble">Build finished, I am summarizing the result.</div>
    <div class="chat-footer opacity-50">Preview ready</div>
  </div>
  <div class="chat chat-start">
    <div class="chat-image avatar">
      <div class="w-10 rounded-full bg-info text-info-content grid place-items-center text-[11px] font-semibold">OPS</div>
    </div>
    <div class="chat-header">
      Deploy Agent
      <time class="text-xs opacity-50">Just now</time>
    </div>
    <div class="chat-bubble">
      <span class="inline-flex items-center gap-2">
        <span class="loading loading-dots loading-xs"></span>
        <span class="text-xs opacity-70">Streaming output</span>
      </span>
    </div>
    <div class="chat-footer opacity-50">Monitoring</div>
  </div>
</div>

```html
<div class="$$chat $$chat-start">
  <div class="$$chat-image $$avatar">
    <div class="w-10 rounded-full bg-neutral text-neutral-content grid place-items-center text-xs font-semibold">AI</div>
  </div>
  <div class="$$chat-header">
    Rue Agent
    <time class="text-xs opacity-50">09:28</time>
  </div>
  <div class="$$chat-bubble">Build finished, I am summarizing the result.</div>
  <div class="$$chat-footer opacity-50">Preview ready</div>
</div>
<div class="$$chat $$chat-start">
  <div class="$$chat-image $$avatar">
    <div class="w-10 rounded-full bg-info text-info-content grid place-items-center text-[11px] font-semibold">OPS</div>
  </div>
  <div class="$$chat-header">
    Deploy Agent
    <time class="text-xs opacity-50">Just now</time>
  </div>
  <div class="$$chat-bubble">
    <span class="inline-flex items-center gap-2">
      <span class="$$loading $$loading-dots $$loading-xs"></span>
      <span class="text-xs opacity-70">Streaming output</span>
    </span>
  </div>
  <div class="$$chat-footer opacity-50">Monitoring</div>
</div>
```

### ~Chat with image

<div class="w-full">
  <div class="chat chat-start">
    <div class="chat-image avatar">
      <div class="w-10 rounded-full">
        <img alt="Tailwind CSS chat bubble component" src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp" />
      </div>
    </div>
    <div class="chat-bubble">It was said that you would, destroy the Sith, not join them.</div>
  </div>
  <div class="chat chat-start">
    <div class="chat-image avatar">
      <div class="w-10 rounded-full">
        <img alt="Tailwind CSS chat bubble component" src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp" />
      </div>
    </div>
    <div class="chat-bubble">It was you who would bring balance to the Force</div>
  </div>
  <div class="chat chat-start">
    <div class="chat-image avatar">
      <div class="w-10 rounded-full">
        <img alt="Tailwind CSS chat bubble component" src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp" />
      </div>
    </div>
    <div class="chat-bubble">Not leave it in Darkness</div>
  </div>
</div>

```html
<div class="$$chat $$chat-start">
  <div class="$$chat-image $$avatar">
    <div class="w-10 rounded-full">
      <img
        alt="Tailwind CSS chat bubble component"
        src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp"
      />
    </div>
  </div>
  <div class="$$chat-bubble">It was said that you would, destroy the Sith, not join them.</div>
</div>
<div class="$$chat $$chat-start">
  <div class="$$chat-image $$avatar">
    <div class="w-10 rounded-full">
      <img
        alt="Tailwind CSS chat bubble component"
        src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp"
      />
    </div>
  </div>
  <div class="$$chat-bubble">It was you who would bring balance to the Force</div>
</div>
<div class="$$chat $$chat-start">
  <div class="$$chat-image $$avatar">
    <div class="w-10 rounded-full">
      <img
        alt="Tailwind CSS chat bubble component"
        src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp"
      />
    </div>
  </div>
  <div class="$$chat-bubble">Not leave it in Darkness</div>
</div>
```

### ~Chat with image, header and footer

<div class="w-full">
  <div class="chat chat-start">
    <div class="chat-image avatar">
      <div class="w-10 rounded-full">
        <img alt="Tailwind CSS chat bubble component" src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp" />
      </div>
    </div>
    <div class="chat-header">
      Obi-Wan Kenobi
      <time class="text-xs opacity-50">12:45</time>
    </div>
    <div class="chat-bubble">You were the Chosen One!</div>
    <div class="chat-footer opacity-50">
      Delivered
    </div>
  </div>
  <div class="chat chat-end">
    <div class="chat-image avatar">
      <div class="w-10 rounded-full">
        <img alt="Tailwind CSS chat bubble component" src="https://img.daisyui.com/images/profile/demo/anakeen@192.webp" />
      </div>
    </div>
    <div class="chat-header">
      Anakin
      <time class="text-xs opacity-50">12:46</time>
    </div>
    <div class="chat-bubble">I hate you!</div>
    <div class="chat-footer opacity-50">
      Seen at 12:46
    </div>
  </div>
</div>

```html
<div class="$$chat $$chat-start">
  <div class="$$chat-image $$avatar">
    <div class="w-10 rounded-full">
      <img
        alt="Tailwind CSS chat bubble component"
        src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp"
      />
    </div>
  </div>
  <div class="$$chat-header">
    Obi-Wan Kenobi
    <time class="text-xs opacity-50">12:45</time>
  </div>
  <div class="$$chat-bubble">You were the Chosen One!</div>
  <div class="$$chat-footer opacity-50">Delivered</div>
</div>
<div class="$$chat $$chat-end">
  <div class="$$chat-image $$avatar">
    <div class="w-10 rounded-full">
      <img
        alt="Tailwind CSS chat bubble component"
        src="https://img.daisyui.com/images/profile/demo/anakeen@192.webp"
      />
    </div>
  </div>
  <div class="$$chat-header">
    Anakin
    <time class="text-xs opacity-50">12:46</time>
  </div>
  <div class="$$chat-bubble">I hate you!</div>
  <div class="$$chat-footer opacity-50">Seen at 12:46</div>
</div>
```

### ~Chat with header and footer

<div class="w-full">
  <div class="chat chat-start">
    <div class="chat-header">
      Obi-Wan Kenobi
      <time class="text-xs opacity-50">2 hours ago</time>
    </div>
    <div class="chat-bubble">You were my brother, Anakin.</div>
    <div class="chat-footer opacity-50">
      Seen
    </div>
  </div>
  <div class="chat chat-start">
    <div class="chat-header">
      Obi-Wan Kenobi
      <time class="text-xs opacity-50">2 hour ago</time>
    </div>
    <div class="chat-bubble">I loved you.</div>
    <div class="chat-footer opacity-50">
      Delivered
    </div>
  </div>
</div>

```html
<div class="$$chat $$chat-start">
  <div class="$$chat-header">
    Obi-Wan Kenobi
    <time class="text-xs opacity-50">2 hours ago</time>
  </div>
  <div class="$$chat-bubble">You were the Chosen One!</div>
  <div class="$$chat-footer opacity-50">Seen</div>
</div>
<div class="$$chat $$chat-start">
  <div class="$$chat-header">
    Obi-Wan Kenobi
    <time class="text-xs opacity-50">2 hour ago</time>
  </div>
  <div class="$$chat-bubble">I loved you.</div>
  <div class="$$chat-footer opacity-50">Delivered</div>
</div>
```

### ~Chat Bubble with colors

<div class="w-full">
  <div class="chat chat-start">
    <div class="chat-bubble chat-bubble-primary">What kind of nonsense is this</div>
  </div>
  <div class="chat chat-start">
    <div class="chat-bubble chat-bubble-secondary">Put me on the Council and not make me a Master!??</div>
  </div>
  <div class="chat chat-start">
    <div class="chat-bubble chat-bubble-accent">That's never been done in the history of the Jedi.</div>
  </div>
  <div class="chat chat-start">
    <div class="chat-bubble chat-bubble-neutral">It's insulting!</div>
  </div>
  <div class="chat chat-end">
    <div class="chat-bubble chat-bubble-info">Calm down, Anakin.</div>
  </div>
  <div class="chat chat-end">
    <div class="chat-bubble chat-bubble-success">You have been given a great honor.</div>
  </div>
  <div class="chat chat-end">
    <div class="chat-bubble chat-bubble-warning">To be on the Council at your age.</div>
  </div>
  <div class="chat chat-end">
    <div class="chat-bubble chat-bubble-error">It's never happened before.</div>
  </div>
</div>

```html
<div class="$$chat $$chat-start">
  <div class="$$chat-bubble $$chat-bubble-primary">What kind of nonsense is this</div>
</div>
<div class="$$chat $$chat-start">
  <div class="$$chat-bubble $$chat-bubble-secondary">
    Put me on the Council and not make me a Master!??
  </div>
</div>
<div class="$$chat $$chat-start">
  <div class="$$chat-bubble $$chat-bubble-accent">
    That's never been done in the history of the Jedi.
  </div>
</div>
<div class="$$chat $$chat-start">
  <div class="$$chat-bubble $$chat-bubble-neutral">It's insulting!</div>
</div>
<div class="$$chat $$chat-end">
  <div class="$$chat-bubble $$chat-bubble-info">Calm down, Anakin.</div>
</div>
<div class="$$chat $$chat-end">
  <div class="$$chat-bubble $$chat-bubble-success">You have been given a great honor.</div>
</div>
<div class="$$chat $$chat-end">
  <div class="$$chat-bubble $$chat-bubble-warning">To be on the Council at your age.</div>
</div>
<div class="$$chat $$chat-end">
  <div class="$$chat-bubble $$chat-bubble-error">It's never happened before.</div>
</div>
```
