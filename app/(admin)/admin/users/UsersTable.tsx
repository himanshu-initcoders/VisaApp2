'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Badge, getRoleVariant, Button } from '@/components/ui';
import { UserRoleModal } from '@/components/admin/UserRoleModal';
import type { UserWithStats } from '@/types/admin';

/**
 * Users Table Component
 *
 * Displays all users with:
 * - Name, Email, Role, Registration Date
 * - Application counts
 * - Change Role action (admin only)
 * - View Applications link
 */

interface UsersTableProps {
  users: UserWithStats[];
}

export function UsersTable({ users }: UsersTableProps) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);

  const handleRoleUpdateSuccess = () => {
    setSelectedUser(null);
    router.refresh();
  };

  if (users.length === 0) {
    return (
      <Card className="py-12">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto text-slate-helper mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <p className="font-switzer text-sm text-slate-helper">
            No users found
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ash bg-[#fafbfc]">
                <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                  Applications
                </th>
                <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                  Registered
                </th>
                <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-ash hover:bg-sky-wash/10 transition-colors"
                >
                  {/* User */}
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-switzer text-sm font-medium text-portrait-ink">
                        {user.name}
                      </p>
                      <p className="font-switzer text-xs text-slate-helper">
                        {user.email}
                      </p>
                      {user.emailVerified && (
                        <span className="inline-flex items-center font-switzer text-xs text-green-600 mt-1">
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Verified
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-6 py-4">
                    <Badge variant={getRoleVariant(user.role)}>
                      {user.role}
                    </Badge>
                  </td>

                  {/* Applications */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="font-switzer text-sm text-portrait-ink">
                        Total: <span className="font-semibold">{user.totalApplicationsCount}</span>
                      </p>
                      <p className="font-switzer text-xs text-slate-helper">
                        Visa: {user.visaApplicationsCount} | Passport: {user.passportApplicationsCount}
                      </p>
                    </div>
                  </td>

                  {/* Registered */}
                  <td className="px-6 py-4">
                    <span className="font-switzer text-sm text-slate-helper">
                      {new Date(user.createdAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {user.totalApplicationsCount > 0 && (
                        <Link
                          href={`/admin/applications?userId=${user.id}`}
                          className="font-switzer text-xs text-nautical-teal hover:text-portrait-ink transition-colors"
                        >
                          View Apps
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUser(user)}
                        className="text-xs"
                      >
                        Change Role
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* User Role Modal */}
      {selectedUser && (
        <UserRoleModal
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          userId={selectedUser.id}
          userName={selectedUser.name}
          currentRole={selectedUser.role}
          onSuccess={handleRoleUpdateSuccess}
        />
      )}
    </>
  );
}
