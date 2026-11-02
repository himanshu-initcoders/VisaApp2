'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { indianMobileSchema } from '@/lib/validations/auth';
import { updateStaffProfile, signOutAction } from '@/app/(admin)/actions';

interface StaffProfileFormProps {
  initialName: string;
  email: string | null;
  phone: string | null;
  role: string;
}

function roleLabel(role: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'reviewer') return 'Reviewer';
  return role;
}

export function StaffProfileForm({
  initialName,
  email,
  phone: initialPhone,
  role,
}: StaffProfileFormProps) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState(initialPhone);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canEditPhone = !savedPhone;

  const phoneDirty = canEditPhone && phone.length > 0;
  const nameDirty = name.trim() !== savedName.trim();
  const canSave = nameDirty || phoneDirty;

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, '').slice(0, 10));
    setPhoneError(null);
    setSuccess(null);
  };

  const handleSave = () => {
    setNameError(null);
    setPhoneError(null);
    setSuccess(null);

    if (canEditPhone && phone) {
      const parsedPhone = indianMobileSchema.safeParse(phone);
      if (!parsedPhone.success) {
        setPhoneError(
          parsedPhone.error.issues[0]?.message ??
            'Enter a valid 10-digit Indian mobile number'
        );
        return;
      }
    }

    startTransition(async () => {
      const result = await updateStaffProfile({
        name,
        ...(canEditPhone && phone ? { phone } : {}),
      });
      if (!result.success) {
        const message = result.message || 'Could not update profile';
        if (/mobile|phone/i.test(message)) {
          setPhoneError(message);
        } else {
          setNameError(message);
        }
        return;
      }

      const nextName = result.data?.name ?? name.trim();
      const nextPhone = result.data?.phone ?? savedPhone;
      setName(nextName);
      setSavedName(nextName);
      setSavedPhone(nextPhone);
      setPhone('');
      setSuccess('Profile saved');

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
            setNameError(null);
          }}
          autoComplete="name"
          disabled={pending}
          error={nameError || undefined}
        />

        <Input
          label="Email"
          value={email || '—'}
          disabled
          readOnly
          helperText="Used for staff login — cannot be changed here"
        />

        {!canEditPhone ? (
          <Input
            label="Mobile"
            value={`+91 ${savedPhone}`}
            disabled
            readOnly
            helperText="Locked on your account. You can also sign in with this number via mobile OTP."
          />
        ) : (
          <div className="w-full">
            <label
              htmlFor="staff-profile-phone"
              className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
            >
              Mobile
            </label>
            <div
              className={cn(
                'flex items-center overflow-hidden rounded-input border bg-white',
                phoneError
                  ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-500'
                  : 'border-ash focus-within:border-transparent focus-within:ring-2 focus-within:ring-portrait-ink'
              )}
            >
              <span className="shrink-0 border-r border-ash bg-mist px-3 py-2.5 font-switzer text-sm text-slate-helper">
                +91
              </span>
              <input
                id="staff-profile-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                disabled={pending}
                onChange={(event) => handlePhoneChange(event.target.value)}
                className="w-full bg-transparent px-4 py-2.5 font-switzer text-base text-portrait-ink placeholder:text-slate-helper focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            {phoneError ? (
              <p className="mt-1.5 font-switzer text-sm text-red-600">
                {phoneError}
              </p>
            ) : (
              <p className="mt-1.5 font-switzer text-sm text-slate-helper">
                Optional — once saved, you can sign in with email or mobile OTP
              </p>
            )}
          </div>
        )}

        <Input
          label="Role"
          value={roleLabel(role)}
          disabled
          readOnly
          helperText="Assigned by an administrator"
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
            disabled={pending || !canSave}
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
