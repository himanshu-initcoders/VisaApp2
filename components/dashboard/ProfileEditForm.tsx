'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button, Input } from '@/components/ui';
import { updateMyProfile, signOutAction } from '@/app/(dashboard)/actions';

interface ProfileEditFormProps {
  initialName: string;
  email: string | null;
  phone: string | null;
}

export function ProfileEditForm({
  initialName,
  email,
  phone,
}: ProfileEditFormProps) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await updateMyProfile({ name });
      if (!result.success) {
        setError(result.message || 'Could not update profile');
        return;
      }

      const nextName = result.data?.name ?? name.trim();
      setName(nextName);
      setSavedName(nextName);
      setSuccess('Profile saved');

      // Refresh JWT from DB (server ignores any forged role/phone)
      await update({});
      router.refresh();
    });
  };

  return (
    <div className="rounded-[24px] border border-ash bg-white p-6 sm:p-8">
      <div className="space-y-5">
        <Input
          label="Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSuccess(null);
            setError(null);
          }}
          autoComplete="name"
          disabled={pending}
          error={error || undefined}
        />

        <Input
          label="Email"
          value={email || '—'}
          disabled
          readOnly
          helperText="Email cannot be changed here"
        />

        <Input
          label="Mobile"
          value={phone ? `+91 ${phone}` : '—'}
          disabled
          readOnly
          helperText="Mobile number is locked to your account"
        />

        {success && (
          <p className="font-switzer text-sm text-nautical-teal" role="status">
            {success}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={pending || name.trim() === savedName.trim()}
            onClick={handleSave}
          >
            {pending ? 'Saving…' : 'Save changes'}
          </Button>

          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="md">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
