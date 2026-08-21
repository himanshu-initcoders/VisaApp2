'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Select, getRoleVariant } from '@/components/ui';
import { updateUserRole } from '@/app/(admin)/actions';

/**
 * User Role Modal
 *
 * Modal for changing user roles (admin only):
 * - Current role badge
 * - Select for new role (User, Reviewer, Admin)
 * - Warning message about permission changes
 * - Confirmation required for promoting to admin
 */

interface UserRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentRole: string;
  onSuccess?: () => void;
}

export function UserRoleModal({
  isOpen,
  onClose,
  userId,
  userName,
  currentRole,
  onSuccess,
}: UserRoleModalProps) {
  const [newRole, setNewRole] = useState<'user' | 'admin' | 'reviewer'>(
    currentRole as 'user' | 'admin' | 'reviewer'
  );
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewRole(currentRole as 'user' | 'admin' | 'reviewer');
      setShowConfirmation(false);
      setError('');
    }
  }, [isOpen, currentRole]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    if (newRole === currentRole) {
      setError('Please select a different role');
      return;
    }

    // Show confirmation if promoting to admin
    if (newRole === 'admin' && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updateUserRole({
        userId,
        newRole,
      });

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.message || 'Failed to update role');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-portrait-ink/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[24px] shadow-elevated max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-basier text-[31px] text-portrait-ink">
            Change User Role
          </h2>
          <button
            onClick={onClose}
            className="text-slate-helper hover:text-portrait-ink transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User info */}
          <div>
            <p className="font-switzer text-sm text-slate-helper mb-1">
              User
            </p>
            <p className="font-switzer text-base font-medium text-portrait-ink">
              {userName}
            </p>
          </div>

          {/* Current Role */}
          <div>
            <label className="block font-switzer text-sm font-medium text-portrait-ink mb-2">
              Current Role
            </label>
            <Badge variant={getRoleVariant(currentRole)}>
              {currentRole}
            </Badge>
          </div>

          {/* New Role */}
          <Select
            label="New Role"
            options={[
              { value: 'user', label: 'User' },
              { value: 'reviewer', label: 'Reviewer' },
              { value: 'admin', label: 'Admin' },
            ]}
            value={newRole}
            onChange={(e) => {
              setNewRole(e.target.value as 'user' | 'admin' | 'reviewer');
              setShowConfirmation(false);
            }}
            disabled={isSubmitting}
          />

          {/* Warning message */}
          <div className="bg-peach-wash/50 p-3 rounded-lg">
            <p className="font-switzer text-xs text-portrait-ink">
              <span className="font-semibold">Note:</span> Changing roles affects access permissions.
              {newRole === 'admin' && ' Admins have full system access including user management.'}
              {newRole === 'reviewer' && ' Reviewers can view and update applications but cannot manage users.'}
              {newRole === 'user' && ' Users can only view and manage their own applications.'}
            </p>
          </div>

          {/* Confirmation for admin promotion */}
          {showConfirmation && newRole === 'admin' && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <p className="font-switzer text-xs text-red-800 font-semibold mb-2">
                ⚠️ Confirmation Required
              </p>
              <p className="font-switzer text-xs text-red-700">
                You are about to promote <span className="font-semibold">{userName}</span> to Admin.
                This will grant them full system access. Are you sure?
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="font-switzer text-sm text-red-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || newRole === currentRole}
            >
              {isSubmitting
                ? 'Updating...'
                : showConfirmation && newRole === 'admin'
                ? 'Confirm & Update'
                : 'Update Role'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
