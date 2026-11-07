import { useSyncExternalStore } from 'react';

export const SIDEBAR_WIDTH = 248;
export const RAIL_WIDTH = 64;
export const TOPBAR_HEIGHT = 56;

interface SidebarState {
  collapsed: boolean;
  /** Explicit open/closed choice per group; absent means "open only while it holds the active page". */
  groups: Record<string, boolean>;
  /** Off-canvas drawer on small screens. Never persisted. */
  mobileOpen: boolean;
}

const STORAGE_KEY = 'vector:sidebar';

const readPersisted = (): Pick<SidebarState, 'collapsed' | 'groups'> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SidebarState>;
      return { collapsed: Boolean(parsed.collapsed), groups: parsed.groups && typeof parsed.groups === 'object' ? parsed.groups : {} };
    }
  } catch {
    // storage can be blocked or hold bad JSON; fall back to defaults
  }
  return { collapsed: false, groups: {} };
};

let state: SidebarState = { ...readPersisted(), mobileOpen: false };
const listeners = new Set<() => void>();

const commit = (next: SidebarState) => {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ collapsed: next.collapsed, groups: next.groups }));
  } catch {
    // ignore: the sidebar just will not remember its state
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const sidebarActions = {
  toggleCollapsed: () => commit({ ...state, collapsed: !state.collapsed }),
  setCollapsed: (collapsed: boolean) => commit({ ...state, collapsed }),
  setGroup: (name: string, open: boolean) => commit({ ...state, groups: { ...state.groups, [name]: open } }),
  openMobile: () => commit({ ...state, mobileOpen: true }),
  closeMobile: () => state.mobileOpen && commit({ ...state, mobileOpen: false }),
  toggleMobile: () => commit({ ...state, mobileOpen: !state.mobileOpen }),
};

export const useSidebar = (): SidebarState => useSyncExternalStore(subscribe, () => state, () => state);
