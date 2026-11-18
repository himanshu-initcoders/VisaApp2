'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/Toggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  toggleCountryEnabled,
  reorderCountries,
} from '@/app/(admin)/admin/config/countries/actions';

interface Country {
  id: string;
  name: string;
  iso2Code: string;
  enabled: boolean;
  supported: boolean;
  sortOrder?: number;
  visaListings: { id: string }[];
}

interface CountriesTableProps {
  countries: Country[];
}

function getFlag(iso2Code: string) {
  const codePoints = iso2Code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function SortableCountryRow({
  country,
  index,
  toggleLoading,
  onToggleClick,
}: {
  country: Country;
  index: number;
  toggleLoading: string | null;
  onToggleClick: (country: Country) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: country.id });

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="border-b border-ash-divider last:border-0 hover:bg-sky-wash transition-colors bg-white"
    >
      <td className="px-4 py-4 w-12">
        <button
          type="button"
          className="inline-flex items-center justify-center text-slate-helper cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Drag to reorder ${country.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 shrink-0" />
        </button>
      </td>

      <td className="px-2 py-4 w-12 text-center">
        <span className="text-sm font-medium text-slate-helper tabular-nums">
          {index + 1}
        </span>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getFlag(country.iso2Code)}</span>
          <div>
            <p className="font-medium text-portrait-ink">{country.name}</p>
            {!country.supported && (
              <span className="text-xs text-slate-helper">Not supported</span>
            )}
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-ash-divider text-portrait-ink">
          {country.iso2Code}
        </span>
      </td>

      <td className="px-6 py-4 text-center">
        <span className="font-medium text-portrait-ink">
          {country.visaListings.length}
        </span>
      </td>

      <td className="px-6 py-4">
        <div className="flex justify-center">
          <Toggle
            enabled={country.enabled}
            onChange={() => onToggleClick(country)}
            disabled={toggleLoading === country.id}
          />
        </div>
      </td>

      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/admin/config/countries/${country.iso2Code}`}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              'text-portrait-ink hover:bg-sky-wash'
            )}
          >
            Manage
          </Link>
          {country.visaListings.length > 0 && (
            <Link
              href={`/admin/config/visa-listings?country=${country.iso2Code}`}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                'text-portrait-ink hover:bg-mint-wash'
              )}
            >
              Visa Listings →
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * CountriesTable Component
 *
 * Displays all countries with drag-and-drop ordering for the public catalog.
 */
export function CountriesTable({ countries: initialCountries }: CountriesTableProps) {
  const router = useRouter();
  const [countries, setCountries] = useState(initialCountries);
  const [isMounted, setIsMounted] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    countryId: string;
    countryName: string;
    currentStatus: boolean;
  }>({
    open: false,
    countryId: '',
    countryName: '',
    currentStatus: false,
  });
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  useEffect(() => setIsMounted(true), []);
  useEffect(() => setCountries(initialCountries), [initialCountries]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleToggleClick = (country: Country) => {
    setConfirmDialog({
      open: true,
      countryId: country.id,
      countryName: country.name,
      currentStatus: country.enabled,
    });
  };

  const handleConfirmToggle = async () => {
    setToggleLoading(confirmDialog.countryId);

    try {
      const result = await toggleCountryEnabled(confirmDialog.countryId);

      if (result.error) {
        alert(result.error);
      } else {
        setConfirmDialog({
          open: false,
          countryId: '',
          countryName: '',
          currentStatus: false,
        });
        router.refresh();
      }
    } catch {
      alert('Failed to toggle country status');
    } finally {
      setToggleLoading(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = countries.findIndex((c) => c.id === active.id);
    const newIndex = countries.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = countries;
    const reordered = arrayMove(countries, oldIndex, newIndex);
    setCountries(reordered);

    const result = await reorderCountries(reordered.map((c) => c.id));
    if (result.error) {
      setCountries(previous);
      alert(result.error);
      return;
    }
    router.refresh();
  };

  if (countries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-helper">No countries found</div>
    );
  }

  const tableHeader = (
    <thead>
      <tr className="border-b border-ash-divider">
        <th className="px-4 py-4 w-12" aria-label="Drag handle" />
        <th className="px-2 py-4 w-12 text-center">
          <span
            className="text-sm font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle' }}
          >
            #
          </span>
        </th>
        <th className="px-6 py-4 text-left">
          <span
            className="text-sm font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle' }}
          >
            Country
          </span>
        </th>
        <th className="px-6 py-4 text-left">
          <span
            className="text-sm font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle' }}
          >
            Code
          </span>
        </th>
        <th className="px-6 py-4 text-center">
          <span
            className="text-sm font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle' }}
          >
            Visa Listings
          </span>
        </th>
        <th className="px-6 py-4 text-center">
          <span
            className="text-sm font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle' }}
          >
            Status
          </span>
        </th>
        <th className="px-6 py-4 text-right">
          <span
            className="text-sm font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle' }}
          >
            Actions
          </span>
        </th>
      </tr>
    </thead>
  );

  const rows = countries.map((country, index) => (
    <SortableCountryRow
      key={country.id}
      country={country}
      index={index}
      toggleLoading={toggleLoading}
      onToggleClick={handleToggleClick}
    />
  ));

  return (
    <>
      <div className="bg-white rounded-3xl border border-ash-divider overflow-hidden">
        <div className="overflow-x-auto">
          {isMounted ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={countries.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <table className="w-full">
                  {tableHeader}
                  <tbody>{rows}</tbody>
                </table>
              </SortableContext>
            </DndContext>
          ) : (
            <table className="w-full">
              {tableHeader}
              <tbody>{rows}</tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() =>
          setConfirmDialog({
            open: false,
            countryId: '',
            countryName: '',
            currentStatus: false,
          })
        }
        onConfirm={handleConfirmToggle}
        title={`${confirmDialog.currentStatus ? 'Disable' : 'Enable'} ${confirmDialog.countryName}?`}
        message={
          confirmDialog.currentStatus
            ? `This will hide ${confirmDialog.countryName} from users. Entry processes will not be available for visa applications. You can re-enable it anytime.`
            : `This will make ${confirmDialog.countryName} visible to users. Entry processes will become available for visa applications.`
        }
        confirmText={confirmDialog.currentStatus ? 'Disable' : 'Enable'}
        loading={toggleLoading === confirmDialog.countryId}
      />
    </>
  );
}
