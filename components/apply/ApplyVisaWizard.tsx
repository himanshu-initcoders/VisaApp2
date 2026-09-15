'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ApplyStepper } from '@/components/apply/ApplyStepper';
import { BasicInformationStep } from '@/components/apply/BasicInformationStep';
import { ReviewStep } from '@/components/apply/review/ReviewStep';
import { PassportCaptureFlow } from '@/components/apply/passport/PassportCaptureFlow';
import type { PassportApplicationPayload } from '@/components/apply/passport/PassportReviewStage';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import { defaultApplyFormConfig } from '@/lib/apply/applicationForm';
import type { ApplyStep, ApplyTraveller } from '@/lib/apply/types';
import { isTravellerFilled } from '@/lib/apply/reviewFields';
import {
  persistPreviewUrl,
  readApplyDraft,
  writeApplyDraft,
  type ApplyDraftDeparture,
} from '@/lib/apply/draftStorage';
import {
  formatProfileName,
  listTravellerProfiles,
  profileFromTraveller,
  saveTravellerProfile,
  type TravellerProfile,
} from '@/lib/apply/travellerProfiles';

export type { ApplyStep, ApplyTraveller };

interface ApplyVisaWizardProps {
  countryName: string;
  countryCode: string;
  listingId: string;
  processName: string;
  /** e.g. "United States Business Visa 30 Days" — always shown in the apply header */
  visaFullName?: string;
  initialTravellerCount: number;
  departureLabel: string | null;
  departureMeta?: ApplyDraftDeparture;
  formConfig?: ApplyFormConfig;
  resume?: boolean;
}

const MAX_TRAVELLERS = 100;

