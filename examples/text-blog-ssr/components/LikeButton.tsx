'use client'

import { useState } from '@rue-js/rue'

export default function LikeButton({ initialLikes = 12 }: { initialLikes?: number }) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(initialLikes)

  function handleClick() {
    const nextLiked = !liked.value
    setLiked(nextLiked)
    setLikes(likes.value + (nextLiked ? 1 : -1))
  }

  return (
    <button
      className={`like-button${liked.value ? ' liked' : ''}`}
      type="button"
      onClick={handleClick}
    >
      {liked.value ? 'Liked' : 'Like'} · {likes.value}
    </button>
  )
}
