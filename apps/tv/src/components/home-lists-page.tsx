import CategoryPicker from './category-picker'

export default function HomeListsPage() {
  return (
    <CategoryPicker
      title="Home lists"
      description="Pick the categories shown as rows on Home. Until you choose, it shows the first two movie categories and the first two show categories."
      setting="homeLists"
      perKind={2}
    />
  )
}
