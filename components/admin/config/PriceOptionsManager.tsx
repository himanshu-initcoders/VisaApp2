'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { visaListingPriceSchema, type VisaListingPriceInput } from '@/lib/validations/config';
import {
  createListingPrice,
  updateListingPrice,
  deleteListingPrice,
} from '@/app/(admin)/admin/config/visa-listings/actions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Unit = 'minutes' | 'hours' | 'days' | 'months' | 'years';

export interface ListingPrice {
  id: string;
  visaListingId: string;
  entryValidityAmount: number | null;
  entryValidityUnit: Unit | null;
  entryLengthStayAmount: number | null;
  entryLengthStayUnit: Unit | null;
  governmentFeeAmount: string | null;
  serviceFeeAmount: string | null;
  governmentGstFeeAmount: string | null;
  sortOrder: number;
  createdAt: Date;
}

interface PriceOptionsManagerProps {
  processId: string;
  initialPrices: ListingPrice[];
}

const UNIT_OPTIONS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'months', label: 'Months' },
  { value: 'years', label: 'Years' },
];

function formatAmount(amount: string | null) {
  const value = parseFloat(amount || '0');
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatDuration(amount: number | null, unit: string | null) {
  if (!amount || !unit) return '—';
  return `${amount} ${unit}`;
}

function totalFees(price: ListingPrice) {
  return (
    parseFloat(price.governmentFeeAmount || '0') +
    parseFloat(price.serviceFeeAmount || '0') +
    parseFloat(price.governmentGstFeeAmount || '0')
  );
}

function PriceFormFields({
  form,
}: {
  form: ReturnType<typeof useForm<VisaListingPriceInput>>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Entry Validity"
          type="number"
          error={form.formState.errors.entryValidityAmount?.message}
          {...form.register('entryValidityAmount', { valueAsNumber: true })}
        />
        <Select
          label="Validity Unit"
          options={UNIT_OPTIONS}
          {...form.register('entryValidityUnit')}
        />
        <Input
          label="Stay Duration"
          type="number"
          error={form.formState.errors.entryLengthStayAmount?.message}
          {...form.register('entryLengthStayAmount', { valueAsNumber: true })}
        />
        <Select
          label="Stay Unit"
          options={UNIT_OPTIONS}
          {...form.register('entryLengthStayUnit')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Visa Fee (₹)"
          type="number"
          step="0.01"
          helperText="Government fee"
          error={form.formState.errors.governmentFeeAmount?.message}
          {...form.register('governmentFeeAmount')}
        />
        <Input
          label="Service Fee (₹)"
          type="number"
          step="0.01"
          error={form.formState.errors.serviceFeeAmount?.message}
          {...form.register('serviceFeeAmount')}
        />
        <Input
          label="Government GST (₹)"
          type="number"
          step="0.01"
          error={form.formState.errors.governmentGstFeeAmount?.message}
          {...form.register('governmentGstFeeAmount')}
        />
      </div>
    </div>
  );
}

function PriceCard({
  price,
  isEditing,
  onEdit,
  onCancel,
  onSuccess,
  onDelete,
}: {
  price: ListingPrice;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSuccess: () => void;
  onDelete: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<VisaListingPriceInput>({
    resolver: zodResolver(visaListingPriceSchema),
    defaultValues: {
      entryValidityAmount: price.entryValidityAmount || 30,
      entryValidityUnit: price.entryValidityUnit || 'days',
      entryLengthStayAmount: price.entryLengthStayAmount || 30,
      entryLengthStayUnit: price.entryLengthStayUnit || 'days',
      governmentFeeAmount: price.governmentFeeAmount || '0',
      serviceFeeAmount: price.serviceFeeAmount || '0',
      governmentGstFeeAmount: price.governmentGstFeeAmount || '0',
      sortOrder: price.sortOrder,
    },
  });

  const onSubmit = async (data: VisaListingPriceInput) => {
    setIsSubmitting(true);
    try {
      const result = await updateListingPrice(price.id, data);
      if (result.success) onSuccess();
      else alert(result.error || 'Failed to update');
    } catch {
      alert('Failed to update price option');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing) {
    return (
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-white border border-ash-divider rounded-3xl p-6"
      >
        <h3
          className="text-2xl font-medium text-portrait-ink mb-6"
          style={{ fontFamily: 'Basier Circle' }}
        >
          Edit Price Option
        </h3>
        <PriceFormFields form={form} />
        <div className="flex gap-3 mt-8">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button type="button" onClick={onCancel} variant="ghost" size="md">
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white border border-ash-divider rounded-3xl p-6">
      <div className="mb-4">
        <h3
          className="text-xl font-medium text-portrait-ink"
          style={{ fontFamily: 'Basier Circle' }}
        >
          {formatDuration(price.entryValidityAmount, price.entryValidityUnit)} validity
        </h3>
        <p className="text-sm text-slate-helper">
          Stay up to {formatDuration(price.entryLengthStayAmount, price.entryLengthStayUnit)}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between py-2 border-b border-ash-divider text-sm">
          <span className="text-slate-helper">Visa Fee</span>
          <span className="font-medium text-portrait-ink">
            {formatAmount(price.governmentFeeAmount)}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-ash-divider text-sm">
          <span className="text-slate-helper">Service Fee</span>
          <span className="font-medium text-portrait-ink">
            {formatAmount(price.serviceFeeAmount)}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-ash-divider text-sm">
          <span className="text-slate-helper">Government GST</span>
          <span className="font-medium text-portrait-ink">
            {formatAmount(price.governmentGstFeeAmount)}
          </span>
        </div>
        <div className="flex justify-between py-2 text-sm">
          <span className="text-slate-helper">Total</span>
          <span className="font-medium text-portrait-ink">
            ₹{totalFees(price).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onEdit} variant="ghost" size="md" className="flex-1">
          Edit
        </Button>
        <Button onClick={onDelete} variant="ghost" size="md">
          Delete
        </Button>
      </div>
    </div>
  );
}

function AddPriceModal({
  processId,
  onClose,
  onSuccess,
}: {
  processId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<VisaListingPriceInput>({
    resolver: zodResolver(visaListingPriceSchema),
    defaultValues: {
      entryValidityAmount: 90,
      entryValidityUnit: 'days',
      entryLengthStayAmount: 30,
      entryLengthStayUnit: 'days',
      governmentFeeAmount: '0',
      serviceFeeAmount: '0',
      governmentGstFeeAmount: '0',
    },
  });

  const onSubmit = async (data: VisaListingPriceInput) => {
    setIsSubmitting(true);
    try {
      const result = await createListingPrice(processId, data);
      if (result.success) onSuccess();
      else alert(result.error || 'Failed to create');
    } catch {
      alert('Failed to create price option');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-elevated max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ash-divider p-6 flex items-center justify-between rounded-t-3xl">
          <h2
            className="text-[31px] font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
          >
            Add Price Option
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-helper/10 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-slate-helper" />
          </button>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
          <PriceFormFields form={form} />
          <div className="flex gap-3 mt-8">
            <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" size="md">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Manage multiple price options per listing (validity + stay + 3 fees).
 */
export function PriceOptionsManager({
  processId,
  initialPrices,
}: PriceOptionsManagerProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = () => router.refresh();

  const handleDelete = async () => {
    if (!deletingId) return;
    const result = await deleteListingPrice(deletingId);
    if (result.success) {
      setDeletingId(null);
      refresh();
    } else {
      alert(result.error || 'Failed to delete');
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowAdd(true)} variant="primary" size="md">
          <Plus className="h-4 w-4 mr-2" />
          Add Price Option
        </Button>
      </div>

      {initialPrices.length === 0 ? (
        <div className="bg-white border border-dashed border-ash-divider rounded-3xl p-12 text-center">
          <p className="text-portrait-ink font-medium mb-2">No price options yet</p>
          <p className="text-sm text-slate-helper mb-4">
            Add packages with entry validity, stay duration, and fees.
          </p>
          <Button onClick={() => setShowAdd(true)} variant="primary" size="md">
            Add first option
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {initialPrices.map((price) => (
            <PriceCard
              key={price.id}
              price={price}
              isEditing={editingId === price.id}
              onEdit={() => setEditingId(price.id)}
              onCancel={() => setEditingId(null)}
              onSuccess={() => {
                setEditingId(null);
                refresh();
              }}
              onDelete={() => setDeletingId(price.id)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddPriceModal
          processId={processId}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Price Option"
        message="Remove this validity/stay package and its fees? This cannot be undone."
        confirmText="Delete"
        destructive
      />
    </>
  );
}
