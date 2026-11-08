import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCreatePath, useResourceContext, useResourceDefinition, type ResourceProps } from 'react-admin';
import { useNavigate } from 'react-router-dom';
import { Layers, X } from 'lucide-react';
import { VxScope } from '../components/scope';
import { groupIcons, resourceIcons } from './navModel';

type Kind = 'edit' | 'create';
type Renderable = React.ComponentType | React.ReactElement;

const toElement = (value: Renderable): React.ReactElement =>
  React.isValidElement(value) ? value : React.createElement(value as React.ComponentType);

const humanize = (value: string): string => value.replace(/[_-]+/g, ' ').replace(/^./, (character) => character.toUpperCase());

/** Centered modal that hosts an edit / create form on top of the (dimmed) list. */
const Sheet: React.FC<
  React.PropsWithChildren<{ eyebrow: string; title: string; subtitle: string; icon: React.ElementType; onClose: () => void }>
> = ({
  eyebrow,
  subtitle,
  icon: Icon,
  title,
  onClose,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // let open menus / dialogs inside the form handle Escape first
      if ((event.target as HTMLElement | null)?.closest?.('.MuiPopover-root, .MuiDialog-root, [role="listbox"], [role="menu"]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <VxScope className='fixed inset-0 z-[1300] flex items-center justify-center p-4 sm:p-8'>
      <div className='absolute inset-0 animate-fade-in bg-[color-mix(in_oklab,var(--background)_68%,transparent)] backdrop-blur-[3px]' onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-label={title}
        tabIndex={-1}
        className='vx-sheet relative flex max-h-full w-[min(880px,100%)] animate-pop-in flex-col border border-border bg-card text-card-foreground shadow-[0_32px_80px_-24px_rgba(0,0,0,0.55)] outline-none'
      >
        <header className='flex shrink-0 items-center gap-4 border-b border-border px-7 py-5'>
          <span className='grid size-11 shrink-0 place-items-center border border-border bg-foreground/[0.04] text-accent'>
            <Icon className='size-5' strokeWidth={1.6} aria-hidden />
          </span>
          <div className='min-w-0 flex-1'>
            <p className='font-mono text-[10.5px] font-medium tracking-[0.12em] text-muted-foreground uppercase'>{eyebrow}</p>
            <h2 className='mt-1 truncate text-lg leading-tight font-semibold tracking-tight'>{title}</h2>
            <p className='mt-0.5 truncate text-[13px] text-muted-foreground'>{subtitle}</p>
          </div>
          <kbd className='hidden border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block'>ESC</kbd>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close'
            className='grid size-9 shrink-0 place-items-center text-muted-foreground transition-colors outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:bg-foreground/[0.06]'
          >
            <X className='size-4' aria-hidden />
          </button>
        </header>
        <div className='min-h-0 flex-1 overflow-y-auto px-7 pt-6 pb-0'>{children}</div>
      </div>
    </VxScope>,
    document.body,
  );
};

const SheetRoute: React.FC<{ kind: Kind; list: Renderable; form: Renderable }> = ({ kind, list, form }) => {
  const resource = useResourceContext() ?? '';
  const definition = useResourceDefinition({ resource });
  const createPath = useCreatePath();
  const navigate = useNavigate();

  const close = React.useCallback(() => {
    // go back when we arrived from the list (keeps its filters), otherwise open the list
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate(createPath({ resource, type: 'list' }));
  }, [navigate, createPath, resource]);

  const label = String(definition.options?.label ?? humanize(resource));
  const singular = label.replace(/s$/i, '').toLowerCase();

  return (
    <>
      <div inert aria-hidden className='pointer-events-none select-none'>
        {toElement(list)}
      </div>
      <Sheet
        eyebrow={label}
        title={kind === 'create' ? `New ${singular}` : `Edit ${singular}`}
        subtitle={kind === 'create' ? `Fill in the details to add a ${singular}.` : 'Changes apply as soon as you save.'}
        icon={resourceIcons[resource] ?? groupIcons[String(definition.options?.menuParent)] ?? Layers}
        onClose={close}
      >
        {toElement(form)}
      </Sheet>
    </>
  );
};

const cache = new WeakMap<object, ResourceProps>();

/** Makes a resource's edit and create screens open as a centered modal above its list. */
export const withSheets = <T extends Partial<ResourceProps>>(definition: T): T => {
  const cached = cache.get(definition);
  if (cached) return cached as T;

  const { list, edit, create } = definition;
  if (!list || (!edit && !create)) return definition;

  const make = (form: Renderable, kind: Kind): React.FC => {
    const Wrapped: React.FC = () => <SheetRoute kind={kind} list={list as Renderable} form={form} />;
    Wrapped.displayName = `Sheet(${kind})`;
    return Wrapped;
  };

  const wrapped = {
    ...definition,
    edit: edit ? make(edit as Renderable, 'edit') : edit,
    create: create ? make(create as Renderable, 'create') : create,
  } as T;
  cache.set(definition, wrapped as ResourceProps);
  return wrapped;
};
