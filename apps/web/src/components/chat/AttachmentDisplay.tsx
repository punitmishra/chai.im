'use client';

import { Attachment } from '@/store/chatStore';
import { getFileUrl, formatFileSize, downloadFile } from '@/lib/api/attachments';
import { useCallback, useState } from 'react';

interface AttachmentDisplayProps {
  attachments: Attachment[];
  isSelf: boolean;
}

export function AttachmentDisplay({ attachments, isSelf }: AttachmentDisplayProps) {
  if (!attachments.length) return null;

  return (
    <div className="flex flex-col gap-2 mt-2">
      {attachments.map((attachment) => (
        <AttachmentItem key={attachment.id} attachment={attachment} isSelf={isSelf} />
      ))}
    </div>
  );
}

function AttachmentItem({ attachment, isSelf }: { attachment: Attachment; isSelf: boolean }) {
  const [downloading, setDownloading] = useState(false);
  const isImage = attachment.contentType.startsWith('image/');

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await downloadFile(attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }, [attachment.id, attachment.filename]);

  if (isImage) {
    return (
      <div className="rounded-xl overflow-hidden max-w-xs">
        <img
          src={getFileUrl(attachment.id)}
          alt={attachment.filename}
          className="max-w-full h-auto rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handleDownload}
          loading="lazy"
        />
        <div className={`flex items-center justify-between px-2 py-1 text-xs ${
          isSelf ? 'text-cyan-900/60' : 'text-slate-500'
        }`}>
          <span className="truncate">{attachment.filename}</span>
          <span>{formatFileSize(attachment.sizeBytes)}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors max-w-xs ${
        isSelf
          ? 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-900'
          : 'bg-dark-700/50 hover:bg-dark-700/70 text-slate-300'
      }`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
        isSelf ? 'bg-cyan-600/30' : 'bg-dark-600/50'
      }`}>
        {downloading ? (
          <div className={`h-5 w-5 animate-spin rounded-full border-2 ${
            isSelf ? 'border-cyan-900/30 border-t-cyan-900' : 'border-slate-500 border-t-white'
          }`} />
        ) : (
          <FileIcon contentType={attachment.contentType} isSelf={isSelf} />
        )}
      </div>
      <div className="min-w-0 text-left">
        <p className={`text-sm font-medium truncate ${isSelf ? 'text-cyan-950' : 'text-white'}`}>
          {attachment.filename}
        </p>
        <p className={`text-xs ${isSelf ? 'text-cyan-900/60' : 'text-slate-500'}`}>
          {formatFileSize(attachment.sizeBytes)}
        </p>
      </div>
    </button>
  );
}

function FileIcon({ contentType, isSelf }: { contentType: string; isSelf: boolean }) {
  const color = isSelf ? 'text-cyan-900' : 'text-slate-400';

  if (contentType.startsWith('video/')) {
    return (
      <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  }

  if (contentType === 'application/pdf') {
    return (
      <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }

  return (
    <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}
