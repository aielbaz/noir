import { useMemo } from 'react'
import { useSettings, type Settings } from '../utils/settings'
import { useCategories } from './use-catalog'

export type SelectionSetting = { [K in keyof Settings]: Settings[K] extends string[] | null ? K : never }[keyof Settings]

// The categories a setting picks (`movie:<id>` / `series:<id>`): what was chosen in Settings, or until
// then the first `perKind` categories of movies and of shows. undefined while the categories load.
export function useCategorySelection(setting: SelectionSetting, perKind: number): string[] | undefined {
  const chosen = useSettings()[setting]
  const movies = useCategories('movie').data
  const series = useCategories('series').data
  return useMemo(() => {
    if (chosen) return chosen
    if (!movies || !series) return undefined
    return [
      ...movies.slice(0, perKind).map(c => `movie:${c.category_id}`),
      ...series.slice(0, perKind).map(c => `series:${c.category_id}`),
    ]
  }, [chosen, movies, series, perKind])
}
