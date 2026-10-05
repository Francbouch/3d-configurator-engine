export function findAnimationClip(animations = [], clipName = 'Open') {
  return animations.find(
    (clip) => clip.name.toLowerCase() === clipName.toLowerCase(),
  ) ?? null
}

export function hasOpenAnimation(animations = []) {
  return Boolean(findAnimationClip(animations, 'Open'))
}
