'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { searchUsers, type UserSearchResult } from '@/lib/api/users';
import { useGroupStore } from '@/store/groupStore';

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
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError('');
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-900/95 border border-dark-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Add Member</h3>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by username..."
          className="w-full px-4 py-3 bg-dark-800/50 border border-dark-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
        />

        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}

        <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
          {isSearching && (
            <p className="text-sm text-slate-500 text-center py-4">Searching...</p>
          )}

          {!isSearching && query.length >= 2 && results.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No users found</p>
          )}

          {results.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-800/50 transition-colors"
            >
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-dark-700 to-dark-800 flex items-center justify-center text-sm font-medium text-slate-300">
                {user.username[0]?.toUpperCase() || '?'}
              </div>
              <span className="flex-1 text-sm text-slate-200">{user.username}</span>
              <button
                onClick={() => handleAdd(user)}
                disabled={adding === user.id}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding === user.id ? 'Adding...' : 'Add'}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
