import { useState } from 'react'
import { resourceInfo } from '@/data/catalog'
import type { Sphere } from '@/data/types'
import { cn } from '@/lib/utils'

/**
 * Game commodity icon (16px in tables, 32px in the picker and peek panel). Unknown names and
 * images that fail to load show a neutral placeholder of the same size, never a broken image.
 */
export function ResourceIcon({
  name,
  sphere,
  size = 16,
  className,
}: {
  name: string
  sphere?: Sphere
  size?: 16 | 32
  className?: string
}) {
  const icon = resourceInfo(name, sphere).icon
  // Remember which URL failed so a different resource reusing this component still tries to load.
  const [failed, setFailed] = useState<string>()
  const box = { width: size, height: size }
  if (!icon || failed === icon) {
    return (
      <span
        aria-hidden
        title={name}
        className={cn('inline-block shrink-0 rounded-[3px] border border-dashed border-muted-foreground/40 bg-muted/40 align-middle', className)}
        style={box}
      />
    )
  }
  return (
    <img
      src={icon}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(icon)}
      className={cn('inline-block shrink-0 align-middle', className)}
      style={{ ...box, imageRendering: 'pixelated' }}
    />
  )
}
