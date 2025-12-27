'use client';

import { useEffect, useCallback, useRef } from 'react';

/**
 * Keyboard shortcut definition.
 */
export interface Shortcut {
  id: string;
  keys: string;
  description: string;
  category: ShortcutCategory;
  handler: () => void;
  allowInInput?: boolean;
  enabled?: boolean;
}

export type ShortcutCategory =
  | 'navigation'
  | 'messaging'
  | 'modals'
  | 'editing'
  | 'general';

function parseKeys(keys: string): {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
} {
  const parts = keys.toLowerCase().split('+');
  const key = parts[parts.length - 1];

  return {
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
    key: key === 'arrowup' ? 'ArrowUp' :
         key === 'arrowdown' ? 'ArrowDown' :
         key === 'arrowleft' ? 'ArrowLeft' :
         key === 'arrowright' ? 'ArrowRight' :
         key === 'escape' || key === 'esc' ? 'Escape' :
         key === 'enter' ? 'Enter' :
         key === 'space' ? ' ' :
         key === 'tab' ? 'Tab' :
         key === 'backspace' ? 'Backspace' :
         key === 'delete' ? 'Delete' :
         key,
  };
}

function matchesShortcut(event: KeyboardEvent, keys: string): boolean {
  const parsed = parseKeys(keys);
  const eventKey = event.key.toLowerCase();
  const parsedKey = parsed.key.toLowerCase();

  if (parsedKey === '/' && eventKey === '/') {
    return (
      event.ctrlKey === parsed.ctrl &&
      event.shiftKey === parsed.shift &&
      event.altKey === parsed.alt &&
      event.metaKey === parsed.meta
    );
  }

  return (
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.metaKey === parsed.meta &&
    eventKey === parsedKey
  );
}

function isInInputField(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    isContentEditable
  );
}

export function formatShortcut(keys: string): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');

  return keys
    .split('+')
    .map(part => {
      const lower = part.toLowerCase();
      switch (lower) {
        case 'ctrl':
        case 'control':
          return isMac ? '\u2303' : 'Ctrl';
        case 'shift':
          return isMac ? '\u21E7' : 'Shift';
        case 'alt':
        case 'option':
          return isMac ? '\u2325' : 'Alt';
        case 'meta':
        case 'cmd':
        case 'command':
          return isMac ? '\u2318' : 'Win';
        case 'enter':
          return isMac ? '\u21A9' : 'Enter';
        case 'escape':
        case 'esc':
          return 'Esc';
        case 'arrowup':
          return '\u2191';
        case 'arrowdown':
          return '\u2193';
        case 'arrowleft':
          return '\u2190';
        case 'arrowright':
          return '\u2192';
        case 'backspace':
          return isMac ? '\u232B' : 'Backspace';
        case 'delete':
          return isMac ? '\u2326' : 'Delete';
        case 'tab':
          return isMac ? '\u21E5' : 'Tab';
        case 'space':
          return 'Space';
        default:
          return part.toUpperCase();
      }
    })
    .join(isMac ? '' : ' + ');
}

export function getCategoryName(category: ShortcutCategory): string {
  switch (category) {
    case 'navigation':
      return 'Navigation';
    case 'messaging':
      return 'Messaging';
    case 'modals':
      return 'Windows & Modals';
    case 'editing':
      return 'Editing';
    case 'general':
      return 'General';
    default:
      return category;
  }
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true } = options;
  const shortcutsRef = useRef<Map<string, Shortcut>>(new Map());

  const registerShortcut = useCallback((shortcut: Shortcut) => {
    shortcutsRef.current.set(shortcut.id, {
      ...shortcut,
      enabled: shortcut.enabled ?? true,
    });
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    shortcutsRef.current.delete(id);
  }, []);

  const setShortcutEnabled = useCallback((id: string, enabled: boolean) => {
    const shortcut = shortcutsRef.current.get(id);
    if (shortcut) {
      shortcutsRef.current.set(id, { ...shortcut, enabled });
    }
  }, []);

  const getShortcuts = useCallback((): Shortcut[] => {
    return Array.from(shortcutsRef.current.values());
  }, []);

  const getShortcutsByCategory = useCallback((): Map<ShortcutCategory, Shortcut[]> => {
    const grouped = new Map<ShortcutCategory, Shortcut[]>();

    for (const shortcut of shortcutsRef.current.values()) {
      const existing = grouped.get(shortcut.category) || [];
      grouped.set(shortcut.category, [...existing, shortcut]);
    }

    return grouped;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const inInput = isInInputField();

      for (const shortcut of shortcutsRef.current.values()) {
        if (!shortcut.enabled) continue;
        if (inInput && !shortcut.allowInInput) continue;

        if (matchesShortcut(event, shortcut.keys)) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled]);

  return {
    registerShortcut,
    unregisterShortcut,
    setShortcutEnabled,
    getShortcuts,
    getShortcutsByCategory,
  };
}

export const DEFAULT_SHORTCUTS: Omit<Shortcut, 'handler'>[] = [
  { id: 'command-palette', keys: 'ctrl+k', description: 'Open command palette', category: 'navigation', allowInInput: true },
  { id: 'new-conversation', keys: 'ctrl+n', description: 'Start new conversation', category: 'navigation', allowInInput: false },
  { id: 'next-conversation', keys: 'alt+arrowdown', description: 'Next conversation', category: 'navigation', allowInInput: false },
  { id: 'prev-conversation', keys: 'alt+arrowup', description: 'Previous conversation', category: 'navigation', allowInInput: false },
  { id: 'send-message', keys: 'ctrl+enter', description: 'Send message', category: 'messaging', allowInInput: true },
  { id: 'edit-last', keys: 'ctrl+arrowup', description: 'Edit last sent message', category: 'messaging', allowInInput: true },
  { id: 'mute-conversation', keys: 'ctrl+shift+m', description: 'Mute/unmute conversation', category: 'messaging', allowInInput: false },
  { id: 'emoji-picker', keys: 'ctrl+shift+e', description: 'Toggle emoji picker', category: 'messaging', allowInInput: true },
  { id: 'shortcuts-modal', keys: 'ctrl+/', description: 'Show keyboard shortcuts', category: 'modals', allowInInput: true },
  { id: 'close-modal', keys: 'escape', description: 'Close modal / Cancel', category: 'modals', allowInInput: true },
  { id: 'focus-input', keys: 'ctrl+i', description: 'Focus message input', category: 'general', allowInInput: false },
  { id: 'toggle-sidebar', keys: 'ctrl+b', description: 'Toggle sidebar', category: 'general', allowInInput: false },
  { id: 'search', keys: 'ctrl+f', description: 'Search messages', category: 'general', allowInInput: false },
];

export default useKeyboardShortcuts;
