'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';

interface UseMessageShortcutsOptions {
  enabled?: boolean;
  onOpenThread?: (messageId: string) => void;
  onEditMessage?: (messageId: string) => void;
  onAddReaction?: (messageId: string) => void;
}

/**
 * Hook for message-related keyboard shortcuts.
 *
 * Shortcuts:
 * - T: Open thread for selected message
 * - E: Edit selected message (only for own messages)
 * - R: Add reaction to selected message
 * - J/Down: Select next message
 * - K/Up: Select previous message
 * - Escape: Close thread panel / Deselect message
 */
export function useMessageShortcuts(options: UseMessageShortcutsOptions = {}) {
  const {
    enabled = true,
    onOpenThread,
    onEditMessage,
    onAddReaction,
  } = options;

  const user = useAuthStore((state) => state.user);
  const messages = useChatStore((state) => state.messages);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const selectedMessageId = useChatStore((state) => state.selectedMessageId);
  const activeThreadId = useChatStore((state) => state.activeThreadId);
  const selectMessage = useChatStore((state) => state.selectMessage);
  const selectNextMessage = useChatStore((state) => state.selectNextMessage);
  const selectPreviousMessage = useChatStore((state) => state.selectPreviousMessage);
  const openThread = useChatStore((state) => state.openThread);
  const closeThread = useChatStore((state) => state.closeThread);

  // Get the currently selected message
  const getSelectedMessage = useCallback(() => {
    if (!selectedMessageId) return null;
    return messages.find((m) => m.id === selectedMessageId) || null;
  }, [messages, selectedMessageId]);

  // Check if the current element is an input field
  const isInInputField = useCallback(() => {
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
  }, []);

  // Handle keyboard events
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts if in input field (except Escape)
      if (isInInputField() && event.key !== 'Escape') {
        return;
      }

      const selectedMessage = getSelectedMessage();

      switch (event.key.toLowerCase()) {
        // Thread: T key
        case 't':
          if (selectedMessage) {
            event.preventDefault();
            onOpenThread?.(selectedMessage.id);
            openThread(selectedMessage.id);
          }
          break;

        // Edit: E key (only for own messages)
        case 'e':
          if (selectedMessage && selectedMessage.senderId === user?.id) {
            event.preventDefault();
            onEditMessage?.(selectedMessage.id);
          }
          break;

        // Reaction: R key
        case 'r':
          if (selectedMessage) {
            event.preventDefault();
            onAddReaction?.(selectedMessage.id);
          }
          break;

        // Navigate down: J or ArrowDown
        case 'j':
        case 'arrowdown':
          if (!event.altKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            selectNextMessage();
          }
          break;

        // Navigate up: K or ArrowUp
        case 'k':
        case 'arrowup':
          if (!event.altKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            selectPreviousMessage();
          }
          break;

        // Escape: Close thread / Deselect
        case 'escape':
          event.preventDefault();
          if (activeThreadId) {
            closeThread();
          } else if (selectedMessageId) {
            selectMessage(null);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    isInInputField,
    getSelectedMessage,
    user?.id,
    activeThreadId,
    selectedMessageId,
    onOpenThread,
    onEditMessage,
    onAddReaction,
    selectNextMessage,
    selectPreviousMessage,
    selectMessage,
    openThread,
    closeThread,
  ]);

  // Scroll to selected message
  useEffect(() => {
    if (!selectedMessageId) return;

    const element = document.querySelector(`[data-message-id="${selectedMessageId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedMessageId]);

  return {
    selectedMessageId,
    selectMessage,
    selectNextMessage,
    selectPreviousMessage,
    getSelectedMessage,
  };
}

export default useMessageShortcuts;
