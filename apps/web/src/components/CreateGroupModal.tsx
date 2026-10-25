'use client';

import { useState, useRef, useEffect } from 'react';
import { createGroup as createGroupApi } from '@/lib/api/groups';
import { Modal, Input, Textarea, Button } from '@/components/ui';

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
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => nameRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

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

  return (
    <Modal open={isOpen} onClose={onClose} title="Create Group">
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        {/* Name input */}
        <Input
          ref={nameRef}
          id="group-name"
          label="Group Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter group name..."
          maxLength={128}
        />

        {/* Description input */}
        <Textarea
          id="group-description"
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this group about?"
          rows={3}
        />

        {/* Public toggle */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-white">Public Group</p>
            <p className="text-xs text-dark-400">Anyone can find and join this group</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-label="Public group"
            onClick={() => setIsPublic(!isPublic)}
            className={`relative w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-900 ${
              isPublic ? 'bg-primary-500' : 'bg-dark-700'
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
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            loading={isLoading}
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateGroupModal;
