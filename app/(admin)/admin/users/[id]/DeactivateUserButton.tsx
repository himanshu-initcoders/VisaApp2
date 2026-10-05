'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { setUserDeactivated } from '@/app/(admin)/actions';

export function DeactivateUserButton({
  userId,
  deactivated,
}: {
  userId: string;
  deactivated: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    const result = await setUserDeactivated({
      userId,
      deactivated: !deactivated,
    });
    setLoading(false);

    if (!result.success) {
      setError(result.error || result.message);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button
        type="button"
        variant={deactivated ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {deactivated ? 'Reactivate account' : 'Deactivate account'}
      </Button>
      {error ? (
        <p className="w-full font-switzer text-sm text-red-600">{error}</p>
      ) : null}
      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        onConfirm={handleConfirm}
        loading={loading}
        destructive={!deactivated}
        title={deactivated ? 'Reactivate account?' : 'Deactivate account?'}
        message={
          deactivated
            ? 'This person will be able to sign in again.'
            : 'They will not be able to sign in or use their account, including existing sessions.'
        }
        confirmText={deactivated ? 'Reactivate' : 'Deactivate'}
      />
    </>
  );
}
