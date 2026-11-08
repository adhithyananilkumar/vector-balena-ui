import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { VxScope } from './scope';

export interface RichOption {
  value: string;
  label: string;
  /** Secondary line (a slug, a hint). */
  detail?: string;
  icon?: React.ReactNode;
}

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: RichOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
}

/**
 * A listbox with icons, a second line and type-to-filter, for choices where a plain <select> cannot show a logo
 * (device types, fleets). Keyboard: arrows move, Enter picks, Escape closes, typing filters.
 */
export const RichSelect: React.FC<Props> = ({ id, value, onChange, options, placeholder = 'Choose…', disabled, searchable = true, className }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const search = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  const selected = options.find((option) => option.value === value);
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(needle));
  }, [options, query]);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const openPanel = () => {
    if (disabled) return;
    setRect(trigger.current?.getBoundingClientRect() ?? null);
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  React.useEffect(() => {
    if (!open) return undefined;
    search.current?.focus();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    const onViewport = (event: Event) => {
      if (panel.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [open, close]);

  // keep the highlighted row in view
  React.useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (option: RichOption | undefined) => {
    if (!option) return;
    onChange(option.value);
    close();
    trigger.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(filtered.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(filtered[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      trigger.current?.focus();
    }
  };

  const below = rect ? window.innerHeight - rect.bottom : 0;
  const flip = rect ? below < 280 && rect.top > below : false;

  return (
    <div className={cn('relative', className)}>
      <button
        ref={trigger}
        id={id}
        type='button'
        role='combobox'
        aria-expanded={open}
        aria-haspopup='listbox'
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            openPanel();
          }
        }}
        className='flex h-11 w-full items-center gap-3 border border-input bg-card px-3 text-left text-sm text-foreground transition-colors outline-none hover:border-foreground/30 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50'
      >
        {selected ? (
          <>
            {selected.icon}
            <span className='min-w-0 flex-1 truncate'>{selected.label}</span>
          </>
        ) : (
          <span className='flex-1 truncate text-muted-foreground'>{placeholder}</span>
        )}
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open &&
        rect &&
        createPortal(
          <VxScope
            ref={panel}
            onKeyDown={onKeyDown}
            style={{
              position: 'fixed',
              left: rect.left,
              width: rect.width,
              zIndex: 1500,
              ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            }}
            className='flex max-h-[min(360px,50vh)] animate-pop-in flex-col border border-border bg-card text-card-foreground shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]'
          >
            {searchable && (
              <div className='flex shrink-0 items-center gap-2 border-b border-border px-3'>
                <Search className='size-4 shrink-0 text-muted-foreground' aria-hidden />
                <input
                  ref={search}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  placeholder='Search…'
                  aria-label='Search options'
                  aria-controls={listId}
                  className='h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70'
                />
              </div>
            )}
            <ul id={listId} role='listbox' className='min-h-0 flex-1 overflow-y-auto py-1'>
              {filtered.length === 0 && <li className='px-3 py-6 text-center text-sm text-muted-foreground'>Nothing matches “{query}”.</li>}
              {filtered.map((option, index) => (
                <li
                  key={option.value}
                  role='option'
                  aria-selected={option.value === value}
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(option)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
                    index === active && 'bg-foreground/[0.06]',
                  )}
                >
                  {option.icon}
                  <span className='flex min-w-0 flex-1 flex-col leading-tight'>
                    <span className='truncate'>{option.label}</span>
                    {option.detail && <span className='truncate font-mono text-[11px] text-muted-foreground'>{option.detail}</span>}
                  </span>
                  {option.value === value && <Check className='size-4 shrink-0 text-accent' aria-hidden />}
                </li>
              ))}
            </ul>
          </VxScope>,
          document.body,
        )}
    </div>
  );
};
