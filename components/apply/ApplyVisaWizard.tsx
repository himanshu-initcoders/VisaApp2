'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { ApplyStepper } from '@/components/apply/ApplyStepper';
import { BasicInformationStep } from '@/components/apply/BasicInformationStep';
import { ReviewStep } from '@/components/apply/review/ReviewStep';
import { PassportCaptureFlow } from '@/components/apply/passport/PassportCaptureFlow';
import { CheckoutPayStep } from '@/components/apply/CheckoutPayStep';
import type { PassportApplicationPayload } from '@/components/apply/passport/PassportReviewStage';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import {
  defaultApplyFormConfig,
  isAdditionalQuestionsComplete,
  isCoreTripComplete,
  isDocumentsComplete,
  isMultiStopComplete,
} from '@/lib/apply/applicationForm';
import { isReviewComplete } from '@/lib/passport/schema';
import type { ApplyStep, ApplyTraveller } from '@/lib/apply/types';
import { isTravellerFilled, travellerDisplayName } from '@/lib/apply/reviewFields';
import {
  draftSubstanceScore,
  migrateLegacyDraftBinaries,
  readApplyDraftAsync,
  rehydrateTravellerPreviews,
  writeApplyDraft,
  writeApplyDraftAsync,
  type ApplyDraftDeparture,
} from '@/lib/apply/draftStorage';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
  deletePassengerFiles,
  idbErrorMessage,
  isIdbAvailable,
  putFile,
  urlToBlob,
} from '@/lib/apply/idbDraftStorage';
import {
  formatProfileName,
  listTravellerProfiles,
  profileFromTraveller,
  saveTravellerProfile,
  type TravellerProfile,
} from '@/lib/apply/travellerProfiles';
import { getMyPassengerAutofill } from '@/app/visa/actions';
import { restoreAutofillDocumentsToIdb } from '@/lib/apply/restoreAutofillDocuments';
import { getFlagEmoji } from '@/lib/public';

export type { ApplyStep, ApplyTraveller };

