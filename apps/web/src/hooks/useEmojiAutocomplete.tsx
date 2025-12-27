'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getAutocompleteSuggestions, type EmojiData } from '@/lib/emoji';

interface AutocompleteState {
  isActive: boolean;
  suggestions: EmojiData[];
  selectedIndex: number;
  query: string;
  startIndex: number;
}

interface UseEmojiAutocompleteOptions {
  enabled?: boolean;
  maxSuggestions?: number;
}

export function useEmojiAutocomplete(options: UseEmojiAutocompleteOptions = {}) {
  const { enabled = true, maxSuggestions = 8 } = options;

  const [state, setState] = useState<AutocompleteState>({
    isActive: false,
    suggestions: [],
    selectedIndex: 0,
    query: '',
    startIndex: -1,
  });

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  /**
   * Update suggestions based on current input state.
   */
  const updateSuggestions = useCallback(
    (text: string, cursorPosition: number) => {
      if (!enabled) return;

      const result = getAutocompleteSuggestions(text, cursorPosition, maxSuggestions);

      if (result && result.suggestions.length > 0) {
        setState({
          isActive: true,
          suggestions: result.suggestions,
          selectedIndex: 0,
          query: result.query,
          startIndex: result.startIndex,
        });
      } else {
        setState({
          isActive: false,
          suggestions: [],
          selectedIndex: 0,
          query: '',
          startIndex: -1,
        });
      }
    },
    [enabled, maxSuggestions]
  );

  /**
   * Handle text input changes.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value, selectionStart } = e.target;
      updateSuggestions(value, selectionStart ?? value.length);
    },
    [updateSuggestions]
  );

  /**
   * Handle keyboard navigation in suggestions.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!state.isActive) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex + 1) % prev.suggestions.length,
          }));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex:
              prev.selectedIndex === 0
                ? prev.suggestions.length - 1
                : prev.selectedIndex - 1,
          }));
          break;

        case 'Enter':
        case 'Tab':
          if (state.suggestions.length > 0) {
            e.preventDefault();
            selectEmoji(state.suggestions[state.selectedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [state.isActive, state.suggestions, state.selectedIndex]
  );

  /**
   * Select an emoji and insert it into the input.
   */
  const selectEmoji = useCallback(
    (emoji: EmojiData) => {
      const input = inputRef.current;
      if (!input) return;

      const text = input.value;
      const beforeShortcode = text.slice(0, state.startIndex);
      const afterCursor = text.slice(input.selectionStart ?? text.length);

      const newText = beforeShortcode + emoji.emoji + afterCursor;
      const newCursorPosition = beforeShortcode.length + emoji.emoji.length;

      // Update input value
      input.value = newText;

      // Trigger input event for React state updates
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, newText);
      }

      const inputEvent = new Event('input', { bubbles: true });
      input.dispatchEvent(inputEvent);

      // Set cursor position
      input.setSelectionRange(newCursorPosition, newCursorPosition);
      input.focus();

      // Close suggestions
      close();
    },
    [state.startIndex]
  );

  /**
   * Close the autocomplete dropdown.
   */
  const close = useCallback(() => {
    setState({
      isActive: false,
      suggestions: [],
      selectedIndex: 0,
      query: '',
      startIndex: -1,
    });
  }, []);

  /**
   * Set the input ref for manipulation.
   */
  const setInputRef = useCallback((ref: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRef.current = ref;
  }, []);

  return {
    isActive: state.isActive,
    suggestions: state.suggestions,
    selectedIndex: state.selectedIndex,
    query: state.query,
    handleInputChange,
    handleKeyDown,
    selectEmoji,
    close,
    setInputRef,
  };
}

/**
 * Autocomplete dropdown component.
 */
interface EmojiAutocompleteDropdownProps {
  suggestions: EmojiData[];
  selectedIndex: number;
  onSelect: (emoji: EmojiData) => void;
  className?: string;
}

export function EmojiAutocompleteDropdown({
  suggestions,
  selectedIndex,
  onSelect,
  className = '',
}: EmojiAutocompleteDropdownProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={`absolute bottom-full left-0 mb-2 w-72 bg-zinc-900 border border-zinc-800
                  rounded-lg shadow-xl overflow-hidden ${className}`}
    >
      {suggestions.map((emoji, idx) => (
        <button
          key={`${emoji.emoji}-${idx}`}
          onClick={() => onSelect(emoji)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-800
                     transition-colors ${idx === selectedIndex ? 'bg-zinc-800' : ''}`}
        >
          <span className="text-xl">{emoji.emoji}</span>
          <span className="text-sm text-zinc-300">{emoji.name}</span>
          <span className="text-xs text-zinc-500 ml-auto">:{emoji.shortcodes[0]}:</span>
        </button>
      ))}
    </div>
  );
}

export default useEmojiAutocomplete;
