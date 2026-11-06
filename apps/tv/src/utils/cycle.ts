// The value after `current` in `list`, wrapping round to the first.
export const nextOf = <T>(list: readonly T[], current: T): T => list[(list.indexOf(current) + 1) % list.length]
