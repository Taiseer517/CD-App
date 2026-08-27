import { useEffect } from 'react'
import { AppRouter } from './router'
import { useCollectionStore } from './store/useCollectionStore'

function App() {
  const status = useCollectionStore((state) => state.status)
  const fetchAll = useCollectionStore((state) => state.fetchAll)

  useEffect(() => {
    if (status === 'idle') {
      fetchAll()
    }
  }, [status, fetchAll])

  return <AppRouter />
}

export default App
