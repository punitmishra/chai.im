'use client';

import { GroupMember } from '@/store/groupStore';
import { Avatar, IconButton } from '@/components/ui';

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
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-dark-800/50 transition-colors"
          >
            {/* Avatar */}
            <Avatar name={member.username} size="sm" />

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white truncate">
                  {member.username}
                  {isSelf && (
                    <span className="text-dark-400 ml-1">(you)</span>
                  )}
                </span>
                {isOwnerMember && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30 font-medium">
                    Owner
                  </span>
                )}
                {!isOwnerMember && member.role === 'admin' && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-dark-700/70 text-dark-100 border border-dark-600 font-medium">
                    Admin
                  </span>
                )}
              </div>
            </div>

            {/* Remove button — always reachable by keyboard and touch */}
            {canRemove && onRemoveMember && (
              <IconButton
                aria-label={`Remove ${member.username}`}
                variant="danger"
                size="sm"
                onClick={() => onRemoveMember(member.userId)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </IconButton>
            )}
          </div>
        );
      })}
    </div>
  );
}
