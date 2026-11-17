'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { searchUsers, type UserSearchResult } from '@/lib/api/users';
import { useGroupStore } from '@/store/groupStore';
import { Modal, Input, Button, Avatar } from '@/components/ui';

interface AddMemberDialogProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
  existingMemberIds: string[];
}

export function AddMemberDialog({
  groupId,
  isOpen,
  onClose,
  existingMemberIds,
}: AddMemberDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const addMember = useGroupStore((s) => s.addMember);

  useEffect(() => {
    if (isOpen) {
      // Focus the search field after the modal has moved focus into the panel.
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
    setQuery('');
    setResults([]);
    setError('');
  }, [isOpen]);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setError('');

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.trim().length < 2) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const users = await searchUsers(value.trim());
          setResults(users.filter((u) => !existingMemberIds.includes(u.id)));
        } catch {
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [existingMemberIds]
  );

  const handleAdd = async (user: UserSearchResult) => {
    setAdding(user.id);
    setError('');
    try {
      await addMember(groupId, user.id);
      setResults((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add member');
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Add Member">
      <div className="px-6 py-5">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by username..."
          error={error || undefined}
        />

        <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
          {isSearching && (
            <p className="text-sm text-dark-400 text-center py-4">Searching...</p>
          )}

          {!isSearching && query.length >= 2 && results.length === 0 && (
            <p className="text-sm text-dark-400 text-center py-4">No users found</p>
          )}

          {results.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-800/50 transition-colors"
            >
              <Avatar name={user.username} size="sm" />
              <span className="flex-1 text-sm text-white">{user.username}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAdd(user)}
                loading={adding === user.id}
                disabled={adding === user.id}
              >
                {adding === user.id ? 'Adding...' : 'Add'}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
