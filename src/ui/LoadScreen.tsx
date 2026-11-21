import { useRef, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/ui/ui/button'
import { cn } from '@/lib/utils'
import type { MapLoader } from './useMapLoader'

export function LoadScreen({ loader }: { loader: MapLoader }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const f = e.dataTransfer.files[0]
    if (f && !loader.parsing) loader.loadFile(f)
  }
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={cn(
          'flex w-full max-w-xl flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center',
          over ? 'border-ring bg-accent/30' : 'border-border',
        )}
      >
        <h1 className="text-xl font-semibold text-primary">Prospector</h1>
        <p className="text-sm text-muted-foreground">
          Drop a Shores of Hazeron starmap export (.xml) here. It is parsed in your browser and never uploaded.
        </p>
        <input
          ref={input}
          type="file"
          accept=".xml,text/xml,application/xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) loader.loadFile(f)
            e.target.value = ''
          }}
        />
        <Button size="sm" disabled={loader.parsing} onClick={() => input.current?.click()}>
          <Upload /> Choose file
        </Button>
        {loader.parsing && (
          <div className="w-full" role="progressbar" aria-valuenow={Math.round(loader.progress * 100)}>
            <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${loader.progress * 100}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground tabular-nums">
              Parsing {Math.round(loader.progress * 100)}%
            </div>
          </div>
        )}
        {loader.error && (
          <p role="alert" className="text-sm text-destructive">
            {loader.error}
          </p>
        )}
      </div>
    </div>
  )
}
