import { useCategorySelection } from './use-category-selection'

// The categories shown as rows on Home: the first two of movies and of shows until chosen in Settings.
export const useHomeLists = () => useCategorySelection('homeLists', 2)