interface ApplyVisaWizardProps {
  countryName: string;
  countryCode: string;
  /** Flag image URL from countries.images.flag.url */
  flagUrl?: string | null;
  listingId: string;
  processName: string;
  /** e.g. "United States Business Visa 30 Days" — always shown in the apply header */
  visaFullName?: string;
  initialTravellerCount: number;
  departureLabel: string | null;
  departureMeta?: ApplyDraftDeparture;
  formConfig?: ApplyFormConfig;
  resume?: boolean;
  isAuthenticated?: boolean;
  previousProfiles?: TravellerProfile[];
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

/** True only when every required tab on this listing is filled. */
function isListingApplicationComplete(
  traveller: ApplyTraveller,
  formConfig: ApplyFormConfig
) {
  const generalComplete = formConfig.showGeneralInfo
    ? Boolean(traveller.passportData && isReviewComplete(traveller.passportData))
    : true;
  const tripComplete = formConfig.showTripDetails
    ? isCoreTripComplete(traveller.tripDetails) &&
      isMultiStopComplete(traveller.tripDetails)
    : true;
  const additionalComplete =
    formConfig.extraQuestions.length === 0
      ? true
      : isAdditionalQuestionsComplete(
          traveller.tripDetails,
          formConfig.extraQuestions
        );
  const documentsComplete = isDocumentsComplete(
    traveller.documents,
    formConfig.documentSlots
  );

  return (
    generalComplete && tripComplete && additionalComplete && documentsComplete
  );
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
  flagUrl,
  listingId,
  processName,
  visaFullName,
  initialTravellerCount,
  departureLabel,
  departureMeta,
  formConfig = defaultApplyFormConfig(countryName, processName),
  resume: _resume = false,
  isAuthenticated = false,
  previousProfiles = [],
}: ApplyVisaWizardProps) {
  void _resume;
  const router = useRouter();
  const visaLabel = visaFullName?.trim() || processName;
  const [step, setStep] = useState<ApplyStep>('travellers');
  const [primaryName, setPrimaryName] = useState('');
  const [travellers, setTravellers] = useState<ApplyTraveller[]>(() =>
    createInitialTravellers(initialTravellerCount)
  );
  const [profiles, setProfiles] = useState<TravellerProfile[]>(() =>
    isAuthenticated ? previousProfiles : []
  );
  const [selectingProfile, setSelectingProfile] = useState(false);
  const [autofillWarning, setAutofillWarning] = useState<string | null>(null);
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
  const skipFirstPersist = useRef(true);
  const hydratedResume = useRef(false);
  /** Only true after hydrate finishes — blocks empty overwrite races. */
  const persistEnabled = useRef(false);
  const travellersRef = useRef(travellers);
  travellersRef.current = travellers;
  const stepRef = useRef(step);
  stepRef.current = step;
  const primaryNameRef = useRef(primaryName);
  primaryNameRef.current = primaryName;
  const departureRef = useRef(departure);
  departureRef.current = departure;

  const backHref = `/visa/${countryCode.toLowerCase()}/${listingId}`;
  const namedTraveller = travellers.some((t) => t.name.trim());
  const usedProfileNames = new Set(
    travellers
      .map((traveller) => traveller.name.trim().toUpperCase())
      .filter(Boolean)
  );
  const availableProfiles = profiles.filter(
    (profile) => !usedProfileNames.has(profile.name.trim().toUpperCase())
  );
  const allProfilesAdded =
    profiles.length > 0 && availableProfiles.length === 0;
  const filledTravellers = travellers.filter(isTravellerFilled);
  const activePassportTraveller = travellers.find(
    (item) => item.id === passportTravellerId
  );

  // Restore draft for this listing (resume CTA, or page refresh mid-flow)
  useEffect(() => {
    let cancelled = false;
    persistEnabled.current = false;
    skipFirstPersist.current = true;
    hydratedResume.current = false;
    setHydrating(true);

    async function hydrate() {
      try {
        const draft = await readApplyDraftAsync(listingId);
        if (cancelled) return;

        if (draft) {
          hydratedResume.current = true;
          try {
            const migrated = await migrateLegacyDraftBinaries(draft);
            const hydrated = await rehydrateTravellerPreviews(
              listingId,
              migrated
            );
            if (cancelled) return;
            setStep(draft.step);
            setPrimaryName(
              formatProfileName(
                draft.primaryName || draft.travellers[0]?.name || ''
              )
            );
            setTravellers(hydrated.map((t) => ({ ...t, editing: false })));
            setDeparture(draft.departure ?? {});
          } catch (error) {
            console.warn('Draft hydrate failed', error);
            if (cancelled) return;
            setStep(draft.step);
            setPrimaryName(
              formatProfileName(
                draft.primaryName || draft.travellers[0]?.name || ''
              )
            );
            setTravellers(
              draft.travellers.map((t) => ({ ...t, editing: false }))
            );
            setDeparture(draft.departure ?? {});
          }
        } else {
          hydratedResume.current = false;
        }

        if (cancelled) return;
        if (!isAuthenticated) {
          setProfiles(listTravellerProfiles({ includeSamples: false }));
        }
      } finally {
        if (!cancelled) {
          persistEnabled.current = true;
          setHydrating(false);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [listingId, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setProfiles(previousProfiles);
    }
  }, [isAuthenticated, previousProfiles]);

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
    if (hydrating || !persistEnabled.current) return;

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
      } else {
        // After resume hydrate: skip one write only if state is still an empty shell
        const score = draftSubstanceScore({
          primaryName,
          step,
          travellers,
        });
        if (score <= 2) return;
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
    if (!isAuthenticated) {
      setProfiles(listTravellerProfiles({ includeSamples: false }));
    }
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

  const handleSelectProfile = async (profile: TravellerProfile) => {
    const name = profile.name.trim().toUpperCase();
    if (!name) return;

    setAutofillWarning(null);

    // Server profile: hydrate passport / trip / docs from past applications
    if (profile.isServerProfile && isAuthenticated) {
      setSelectingProfile(true);
      try {
        const result = await getMyPassengerAutofill({
          profileId: profile.id,
          formConfig,
        });

        if (!result.success || !result.data) {
          setAutofillWarning(
            result.message || 'Could not load previous answers. Continuing with name only.'
          );
          setPrimaryName(formatProfileName(profile.name));
          const fallback = createTraveller(1, name);
          setTravellers([fallback]);
          setStep('documents');
          return;
        }

        const payload = result.data;
        const nextTraveller = createTraveller(1, name);
        const displayName = formatProfileName(payload.name || profile.name);
        setPrimaryName(displayName);

        const restored = await restoreAutofillDocumentsToIdb({
          listingId,
          travellerId: nextTraveller.id,
          refs: payload.documents,
        });

        const draftTraveller: ApplyTraveller = {
          ...nextTraveller,
          name: displayName.toUpperCase(),
          passportData: payload.passportData ?? undefined,
          tripDetails: payload.tripDetails ?? undefined,
          passportUploaded:
            restored.passportUploaded || Boolean(payload.passportData),
          photoUploaded: restored.photoUploaded,
          passportFrontUrl: restored.passportFrontUrl,
          passportBackUrl: restored.passportBackUrl,
          documents: restored.documents,
          applicationComplete: false,
          editing: false,
        };
        const applicationComplete = isListingApplicationComplete(
          draftTraveller,
          formConfig
        );
        const filled: ApplyTraveller = {
          ...draftTraveller,
          applicationComplete,
        };

        setTravellers([filled]);
        persistNamedProfile(filled);

        if (restored.failedSlots.length > 0) {
          setAutofillWarning(
            `Some documents could not be restored (${restored.failedSlots.length}). You can re-upload them.`
          );
        }

        setStep('documents');
        // Required tabs still empty (e.g. extra questions from another form):
        // open Complete application on the first unfilled tab.
        if (!applicationComplete) {
          setPassportFile(null);
          setPassportResume(true);
          setPassportTravellerId(filled.id);
        }
      } catch (error) {
        console.error('Profile autofill failed', error);
        setAutofillWarning(
          'Could not restore previous data. Continuing with name only.'
        );
        setPrimaryName(formatProfileName(profile.name));
        setTravellers([createTraveller(1, name)]);
        setStep('documents');
      } finally {
        setSelectingProfile(false);
      }
      return;
    }

    // Local / logged-out: name-only (existing behaviour)
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

  const appendTraveller = (traveller: ApplyTraveller) => {
    const token = traveller.name.trim().toUpperCase();
    const current = travellersRef.current;
    if (current.length >= MAX_TRAVELLERS) return false;
    if (
      token &&
      current.some((item) => item.name.trim().toUpperCase() === token)
    ) {
      return false;
    }
    const next = [...current, traveller];
    travellersRef.current = next;
    setTravellers(next);
    persistNamedProfile(traveller);
    return true;
  };

  const addTravellerFromProfile = async (profile: TravellerProfile) => {
    if (travellersRef.current.length >= MAX_TRAVELLERS) return;
    const name = profile.name.trim().toUpperCase();
    if (!name) return;
    if (
      travellersRef.current.some(
        (item) => item.name.trim().toUpperCase() === name
      )
    ) {
      return;
    }

    setAutofillWarning(null);

    if (profile.isServerProfile && isAuthenticated) {
      setSelectingProfile(true);
      try {
        const result = await getMyPassengerAutofill({
          profileId: profile.id,
          formConfig,
        });

        const newbie = createTraveller(
          travellersRef.current.length + 1,
          name
        );

        if (!result.success || !result.data) {
          setAutofillWarning(
            result.message ||
              'Could not load previous answers. Added the name only.'
          );
          appendTraveller(newbie);
          return;
        }

        const payload = result.data;
        const displayName = formatProfileName(payload.name || profile.name);
        const restored = await restoreAutofillDocumentsToIdb({
          listingId,
          travellerId: newbie.id,
          refs: payload.documents,
        });

        const draftTraveller: ApplyTraveller = {
          ...newbie,
          name: displayName.toUpperCase(),
          passportData: payload.passportData ?? undefined,
          tripDetails: payload.tripDetails ?? undefined,
          passportUploaded:
            restored.passportUploaded || Boolean(payload.passportData),
          photoUploaded: restored.photoUploaded,
          passportFrontUrl: restored.passportFrontUrl,
          passportBackUrl: restored.passportBackUrl,
          documents: restored.documents,
          applicationComplete: false,
          editing: false,
        };
        const applicationComplete = isListingApplicationComplete(
          draftTraveller,
          formConfig
        );
        const filled: ApplyTraveller = {
          ...draftTraveller,
          applicationComplete,
        };

        const added = appendTraveller(filled);
        if (!added) return;

        if (restored.failedSlots.length > 0) {
          setAutofillWarning(
            `Some documents could not be restored (${restored.failedSlots.length}). You can re-upload them.`
          );
        }

        if (!applicationComplete) {
          setPassportFile(null);
          setPassportResume(true);
          setPassportTravellerId(filled.id);
        }
      } catch (error) {
        console.error('Profile autofill failed', error);
        setAutofillWarning(
          'Could not restore previous data. Added the name only.'
        );
        appendTraveller(
          createTraveller(travellersRef.current.length + 1, name)
        );
      } finally {
        setSelectingProfile(false);
      }
      return;
    }

    const newbie = createTraveller(travellersRef.current.length + 1, name);
    appendTraveller({
      ...newbie,
      photoUploaded: profile.photoUploaded ?? false,
      passportUploaded: profile.passportUploaded ?? false,
      passportFrontUrl: profile.passportFrontUrl,
    });
  };

  const removeTraveller = (id: string) => {
    setTravellers((current) => {
      if (current.length <= 1) return current;
      return current.filter((item) => item.id !== id);
    });
    if (isIdbAvailable()) {
      void deletePassengerFiles(listingId, id).catch((error) => {
        console.warn('Could not clear traveller files', error);
      });
    }
  };

  const openPassport = (id: string, resume = false, file?: File) => {
    setPassportResume(resume);
    setPassportFile(file ?? null);
    setPassportTravellerId(id);
  };

  const openFillApplication = (id: string) => {
    openPassport(id, true);
  };

  /** Persist passport images + traveller fields to IDB/draft. Does not close overlay when complete=false. */
  const persistTravellerApplication = async (
    id: string,
    payload: PassportApplicationPayload,
    options: { complete: boolean; closeOverlay: boolean }
  ) => {
    const fullName =
      `${payload.fields.givenNames} ${payload.fields.surname}`.trim();

    let frontUrl = payload.frontPreviewUrl;
    let backUrl = payload.backPreviewUrl;
    const documents = [...payload.documents];

    try {
      if (!isIdbAvailable()) {
        throw new Error(idbErrorMessage(new Error('IndexedDB unavailable')));
      }

      const frontBlob = await urlToBlob(payload.frontPreviewUrl);
      if (frontBlob) {
        await putFile(listingId, id, PASSPORT_FRONT_SLOT, {
          blob: frontBlob,
          mimeType: frontBlob.type || 'image/jpeg',
          filename: 'passport-front.jpg',
        });
        if (!frontUrl?.startsWith('blob:')) {
          frontUrl = URL.createObjectURL(frontBlob);
        }
      }

      if (payload.backPreviewUrl) {
        const backBlob = await urlToBlob(payload.backPreviewUrl);
        if (backBlob) {
          await putFile(listingId, id, PASSPORT_BACK_SLOT, {
            blob: backBlob,
            mimeType: backBlob.type || 'image/jpeg',
            filename: 'passport-back.jpg',
          });
          if (!backUrl?.startsWith('blob:')) {
            backUrl = URL.createObjectURL(backBlob);
          }
        }
      }

      for (let i = 0; i < documents.length; i += 1) {
        const item = documents[i];
        if (item.storedInIdb) continue;
        if (!item.previewUrl) continue;
        const blob = await urlToBlob(item.previewUrl);
        if (!blob) continue;
        await putFile(listingId, id, item.key, {
          blob,
          mimeType: item.mimeType || blob.type,
          filename: item.name || `${item.key}.bin`,
        });
        documents[i] = {
          ...item,
          size: blob.size,
          storedInIdb: true,
          previewUrl: item.previewUrl.startsWith('blob:')
            ? item.previewUrl
            : URL.createObjectURL(blob),
        };
      }
    } catch (error) {
      console.error('Failed to persist passport files to IndexedDB', error);
      if (options.complete) {
        window.alert(
          idbErrorMessage(error) ||
            'Could not save documents in this browser. Try again in a normal window.'
        );
      }
      if (options.complete) return;
      // Progress saves: still keep field JSON even if a binary write fails
    }

    const photoUploaded = documents.some((item) => item.key === 'photo');
    const currentTravellers = travellersRef.current;

    const nextTravellers = currentTravellers.map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        passportUploaded: true,
        photoUploaded: photoUploaded || item.photoUploaded,
        applicationComplete: options.complete
          ? true
          : item.applicationComplete,
        passportData: payload.fields,
        passportFrontUrl: frontUrl || item.passportFrontUrl,
        passportBackUrl: backUrl || item.passportBackUrl,
        tripDetails: payload.tripDetails,
        documents:
          documents.length > 0 ? documents : item.documents,
        name: fullName || item.name,
      };
    });

    setTravellers(nextTravellers);
    travellersRef.current = nextTravellers;

    // Ensure review step is restored after reload mid-flow
    const nextStep =
      stepRef.current === 'travellers' ? 'documents' : stepRef.current;
    if (nextStep !== stepRef.current) {
      setStep(nextStep);
      stepRef.current = nextStep;
    }

    await writeApplyDraftAsync({
      version: 1,
      updatedAt: new Date().toISOString(),
      countryCode,
      countryName,
      listingId,
      processName,
      step: nextStep,
      primaryName: primaryNameRef.current,
      travellers: nextTravellers,
      departure: departureRef.current,
      travellersCount: nextTravellers.length,
    });

    if (options.complete) {
      persistNamedProfile({
        id,
        name: fullName,
        photoUploaded,
        passportUploaded: true,
        passportData: payload.fields,
        passportFrontUrl: undefined,
        passportBackUrl: undefined,
        tripDetails: payload.tripDetails,
        documents: documents.map((doc) => ({
          key: doc.key,
          name: doc.name,
          mimeType: doc.mimeType,
          size: doc.size,
          storedInIdb: true,
        })),
        applicationComplete: true,
        editing: false,
      });
    }

    if (options.closeOverlay) {
      setPassportTravellerId(null);
      setPassportResume(false);
      setPassportFile(null);
    }
  };

  const savePassportProgress = (id: string, payload: PassportApplicationPayload) => {
    void persistTravellerApplication(id, payload, {
      complete: false,
      closeOverlay: false,
    });
  };

  const savePassport = async (
    id: string,
    payload: PassportApplicationPayload
  ) => {
    await persistTravellerApplication(id, payload, {
      complete: true,
      closeOverlay: true,
    });
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
            <span className="inline-flex max-w-full items-center justify-end gap-2">
              <span className="relative flex h-5 w-5 shrink-0 overflow-hidden rounded-full bg-sky-wash sm:h-6 sm:w-6">
                {flagUrl ? (
                  <Image
                    src={flagUrl}
                    alt=""
                    fill
                    sizes="24px"
                    className="object-cover"
                  />
                ) : (
                  <span
                    className="flex size-full items-center justify-center text-sm leading-none sm:text-base"
                    aria-hidden
                  >
                    {getFlagEmoji(countryCode)}
                  </span>
                )}
              </span>
              <span className="min-w-0 truncate">{visaLabel}</span>
            </span>
            <span className="sr-only">{countryName}</span>
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
          <>
            <BasicInformationStep
              primaryName={primaryName}
              onNameChange={setPrimaryName}
              onContinue={handlePrimaryContinue}
              onSelectProfile={(profile) => {
                void handleSelectProfile(profile);
              }}
              profiles={profiles}
              isAuthenticated={isAuthenticated}
              selectingProfile={selectingProfile}
            />
            {autofillWarning && (
              <p
                className="mx-auto mt-4 max-w-5xl px-1 font-switzer text-sm text-[#b45309]"
                role="status"
              >
                {autofillWarning}
              </p>
            )}
          </>
        )}

        {step === 'documents' && (
          <>
            {selectingProfile && (
              <p className="mb-4 font-switzer text-sm text-nautical-teal" role="status">
                Restoring your previous answers and documents…
              </p>
            )}
            {autofillWarning && (
              <p
                className="mb-4 font-switzer text-sm text-[#b45309]"
                role="status"
              >
                {autofillWarning}
              </p>
            )}
            <ReviewStep
              countryName={countryName}
              travellers={travellers}
              canAdd={travellers.length < MAX_TRAVELLERS}
              profiles={availableProfiles}
              allProfilesAdded={allProfilesAdded}
              showEmptyProfiles={isAuthenticated}
              selectingProfile={selectingProfile}
              extraQuestions={formConfig.extraQuestions}
              documentSlots={formConfig.documentSlots}
              showGeneralInfo={formConfig.showGeneralInfo}
              showTripDetails={formConfig.showTripDetails}
              onAddTraveller={addTraveller}
              onSelectProfile={(profile) => {
                void addTravellerFromProfile(profile);
              }}
              onRemoveTraveller={removeTraveller}
              onUploadPassport={(id, file) => openPassport(id, false, file)}
              onFillApplication={openFillApplication}
              onEditTraveller={(id) => openPassport(id, true)}
              onProceedCheckout={() => {
                if (filledTravellers.length === 0) return;
                setStep('pay');
              }}
            />
          </>
        )}

        {step === 'pay' && (
          <CheckoutPayStep
            countryName={countryName}
            countryCode={countryCode}
            listingId={listingId}
            filledCount={filledTravellers.length}
            onBack={() => setStep('documents')}
            onDraftRestored={() => {
              // Re-run hydrate path by toggling hydrating
              setHydrating(true);
              void (async () => {
                const draft = await readApplyDraftAsync(listingId);
                if (draft) {
                  const migrated = await migrateLegacyDraftBinaries(draft);
                  const hydrated = await rehydrateTravellerPreviews(
                    listingId,
                    migrated
                  );
                  setStep(draft.step);
                  setPrimaryName(
                    formatProfileName(
                      draft.primaryName || draft.travellers[0]?.name || ''
                    )
                  );
                  setTravellers(hydrated.map((t) => ({ ...t, editing: false })));
                  setDeparture(draft.departure ?? {});
                }
                setHydrating(false);
              })();
            }}
          />
        )}
      </main>

      {passportTravellerId && (passportFile || passportResume) && (
        <PassportCaptureFlow
          travellerName={activePassportTraveller?.name}
          travellerId={passportTravellerId}
          listingId={listingId}
          initialFile={passportFile ?? undefined}
          formConfig={formConfig}
          arrivalPrefill={departure.departure}
          tripSources={travellers.flatMap((traveller, index) => {
            if (traveller.id === passportTravellerId || !traveller.tripDetails) {
              return [];
            }
            if (
              !isCoreTripComplete(traveller.tripDetails) ||
              !isMultiStopComplete(traveller.tripDetails)
            ) {
              return [];
            }
            return [
              {
                id: traveller.id,
                name: travellerDisplayName(traveller, index),
                tripDetails: traveller.tripDetails,
              },
            ];
          })}
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
          onProgress={(payload) => {
            savePassportProgress(passportTravellerId, payload);
          }}
          onComplete={(payload) => {
            void savePassport(passportTravellerId, payload);
          }}
        />
      )}
    </div>
  );
}
