'use client'

import { useState } from '@rue-js/rue'

export default function LikeButton({ initialLikes = 12 }: { initialLikes?: number }) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(initialLikes)

  function handleClick() {
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikes(value => value + (nextLiked ? 1 : -1))
  }

  return (
    <button className={`like-button${liked ? ' liked' : ''}`} type="button" onClick={handleClick}>
      {liked ? 'Liked' : 'Like'} · {likes}
    </button>
  )
}
