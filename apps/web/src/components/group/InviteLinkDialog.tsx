'use client';

import { useState } from 'react';
import { createInvite } from '@/lib/api/groups';

interface InviteLinkDialogProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function InviteLinkDialog({ groupId, isOpen, onClose }: InviteLinkDialogProps) {
  const [maxUses, setMaxUses] = useState<string>('');
  const [expiresIn, setExpiresIn] = useState<string>('24');
  const [inviteCode, setInviteCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const result = await createInvite(
        groupId,
        maxUses ? parseInt(maxUses) : undefined,
        expiresIn ? parseInt(expiresIn) : undefined
      );
      setInviteCode(result.invite_code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate invite');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.querySelector<HTMLInputElement>('#invite-code-input');
      input?.select();
      document.execCommand('copy');
    }
  };

  const handleClose = () => {
    setInviteCode('');
    setCopied(false);
    setError('');
    setMaxUses('');
    setExpiresIn('24');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-zinc-900/95 border border-zinc-800/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">Generate Invite Link</h3>

        {!inviteCode ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Max uses</label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-zinc-100 focus:outline-none focus:border-purple-500/50"
                >
                  <option value="">Unlimited</option>
                  <option value="1">1 use</option>
                  <option value="5">5 uses</option>
                  <option value="10">10 uses</option>
                  <option value="25">25 uses</option>
                  <option value="100">100 uses</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Expires in</label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-zinc-100 focus:outline-none focus:border-purple-500/50"
                >
                  <option value="1">1 hour</option>
                  <option value="6">6 hours</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                  <option value="">Never</option>
                </select>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-zinc-400 mb-3">
              Share this code with people you want to invite:
            </p>

            <div className="flex gap-2">
              <input
                id="invite-code-input"
                type="text"
                value={inviteCode}
                readOnly
                className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-zinc-100 font-mono text-lg tracking-wider text-center select-all"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-3 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors text-sm font-medium min-w-[80px]"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
