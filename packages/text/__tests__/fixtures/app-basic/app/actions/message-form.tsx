'use client'

import { useState } from '@rue-js/rue'
import { addMessage } from './actions'

function useTextTransition(): [boolean, (callback: () => void | Promise<void>) => void] {
  const [isPending, setIsPending] = useState(false)
  return [
    isPending,
    callback => {
      setIsPending(true)
      Promise.resolve()
        .then(callback)
        .finally(() => setIsPending(false))
    },
  ]
}

export function MessageForm() {
  const [result, setResult] = useState<string | null>(null)
  const [isPending, startTransition] = useTextTransition()

  function handleSubmit(e: Event & { currentTarget: HTMLFormElement }) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const response = await addMessage(formData)
      setResult(response)
    })
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="message"
          data-testid="message-input"
          placeholder="Type a message..."
          defaultValue=""
        />
        <button type="submit" data-testid="send-btn" disabled={isPending}>
          {isPending ? 'Sending...' : 'Send'}
        </button>
      </form>
      {result && <p data-testid="message-result">{result}</p>}
    </div>
  )
}