function createTraveller(index: number, name = ''): ApplyTraveller {
  return {
    id: `traveller-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    photoUploaded: false,
    passportUploaded: false,
    applicationComplete: false,
    editing: false,
  };
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
  visaFullName,
  initialTravellerCount,
  departureLabel,
  departureMeta,
  formConfig = defaultApplyFormConfig(countryName, processName),
  resume: _resume = false,
}: ApplyVisaWizardProps) {
  void _resume;
  const router = useRouter();
  const visaLabel = visaFullName?.trim() || processName;
  const [step, setStep] = useState<ApplyStep>('travellers');
  const [primaryName, setPrimaryName] = useState('');
  const [travellers, setTravellers] = useState<ApplyTraveller[]>(() =>
    createInitialTravellers(initialTravellerCount)
  );
  const [passportTravellerId, setPassportTravellerId] = useState<string | null>(
    null
  );
  const [passportResume, setPassportResume] = useState(false);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [departure, setDeparture] = useState<ApplyDraftDeparture>({
    ...departureMeta,
    label: departureLabel,
  });
  const [hydrating, setHydrating] = useState(true);
  const [profiles, setProfiles] = useState<TravellerProfile[]>([]);
  const skipFirstPersist = useRef(true);
  const hydratedResume = useRef(false);

  const backHref = `/visa/${countryCode.toLowerCase()}/${listingId}`;
  const namedTraveller = travellers.some((t) => t.name.trim());
  const filledTravellers = travellers.filter(isTravellerFilled);
  const activePassportTraveller = travellers.find(
    (item) => item.id === passportTravellerId
  );

  // Restore draft for this listing (resume CTA, or page refresh mid-flow)
  useEffect(() => {
    const draft = readApplyDraft(listingId);
    if (draft) {
      hydratedResume.current = true;
      setStep(draft.step);
      setPrimaryName(
        formatProfileName(draft.primaryName || draft.travellers[0]?.name || '')
      );
      setTravellers(draft.travellers.map((t) => ({ ...t, editing: false })));
      setDeparture(draft.departure);
    }
    setProfiles(listTravellerProfiles());
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

  const persistNamedProfile = (traveller: ApplyTraveller, visaType = processName) => {
    const profile = profileFromTraveller(traveller, visaType);
    if (!profile) return;
    saveTravellerProfile(profile);
    setProfiles(listTravellerProfiles());
  };

  const handlePrimaryContinue = () => {
    const name = primaryName.trim().toUpperCase();
    if (!name) return;

    const nextTraveller = createTraveller(1, name);
    setTravellers((current) => {
      if (current.length === 0) return [nextTraveller];
      return current.map((item, index) =>
        index === 0 ? { ...item, name } : item
      );
    });
    persistNamedProfile(
      travellers[0] ? { ...travellers[0], name } : nextTraveller
    );
    setStep('documents');
  };

  const handleSelectProfile = (profile: TravellerProfile) => {
    const name = profile.name.trim().toUpperCase();
    if (!name) return;

    setPrimaryName(formatProfileName(profile.name));
    setTravellers((current) => {
      const next: ApplyTraveller = {
        ...(current[0] ?? createTraveller(1, name)),
        name,
        photoUploaded: profile.photoUploaded ?? false,
        passportUploaded: profile.passportUploaded ?? false,
        passportFrontUrl: profile.passportFrontUrl,
      };
      if (current.length === 0) return [next];
      return current.map((item, index) => (index === 0 ? next : item));
    });
    persistNamedProfile({
      id: profile.id,
      name,
      photoUploaded: profile.photoUploaded ?? false,
      passportUploaded: profile.passportUploaded ?? false,
      passportFrontUrl: profile.passportFrontUrl,
      editing: false,
    });
    setStep('documents');
  };

  const addTraveller = (name: string) => {
    if (travellers.length >= MAX_TRAVELLERS) return;
    const nextName = name.trim().toUpperCase();
    if (!nextName) return;
    const newbie = createTraveller(travellers.length + 1, nextName);
    setTravellers((current) => [...current, newbie]);
    persistNamedProfile(newbie);
  };

  const removeTraveller = (id: string) => {
    setTravellers((current) => {
      if (current.length <= 1) return current;
      return current.filter((item) => item.id !== id);
    });
  };

  const openPassport = (id: string, resume = false, file?: File) => {
    setPassportResume(resume);
    setPassportFile(file ?? null);
    setPassportTravellerId(id);
  };

  const openFillApplication = (id: string) => {
    openPassport(id, true);
  };

  const savePassport = async (
    id: string,
    payload: PassportApplicationPayload
  ) => {
    const [front, back, ...documentUrls] = await Promise.all([
      persistPreviewUrl(payload.frontPreviewUrl),
      persistPreviewUrl(payload.backPreviewUrl),
      ...payload.documents.map((item) => persistPreviewUrl(item.previewUrl)),
    ]);

    const fullName =
      `${payload.fields.givenNames} ${payload.fields.surname}`.trim();
    const frontUrl = front || payload.frontPreviewUrl;
    const backUrl = back || payload.backPreviewUrl;
    const documents = payload.documents.map((item, index) => ({
      ...item,
      previewUrl: documentUrls[index] || item.previewUrl,
    }));
    const photoUploaded = documents.some((item) => item.key === 'photo');

    setTravellers((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          passportUploaded: formConfig.showGeneralInfo
            ? true
            : item.passportUploaded,
          photoUploaded,
          applicationComplete: true,
          passportData: payload.fields,
          passportFrontUrl: frontUrl,
          passportBackUrl: backUrl,
          tripDetails: payload.tripDetails,
          documents,
          name: fullName || item.name,
        };
      })
    );
    persistNamedProfile({
      id,
      name: fullName,
      photoUploaded,
      passportUploaded: formConfig.showGeneralInfo,
      passportData: payload.fields,
      passportFrontUrl: frontUrl,
      passportBackUrl: backUrl,
      tripDetails: payload.tripDetails,
      documents,
      applicationComplete: true,
      editing: false,
    });
    setPassportTravellerId(null);
    setPassportResume(false);
    setPassportFile(null);
  };

  if (hydrating) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f4f7fb]">
        <p className="text-sm text-slate-helper">Loading application…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb]">
      <header className="relative z-20 px-4 pb-2 pt-4 sm:px-8 sm:pt-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (step === 'documents') {
                setPrimaryName(
                  formatProfileName(travellers[0]?.name || primaryName)
                );
                setStep('travellers');
                return;
              }
              if (step === 'pay') {
                setStep('documents');
                return;
              }
              router.push(backHref);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-slate-helper transition-colors hover:text-portrait-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <p className="min-w-0 flex-1 text-right text-sm font-medium leading-snug text-portrait-ink sm:text-base">
            {visaLabel}
          </p>
        </div>

        <div className="mt-3 sm:mt-4">
          <ApplyStepper
            step={step}
            canOpenReview={namedTraveller}
            canOpenCheckout={filledTravellers.length > 0}
            onSelect={(next) => setStep(next)}
          />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-8">
        {(departure.label || departureLabel) && step !== 'travellers' && (
          <p className="mb-4 text-center text-xs text-slate-helper">
            Departure · {departure.label || departureLabel} · {visaLabel}
          </p>
        )}

        {step === 'travellers' && (
          <BasicInformationStep
            primaryName={primaryName}
            onNameChange={setPrimaryName}
            onContinue={handlePrimaryContinue}
            onSelectProfile={handleSelectProfile}
            profiles={profiles}
          />
        )}

        {step === 'documents' && (
          <ReviewStep
            countryName={countryName}
            travellers={travellers}
            canAdd={travellers.length < MAX_TRAVELLERS}
            extraQuestions={formConfig.extraQuestions}
            documentSlots={formConfig.documentSlots}
            showGeneralInfo={formConfig.showGeneralInfo}
            showTripDetails={formConfig.showTripDetails}
            onAddTraveller={addTraveller}
            onRemoveTraveller={removeTraveller}
            onUploadPassport={(id, file) => openPassport(id, false, file)}
            onFillApplication={openFillApplication}
            onEditTraveller={(id) => openPassport(id, true)}
            onProceedCheckout={() => {
              if (filledTravellers.length === 0) return;
              setStep('pay');
            }}
          />
        )}

        {step === 'pay' && (
          <section className="mx-auto max-w-xl pt-10 text-center sm:pt-16">
            <h1 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
              Ready to pay
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-helper sm:text-base">
              Payment for {filledTravellers.length} traveller
              {filledTravellers.length === 1 ? '' : 's'} to {countryName} will
              connect here next.
            </p>
            <button
              type="button"
              onClick={() => setStep('documents')}
              className="mt-10 inline-flex items-center gap-2 rounded-full border border-portrait-ink px-6 py-3 text-sm font-medium text-portrait-ink transition-colors hover:bg-portrait-ink hover:text-white"
            >
              Back to review
            </button>
          </section>
        )}
      </main>

      {passportTravellerId && (passportFile || passportResume) && (
        <PassportCaptureFlow
          travellerName={activePassportTraveller?.name}
          initialFile={passportFile ?? undefined}
          formConfig={formConfig}
          arrivalPrefill={departure.departure}
          resume={
            passportResume
              ? {
                  fields: activePassportTraveller?.passportData ?? {
                    passportNumber: '',
                    surname: '',
                    givenNames: '',
                    nationality: 'IND',
                    dateOfBirth: '',
                    sex: '',
                    dateOfExpiry: '',
                    documentType: 'P',
                    countryOfIssue: 'IND',
                  },
                  frontPreviewUrl:
                    activePassportTraveller?.passportFrontUrl ?? '',
                  backPreviewUrl: activePassportTraveller?.passportBackUrl,
                  tripDetails: activePassportTraveller?.tripDetails,
                  documents: activePassportTraveller?.documents,
                }
              : undefined
          }
          onClose={() => {
            setPassportTravellerId(null);
            setPassportResume(false);
            setPassportFile(null);
          }}
          onComplete={(payload) => {
            void savePassport(passportTravellerId, payload);
          }}
        />
      )}
    </div>
  );
}
