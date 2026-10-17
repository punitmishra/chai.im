'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGroupStore } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { MemberList } from './MemberList';
import { AddMemberDialog } from './AddMemberDialog';
import { InviteLinkDialog } from './InviteLinkDialog';

interface GroupInfoPanelProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function GroupInfoPanel({ groupId, isOpen, onClose }: GroupInfoPanelProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const group = useGroupStore((s) => s.getGroup(groupId));
  const members = useGroupStore((s) => s.getMembers(groupId));
  const isAdmin = useGroupStore((s) => s.isAdmin(groupId));
  const isOwner = useGroupStore((s) => s.isOwner(groupId));
  const fetchGroupDetails = useGroupStore((s) => s.fetchGroupDetails);
  const fetchMembers = useGroupStore((s) => s.fetchMembers);
  const updateGroup = useGroupStore((s) => s.updateGroup);
  const deleteGroup = useGroupStore((s) => s.deleteGroup);
  const leaveGroup = useGroupStore((s) => s.leaveGroup);
  const removeMember = useGroupStore((s) => s.removeMember);

  const [showAddMember, setShowAddMember] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && groupId) {
      fetchGroupDetails(groupId).catch(() => {});
      fetchMembers(groupId).catch(() => {});
    }
  }, [isOpen, groupId, fetchGroupDetails, fetchMembers]);

  useEffect(() => {
    if (group) {
      setEditName(group.name);
      setEditDescription(group.description || '');
    }
  }, [group]);

  const handleSaveEdit = async () => {
    try {
      await updateGroup(groupId, { name: editName, description: editDescription || undefined });
      setEditing(false);
    } catch (e) {
      console.error('Failed to update group:', e);
    }
  };

  const handleDelete = async () => {
    if (deleteInput !== group?.name) return;
    setIsDeleting(true);
    try {
      await deleteGroup(groupId);
      // Remove from conversations
      const conversations = useChatStore.getState().conversations;
      const convId = `group_${groupId}`;
      if (conversations.find((c) => c.id === convId)) {
        useChatStore.getState().updateConversation(convId, { name: '[Deleted]' });
      }
      onClose();
      router.push('/chat');
    } catch (e) {
      console.error('Failed to delete group:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveGroup(groupId);
      onClose();
      router.push('/chat');
    } catch (e) {
      console.error('Failed to leave group:', e);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeMember(groupId, userId);
    } catch (e) {
      console.error('Failed to remove member:', e);
    }
  };

  return (
    <>
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-dark-900/95 backdrop-blur-xl border-l border-dark-700/50 z-40 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-dark-700/50">
            <h2 className="text-lg font-semibold text-slate-100">Group Info</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-dark-800/50 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {/* Group details */}
            {group && (
              <div>
                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-800/50 border border-dark-600/50 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-purple-500/50"
                      maxLength={128}
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-3 py-2 bg-dark-800/50 border border-dark-600/50 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-purple-500/50 resize-none"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditing(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-slate-100">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-slate-400 mt-1">{group.description}</p>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                        group.isPublic
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-dark-700/50 text-slate-400 border border-dark-600/30'
                      }`}>
                        {group.isPublic ? 'Public' : 'Private'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {members.length} member{members.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Admin actions */}
            {isAdmin && !editing && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">Admin</h4>
                <button
                  onClick={() => setEditing(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-dark-800/50 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit Group
                </button>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-dark-800/50 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add Member
                </button>
                <button
                  onClick={() => setShowInviteLink(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-dark-800/50 transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Generate Invite Link
                </button>
              </div>
            )}

            {/* Members */}
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1 mb-2">
                Members ({members.length})
              </h4>
              <MemberList
                members={members}
                currentUserId={user?.id || ''}
                isAdmin={isAdmin}
                ownerId={group?.ownerId || ''}
                onRemoveMember={handleRemoveMember}
              />
            </div>

            {/* Danger zone */}
            {isOwner && !confirmDelete && (
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1 mb-2">Danger Zone</h4>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Group
                </button>
              </div>
            )}

            {isOwner && confirmDelete && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10">
                <p className="text-sm text-red-400 mb-2">
                  Type <strong>{group?.name}</strong> to confirm deletion:
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-800/50 border border-red-500/30 rounded-xl text-slate-100 text-sm focus:outline-none"
                  placeholder="Group name"
                />
                <div className="flex gap-2 mt-3 justify-end">
                  <button
                    onClick={() => { setConfirmDelete(false); setDeleteInput(''); }}
                    className="px-3 py-1.5 text-xs text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteInput !== group?.name || isDeleting}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Leave group (at bottom) */}
          {!isOwner && (
            <div className="px-4 py-4 border-t border-dark-700/50">
              <button
                onClick={handleLeave}
                className="w-full py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Leave Group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sub-dialogs */}
      <AddMemberDialog
        groupId={groupId}
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        existingMemberIds={members.map((m) => m.userId)}
      />
      <InviteLinkDialog
        groupId={groupId}
        isOpen={showInviteLink}
        onClose={() => setShowInviteLink(false)}
      />
    </>
  );
}
