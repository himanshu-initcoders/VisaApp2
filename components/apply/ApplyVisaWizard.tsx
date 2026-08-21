'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  Lock,
  Plus,
  ShoppingCart,
  Trash2,
  Upload,
  UserRoundPlus,
  X,
} from 'lucide-react';
import { PassportCaptureFlow } from '@/components/apply/passport/PassportCaptureFlow';
import type { IndianPassportFields } from '@/lib/passport/types';
import type { ApplyStep, ApplyTraveller } from '@/lib/apply/types';
import {
  clearApplyDraft,
  persistPreviewUrl,
  readApplyDraft,
  writeApplyDraft,
  type ApplyDraftDeparture,
} from '@/lib/apply/draftStorage';

export type { ApplyStep, ApplyTraveller };

interface ApplyVisaWizardProps {
  countryName: string;
  countryCode: string;
  listingId: string;
  processName: string;
  initialTravellerCount: number;
  departureLabel: string | null;
  departureMeta?: ApplyDraftDeparture;
  resume?: boolean;
}

const MAX_TRAVELLERS = 100;

function createTraveller(index: number, name = ''): ApplyTraveller {
  return {
    id: `traveller-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    photoUploaded: false,
    passportUploaded: false,
    editing: false,
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function progressForStep(step: ApplyStep) {
  if (step === 'travellers') return 33;
  if (step === 'documents') return 66;
  return 100;
}

function createInitialTravellers(count: number): ApplyTraveller[] {
  return Array.from(
    { length: Math.max(1, Math.min(count, MAX_TRAVELLERS)) },
    (_, i) => createTraveller(i + 1)
  );
}

export function ApplyVisaWizard({
  countryName,
  countryCode,
  listingId,
  processName,
  initialTravellerCount,
  departureLabel,
  departureMeta,
  resume: _resume = false,
}: ApplyVisaWizardProps) {
  void _resume;
  const router = useRouter();
  const [step, setStep] = useState<ApplyStep>('travellers');
  const [primaryName, setPrimaryName] = useState('');
  const [travellers, setTravellers] = useState<ApplyTraveller[]>(() =>
    createInitialTravellers(initialTravellerCount)
  );
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [passportTravellerId, setPassportTravellerId] = useState<string | null>(
    null
  );
  const [departure, setDeparture] = useState<ApplyDraftDeparture>({
    ...departureMeta,
    label: departureLabel,
  });
  const [hydrating, setHydrating] = useState(true);
  const skipFirstPersist = useRef(true);
  const hydratedResume = useRef(false);

  const backHref = `/visa/${countryCode.toLowerCase()}/${listingId}`;
  const progress = progressForStep(step);

  const steps = useMemo(
    () =>
      [
        { id: 'travellers' as const, label: 'Travelers', Icon: UserRoundPlus },
        { id: 'documents' as const, label: 'Documents', Icon: FolderOpen },
        { id: 'pay' as const, label: 'Pay', Icon: ShoppingCart },
      ] as const,
    []
  );

  // Restore draft for this listing (resume CTA, or page refresh mid-flow)
  useEffect(() => {
    const draft = readApplyDraft(listingId);
    if (draft) {
      hydratedResume.current = true;
      setStep(draft.step);
      setPrimaryName(draft.primaryName || draft.travellers[0]?.name || '');
      setTravellers(draft.travellers.map((t) => ({ ...t, editing: false })));
      setDeparture(draft.departure);
    }
    setHydrating(false);
  }, [listingId]);

  // Keep departure label in sync if page props change on a fresh start
  useEffect(() => {
    if (hydratedResume.current) return;
    setDeparture((current) => ({
      ...current,
      ...departureMeta,
      label: departureLabel ?? current.label,
    }));
  }, [departureLabel, departureMeta]);

  // Realtime persist — travellers add/edit/remove, step, passport, names
  useEffect(() => {
    if (hydrating) return;

    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      if (!hydratedResume.current) {
        const hasContent =
          primaryName.trim().length > 0 ||
          travellers.some(
            (t) =>
              t.name.trim() ||
              t.photoUploaded ||
              t.passportUploaded ||
              Boolean(t.passportData)
          ) ||
          step !== 'travellers';
        if (!hasContent) return;
      }
    }

    writeApplyDraft({
      version: 1,
      updatedAt: new Date().toISOString(),
      countryCode,
      countryName,
      listingId,
      processName,
      step,
      primaryName,
      travellers,
      departure,
      travellersCount: travellers.length,
    });
  }, [
    hydrating,
    countryCode,
    countryName,
    listingId,
    processName,
    step,
    primaryName,
    travellers,
    departure,
  ]);

  const handlePrimaryContinue = () => {
    const name = primaryName.trim().toUpperCase();
    if (!name) return;

    setTravellers((current) => {
      if (current.length === 0) return [createTraveller(1, name)];
      return current.map((item, index) =>
        index === 0 ? { ...item, name } : item
      );
    });
    setStep('documents');
  };

  const addTraveller = () => {
    if (travellers.length >= MAX_TRAVELLERS) return;
    const nextIndex = travellers.length + 1;
    const newbie = createTraveller(nextIndex);
    setTravellers((current) => [...current, { ...newbie, editing: true }]);
    setDraftNames((current) => ({ ...current, [newbie.id]: '' }));
  };

  const removeTraveller = (id: string) => {
    setTravellers((current) => {
      if (current.length <= 1) return current;
      const index = current.findIndex((item) => item.id === id);
      if (index <= 0) return current;
      return current.filter((item) => item.id !== id);
    });
    setDraftNames((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const openEdit = (id: string) => {
    setTravellers((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, editing: true }
          : { ...item, editing: false }
      )
    );
    setDraftNames((current) => {
      const target = travellers.find((item) => item.id === id);
      return { ...current, [id]: target?.name || '' };
    });
  };

  const cancelEdit = (id: string) => {
    setTravellers((current) => {
      const target = current.find((item) => item.id === id);
      if (target && !target.name.trim() && current.length > 1) {
        return current.filter((item) => item.id !== id);
      }
      return current.map((item) =>
        item.id === id ? { ...item, editing: false } : item
      );
    });
  };

  const commitEdit = (id: string) => {
    const nextName = (draftNames[id] || '').trim().toUpperCase();
    if (!nextName) return;
    setTravellers((current) =>
      current.map((item) =>
        item.id === id ? { ...item, name: nextName, editing: false } : item
      )
    );
  };

  const markUpload = (
    id: string,
    field: 'photoUploaded' | 'passportUploaded'
  ) => {
    setTravellers((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: true } : item
      )
    );
  };

  const savePassport = async (
    id: string,
    payload: {
      fields: IndianPassportFields;
      frontPreviewUrl: string;
      backPreviewUrl?: string;
    }
  ) => {
    const [front, back] = await Promise.all([
      persistPreviewUrl(payload.frontPreviewUrl),
      persistPreviewUrl(payload.backPreviewUrl),
    ]);

    setTravellers((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const fullName =
          `${payload.fields.givenNames} ${payload.fields.surname}`.trim();
        return {
          ...item,
          passportUploaded: true,
          passportData: payload.fields,
          passportFrontUrl: front || payload.frontPreviewUrl,
          passportBackUrl: back || payload.backPreviewUrl,
          name: item.name || fullName,
        };
      })
    );
    setPassportTravellerId(null);
  };

  const clearAndExit = () => {
    clearApplyDraft(listingId);
    router.push(backHref);
  };

  if (hydrating) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white">
        <p className="text-sm text-slate-helper">Loading application…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[linear-gradient(180deg,#eef5ff_0%,#f7f9fc_42%,#ffffff_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(38,192,255,0.12),transparent_28%),radial-gradient(circle_at_88%_8%,rgba(230,0,194,0.08),transparent_24%)]" />

      <header className="relative z-20 flex items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => {
            if (step === 'documents') {
              setPrimaryName(travellers[0]?.name || primaryName);
              setStep('travellers');
              return;
            }
            if (step === 'pay') {
              setStep('documents');
              return;
            }
            router.push(backHref);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-ash bg-white/80 px-3 py-1.5 text-sm text-portrait-ink shadow-sm backdrop-blur transition-colors hover:bg-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="absolute left-1/2 top-4 w-[min(280px,46vw)] -translate-x-1/2 sm:top-5">
          <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-slate-helper">
            {progress}% completed
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-ash">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#3b82f6,#ff4940_55%,#ffa130)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={clearAndExit}
          className="rounded-full border border-ash bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-helper shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-portrait-ink"
          title="Discard saved draft and exit"
        >
          Discard
        </button>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-72px)] max-w-6xl gap-2 px-2 pb-8 sm:gap-6 sm:px-6">
        <aside className="sticky top-20 flex h-fit shrink-0 flex-col gap-5 rounded-[24px] border border-white/70 bg-white/55 px-2.5 py-5 shadow-sm backdrop-blur sm:px-3">
          {steps.map(({ id, label, Icon }) => {
            const active = step === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === 'travellers') setStep('travellers');
                  if (id === 'documents' && travellers.some((t) => t.name)) {
                    setStep('documents');
                  }
                  if (id === 'pay' && travellers.some((t) => t.name)) {
                    setStep('pay');
                  }
                }}
                className={`flex w-[64px] flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-colors sm:w-[72px] ${
                  active
                    ? 'text-[#3b82f6]'
                    : 'text-slate-helper hover:text-portrait-ink'
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    active ? 'bg-sky-wash' : 'bg-transparent'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            );
          })}
        </aside>

        <main className="min-w-0 flex-1 px-2 pt-4 sm:px-8 sm:pt-8">
          {(departure.label || departureLabel) && (
            <p className="mb-4 text-center text-xs text-slate-helper sm:text-left">
              Departure · {departure.label || departureLabel} · {processName}
            </p>
          )}

          {step === 'travellers' && (
            <section className="mx-auto flex max-w-2xl flex-col items-center pt-8 sm:pt-16">
              <h1 className="text-center font-basier text-3xl leading-tight text-portrait-ink sm:text-4xl">
                Who&apos;s going on this trip to {countryName}?
              </h1>
              <p className="mt-3 text-center text-sm text-slate-helper sm:text-base">
                You can add all travelers or continue solo
              </p>

              <label className="mt-16 w-full max-w-md">
                <span className="sr-only">Traveller name</span>
                <input
                  value={primaryName}
                  onChange={(event) =>
                    setPrimaryName(
                      event.target.value.replace(/[^a-zA-Z\s]/g, '').toUpperCase()
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handlePrimaryContinue();
                  }}
                  placeholder="YOUR NAME"
                  autoFocus
                  className="w-full border-0 border-b border-dashed border-fog bg-transparent pb-3 text-center font-basier text-3xl tracking-wide text-portrait-ink outline-none placeholder:text-fog focus:border-portrait-ink sm:text-4xl"
                />
              </label>

              <button
                type="button"
                disabled={!primaryName.trim()}
                onClick={handlePrimaryContinue}
                className="mt-14 inline-flex min-w-[220px] items-center justify-center gap-2 rounded-full bg-portrait-ink px-8 py-3.5 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          )}

          {step === 'documents' && (
            <DocumentsStep
              countryName={countryName}
              travellers={travellers}
              draftNames={draftNames}
              onDraftChange={(id, value) =>
                setDraftNames((current) => ({
                  ...current,
                  [id]: value.replace(/[^a-zA-Z\s]/g, '').toUpperCase(),
                }))
              }
              onOpenEdit={openEdit}
              onCancelEdit={cancelEdit}
              onCommitEdit={commitEdit}
              onMarkUpload={markUpload}
              onOpenPassport={(id) => setPassportTravellerId(id)}
              onAddTraveller={addTraveller}
              onRemoveTraveller={removeTraveller}
              onProceedCheckout={() => setStep('pay')}
              canAdd={travellers.length < MAX_TRAVELLERS}
            />
          )}

          {step === 'pay' && (
            <section className="mx-auto max-w-xl pt-10 text-center sm:pt-16">
              <h1 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
                Ready to pay
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-helper sm:text-base">
                Payment for {travellers.filter((t) => t.name).length} traveller
                {travellers.filter((t) => t.name).length === 1 ? '' : 's'} to{' '}
                {countryName} will connect here next. Review documents, then
                complete checkout.
              </p>
              <button
                type="button"
                onClick={() => setStep('documents')}
                className="mt-10 inline-flex items-center gap-2 rounded-full border border-portrait-ink px-6 py-3 text-sm font-medium text-portrait-ink transition-colors hover:bg-portrait-ink hover:text-white"
              >
                Back to documents
              </button>
            </section>
          )}
        </main>
      </div>

      {passportTravellerId && (
        <PassportCaptureFlow
          travellerName={
            travellers.find((item) => item.id === passportTravellerId)?.name
          }
          onClose={() => setPassportTravellerId(null)}
          onComplete={(payload) => {
            void savePassport(passportTravellerId, payload);
          }}
        />
      )}
    </div>
  );
}

