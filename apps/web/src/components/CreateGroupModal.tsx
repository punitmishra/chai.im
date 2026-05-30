'use client';

import { useState } from 'react';
import { createGroup as createGroupApi } from '@/lib/api/groups';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (group: GroupInfo) => void;
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
}

export function CreateGroupModal({ isOpen, onClose, onCreated }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    if (name.length > 128) {
      setError('Group name must be 128 characters or less');
      return;
    }

    setIsLoading(true);

    try {
      const group = await createGroupApi(
        name.trim(),
        description.trim() || undefined,
        isPublic
      );

      // Reset form
      setName('');
      setDescription('');
      setIsPublic(false);

      onCreated?.({
        id: group.id,
        name: group.name,
        description: group.description,
        isPublic: group.is_public,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsLoading(false);
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
      <div className="relative w-full max-w-md bg-dark-900 rounded-2xl border border-dark-700 shadow-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Create Group</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name input */}
          <div>
            <label htmlFor="group-name" className="block text-sm font-medium text-slate-400 mb-2">
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full bg-dark-800 text-white rounded-xl px-4 py-3
                       placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                       border border-dark-600"
              maxLength={128}
              autoFocus
            />
          </div>

          {/* Description input */}
          <div>
            <label htmlFor="group-description" className="block text-sm font-medium text-slate-400 mb-2">
              Description (optional)
            </label>
            <textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              rows={3}
              className="w-full bg-dark-800 text-white rounded-xl px-4 py-3
                       placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                       border border-dark-600 resize-none"
            />
          </div>

          {/* Public toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-white">Public Group</p>
              <p className="text-xs text-slate-500">Anyone can find and join this group</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isPublic ? 'bg-cyan-500' : 'bg-dark-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  isPublic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-dark-800 text-white font-medium
                       hover:bg-dark-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500
                       text-white font-medium hover:from-cyan-600 hover:to-teal-600
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Group'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupModal;
