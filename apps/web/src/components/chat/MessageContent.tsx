'use client';

import { useMemo, ReactNode } from 'react';
import { parseShortcodes } from '@/lib/emoji';

interface MessageContentProps {
  content: string;
  isSelf?: boolean;
  onMentionClick?: (username: string) => void;
  onLinkClick?: (url: string) => void;
}

// Common emoji shortcodes to emoji mappings
const EMOJI_MAP: Record<string, string> = {
  smile: '\u{1F604}',
  grin: '\u{1F601}',
  laugh: '\u{1F602}',
  joy: '\u{1F602}',
  wink: '\u{1F609}',
  blush: '\u{1F60A}',
  heart_eyes: '\u{1F60D}',
  kiss: '\u{1F618}',
  thinking: '\u{1F914}',
  thumbsup: '\u{1F44D}',
  thumbsdown: '\u{1F44E}',
  clap: '\u{1F44F}',
  fire: '\u{1F525}',
  heart: '\u{2764}\u{FE0F}',
  star: '\u{2B50}',
  rocket: '\u{1F680}',
  check: '\u{2705}',
  x: '\u{274C}',
  wave: '\u{1F44B}',
  pray: '\u{1F64F}',
  eyes: '\u{1F440}',
  sparkles: '\u{2728}',
  tada: '\u{1F389}',
  party_popper: '\u{1F389}',
  muscle: '\u{1F4AA}',
  skull: '\u{1F480}',
  sob: '\u{1F62D}',
  angry: '\u{1F620}',
  sunglasses: '\u{1F60E}',
  nerd: '\u{1F913}',
  thinking_face: '\u{1F914}',
  '+1': '\u{1F44D}',
  '-1': '\u{1F44E}',
  ok_hand: '\u{1F44C}',
  raised_hands: '\u{1F64C}',
  facepalm: '\u{1F926}',
  shrug: '\u{1F937}',
  coffee: '\u{2615}',
  tea: '\u{1F375}',
  beer: '\u{1F37A}',
  pizza: '\u{1F355}',
  hamburger: '\u{1F354}',
  cake: '\u{1F370}',
  ice_cream: '\u{1F368}',
  dog: '\u{1F436}',
  cat: '\u{1F431}',
  unicorn: '\u{1F984}',
  rainbow: '\u{1F308}',
  sun: '\u{2600}\u{FE0F}',
  moon: '\u{1F319}',
  cloud: '\u{2601}\u{FE0F}',
  lightning: '\u{26A1}',
  snow: '\u{2744}\u{FE0F}',
  bug: '\u{1F41B}',
  gear: '\u{2699}\u{FE0F}',
  lock: '\u{1F512}',
  key: '\u{1F511}',
  bulb: '\u{1F4A1}',
  memo: '\u{1F4DD}',
  book: '\u{1F4D6}',
  link: '\u{1F517}',
  pin: '\u{1F4CC}',
  bell: '\u{1F514}',
  trophy: '\u{1F3C6}',
  medal: '\u{1F3C5}',
  crown: '\u{1F451}',
  gem: '\u{1F48E}',
  money: '\u{1F4B0}',
  chart: '\u{1F4C8}',
};

interface ParsedNode {
  type: 'text' | 'bold' | 'italic' | 'code' | 'code_block' | 'link' | 'mention' | 'emoji';
  content: string;
  children?: ParsedNode[];
  url?: string;
  language?: string;
}

/**
 * Parse markdown-like content into a tree of nodes.
 */
