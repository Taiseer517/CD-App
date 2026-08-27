import { useNavigate, useParams } from 'react-router-dom'
import { ItemForm } from '../components/admin/ItemForm'
import { PageTransition } from '../components/layout/PageTransition'
import { toCollectionItemInput, type CollectionItemInput } from '../data/schema'
import { useCollectionStore } from '../store/useCollectionStore'

export function AdminItemFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const items = useCollectionStore((state) => state.items)
  const addItem = useCollectionStore((state) => state.addItem)
  const updateItem = useCollectionStore((state) => state.updateItem)

  const existing = id ? items.find((item) => item.id === id) : undefined
  const isEditing = Boolean(id)

  if (isEditing && !existing) {
    return (
      <PageTransition>
        <p className="text-bone-400">Item not found.</p>
      </PageTransition>
    )
  }

  async function handleSubmit(input: CollectionItemInput) {
    if (existing) {
      await updateItem(existing.id, input)
      navigate(`/item/${existing.id}`)
    } else {
      const created = await addItem(input)
      navigate(`/item/${created.id}`)
    }
  }

  async function handleSaveAndAddAnother(input: CollectionItemInput) {
    await addItem(input)
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl space-y-6">
        <h2 className="font-display text-2xl text-bone-100">
          {existing ? `Edit "${existing.title}"` : 'Add a new item'}
        </h2>
        <ItemForm
          initialValues={existing ? toCollectionItemInput(existing) : undefined}
          submitLabel={existing ? 'Save changes' : 'Add item'}
          onSubmit={handleSubmit}
          onSaveAndAddAnother={existing ? undefined : handleSaveAndAddAnother}
        />
      </div>
    </PageTransition>
  )
}
