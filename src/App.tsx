import { clearMap } from '@/data/store'
import { AppShell } from '@/ui/AppShell'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { LoadScreen } from '@/ui/LoadScreen'
import { useMapLoader } from '@/ui/useMapLoader'
import { useWindowDrop } from '@/ui/useWindowDrop'

export default function App() {
  const loader = useMapLoader()
  useWindowDrop(loader)
  if (loader.booting) return <div className="p-4 text-sm text-muted-foreground">Loading...</div>
  if (!loader.map) return <LoadScreen loader={loader} />
  return (
    <ErrorBoundary
      key={loader.generation}
      onError={() => {
        clearMap().catch(() => {})
        loader.discardMap('The saved map could not be displayed and was cleared. Please load the file again.')
      }}
    >
      <AppShell map={loader.map} loader={loader} />
    </ErrorBoundary>
  )
}