function parseMarkdown(text: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Code block (```)
    const codeBlockMatch = remaining.match(/^```(\w*)\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      nodes.push({
        type: 'code_block',
        content: codeBlockMatch[2].trim(),
        language: codeBlockMatch[1] || undefined,
      });
      remaining = remaining.slice(codeBlockMatch[0].length);
      continue;
    }

    // Inline code (`)
    const inlineCodeMatch = remaining.match(/^`([^`]+)`/);
    if (inlineCodeMatch) {
      nodes.push({
        type: 'code',
        content: inlineCodeMatch[1],
      });
      remaining = remaining.slice(inlineCodeMatch[0].length);
      continue;
    }

    // Bold (**text** or __text__)
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      nodes.push({
        type: 'bold',
        content: boldMatch[2],
        children: parseMarkdown(boldMatch[2]),
      });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic (*text* or _text_) - but not ** or __ which is bold
    const italicMatch = remaining.match(/^(\*|_)(?!\1)(.+?)\1(?!\1)/);
    if (italicMatch) {
      nodes.push({
        type: 'italic',
        content: italicMatch[2],
        children: parseMarkdown(italicMatch[2]),
      });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      nodes.push({
        type: 'link',
        content: linkMatch[1],
        url: linkMatch[2],
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Auto-detect URLs
    const urlMatch = remaining.match(/^(https?:\/\/[^\s<>[\]]+)/);
    if (urlMatch) {
      nodes.push({
        type: 'link',
        content: urlMatch[1],
        url: urlMatch[1],
      });
      remaining = remaining.slice(urlMatch[0].length);
      continue;
    }

    // @mentions
    const mentionMatch = remaining.match(/^@(\w+)/);
    if (mentionMatch) {
      nodes.push({
        type: 'mention',
        content: mentionMatch[1],
      });
      remaining = remaining.slice(mentionMatch[0].length);
      continue;
    }

    // Emoji shortcodes (:smile:)
    const emojiMatch = remaining.match(/^:([a-zA-Z0-9_+-]+):/);
    if (emojiMatch) {
      const shortcode = emojiMatch[1].toLowerCase();
      const emoji = EMOJI_MAP[shortcode];
      if (emoji) {
        nodes.push({
          type: 'emoji',
          content: emoji,
        });
        remaining = remaining.slice(emojiMatch[0].length);
        continue;
      }
      // If not found in map, try the parseShortcodes function
      const parsed = parseShortcodes(emojiMatch[0]);
      if (parsed !== emojiMatch[0]) {
        nodes.push({
          type: 'emoji',
          content: parsed,
        });
        remaining = remaining.slice(emojiMatch[0].length);
        continue;
      }
    }

    // Plain text - consume until we hit a special character
    const plainMatch = remaining.match(/^[^*_`\[@:]+|^[\s\S]/);
    if (plainMatch) {
      // Merge with previous text node if possible
      const lastNode = nodes[nodes.length - 1];
      if (lastNode && lastNode.type === 'text') {
        lastNode.content += plainMatch[0];
      } else {
        nodes.push({
          type: 'text',
          content: plainMatch[0],
        });
      }
      remaining = remaining.slice(plainMatch[0].length);
      continue;
    }

    // Fallback: consume one character
    const lastNode = nodes[nodes.length - 1];
    if (lastNode && lastNode.type === 'text') {
      lastNode.content += remaining[0];
    } else {
      nodes.push({
        type: 'text',
        content: remaining[0],
      });
    }
    remaining = remaining.slice(1);
  }

  return nodes;
}

/**
 * Render parsed nodes to React elements.
 */
function renderNodes(
  nodes: ParsedNode[],
  isSelf: boolean,
  onMentionClick?: (username: string) => void,
  onLinkClick?: (url: string) => void
): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <span key={index}>{node.content}</span>;

      case 'bold':
        return (
          <strong key={index} className="font-semibold">
            {node.children
              ? renderNodes(node.children, isSelf, onMentionClick, onLinkClick)
              : node.content}
          </strong>
        );

      case 'italic':
        return (
          <em key={index} className="italic">
            {node.children
              ? renderNodes(node.children, isSelf, onMentionClick, onLinkClick)
              : node.content}
          </em>
        );

      case 'code':
        return (
          <code
            key={index}
            className={`px-1.5 py-0.5 rounded font-mono text-sm ${
              isSelf
                ? 'bg-amber-600/30 text-amber-100'
                : 'bg-zinc-700/70 text-green-400'
            }`}
          >
            {node.content}
          </code>
        );

      case 'code_block':
        return (
          <div key={index} className="overflow-x-auto rounded-xl bg-zinc-900/80 p-4 my-2">
            {node.language && (
              <div className="mb-2 text-xs text-zinc-500 font-mono">{node.language}</div>
            )}
            <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap break-all">
              <code>{node.content}</code>
            </pre>
          </div>
        );

      case 'link':
        return (
          <a
            key={index}
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (onLinkClick) {
                e.preventDefault();
                onLinkClick(node.url!);
              }
            }}
            className={`underline underline-offset-2 hover:no-underline transition-colors ${
              isSelf
                ? 'text-amber-100 hover:text-white'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            {node.content}
          </a>
        );

      case 'mention':
        return (
          <button
            key={index}
            onClick={() => onMentionClick?.(node.content)}
            className={`font-medium rounded px-1 transition-colors ${
              isSelf
                ? 'text-amber-100 bg-amber-600/30 hover:bg-amber-600/50'
                : 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30'
            }`}
          >
            @{node.content}
          </button>
        );

      case 'emoji':
        return (
          <span key={index} className="text-lg mx-0.5" role="img">
            {node.content}
          </span>
        );

      default:
        return <span key={index}>{node.content}</span>;
    }
  });
}

/**
 * MessageContent component that parses and renders markdown-like content.
 *
 * Supports:
 * - **bold** and __bold__
 * - *italic* and _italic_
 * - `inline code`
 * - ```code blocks```
 * - [links](url) and auto-detected URLs
 * - @mentions
 * - :emoji: shortcodes
 */
export function MessageContent({
  content,
  isSelf = false,
  onMentionClick,
  onLinkClick,
}: MessageContentProps) {
  const parsedNodes = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="whitespace-pre-wrap leading-relaxed break-words">
      {renderNodes(parsedNodes, isSelf, onMentionClick, onLinkClick)}
    </div>
  );
}

export default MessageContent;
