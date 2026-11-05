'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft } from 'lucide-react';
import { MediaImage } from '@/components/shared/MediaImage';
import { ApplyStepper } from '@/components/apply/ApplyStepper';
import { BasicInformationStep } from '@/components/apply/BasicInformationStep';
import { ReviewStep } from '@/components/apply/review/ReviewStep';
import { PassportCaptureFlow } from '@/components/apply/passport/PassportCaptureFlow';
import { CheckoutPayStep } from '@/components/apply/CheckoutPayStep';
import { SaveDraftLoginModal } from '@/components/apply/SaveDraftLoginModal';
import type { PassportApplicationPayload } from '@/components/apply/passport/PassportReviewStage';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import {
  defaultApplyFormConfig,
  hasPassportBackImage,
  isAdditionalQuestionsComplete,
  isCoreTripComplete,
  isDocumentsComplete,
  isMultiStopComplete,
  resolveDocumentSlotsWithPassportBack,
} from '@/lib/apply/applicationForm';
import { getVisibleDocumentSlots } from '@/lib/document-conditions';
import { isReviewComplete } from '@/lib/passport/schema';
import type { ApplyStep, ApplyTraveller } from '@/lib/apply/types';
import { isTravellerFilled, travellerDisplayName } from '@/lib/apply/reviewFields';
import {
  clearApplyDraftAsync,
  migrateLegacyDraftBinaries,
  readApplyDraftAsync,
  rehydrateTravellerPreviews,
  serializeTravellersForDraft,
  writeApplyDraft,
  writeApplyDraftAsync,
  type ApplyDraft,
  type ApplyDraftDeparture,
} from '@/lib/apply/draftStorage';
import type { DraftScopeInput } from '@/lib/apply/draftScope';
import {
  deleteApplicationDraft,
  getApplicationDraft,
  getApplicationDraftForUser,
  upsertApplicationDraft,
  upsertApplicationDraftForUser,
  type ServerDraftPayload,
} from '@/lib/apply/serverDraft';
import {
  restoreDraftFilesToIdb,
  syncDraftFilesToServer,
} from '@/lib/apply/syncDraftFiles';
import { ResumeOrNewModal } from '@/components/apply/ResumeOrNewModal';
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
import {
  getMyPassengerAutofill,
  listMyApplyPreviousProfiles,
} from '@/app/visa/actions';
import type { TravellerDocumentUpload } from '@/lib/apply/applicationForm';
import type { DraftFileRef } from '@/lib/apply/types';
import { getFlagEmoji } from '@/lib/public';
import { trackEvent } from '@/lib/analytics/gtm';

function toServerTravellerProfiles(
  rows: Array<{
    id: string;
    name: string;
    nationality: string;
    countryCode: string;
    visaType: string;
    avatarVariant: number;
    applicationCount?: number;
  }>
): TravellerProfile[] {
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    nationality: p.nationality,
    countryCode: p.countryCode,
    visaType: p.visaType,
    avatarVariant: p.avatarVariant,
    isServerProfile: true,
    applicationCount: p.applicationCount,
  }));
}

export type { ApplyStep, ApplyTraveller };

interface ApplyVisaWizardProps {
  countryName: string;
  countryCode: string;
  /** Flag image URL from countries.images.flag.url */
  flagUrl?: string | null;
  listingId: string;
  listingSlug: string;
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
  /** Staff saving a draft for this applicant user id. */
  onBehalfOfUserId?: string | null;
  onBehalfOfLabel?: string | null;
}

const MAX_TRAVELLERS = 100;

