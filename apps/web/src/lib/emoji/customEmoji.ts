'use client';

/**
 * Custom emoji storage using IndexedDB.
 * Allows users to upload and manage their own emoji.
 */

export interface CustomEmoji {
  id: string;
  shortcode: string;
  name: string;
  url: string; // Base64 data URL or blob URL
  createdAt: number;
  keywords: string[];
}

const DB_NAME = 'chai-emoji';
const DB_VERSION = 1;
const STORE_NAME = 'custom-emojis';

let dbInstance: IDBDatabase | null = null;

/**
 * Open or create the IndexedDB database.
 */
async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('shortcode', 'shortcode', { unique: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/**
 * Get all custom emojis.
 */
export async function getAllCustomEmojis(): Promise<CustomEmoji[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.index('createdAt').getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as CustomEmoji[]);
  });
}

/**
 * Get a custom emoji by shortcode.
 */
export async function getCustomEmojiByShortcode(shortcode: string): Promise<CustomEmoji | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('shortcode');
    const request = index.get(shortcode.toLowerCase());

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as CustomEmoji | null);
  });
}

/**
 * Add a custom emoji.
 */
export async function addCustomEmoji(emoji: Omit<CustomEmoji, 'id' | 'createdAt'>): Promise<CustomEmoji> {
  const db = await openDB();

  const fullEmoji: CustomEmoji = {
    ...emoji,
    id: crypto.randomUUID(),
    shortcode: emoji.shortcode.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(fullEmoji);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(fullEmoji);
  });
}

/**
 * Delete a custom emoji.
 */
export async function deleteCustomEmoji(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Update a custom emoji.
 */
export async function updateCustomEmoji(id: string, updates: Partial<CustomEmoji>): Promise<CustomEmoji> {
  const db = await openDB();

  const existing = await new Promise<CustomEmoji | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as CustomEmoji | null);
  });

  if (!existing) {
    throw new Error(`Custom emoji not found: ${id}`);
  }

  const updated: CustomEmoji = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(updated);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updated);
  });
}

/**
 * Convert a File to a base64 data URL.
 * Validates and resizes if necessary.
 */
export async function fileToEmojiDataUrl(file: File, maxSize = 128): Promise<string> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  // Validate file size (max 1MB)
  if (file.size > 1024 * 1024) {
    throw new Error('File must be smaller than 1MB');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        // Resize if too large
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Search custom emojis.
 */
export async function searchCustomEmojis(query: string): Promise<CustomEmoji[]> {
  const all = await getAllCustomEmojis();
  const lowerQuery = query.toLowerCase();

  return all.filter(
    (emoji) =>
      emoji.shortcode.includes(lowerQuery) ||
      emoji.name.toLowerCase().includes(lowerQuery) ||
      emoji.keywords.some((kw) => kw.includes(lowerQuery))
  );
}

/**
 * Clear all custom emojis (for testing/reset).
 */
export async function clearAllCustomEmojis(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
