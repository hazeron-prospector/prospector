import { useRef, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/ui/ui/button'
import { Checkbox } from '@/ui/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/ui/select'
import { cn } from '@/lib/utils'
import type { MapLoader } from './useMapLoader'

type Mode = 'add' | 'replace'

/** Modal behind "Load another file": add to / replace the current map (BLUEPRINT M1, M2). */
export function LoadDialog({
  open,
  onOpenChange,
  loader,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  loader: MapLoader
}) {
  const [mode, setMode] = useState<Mode>('add')
  const [mergeLists, setMergeLists] = useState(true)
  const [picked, setPicked] = useState<File>()
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // A window-level drop offers a file; adopt each new offer once (state adjusted during render).
  const [seen, setSeen] = useState(0)
  const offered = loader.offered
  if (offered && offered.id !== seen) {
    setSeen(offered.id)
    setPicked(offered.file)
  }
  const file = picked

  const change = (v: boolean) => {
    if (!v) {
      setPicked(undefined)
      loader.clearOffered()
    }
    onOpenChange(v)
  }
  const submit = () => {
    if (!file || loader.parsing) return
    loader.loadFile(file, { mode, mergeLists: mode === 'add' && mergeLists })
    change(false)
  }
  const dropZone = (e: DragEvent) => {
    // The window-level handler (useWindowDrop) offers the file; this only resets the highlight.
    e.preventDefault()
    setOver(false)
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Load another file</DialogTitle>
          <DialogDescription>Parsed in your browser; nothing is uploaded.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger size="sm" className="w-full" aria-label="Load mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Add to existing starmap</SelectItem>
              <SelectItem value="replace">Replace starmap</SelectItem>
            </SelectContent>
          </Select>
          <label className={cn('flex items-center gap-2 text-sm', mode === 'replace' && 'opacity-50')}>
            <Checkbox
              checked={mode === 'add' && mergeLists}
              disabled={mode === 'replace'}
              onCheckedChange={(v) => setMergeLists(v === true)}
            />
            Merge cities, spacecraft and wormholes
          </label>
          <p className="text-xs text-muted-foreground">
            Merging lets several empires combine their exports, or stitches partial exports into one map. Systems
            not in the new file are kept. A system in the new file replaces the stored one only when its status is
            at least as advanced (Unexplored &lt; Explored &lt; Surveyed), and on equal status only when the new
            export is newer. Merges cannot be undone; use Replace to start over.
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={dropZone}
            className={cn(
              'flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-4 text-center text-sm',
              over ? 'border-ring bg-accent/30' : 'border-border',
            )}
          >
            <input
              ref={input}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setPicked(f)
                e.target.value = ''
              }}
            />
            <span className={file ? 'font-medium' : 'text-muted-foreground'}>
              {file ? file.name : 'Drop a starmap export (.xml) here'}
            </span>
            <Button variant="outline" size="xs" onClick={() => input.current?.click()}>
              <Upload /> Choose file
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => change(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!file || loader.parsing} onClick={submit}>
            {mode === 'add' ? 'Add file' : 'Replace starmap'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
