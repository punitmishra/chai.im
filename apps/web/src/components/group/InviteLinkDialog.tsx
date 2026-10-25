'use client';

import { useState } from 'react';
import { createInvite } from '@/lib/api/groups';
import { Modal, Input, Button } from '@/components/ui';

interface InviteLinkDialogProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
}

const selectClass =
  'w-full px-3 py-2.5 bg-dark-900 border border-dark-600 rounded-xl text-white ' +
  'focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:border-primary-500/60';

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

  return (
    <Modal open={isOpen} onClose={handleClose} title="Generate Invite Link">
      <div className="px-6 py-5">
        {!inviteCode ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-1.5">Max uses</label>
                <select
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className={selectClass}
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
                <label className="block text-sm font-medium text-dark-100 mb-1.5">Expires in</label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className={selectClass}
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
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} loading={isGenerating} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-dark-300 mb-3">
              Share this code with people you want to invite:
            </p>

            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  id="invite-code-input"
                  type="text"
                  value={inviteCode}
                  readOnly
                  className="font-mono text-lg tracking-wider text-center select-all"
                />
              </div>
              <Button onClick={handleCopy} className="min-w-[80px]">
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="ghost" onClick={handleClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
