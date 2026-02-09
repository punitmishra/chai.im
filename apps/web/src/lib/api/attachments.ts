/**
 * File attachments API client.
 */

import { useAuthStore } from '@/store/authStore';
import { API_URL } from '@/lib/config';

export interface UploadResponse {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

/**
 * Upload a file attachment.
 * Returns attachment metadata including the ID for download.
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
  const token = useAuthStore.getState().sessionToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  return response.json();
}

/**
 * Get the download URL for an attachment.
 */
export function getFileUrl(fileId: string): string {
  return `${API_URL}/files/${fileId}`;
}

/**
 * Download a file attachment.
 */
export async function downloadFile(fileId: string): Promise<Blob> {
  const token = useAuthStore.getState().sessionToken;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/files/${fileId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Download failed');
  }

  return response.blob();
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
