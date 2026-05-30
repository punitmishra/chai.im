'use client';

import { GroupMember } from '@/store/groupStore';

interface MemberListProps {
  members: GroupMember[];
  currentUserId: string;
  isAdmin: boolean;
  ownerId: string;
  onRemoveMember?: (userId: string) => void;
}

export function MemberList({
  members,
  currentUserId,
  isAdmin,
  ownerId,
  onRemoveMember,
}: MemberListProps) {
  // Sort: owner first, then admins, then members
  const sorted = [...members].sort((a, b) => {
    if (a.userId === ownerId) return -1;
    if (b.userId === ownerId) return 1;
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return 0;
  });

  return (
    <div className="space-y-1">
      {sorted.map((member) => {
        const isOwnerMember = member.userId === ownerId;
        const isSelf = member.userId === currentUserId;
        const canRemove = isAdmin && !isOwnerMember && !isSelf;

        return (
          <div
            key={member.userId}
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-dark-800/50 transition-colors group"
          >
            {/* Avatar */}
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-dark-700 to-dark-800 flex items-center justify-center text-sm font-medium text-slate-300 shrink-0">
              {member.username[0]?.toUpperCase() || '?'}
            </div>

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200 truncate">
                  {member.username}
                  {isSelf && (
                    <span className="text-slate-500 ml-1">(you)</span>
                  )}
                </span>
                {isOwnerMember && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-medium">
                    Owner
                  </span>
                )}
                {!isOwnerMember && member.role === 'admin' && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium">
                    Admin
                  </span>
                )}
              </div>
            </div>

            {/* Remove button */}
            {canRemove && onRemoveMember && (
              <button
                onClick={() => onRemoveMember(member.userId)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                title="Remove member"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
