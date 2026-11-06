import CategoryPicker from './category-picker'

export default function BannerPage() {
  return (
    <CategoryPicker
      title="Home banner"
      description="Pick the categories its new movies and shows come from. Until you choose, it uses the first movie category and the first show category."
      setting="heroSelection"
      perKind={1}
    />
  )
}
