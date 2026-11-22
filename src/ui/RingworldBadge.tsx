import { Badge } from '@/ui/ui/badge'

/** "Ringworld" marker for a system (or an arc body) that is part of a ringworld (R5). */
export function RingworldBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-amber-400/60 bg-amber-400/10 text-amber-300 ${className ?? ''}`}
      title="This system contains a ringworld"
    >
      Ringworld
    </Badge>
  )
}