function DocumentsStep({
  countryName,
  travellers,
  draftNames,
  onDraftChange,
  onOpenEdit,
  onCancelEdit,
  onCommitEdit,
  onMarkUpload,
  onOpenPassport,
  onAddTraveller,
  onRemoveTraveller,
  onProceedCheckout,
  canAdd,
}: {
  countryName: string;
  travellers: ApplyTraveller[];
  draftNames: Record<string, string>;
  onDraftChange: (id: string, value: string) => void;
  onOpenEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onCommitEdit: (id: string) => void;
  onMarkUpload: (
    id: string,
    field: 'photoUploaded' | 'passportUploaded'
  ) => void;
  onOpenPassport: (id: string) => void;
  onAddTraveller: () => void;
  onRemoveTraveller: (id: string) => void;
  onProceedCheckout: () => void;
  canAdd: boolean;
}) {
  return (
    <section className="mx-auto max-w-4xl pt-4 sm:pt-8">
      <div className="text-center sm:text-left">
        <h1 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
          The Essential Documents
        </h1>
        <p className="mt-2 text-sm text-slate-helper sm:text-base">
          These are as per the official {countryName} embassy requirements for
          visa processing
        </p>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-5 sm:mt-10 sm:justify-start">
        {travellers.map((traveller, index) => (
          <TravellerDocumentCard
            key={traveller.id}
            traveller={traveller}
            index={index}
            canDelete={index > 0}
            draftName={draftNames[traveller.id] ?? traveller.name}
            onDraftChange={(value) => onDraftChange(traveller.id, value)}
            onOpenEdit={() => onOpenEdit(traveller.id)}
            onCancelEdit={() => onCancelEdit(traveller.id)}
            onCommitEdit={() => onCommitEdit(traveller.id)}
            onMarkPhoto={() => onMarkUpload(traveller.id, 'photoUploaded')}
            onOpenPassport={() => onOpenPassport(traveller.id)}
            onDelete={() => onRemoveTraveller(traveller.id)}
          />
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-4 sm:mt-14">
        <div className="flex w-full max-w-xl flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <button
            type="button"
            disabled={!canAdd}
            onClick={onAddTraveller}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#3b82f6] bg-white px-5 py-3 text-sm font-medium text-[#3b82f6] transition-colors hover:bg-sky-wash disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Add travelers
          </button>

          <span className="hidden text-xs uppercase tracking-[0.18em] text-slate-helper sm:inline">
            OR
          </span>

          <button
            type="button"
            onClick={onProceedCheckout}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#2f3b4c] px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Lock className="h-3.5 w-3.5" />
            Proceed to checkout
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function TravellerDocumentCard({
  traveller,
  index,
  canDelete,
  draftName,
  onDraftChange,
  onOpenEdit,
  onCancelEdit,
  onCommitEdit,
  onMarkPhoto,
  onOpenPassport,
  onDelete,
}: {
  traveller: ApplyTraveller;
  index: number;
  canDelete: boolean;
  draftName: string;
  onDraftChange: (value: string) => void;
  onOpenEdit: () => void;
  onCancelEdit: () => void;
  onCommitEdit: () => void;
  onMarkPhoto: () => void;
  onOpenPassport: () => void;
  onDelete: () => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const uploadedCount =
    Number(traveller.photoUploaded) + Number(traveller.passportUploaded);
  const displayLabel = traveller.name || `Traveler ${index + 1}`;

  if (traveller.editing) {
    return (
      <div className="relative flex w-full max-w-[280px] flex-col items-center rounded-[24px] border border-ash bg-white p-5 shadow-card sm:min-h-[280px]">
        <button
          type="button"
          aria-label="Close edit"
          onClick={onCancelEdit}
          className="absolute right-3 top-3 rounded-full p-1 text-slate-helper transition-colors hover:bg-mist hover:text-portrait-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint-wash text-sm font-semibold text-portrait-ink">
          {draftName ? initials(draftName) : index + 1}
        </div>
        <p className="mt-3 rounded-full bg-[#f3f4f6] px-3 py-1 text-xs font-medium text-slate-helper">
          Traveler {index + 1}
        </p>

        <div className="mt-auto flex w-full items-center gap-2 pt-8">
          <input
            value={draftName}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onCommitEdit();
            }}
            placeholder="Name"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-[#ff4940] bg-white px-3 py-2.5 text-sm text-portrait-ink outline-none placeholder:text-[#ff4940]/70"
          />
          <button
            type="button"
            aria-label="Save name"
            onClick={onCommitEdit}
            disabled={!draftName.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-helper text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex w-full max-w-[280px] flex-col rounded-[24px] border border-ash bg-white p-5 shadow-card">
      {canDelete && (
        <button
          type="button"
          aria-label={`Remove ${displayLabel}`}
          onClick={onDelete}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-helper transition-colors hover:bg-peach-wash hover:text-[#ff4940]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <div className={`flex items-start gap-3 ${canDelete ? 'pr-8' : ''}`}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed border-[#ff4940] bg-peach-wash/40 text-xs font-semibold text-portrait-ink">
          {traveller.name ? initials(traveller.name) : `T${index + 1}`}
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={onOpenEdit}
            className="truncate text-left text-sm font-semibold uppercase tracking-wide text-portrait-ink hover:underline"
          >
            {displayLabel}
          </button>
          <p className="mt-0.5 text-xs text-slate-helper">
            {uploadedCount}/2 docs uploaded
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <input
          ref={photoRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          className="hidden"
          onChange={() => onMarkPhoto()}
        />

        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-2xl bg-[#f3f4f6] px-4 py-3 text-left text-sm font-medium text-portrait-ink transition-colors hover:bg-sky-wash"
        >
          <Upload
            className={`h-4 w-4 ${
              traveller.photoUploaded ? 'text-[#00cc3d]' : 'text-[#3b82f6]'
            }`}
          />
          Photo
          {traveller.photoUploaded && (
            <span className="ml-auto text-xs text-[#00cc3d]">Uploaded</span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenPassport}
          className="flex w-full items-center gap-2 rounded-2xl bg-[#f3f4f6] px-4 py-3 text-left text-sm font-medium text-portrait-ink transition-colors hover:bg-sky-wash"
        >
          <Upload
            className={`h-4 w-4 ${
              traveller.passportUploaded ? 'text-[#00cc3d]' : 'text-[#3b82f6]'
            }`}
          />
          Passport
          {traveller.passportUploaded && (
            <span className="ml-auto text-xs text-[#00cc3d]">Uploaded</span>
          )}
        </button>
      </div>
    </div>
  );
}