type WizardLifecycle =
  | 'initializing'
  | 'ready'
  | 'syncing'
  | 'submitting'
  | 'submitted';

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
  const visibleDocumentSlots = resolveDocumentSlotsWithPassportBack(
    getVisibleDocumentSlots(
      formConfig.documentSlots,
      formConfig.extraQuestions,
      traveller.tripDetails?.extra ?? {}
    ),
    hasPassportBackImage({
      passportBackUrl: traveller.passportBackUrl,
      uploads: traveller.documents,
    })
  );
  const documentsComplete = isDocumentsComplete(
    traveller.documents,
    visibleDocumentSlots
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
  listingSlug,
  processName,
  visaFullName,
  initialTravellerCount,
  departureLabel,
  departureMeta,
  formConfig = defaultApplyFormConfig(countryName, processName),
  resume = false,
  isAuthenticated = false,
  previousProfiles = [],
  onBehalfOfUserId = null,
  onBehalfOfLabel = null,
}: ApplyVisaWizardProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const visaLabel = visaFullName?.trim() || processName;
  const [step, setStep] = useState<ApplyStep>('travellers');
  const [primaryName, setPrimaryName] = useState('');
  const [travellers, setTravellers] = useState<ApplyTraveller[]>(() =>
    createInitialTravellers(initialTravellerCount)
  );
  const [profiles, setProfiles] = useState<TravellerProfile[]>(() =>
    // SSR may pass DB profiles for applicant or staff; prefer those immediately.
    previousProfiles.length > 0 ? previousProfiles : []
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
  const [interestedInInsurance, setInterestedInInsurance] = useState(false);
  const [lifecycle, setLifecycle] = useState<WizardLifecycle>('initializing');
  const [resumeChoiceDraft, setResumeChoiceDraft] = useState<ApplyDraft | null>(
    null
  );
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveDraftMessage, setSaveDraftMessage] = useState<string | null>(null);
  const [saveDraftError, setSaveDraftError] = useState<string | null>(null);
  const [loginForDraftOpen, setLoginForDraftOpen] = useState(false);
  const saveAfterLoginRef = useRef(false);

  const sessionRole = session?.user?.role;
  const isStaffSession =
    sessionRole === 'admin' || sessionRole === 'reviewer';
  const isApplicantSession = Boolean(
    session?.user?.id && sessionStatus === 'authenticated' && !isStaffSession
  );
  const sessionUserId = session?.user?.id ?? null;
  /** Any signed-in apply user (applicant or staff) — previous profiles are DB-backed. */
  const canUseDbPreviousProfiles = Boolean(
    sessionUserId && sessionStatus === 'authenticated'
  );
  const draftScope = (): DraftScopeInput => ({
    listingId,
    sessionUserId,
    onBehalfOfUserId: onBehalfOfUserId ?? null,
  });
  const travellersRef = useRef(travellers);
  travellersRef.current = travellers;
  const stepRef = useRef(step);
  stepRef.current = step;
  const enterTrackedRef = useRef(false);

  useEffect(() => {
    if (lifecycle !== 'ready' || enterTrackedRef.current) return;
    enterTrackedRef.current = true;
    trackEvent('visa_apply_enter', {
      country_code: countryCode,
      listing_id: listingId,
      listing_slug: listingSlug,
      resume: Boolean(resume),
      travellers: initialTravellerCount,
      price_option: departureMeta?.priceOption,
    });
  }, [
    countryCode,
    departureMeta?.priceOption,
    initialTravellerCount,
    lifecycle,
    listingId,
    listingSlug,
    resume,
  ]);

  useEffect(() => {
    if (lifecycle !== 'ready') return;
    trackEvent('visa_wizard_step_view', {
      step,
      listing_id: listingId,
      country_code: countryCode,
      traveller_count: travellersRef.current.length,
      filled_count: travellersRef.current.filter(isTravellerFilled).length,
    });
  }, [step, lifecycle, listingId, countryCode]);
  const primaryNameRef = useRef(primaryName);
  primaryNameRef.current = primaryName;
  const departureRef = useRef(departure);
  departureRef.current = departure;
  const interestedInInsuranceRef = useRef(interestedInInsurance);
  interestedInInsuranceRef.current = interestedInInsurance;

  const buildServerPayload = (): ServerDraftPayload => {
    const updatedAt = new Date().toISOString();
    return {
      version: 1,
      updatedAt,
      countryCode,
      countryName,
      listingId,
      processName,
      step: stepRef.current,
      primaryName: primaryNameRef.current,
      travellers: serializeTravellersForDraft(travellersRef.current),
      departure: departureRef.current,
      travellersCount: Math.max(1, travellersRef.current.length),
      interestedInInsurance: interestedInInsuranceRef.current,
    };
  };

  const persistLocalDraft = async () => {
    const payload = buildServerPayload();
    await writeApplyDraftAsync(
      {
        version: 1,
        updatedAt: payload.updatedAt,
        countryCode: payload.countryCode,
        countryName: payload.countryName,
        listingId: payload.listingId,
        processName: payload.processName,
        step: payload.step as ApplyStep,
        primaryName: payload.primaryName,
        travellers: payload.travellers as ApplyTraveller[],
        departure: payload.departure as ApplyDraftDeparture,
        travellersCount: payload.travellersCount,
        interestedInInsurance: payload.interestedInInsurance,
      },
      {
        sessionUserId,
        onBehalfOfUserId,
      }
    );
    return payload;
  };

  const pushDraftToServer = async (): Promise<boolean> => {
    if (lifecycle === 'submitted' || lifecycle === 'submitting') {
      setSaveDraftError(
        'This application was already submitted. Start a new application to save a draft.'
      );
      return false;
    }
    setSavingDraft(true);
    setLifecycle((current) => (current === 'ready' ? 'syncing' : current));
    setSaveDraftError(null);
    setSaveDraftMessage(null);
    try {
      if (sessionStatus === 'loading') {
        setSaveDraftError('Checking sign-in…');
        return false;
      }

      const savingOnBehalf = Boolean(onBehalfOfUserId && isStaffSession);

      if (!savingOnBehalf && sessionStatus !== 'authenticated') {
        await persistLocalDraft();
        trackEvent('visa_apply_login_prompt', {
          source: 'save_draft',
          listing_id: listingId,
          country_code: countryCode,
        });
        setLoginForDraftOpen(true);
        return false;
      }

      setSaveDraftMessage('Uploading documents…');
      const fileSync = await syncDraftFilesToServer({
        listingId,
        countryCode,
        travellers: travellersRef.current,
        ownerUserId: savingOnBehalf ? onBehalfOfUserId! : undefined,
        sessionUserId,
      });

      if (!fileSync.success) {
        setSaveDraftError(fileSync.error);
        return false;
      }

      if (fileSync.travellers !== travellersRef.current) {
        setTravellers(fileSync.travellers);
        travellersRef.current = fileSync.travellers;
      }

      const payload = await persistLocalDraft();

      if (savingOnBehalf) {
        const result = await upsertApplicationDraftForUser({
          listingId,
          targetUserId: onBehalfOfUserId!,
          countryCode,
          payload,
        });
        if (!result.success) {
          setSaveDraftError(result.error);
          return false;
        }
        setSaveDraftMessage(
          fileSync.uploadedCount > 0
            ? `Draft saved for applicant (${fileSync.uploadedCount} file${fileSync.uploadedCount === 1 ? '' : 's'})`
            : 'Draft saved for applicant'
        );
        return true;
      }

      const result = await upsertApplicationDraft({
        listingId,
        countryCode,
        payload,
      });
      if (!result.success) {
        setSaveDraftError(result.error);
        return false;
      }
      const base = isStaffSession
        ? 'Draft saved to your staff account'
        : 'Draft saved to your account';
      setSaveDraftMessage(
        fileSync.uploadedCount > 0
          ? `${base} (${fileSync.uploadedCount} file${fileSync.uploadedCount === 1 ? '' : 's'})`
          : base
      );
      return true;
    } catch (error) {
      setSaveDraftError(
        error instanceof Error ? error.message : 'Could not save draft'
      );
      return false;
    } finally {
      setSavingDraft(false);
      setLifecycle((current) =>
        current === 'submitted' || current === 'submitting' ? current : 'ready'
      );
    }
  };

  const handleSaveAsDraft = () => {
    void pushDraftToServer();
  };

  const backHref = `/visa/${countryCode.toLowerCase()}/${listingSlug}`;
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

  const applyDraftToUi = async (draft: ApplyDraft) => {
    const scope = draftScope();
    const migrated = await migrateLegacyDraftBinaries(draft, {
      sessionUserId: scope.sessionUserId,
      onBehalfOfUserId: scope.onBehalfOfUserId,
    });
    let hydrated = await rehydrateTravellerPreviews(scope, migrated);
    if (sessionStatus === 'authenticated') {
      hydrated = await restoreDraftFilesToIdb({
        listingId,
        travellers: hydrated,
        ownerUserId:
          onBehalfOfUserId && isStaffSession ? onBehalfOfUserId : undefined,
        sessionUserId,
      });
    }
    setStep(draft.step);
    setPrimaryName(
      formatProfileName(draft.primaryName || draft.travellers[0]?.name || '')
    );
    setTravellers(hydrated.map((t) => ({ ...t, editing: false })));
    travellersRef.current = hydrated;
    setDeparture(draft.departure ?? {});
    setInterestedInInsurance(Boolean(draft.interestedInInsurance));
  };

  // Single hydrate pipeline: local scoped IDB → server draft → restore files → ready
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    let cancelled = false;
    setLifecycle('initializing');
    setResumeChoiceDraft(null);

    async function hydrate() {
      try {
        const scope = draftScope();
        let local = await readApplyDraftAsync(scope);

        if (
          sessionStatus === 'authenticated' &&
          !(onBehalfOfUserId && !isStaffSession)
        ) {
          const remote =
            onBehalfOfUserId && isStaffSession
              ? await getApplicationDraftForUser(listingId, onBehalfOfUserId)
              : await getApplicationDraft(listingId);

          if (
            !cancelled &&
            remote.success &&
            remote.draft &&
            (!local ||
              (Date.parse(remote.draft.updatedAt) || 0) >=
                (Date.parse(local.updatedAt) || 0))
          ) {
            const payload = remote.draft.payload;
            local = {
              version: 1,
              updatedAt: remote.draft.updatedAt,
              countryCode: payload.countryCode,
              countryName: payload.countryName,
              listingId: payload.listingId,
              processName: payload.processName,
              step: (payload.step as ApplyStep) || 'travellers',
              primaryName: payload.primaryName || '',
              travellers: (payload.travellers || []) as ApplyTraveller[],
              departure: (payload.departure as ApplyDraftDeparture) || {},
              travellersCount: payload.travellersCount || 1,
              interestedInInsurance: payload.interestedInInsurance,
            };
            await writeApplyDraftAsync(local, {
              sessionUserId,
              onBehalfOfUserId,
            });
          }
        }

        if (cancelled) return;

        if (local && !resume && !onBehalfOfUserId) {
          setResumeChoiceDraft(local);
          setLifecycle('ready');
          // LocalStorage profiles only for guests — never for signed-in applicants.
          if (sessionStatus === 'unauthenticated') {
            setProfiles(listTravellerProfiles({ includeSamples: false }));
          }
          return;
        }

        if (local && (resume || onBehalfOfUserId)) {
          await applyDraftToUi(local);
        } else if (!local) {
          setDeparture({
            ...departureMeta,
            label: departureLabel,
          });
        }

        if (cancelled) return;
        if (sessionStatus === 'unauthenticated') {
          setProfiles(listTravellerProfiles({ includeSamples: false }));
        }
      } catch (error) {
        console.warn('Draft hydrate failed', error);
      } finally {
        if (!cancelled) {
          setLifecycle('ready');
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on identity + listing; resume handled inside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    listingId,
    sessionStatus,
    sessionUserId,
    onBehalfOfUserId,
    isStaffSession,
    resume,
    isAuthenticated,
  ]);

  // Signed-in apply users: previous profiles from Postgres only (never localStorage).
  useEffect(() => {
    if (!canUseDbPreviousProfiles && !isAuthenticated) return;

    let cancelled = false;

    async function loadServerProfiles() {
      if (previousProfiles.length > 0) {
        setProfiles(previousProfiles);
        return;
      }
      const result = await listMyApplyPreviousProfiles({
        ownerUserId: onBehalfOfUserId,
      });
      if (cancelled) return;
      if (result.success && result.data) {
        setProfiles(toServerTravellerProfiles(result.data));
      } else {
        setProfiles([]);
      }
    }

    void loadServerProfiles();
    return () => {
      cancelled = true;
    };
  }, [
    canUseDbPreviousProfiles,
    isAuthenticated,
    previousProfiles,
    onBehalfOfUserId,
  ]);

  // After OTP login from Save as draft modal, push to server
  useEffect(() => {
    if (!saveAfterLoginRef.current || !isApplicantSession) return;
    saveAfterLoginRef.current = false;
    void pushDraftToServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once after login
  }, [isApplicantSession]);

  // Autosave only when lifecycle is ready (and not choosing Continue vs Start new)
  useEffect(() => {
    if (lifecycle !== 'ready' || resumeChoiceDraft) return;

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

    writeApplyDraft(
      {
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
        interestedInInsurance,
      },
      { sessionUserId, onBehalfOfUserId }
    );
  }, [
    lifecycle,
    resumeChoiceDraft,
    countryCode,
    countryName,
    listingId,
    processName,
    step,
    primaryName,
    travellers,
    departure,
    interestedInInsurance,
    sessionUserId,
    onBehalfOfUserId,
  ]);

  const persistNamedProfile = (traveller: ApplyTraveller, visaType = processName) => {
    const profile = profileFromTraveller(traveller, visaType);
    if (!profile) return;
    // Cache name locally for guests only; signed-in carousel stays DB-backed.
    saveTravellerProfile(profile);
    if (sessionStatus === 'unauthenticated') {
      setProfiles(listTravellerProfiles({ includeSamples: false }));
    }
  };

  /** Resolve a DB profile id even if the carousel card came from localStorage. */
  const resolveServerProfileId = async (
    profile: TravellerProfile
  ): Promise<string | null> => {
    if (profile.isServerProfile && profile.id) return profile.id;

    const token = profile.name.trim().toUpperCase();
    const fromState = profiles.find(
      (item) =>
        item.isServerProfile && item.name.trim().toUpperCase() === token
    );
    if (fromState?.id) return fromState.id;

    const result = await listMyApplyPreviousProfiles({
      ownerUserId: onBehalfOfUserId,
    });
    if (!result.success || !result.data) return null;
    const mapped = toServerTravellerProfiles(result.data);
    setProfiles(mapped);
    return (
      mapped.find((item) => item.name.trim().toUpperCase() === token)?.id ??
      null
    );
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
    trackEvent('visa_basic_info_complete', {
      listing_id: listingId,
      country_code: countryCode,
      traveller_count: Math.max(1, travellers.length),
      has_profile_selected: false,
    });
    setStep('documents');
  };

  const buildAutofilledTraveller = async (
    profile: TravellerProfile,
    base: ApplyTraveller,
    profileId: string
  ): Promise<{ traveller: ApplyTraveller; warning: string | null } | null> => {
    const result = await getMyPassengerAutofill({
      profileId,
      formConfig,
      listingId,
      countryCode,
      travellerId: base.id,
      ownerUserId: onBehalfOfUserId,
    });

    if (!result.success || !result.data) {
      console.warn('Autofill failed', result.message, result.error);
      return null;
    }

    const payload = result.data;
    const displayName = formatProfileName(payload.name || profile.name);
    const documents: TravellerDocumentUpload[] = (payload.documents ?? []).map(
      (doc) => ({
        key: doc.slotKey,
        name: doc.filename,
        mimeType: doc.mimeType || 'application/octet-stream',
        size: doc.size,
        storageKey: doc.storageKey || undefined,
        storageUrl: doc.storageUrl || undefined,
        previewUrl: doc.storageUrl || undefined,
      })
    );
    const draftFileRefs: DraftFileRef[] = (payload.draftFileRefs ?? []).map(
      (ref) => ({
        slotKey: ref.slotKey,
        storageKey: ref.storageKey,
        url: ref.url,
        mimeType: ref.mimeType,
        filename: ref.filename,
        size: ref.size,
      })
    );
    const hasPhoto = draftFileRefs.some(
      (ref) =>
        ref.slotKey === 'photo' ||
        formConfig.documentSlots.some(
          (slot) =>
            slot.key === ref.slotKey &&
            (slot.captureFace || slot.documentType === 'photo')
        )
    );
    const hasPassport =
      Boolean(payload.passportFrontUrl) ||
      draftFileRefs.some(
        (ref) =>
          ref.slotKey === PASSPORT_FRONT_SLOT ||
          ref.slotKey === PASSPORT_BACK_SLOT
      ) ||
      Boolean(payload.passportData);

    const draftTraveller: ApplyTraveller = {
      ...base,
      name: displayName.toUpperCase(),
      passportData: payload.passportData ?? undefined,
      tripDetails: payload.tripDetails ?? undefined,
      passportUploaded: hasPassport,
      photoUploaded: hasPhoto,
      passportFrontUrl: payload.passportFrontUrl || undefined,
      passportBackUrl: payload.passportBackUrl || undefined,
      documents,
      draftFileRefs,
      applicationComplete: false,
      editing: false,
    };

    const applicationComplete = isListingApplicationComplete(
      draftTraveller,
      formConfig
    );

    const failed = payload.failedSlots?.length ?? 0;
    return {
      traveller: { ...draftTraveller, applicationComplete },
      warning:
        failed > 0
          ? `Some documents could not be restored (${failed}). You can re-upload them.`
          : null,
    };
  };

  const handleSelectProfile = async (profile: TravellerProfile) => {
    const name = profile.name.trim().toUpperCase();
    if (!name) return;

    setAutofillWarning(null);

    // Logged-in (applicant or staff): always fill from Postgres.
    if (canUseDbPreviousProfiles || isAuthenticated) {
      setSelectingProfile(true);
      try {
        const serverProfileId = await resolveServerProfileId(profile);
        const nextTraveller = createTraveller(1, name);

        if (!serverProfileId) {
          setAutofillWarning(
            'No past application found for this traveller yet. Continuing with name only.'
          );
          setPrimaryName(formatProfileName(profile.name));
          setTravellers([nextTraveller]);
          setStep('documents');
          return;
        }

        const filled = await buildAutofilledTraveller(
          profile,
          nextTraveller,
          serverProfileId
        );

        if (!filled) {
          setAutofillWarning(
            'Could not load previous answers. Continuing with name only.'
          );
          setPrimaryName(formatProfileName(profile.name));
          setTravellers([nextTraveller]);
          setStep('documents');
          return;
        }

        setPrimaryName(formatProfileName(filled.traveller.name));
        setTravellers([filled.traveller]);
        persistNamedProfile(filled.traveller);
        if (filled.warning) setAutofillWarning(filled.warning);

        setStep('documents');
        // Required tabs still empty (e.g. trip dates): open Complete application.
        if (!filled.traveller.applicationComplete) {
          setPassportFile(null);
          setPassportResume(true);
          setPassportTravellerId(filled.traveller.id);
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

    // Guest: name-only (localStorage cards)
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

    if (canUseDbPreviousProfiles || isAuthenticated) {
      setSelectingProfile(true);
      try {
        const newbie = createTraveller(
          travellersRef.current.length + 1,
          name
        );
        const serverProfileId = await resolveServerProfileId(profile);
        if (!serverProfileId) {
          setAutofillWarning(
            'No past application found for this traveller yet. Added the name only.'
          );
          appendTraveller(newbie);
          return;
        }

        const filled = await buildAutofilledTraveller(
          profile,
          newbie,
          serverProfileId
        );

        if (!filled) {
          setAutofillWarning(
            'Could not load previous answers. Added the name only.'
          );
          appendTraveller(newbie);
          return;
        }

        const added = appendTraveller(filled.traveller);
        if (!added) return;
        if (filled.warning) setAutofillWarning(filled.warning);

        if (!filled.traveller.applicationComplete) {
          setPassportFile(null);
          setPassportResume(true);
          setPassportTravellerId(filled.traveller.id);
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
      void deletePassengerFiles(draftScope(), id).catch((error) => {
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
        await putFile(draftScope(), id, PASSPORT_FRONT_SLOT, {
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
          await putFile(draftScope(), id, PASSPORT_BACK_SLOT, {
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
        await putFile(draftScope(), id, item.key, {
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
    const invalidateSlots = new Set(payload.invalidateDraftSlots ?? []);
    for (const doc of documents) {
      if (!doc.storageKey) invalidateSlots.add(doc.key);
    }

    const nextTravellers = currentTravellers.map((item) => {
      if (item.id !== id) return item;
      const nextDocuments =
        documents.length > 0 ? documents : item.documents;
      const nextDocKeys = new Set((nextDocuments ?? []).map((doc) => doc.key));
      const draftFileRefs = (item.draftFileRefs ?? []).filter((ref) => {
        if (invalidateSlots.has(ref.slotKey)) return false;
        if (
          ref.slotKey !== PASSPORT_FRONT_SLOT &&
          ref.slotKey !== PASSPORT_BACK_SLOT &&
          !nextDocKeys.has(ref.slotKey)
        ) {
          // Document removed from the form — drop its draft ref.
          return false;
        }
        const doc = nextDocuments?.find((d) => d.key === ref.slotKey);
        if (doc && !doc.storageKey) return false;
        return true;
      });
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
        documents: nextDocuments,
        draftFileRefs,
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

    await writeApplyDraftAsync(
      {
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
        interestedInInsurance: interestedInInsuranceRef.current,
      },
      { sessionUserId, onBehalfOfUserId }
    );

    if (options.complete) {
      trackEvent('visa_traveller_complete', {
        listing_id: listingId,
        country_code: countryCode,
        document_slot_count: documents.length,
      });
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

  if (lifecycle === 'initializing') {
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
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleSaveAsDraft}
              disabled={
                savingDraft ||
                lifecycle === 'submitting' ||
                lifecycle === 'submitted'
              }
              className="inline-flex shrink-0 items-center rounded-full border border-portrait-ink/20 bg-white px-3 py-1.5 font-switzer text-xs font-medium text-portrait-ink transition-colors hover:border-portrait-ink hover:bg-sky-wash/40 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              {savingDraft ? 'Saving…' : 'Save as draft'}
            </button>
            <p className="min-w-0 text-right text-sm font-medium leading-snug text-portrait-ink sm:text-base">
              <span className="inline-flex max-w-full items-center justify-end gap-2">
                <span className="relative flex h-5 w-5 shrink-0 overflow-hidden rounded-full bg-sky-wash sm:h-6 sm:w-6">
                  {flagUrl ? (
                    <MediaImage
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
        </div>

        {(saveDraftMessage || saveDraftError) && (
          <p
            className={`mx-auto mt-2 max-w-5xl text-center font-switzer text-xs ${
              saveDraftError ? 'text-red-600' : 'text-nautical-teal'
            }`}
            role="status"
          >
            {saveDraftError || saveDraftMessage}
          </p>
        )}

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
        {onBehalfOfUserId && onBehalfOfLabel && (
          <div className="mb-4 rounded-[20px] border border-nautical-teal/30 bg-sky-wash/50 px-4 py-3 text-center">
            <p className="font-switzer text-sm text-portrait-ink">
              Saving draft for{' '}
              <span className="font-medium">{onBehalfOfLabel}</span>
            </p>
          </div>
        )}

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
              isAuthenticated={
                canUseDbPreviousProfiles || isAuthenticated
              }
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
              showEmptyProfiles={
                canUseDbPreviousProfiles || isAuthenticated
              }
              selectingProfile={selectingProfile}
              extraQuestions={formConfig.extraQuestions}
              documentSlots={formConfig.documentSlots}
              showGeneralInfo={formConfig.showGeneralInfo}
              showTripDetails={formConfig.showTripDetails}
              listingId={listingId}
              draftOwnerUserId={onBehalfOfUserId}
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
                trackEvent('visa_review_proceed_checkout', {
                  listing_id: listingId,
                  country_code: countryCode,
                  filled_count: filledTravellers.length,
                  total_travellers: travellers.length,
                });
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
            showInsuranceInterest={Boolean(formConfig.showInsuranceInterest)}
            interestedInInsurance={interestedInInsurance}
            onInterestedInInsuranceChange={setInterestedInInsurance}
            draftScope={draftScope()}
            onBack={() => setStep('documents')}
            onSubmitSuccess={() => {
              setLifecycle('submitted');
            }}
            onSubmitFailed={() => {
              setLifecycle('ready');
            }}
            onSubmitting={() => {
              setLifecycle('submitting');
            }}
          />
        )}
      </main>

      {resumeChoiceDraft && (
        <ResumeOrNewModal
          open
          draft={resumeChoiceDraft}
          onClose={() => {
            setResumeChoiceDraft(null);
          }}
          onResume={() => {
            const draft = resumeChoiceDraft;
            setResumeChoiceDraft(null);
            void applyDraftToUi(draft);
          }}
          onStartNew={() => {
            void (async () => {
              await clearApplyDraftAsync(draftScope());
              if (sessionStatus === 'authenticated' && !onBehalfOfUserId) {
                try {
                  await deleteApplicationDraft(listingId);
                } catch {
                  // local clear already done
                }
              }
              setResumeChoiceDraft(null);
              setStep('travellers');
              setPrimaryName('');
              setTravellers(createInitialTravellers(initialTravellerCount));
              setDeparture({
                ...departureMeta,
                label: departureLabel,
              });
              setInterestedInInsurance(false);
            })();
          }}
        />
      )}

      {passportTravellerId && (passportFile || passportResume) && (
        <PassportCaptureFlow
          travellerName={activePassportTraveller?.name}
          travellerId={passportTravellerId}
          listingId={listingId}
          countryCode={countryCode}
          sessionUserId={sessionUserId}
          ownerUserId={onBehalfOfUserId}
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
                  draftFileRefs: activePassportTraveller?.draftFileRefs,
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

      <SaveDraftLoginModal
        open={loginForDraftOpen}
        onClose={() => setLoginForDraftOpen(false)}
        onVerified={() => {
          saveAfterLoginRef.current = true;
          setLoginForDraftOpen(false);
          setSaveDraftMessage('Signed in — saving draft…');
        }}
      />
    </div>
  );
}
