'use client'

import { useState } from '@rue-js/rue'
import { incrementLikes } from './actions'

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

export function LikeButton() {
  const [likes, setLikes] = useState(0)
  const [isPending, startTransition] = useTextTransition()

  function handleClick() {
    startTransition(async () => {
      const newCount = await incrementLikes()
      setLikes(newCount)
    })
  }

  return (
    <div>
      <p data-testid="likes">Likes: {likes}</p>
      <button data-testid="like-btn" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Liking...' : 'Like'}
      </button>
    </div>
  )
}
