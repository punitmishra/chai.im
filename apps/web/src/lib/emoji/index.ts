'use client';

import { emojiCategories, shortcodeToEmoji, allEmojis, type EmojiData } from './emojiData';

/**
 * Search emojis by name, shortcode, or keywords.
 */
export function searchEmojis(query: string, limit = 50): EmojiData[] {
  if (!query || query.length < 2) return [];

  const lowerQuery = query.toLowerCase().replace(/^:/, '').replace(/:$/, '');
  const results: Array<{ emoji: EmojiData; score: number }> = [];

  for (const emoji of allEmojis) {
    let score = 0;

    // Exact shortcode match (highest priority)
    if (emoji.shortcodes.some((sc) => sc === lowerQuery)) {
      score = 100;
    }
    // Shortcode starts with query
    else if (emoji.shortcodes.some((sc) => sc.startsWith(lowerQuery))) {
      score = 80;
    }
    // Shortcode contains query
    else if (emoji.shortcodes.some((sc) => sc.includes(lowerQuery))) {
      score = 60;
    }
    // Name starts with query
    else if (emoji.name.toLowerCase().startsWith(lowerQuery)) {
      score = 50;
    }
    // Name contains query
    else if (emoji.name.toLowerCase().includes(lowerQuery)) {
      score = 40;
    }
    // Keyword match
    else if (emoji.keywords.some((kw) => kw.includes(lowerQuery))) {
      score = 30;
    }

    if (score > 0) {
      results.push({ emoji, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.emoji);
}

/**
 * Parse text and replace :shortcodes: with emoji characters.
 */
export function parseShortcodes(text: string): string {
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match, shortcode) => {
    const emoji = shortcodeToEmoji.get(shortcode.toLowerCase());
    return emoji || match;
  });
}

/**
 * Get autocomplete suggestions for a partial shortcode.
 * Returns suggestions when user types `:par` -> suggests `:party:`, `:parrot:`, etc.
 */
export function getAutocompleteSuggestions(
  text: string,
  cursorPosition: number,
  limit = 8
): { suggestions: EmojiData[]; startIndex: number; query: string } | null {
  // Find the start of the shortcode (look for : before cursor)
  let startIndex = -1;
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const char = text[i];
    if (char === ':') {
      startIndex = i;
      break;
    }
    // Stop if we hit whitespace or another special char
    if (/[\s\n\r]/.test(char)) {
      break;
    }
  }

  if (startIndex === -1) return null;

  const query = text.slice(startIndex + 1, cursorPosition);

  // Need at least 2 chars to show suggestions
  if (query.length < 2) return null;

  const suggestions = searchEmojis(query, limit);

  if (suggestions.length === 0) return null;

  return { suggestions, startIndex, query };
}

/**
 * Get emoji by shortcode.
 */
export function getEmojiByShortcode(shortcode: string): string | null {
  return shortcodeToEmoji.get(shortcode.toLowerCase()) || null;
}

/**
 * Get all emojis in a category.
 */
export function getEmojisByCategory(categoryId: string): EmojiData[] {
  const category = emojiCategories.find((c) => c.id === categoryId);
  return category?.emojis || [];
}

/**
 * Get recently used emojis from localStorage.
 */
export function getRecentEmojis(limit = 24): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem('chai:recent-emojis');
    if (!stored) return [];
    const recent = JSON.parse(stored) as string[];
    return recent.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Add an emoji to recently used.
 */
export function addRecentEmoji(emoji: string): void {
  if (typeof window === 'undefined') return;

  try {
    const recent = getRecentEmojis(50);
    const filtered = recent.filter((e) => e !== emoji);
    const updated = [emoji, ...filtered].slice(0, 50);
    localStorage.setItem('chai:recent-emojis', JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if a string is a single emoji.
 */
export function isSingleEmoji(str: string): boolean {
  // Remove variation selectors and zero-width joiners for counting
  const cleaned = str.replace(/[\uFE00-\uFE0F\u200D]/g, '');
  // Check if it's 1-2 code points (emoji can be 1 or 2 code points)
  const codePoints = [...cleaned];
  return codePoints.length >= 1 && codePoints.length <= 4;
}

/**
 * Get the skin tone modifier from an emoji.
 */
export function getSkinTone(emoji: string): string | null {
  const skinTones: Record<string, string> = {
    '\u{1F3FB}': 'light',
    '\u{1F3FC}': 'medium-light',
    '\u{1F3FD}': 'medium',
    '\u{1F3FE}': 'medium-dark',
    '\u{1F3FF}': 'dark',
  };

  for (const [modifier, tone] of Object.entries(skinTones)) {
    if (emoji.includes(modifier)) return tone;
  }
  return null;
}

/**
 * Apply a skin tone modifier to an emoji.
 */
export function applySkinTone(emoji: string, tone: string): string {
  const skinToneModifiers: Record<string, string> = {
    light: '\u{1F3FB}',
    'medium-light': '\u{1F3FC}',
    medium: '\u{1F3FD}',
    'medium-dark': '\u{1F3FE}',
    dark: '\u{1F3FF}',
  };

  const modifier = skinToneModifiers[tone];
  if (!modifier) return emoji;

  // Remove existing skin tone modifiers
  const base = emoji.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');

  // Find position to insert (after first code point)
  const codePoints = [...base];
  if (codePoints.length === 0) return emoji;

  return codePoints[0] + modifier + codePoints.slice(1).join('');
}

// Re-export everything from emojiData
export { emojiCategories, shortcodeToEmoji, allEmojis, quickReactions } from './emojiData';
export type { EmojiData, EmojiCategory } from './emojiData';
