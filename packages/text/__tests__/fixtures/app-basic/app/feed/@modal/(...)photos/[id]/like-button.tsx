'use client'

import { useState } from '@rue-js/rue'
import { bumpPhotoLikes } from './actions'

export function LikeButton({ id, initialLikes }: { id: string; initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes)

  return (
    <div>
      <span data-testid="photo-likes">{likes}</span>
      <button
        data-testid="photo-like-btn"
        type="button"
        onClick={async () => {
          const text = await bumpPhotoLikes(id)
          setLikes(text)
        }}
      >
        Like
      </button>
    </div>
  )
}
