import { AppShell } from '@/ui/AppShell'
import { LoadScreen } from '@/ui/LoadScreen'
import { useMapLoader } from '@/ui/useMapLoader'

export default function App() {
  const loader = useMapLoader()
  if (loader.booting) return <div className="p-4 text-sm text-muted-foreground">Loading...</div>
  if (!loader.map) return <LoadScreen loader={loader} />
  return <AppShell key={loader.generation} map={loader.map} loader={loader} />
}
