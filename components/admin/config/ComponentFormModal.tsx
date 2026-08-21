'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { componentRequiredSchema, type ComponentRequired } from '@/lib/validations/config';
import { createComponent, updateComponent } from '@/app/(admin)/admin/config/visa-listings/actions';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';

interface Component {
  id: string;
  visaListingId: string;
  key: string;
  amount: string;
  chargeable: boolean;
  familyEnabled: boolean;
  onlyB2b: boolean;
  toggle: boolean;
  attributes: string[];
  sourceUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}

interface ComponentFormModalProps {
  processId: string;
  initialData: Component | null;
  onClose: () => void;
  onSuccess: (component: Component) => void;
}

// Common document types
const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport (Front)' },
  { value: 'passport_back', label: 'Passport (Back)' },
  { value: 'photo', label: 'Passport Photo' },
  { value: 'india_aadhaar', label: 'Aadhaar Card' },
  { value: 'pan_card', label: 'PAN Card' },
  { value: 'flight_tickets', label: 'Flight Tickets' },
  { value: 'hotel_details', label: 'Hotel Booking' },
  { value: 'travel_insurance', label: 'Travel Insurance' },
  { value: 'bank_statements', label: 'Bank Statements' },
  { value: 'covid_vaccine', label: 'COVID Vaccine Certificate' },
  { value: 'custom', label: 'Custom (Enter below)' },
];

// Common validation attributes
const COMMON_ATTRIBUTES = [
  'validity_required',
  'image_required',
  'fathers_name_required',
  'mothers_name_required',
  'departure_flight_required',
  'return_flight_required',
  'biometric_required',
];

/**
 * ComponentFormModal Component
 *
 * Modal dialog for creating or editing document requirements.
 */
export function ComponentFormModal({
  processId,
  initialData,
  onClose,
  onSuccess,
}: ComponentFormModalProps) {
  const isEditMode = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(
    DOCUMENT_TYPES.find((t) => t.value === initialData?.key) ? initialData!.key : 'custom'
  );

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSubmitting, onClose]);

  const form = useForm<ComponentRequired>({
    resolver: zodResolver(componentRequiredSchema),
    defaultValues: initialData
      ? {
          key: initialData.key,
          amount: initialData.amount,
          chargeable: initialData.chargeable,
          familyEnabled: initialData.familyEnabled,
          onlyB2b: initialData.onlyB2b,
          toggle: initialData.toggle,
          attributes: initialData.attributes || [],
          sourceUrl: initialData.sourceUrl || '',
        }
      : {
          key: '',
          amount: '0',
          chargeable: false,
          familyEnabled: true,
          onlyB2b: false,
          toggle: false,
          attributes: [],
          sourceUrl: '',
        },
  });

  const chargeable = form.watch('chargeable');

  const handleDocTypeChange = (value: string) => {
    setSelectedDocType(value);
    if (value !== 'custom') {
      form.setValue('key', value);
    }
  };

  const onSubmit = async (data: ComponentRequired) => {
    setIsSubmitting(true);

    try {
      const payload = {
        ...data,
        sourceUrl: data.sourceUrl?.trim() ? data.sourceUrl.trim() : null,
      };

      const result = isEditMode
        ? await updateComponent(initialData!.id, payload)
        : await createComponent(processId, payload);

      if (result.success && result.component) {
        onSuccess({
          ...result.component,
          attributes: (result.component.attributes as string[]) || [],
          amount: String(result.component.amount),
        });
      } else {
        alert(result.error || 'Failed to save document requirement');
      }
    } catch (error) {
      console.error('Error saving component:', error);
      alert('Failed to save document requirement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAttribute = (attr: string) => {
    const current = form.watch('attributes') || [];
    if (current.includes(attr)) {
      form.setValue(
        'attributes',
        current.filter((a) => a !== attr)
      );
    } else {
      form.setValue('attributes', [...current, attr]);
    }
  };

  const currentAttributes = form.watch('attributes') || [];

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop — full viewport, no inset padding */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="component-modal-title"
        className="relative bg-white rounded-3xl shadow-elevated max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-ash-divider p-6 flex items-center justify-between rounded-t-3xl z-10">
          <h2
            id="component-modal-title"
            className="text-[31px] font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
          >
            {isEditMode ? 'Edit Document' : 'Add Document Requirement'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-helper/10 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-helper" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-portrait-ink mb-2">
                Document Type
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => handleDocTypeChange(e.target.value)}
                className="w-full px-4 py-3 border border-ash-divider rounded-2xl focus:outline-none focus:ring-2 focus:ring-portrait-ink/20 transition-shadow"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedDocType === 'custom' && (
              <Input
                label="Document Key"
                placeholder="e.g., emirates_id_front"
                helperText="Lowercase letters and underscores only"
                error={form.formState.errors.key?.message}
                {...form.register('key')}
              />
            )}

            <div className="p-4 bg-mint-wash/30 rounded-2xl space-y-4">
              <Checkbox
                label="Chargeable Document"
                description="Charge a fee for processing this document"
                checked={chargeable}
                onChange={(checked) => form.setValue('chargeable', checked)}
              />

              {chargeable && (
                <Input
                  label="Fee Amount (₹)"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  helperText="INR only"
                  error={form.formState.errors.amount?.message}
                  {...form.register('amount')}
                />
              )}
            </div>

            <div className="space-y-4">
              <Checkbox
                label="Family Enabled"
                description="Required for all family members"
                checked={form.watch('familyEnabled')}
                onChange={(checked) => form.setValue('familyEnabled', checked)}
              />

              <Checkbox
                label="B2B Only"
                description="Only shown in B2B portal"
                checked={form.watch('onlyB2b')}
                onChange={(checked) => form.setValue('onlyB2b', checked)}
              />

              <Checkbox
                label="Optional (User Toggle)"
                description="User can choose whether to provide this document"
                checked={form.watch('toggle')}
                onChange={(checked) => form.setValue('toggle', checked)}
              />
            </div>

            <div className="p-4 bg-sky-wash/30 rounded-2xl">
              <h4 className="text-sm font-medium text-portrait-ink mb-3">
                Validation Attributes
              </h4>
              <p className="text-xs text-slate-helper mb-3">
                Select which validations apply to this document
              </p>
              <div className="space-y-2">
                {COMMON_ATTRIBUTES.map((attr) => (
                  <label key={attr} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentAttributes.includes(attr)}
                      onChange={() => toggleAttribute(attr)}
                      className="w-4 h-4 rounded border-ash-divider"
                    />
                    <span className="text-sm text-portrait-ink">
                      {attr.replace(/_/g, ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Input
              label="Source URL (Optional)"
              type="text"
              inputMode="url"
              placeholder="https://embassy.gov/documents"
              helperText="Official source for this requirement. Leave blank if none."
              error={form.formState.errors.sourceUrl?.message}
              {...form.register('sourceUrl')}
            />
          </div>

          <div className="flex gap-3 mt-8 pt-6 border-t border-ash-divider">
            <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : isEditMode
                  ? 'Update Document'
                  : 'Create Document'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" size="md">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
