'use server'

const likesByPhoto = new Map<string, number>()

export async function bumpPhotoLikes(id: string): Promise<number> {
  const text = (likesByPhoto.get(id) ?? 0) + 1
  likesByPhoto.set(id, text)
  return text
}

export async function getPhotoLikes(id: string): Promise<number> {
  return likesByPhoto.get(id) ?? 0
}
