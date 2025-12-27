'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useGroupStore, fetchGroupMembers, createInviteCode, GroupMember } from '@/store/groupStore';

interface GroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  ownerId: string;
}

export function GroupMembersModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  ownerId,
}: GroupMembersModalProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  const sessionToken = useAuthStore((state) => state.sessionToken);
  const user = useAuthStore((state) => state.user);
  const setMembersInStore = useGroupStore((state) => state.setMembers);

  const isOwner = user?.id === ownerId;
  const isAdmin = members.find((m) => m.userId === user?.id)?.role === 'admin';

  // Fetch members on open
  useEffect(() => {
    if (!isOpen || !sessionToken) return;

    const loadMembers = async () => {
      setIsLoading(true);
      try {
        const data = await fetchGroupMembers(sessionToken, groupId);
        setMembers(data);
        setMembersInStore(groupId, data);
      } catch (error) {
        console.error('Failed to fetch members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMembers();
  }, [isOpen, sessionToken, groupId, setMembersInStore]);

  const handleCreateInvite = async () => {
    if (!sessionToken) return;

    setIsCreatingInvite(true);
    try {
      const result = await createInviteCode(sessionToken, groupId);
      setInviteCode(result.inviteCode);
    } catch (error) {
      console.error('Failed to create invite:', error);
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteCode) return;

    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[80vh] bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-semibold text-white">{groupName}</h2>
            <p className="text-sm text-zinc-500">{members.length} members</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Invite section (for admins) */}
        {(isOwner || isAdmin) && (
          <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
            {inviteCode ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-800 rounded-xl px-4 py-2 font-mono text-amber-400">
                  {inviteCode}
                </div>
                <button
                  onClick={handleCopyInvite}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleCreateInvite}
                disabled={isCreatingInvite}
                className="w-full py-2.5 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCreatingInvite ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Create Invite Link
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Members list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 font-medium text-white">
                    {member.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">
                        {member.username || member.userId.slice(0, 8)}
                      </span>
                      {member.userId === ownerId && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                          Owner
                        </span>
                      )}
                      {member.role === 'admin' && member.userId !== ownerId && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                          Admin
                        </span>
                      )}
                      {member.userId === user?.id && (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 text-xs">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupMembersModal;
