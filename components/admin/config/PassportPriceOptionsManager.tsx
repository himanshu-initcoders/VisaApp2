'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  passportListingPriceSchema,
  type PassportListingPriceInput,
} from '@/lib/validations/passport-config';
import {
  createPassportPrice,
  updatePassportPrice,
  deletePassportPrice,
} from '@/app/(admin)/admin/config/passport-listings/actions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Plus, X } from 'lucide-react';
import {
  PASSPORT_BOOKLET_PAGES,
  PASSPORT_SCHEMES,
  passportPriceLabel,
} from '@/lib/passport/constants';

export interface PassportPriceRow {
  id: string;
  passportListingId: string;
  scheme: 'normal' | 'tatkaal';
  bookletPages: '36' | '60';
  governmentFeeAmount: string;
  serviceFeeAmount: string;
  governmentGstFeeAmount: string;
  sortOrder: number;
}

interface PassportPriceOptionsManagerProps {
  listingId: string;
  initialPrices: PassportPriceRow[];
}

function totalFees(price: PassportPriceRow) {
  return (
    parseFloat(price.governmentFeeAmount || '0') +
    parseFloat(price.serviceFeeAmount || '0') +
    parseFloat(price.governmentGstFeeAmount || '0')
  );
}

export function PassportPriceOptionsManager({
  listingId,
  initialPrices,
}: PassportPriceOptionsManagerProps) {
  const router = useRouter();
  const [prices, setPrices] = useState(initialPrices);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PassportPriceRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setPrices(initialPrices);
  }, [initialPrices]);

  const form = useForm<PassportListingPriceInput>({
    resolver: zodResolver(passportListingPriceSchema),
    defaultValues: {
      scheme: 'normal',
      bookletPages: '36',
      governmentFeeAmount: '1500',
      serviceFeeAmount: '2000',
      governmentGstFeeAmount: '0',
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      scheme: 'normal',
      bookletPages: '36',
      governmentFeeAmount: '1500',
      serviceFeeAmount: '2000',
      governmentGstFeeAmount: '0',
    });
    setShowForm(true);
  };

  const openEdit = (price: PassportPriceRow) => {
    setEditing(price);
    form.reset({
      scheme: price.scheme,
      bookletPages: price.bookletPages,
      governmentFeeAmount: price.governmentFeeAmount,
      serviceFeeAmount: price.serviceFeeAmount,
      governmentGstFeeAmount: price.governmentGstFeeAmount,
    });
    setShowForm(true);
  };

  const onSubmit = async (data: PassportListingPriceInput) => {
    const result = editing
      ? await updatePassportPrice(editing.id, data)
      : await createPassportPrice(listingId, data);
    if (result.success) {
      setShowForm(false);
      setEditing(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to save');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const result = await deletePassportPrice(deletingId);
    if (result.success) {
      setDeletingId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-helper">
          Normal / Tatkaal × 36 / 60 pages — government fee, service fee, GST.
        </p>
        <Button type="button" variant="primary" onClick={openCreate}>
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4 shrink-0" />
            Add package
          </span>
        </Button>
      </div>

      <div className="space-y-3">
        {prices.map((price) => (
          <div
            key={price.id}
            className="flex flex-col gap-3 rounded-3xl border border-ash-divider bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-portrait-ink">
                {passportPriceLabel(price.scheme, price.bookletPages)}
              </p>
              <p className="mt-1 text-sm text-slate-helper">
                Gov ₹{parseFloat(price.governmentFeeAmount).toLocaleString('en-IN')} ·
                Service ₹{parseFloat(price.serviceFeeAmount).toLocaleString('en-IN')} ·
                GST ₹{parseFloat(price.governmentGstFeeAmount).toLocaleString('en-IN')} ·
                Total ₹{totalFees(price).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => openEdit(price)}>
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletingId(price.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
        {prices.length === 0 && (
          <p className="rounded-3xl border border-dashed border-ash-divider p-8 text-center text-sm text-slate-helper">
            No price packages yet. Add Normal/Tatkaal options for 36 and 60 pages.
          </p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowForm(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-medium text-portrait-ink">
                {editing ? 'Edit package' : 'Add package'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Scheme"
                  options={PASSPORT_SCHEMES.map((s) => ({
                    value: s.value,
                    label: s.label,
                  }))}
                  {...form.register('scheme')}
                />
                <Select
                  label="Booklet pages"
                  options={PASSPORT_BOOKLET_PAGES.map((p) => ({
                    value: p.value,
                    label: p.label,
                  }))}
                  {...form.register('bookletPages')}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input
                  label="Gov fee (₹)"
                  {...form.register('governmentFeeAmount')}
                  error={form.formState.errors.governmentFeeAmount?.message}
                />
                <Input
                  label="Service fee (₹)"
                  {...form.register('serviceFeeAmount')}
                  error={form.formState.errors.serviceFeeAmount?.message}
                />
                <Input
                  label="GST (₹)"
                  {...form.register('governmentGstFeeAmount')}
                  error={form.formState.errors.governmentGstFeeAmount?.message}
                />
              </div>
              <Button type="submit" variant="primary" className="w-full">
                Save package
              </Button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete price package?"
        message="Applicants will no longer see this option."
        confirmText="Delete"
        destructive
      />
    </div>
  );
}
