import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/ui/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/ui/popover'
import { cn } from '@/lib/utils'

interface Props<T extends string | number> {
  label: string
  options: readonly T[]
  value: readonly T[]
  onChange: (v: T[]) => void
  searchable?: boolean
  format?: (v: T) => string
}

/** Multi-select dropdown (Popover + Command). Empty selection means "no restriction". */
export function MultiSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
  searchable = false,
  format = String,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const toggle = (o: T) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])
  const summary =
    value.length === 0 ? 'any' : value.length === 1 ? format(value[0]!) : `${value.length} selected`
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs" className="max-w-52 justify-between font-normal" aria-label={label}>
          <span className="text-muted-foreground">{label}</span>
          <span className={cn('truncate', value.length > 0 && 'text-primary')}>{summary}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />}
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={String(o)} value={format(o)} onSelect={() => toggle(o)}>
                  <Check className={cn('size-3', value.includes(o) ? 'opacity-100' : 'opacity-0')} />
                  {format(o)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {value.length > 0 && (
          <div className="border-t p-1">
            <Button variant="ghost" size="xs" className="w-full" onClick={() => onChange([])}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
