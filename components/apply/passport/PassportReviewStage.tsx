'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { AnimatedTabs } from '@/components/ui';
import { AdditionalQuestionsTab } from '@/components/apply/form/AdditionalQuestionsTab';
import { DocumentsTab } from '@/components/apply/form/DocumentsTab';
import { FormTabFooter } from '@/components/apply/form/FormTabFooter';
import { GeneralDetailsTab } from '@/components/apply/form/GeneralDetailsTab';
import { TripDetailsTab } from '@/components/apply/form/TripDetailsTab';
import { ReviewSubmitTab } from '@/components/apply/form/ReviewSubmitTab';
import { PassportScanStage } from '@/components/apply/passport/PassportScanStage';
import { createPdfFirstPagePreviewUrl } from '@/lib/apply/pdfFirstPagePreview';
import {
  APPLICATION_FORM_TABS,
  DOCUMENT_FILE_ACCEPT,
  defaultApplyFormConfig,
  emptyTripDetails,
  getAdditionalQuestionIssues,
  getCoreTripIssues,
  getMultiStopIssues,
  getVisibleApplicationTabs,
  hasPassportBackImage,
  isAdditionalQuestionsComplete,
  isAllowedPassportFile,
  isCoreTripComplete,
  isDocumentsComplete,
  isMultiStopComplete,
  isWithinUploadLimit,
  resolveDocumentSlotsWithPassportBack,
  resolvePreferredFormTab,
  tabUnlockState,
  type ApplicationFormTabId,
  type ApplyFormConfig,
  type TravellerDocumentUpload,
  type TravellerTripDetails,
  type TripCopySource,
} from '@/lib/apply/applicationForm';
import {
  clearHiddenDocumentUploads,
  getVisibleDocumentSlots,
} from '@/lib/document-conditions';
import type { DraftScopeInput } from '@/lib/apply/draftScope';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
  idbErrorMessage,
  isIdbAvailable,
  putFile,
  urlToBlob,
} from '@/lib/apply/idbDraftStorage';
import { deleteServerDraftFile } from '@/lib/apply/deleteDraftFileClient';
import type { DraftFileRef } from '@/lib/apply/types';
import { formatProfileName } from '@/lib/apply/travellerProfiles';
import {
  extractIndianPassport,
  IndianPassportError,
} from '@/lib/passport/extractIndianPassport';
import { isPdfFile } from '@/lib/passport/pdfToImage';
import type {
  IndianPassportExtraction,
  IndianPassportFields,
} from '@/lib/passport/types';
import { isReviewComplete } from '@/lib/passport/schema';
import { isPassportBackDocument } from '@/lib/document-types';
import { sniffFileKind } from '@/lib/apply/sniffFileType';
import { extensionFromMime } from '@/lib/upload/applicationKey';

export interface PassportApplicationPayload {
  fields: IndianPassportFields;
  tripDetails: TravellerTripDetails;
  documents: TravellerDocumentUpload[];
  frontPreviewUrl: string;
  backPreviewUrl?: string;
  frontMimeType?: string;
  backMimeType?: string;
  frontFilename?: string;
  backFilename?: string;
  /** Draft slots whose server keys were invalidated by a local replace/remove. */
  invalidateDraftSlots?: string[];
}

interface PassportReviewStageProps {
  travellerName?: string;
  travellerId: string;
  listingId: string;
  sessionUserId?: string | null;
  ownerUserId?: string | null;
  initial: IndianPassportFields & {
    frontPreviewUrl: string;
    backPreviewUrl?: string;
    warnings?: string[];
  };
  formConfig?: ApplyFormConfig;
  savedTrip?: TravellerTripDetails;
  savedDocuments?: TravellerDocumentUpload[];
  /** Existing server draft refs — used to delete cloud objects on passport replace. */
  draftFileRefs?: DraftFileRef[];
  arrivalPrefill?: string;
  tripSources?: TripCopySource[];
  onBack: () => void;
  onClose: () => void;
  /** Autosave while the user fills tabs (debounced). */
  onProgress?: (data: PassportApplicationPayload) => void;
  /**
   * Fired when Continue advances past a tab (not Review submit).
   * Awaited before switching tabs so draft persistence can flush.
   */
  onStepCommit?: (data: PassportApplicationPayload) => void | Promise<void>;
  onContinue: (data: PassportApplicationPayload) => void;
  /** Restore this form tab after refresh when still unlocked. */
  preferredFormTab?: ApplicationFormTabId | null;
  /** Notify parent so localStorage can keep the current form tab. */
  onFormTabChange?: (tab: ApplicationFormTabId) => void;
}

function revokeIfObjectUrl(url?: string) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Keep the uploaded file as the front preview for images.
 * PDFs already expose full-page rasters from OCR (front + optional back).
 */
function withUploadPreviews(
  result: IndianPassportExtraction,
  originalPreviewUrl: string | null,
  input: File | Blob
): IndianPassportExtraction {
  if (isPdfFile(input)) return result;

  if (!originalPreviewUrl) return result;

  if (result.frontPreviewUrl !== originalPreviewUrl) {
    revokeIfObjectUrl(result.frontPreviewUrl);
  }
  if (result.backPreviewUrl) {
    revokeIfObjectUrl(result.backPreviewUrl);
  }

  return {
    ...result,
    frontPreviewUrl: originalPreviewUrl,
    backPreviewUrl: undefined,
  };
}

function fieldsFromExtraction(
  current: IndianPassportFields,
  extraction: IndianPassportExtraction,
  which: 'front' | 'back'
): IndianPassportFields {
  if (which === 'back') {
    return {
      ...current,
      fathersName: extraction.fathersName || current.fathersName,
      mothersName: extraction.mothersName || current.mothersName,
      spouseName: extraction.spouseName || current.spouseName,
      address: extraction.address || current.address,
      fileNumber: extraction.fileNumber || current.fileNumber,
      oldPassportNumber:
        extraction.oldPassportNumber || current.oldPassportNumber,
      oldPassportDateOfIssue:
        extraction.oldPassportDateOfIssue || current.oldPassportDateOfIssue,
      oldPassportPlaceOfIssue:
        extraction.oldPassportPlaceOfIssue || current.oldPassportPlaceOfIssue,
    };
  }

  return {
    passportNumber: extraction.passportNumber,
    surname: extraction.surname,
    givenNames: extraction.givenNames,
    nationality: extraction.nationality || current.nationality || 'IND',
    dateOfBirth: extraction.dateOfBirth,
    sex: extraction.sex,
    dateOfExpiry: extraction.dateOfExpiry,
    documentType: extraction.documentType || 'P',
    countryOfIssue: extraction.countryOfIssue || 'IND',
    fathersName: extraction.fathersName || '',
    mothersName: extraction.mothersName || '',
    spouseName: extraction.spouseName || '',
    dateOfIssue: extraction.dateOfIssue || '',
    placeOfBirth: extraction.placeOfBirth || '',
    placeOfIssue: extraction.placeOfIssue || '',
    address: extraction.address || '',
    fileNumber: extraction.fileNumber || '',
    oldPassportNumber: extraction.oldPassportNumber || '',
    oldPassportDateOfIssue: extraction.oldPassportDateOfIssue || '',
    oldPassportPlaceOfIssue: extraction.oldPassportPlaceOfIssue || '',
    email: current.email,
    phone: current.phone,
  };
}

async function putPassportSlotBlob(input: {
  scope: DraftScopeInput;
  travellerId: string;
  slotKey: typeof PASSPORT_FRONT_SLOT | typeof PASSPORT_BACK_SLOT;
  blob: Blob;
  mimeHint?: string;
  filenameHint?: string;
}) {
  const buffer = await input.blob.arrayBuffer();
  const sniffed = sniffFileKind(
    buffer,
    input.mimeHint || input.blob.type,
    input.filenameHint
  );
  const ext = extensionFromMime(sniffed.mimeType, input.filenameHint);
  const fallbackName =
    input.slotKey === PASSPORT_FRONT_SLOT
      ? `passport-front.${ext}`
      : `passport-back.${ext}`;
  let filename = input.filenameHint || fallbackName;
  if (input.filenameHint) {
    filename = input.filenameHint.replace(/\.[^.]+$/i, '') + `.${ext}`;
  }
  const typed = new Blob([buffer], { type: sniffed.mimeType });
  await putFile(input.scope, input.travellerId, input.slotKey, {
    blob: typed,
    mimeType: sniffed.mimeType,
    filename,
  });
  return { mimeType: sniffed.mimeType, filename, blob: typed };
}

export function PassportReviewStage({
  travellerName,
  travellerId,
  listingId,
  sessionUserId = null,
  ownerUserId = null,
  initial,
  formConfig: formConfigProp,
  savedTrip,
  savedDocuments,
  draftFileRefs: draftFileRefsProp,
  arrivalPrefill,
  tripSources,
  onBack,
  onClose,
  onProgress,
  onStepCommit,
  onContinue,
  preferredFormTab = null,
  onFormTabChange,
}: PassportReviewStageProps) {
  const formConfig = formConfigProp ?? defaultApplyFormConfig();
  const visibleTabs = useMemo(
    () => getVisibleApplicationTabs(formConfig),
    [formConfig]
  );
  const tabMeta = useMemo(
    () =>
      APPLICATION_FORM_TABS.filter((item) => visibleTabs.includes(item.id)),
    [visibleTabs]
  );

  const [form, setForm] = useState<IndianPassportFields>({
    passportNumber: initial.passportNumber,
    surname: initial.surname,
    givenNames: initial.givenNames,
    nationality: initial.nationality || 'IND',
    dateOfBirth: initial.dateOfBirth,
    sex: initial.sex,
    dateOfExpiry: initial.dateOfExpiry,
    documentType: initial.documentType || 'P',
    countryOfIssue: initial.countryOfIssue || 'IND',
    fathersName: initial.fathersName || '',
    mothersName: initial.mothersName || '',
    spouseName: initial.spouseName || '',
    dateOfIssue: initial.dateOfIssue || '',
    placeOfBirth: initial.placeOfBirth || '',
    placeOfIssue: initial.placeOfIssue || '',
    address: initial.address || '',
    fileNumber: initial.fileNumber || '',
    oldPassportNumber: initial.oldPassportNumber || '',
    oldPassportDateOfIssue: initial.oldPassportDateOfIssue || '',
    oldPassportPlaceOfIssue: initial.oldPassportPlaceOfIssue || '',
    email: initial.email || '',
    phone: initial.phone || '',
  });
  const [trip, setTrip] = useState<TravellerTripDetails>(() =>
    emptyTripDetails({
      ...savedTrip,
      purpose: savedTrip?.purpose || formConfig.purpose,
      arrivalDate: savedTrip?.arrivalDate || arrivalPrefill || '',
    })
  );
  const [documents, setDocuments] = useState<TravellerDocumentUpload[]>(
    savedDocuments ?? []
  );
  const [frontPreviewUrl, setFrontPreviewUrl] = useState(() => {
    const fromResume = initial.frontPreviewUrl?.trim();
    if (fromResume) return fromResume;
    return (
      draftFileRefsProp?.find((ref) => ref.slotKey === PASSPORT_FRONT_SLOT)
        ?.url || ''
    );
  });
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | undefined>(
    () => {
      const fromResume = initial.backPreviewUrl?.trim();
      if (fromResume) return fromResume;
      return draftFileRefsProp?.find((ref) => ref.slotKey === PASSPORT_BACK_SLOT)
        ?.url;
    }
  );
  // OCR crops are images; replace can switch to PDF. Prefer draft refs after refresh.
  const [frontMimeType, setFrontMimeType] = useState(
    () =>
      draftFileRefsProp?.find((ref) => ref.slotKey === PASSPORT_FRONT_SLOT)
        ?.mimeType || 'image/jpeg'
  );
  const [backMimeType, setBackMimeType] = useState(() =>
    draftFileRefsProp?.find((ref) => ref.slotKey === PASSPORT_BACK_SLOT)
      ?.mimeType ||
    (initial.backPreviewUrl ? 'image/jpeg' : undefined)
  );
  const [frontFilename, setFrontFilename] = useState<string | undefined>(
    () =>
      draftFileRefsProp?.find((ref) => ref.slotKey === PASSPORT_FRONT_SLOT)
        ?.filename
  );
  const [backFilename, setBackFilename] = useState<string | undefined>(
    () =>
      draftFileRefsProp?.find((ref) => ref.slotKey === PASSPORT_BACK_SLOT)
        ?.filename
  );
  const [replaceBusy, setReplaceBusy] = useState<'front' | 'back' | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [reuploadScanPreview, setReuploadScanPreview] = useState<string | null>(
    null
  );
  const [ocrWarnings, setOcrWarnings] = useState<string[]>(
    () => initial.warnings ?? []
  );
  const [invalidateDraftSlots, setInvalidateDraftSlots] = useState<string[]>(
    []
  );
  const draftFileRefsRef = useRef(draftFileRefsProp);
  draftFileRefsRef.current = draftFileRefsProp;
  const replaceGenRef = useRef(0);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onStepCommitRef = useRef(onStepCommit);
  onStepCommitRef.current = onStepCommit;
  const [stepCommitting, setStepCommitting] = useState(false);

  const draftScope: DraftScopeInput = useMemo(
    () => ({
      listingId,
      sessionUserId,
      onBehalfOfUserId: ownerUserId,
    }),
    [listingId, sessionUserId, ownerUserId]
  );

  const buildPayload = (): PassportApplicationPayload => ({
    fields: form,
    tripDetails: trip,
    documents,
    frontPreviewUrl,
    backPreviewUrl,
    frontMimeType,
    backMimeType,
    frontFilename,
    backFilename,
    invalidateDraftSlots:
      invalidateDraftSlots.length > 0 ? invalidateDraftSlots : undefined,
  });

  // Persist in-progress form so reload can resume (not only final Continue)
  useEffect(() => {
    if (!onProgressRef.current) return;
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      onProgressRef.current?.(buildPayload());
    }, 450);
    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, trip, documents, frontPreviewUrl, backPreviewUrl]);

  // Immediate first save when review opens (OCR fields + passport images)
  useEffect(() => {
    onProgressRef.current?.(buildPayload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Documents-tab passport back upload becomes the traveller back image.
  useEffect(() => {
    const backUpload = documents.find((item) =>
      isPassportBackDocument({ key: item.key })
    );
    const next = backUpload?.previewUrl;
    if (!next) return;
    setBackPreviewUrl((prev) => {
      if (prev === next) return prev;
      if (prev && prev !== initial.backPreviewUrl) revokeIfObjectUrl(prev);
      return next;
    });
    if (backUpload.mimeType) setBackMimeType(backUpload.mimeType);
    if (backUpload.name) setBackFilename(backUpload.name);
  }, [documents, initial.backPreviewUrl]);

  const invalidateSlot = useCallback(
    (slotKey: string) => {
      const previousRef = draftFileRefsRef.current?.find(
        (ref) => ref.slotKey === slotKey
      );
      if (previousRef?.storageKey) {
        void deleteServerDraftFile({
          storageKey: previousRef.storageKey,
          ownerUserId,
        });
      }
      setInvalidateDraftSlots((prev) =>
        prev.includes(slotKey) ? prev : [...prev, slotKey]
      );
    },
    [ownerUserId]
  );

  const syncDocumentsBack = useCallback(
    (nextUrl: string, mimeType: string, filename: string, size: number) => {
      setDocuments((prev) => {
        const hasBackSlot = prev.some((item) =>
          isPassportBackDocument({ key: item.key })
        );
        if (!hasBackSlot) return prev;
        return prev.map((item) =>
          isPassportBackDocument({ key: item.key })
            ? {
                ...item,
                name: filename,
                previewUrl: nextUrl,
                mimeType,
                size,
                storedInIdb: true,
                storageKey: undefined,
                storageUrl: undefined,
              }
            : item
        );
      });
    },
    []
  );

  const cancelReuploadScan = useCallback(() => {
    replaceGenRef.current += 1;
    setReplaceBusy(null);
    setReuploadScanPreview(null);
  }, []);

  const replacePassportImage = useCallback(
    async (which: 'front' | 'back', file: File) => {
      if (!isAllowedPassportFile(file)) {
        setReplaceError('Please upload a JPG, PNG, WEBP, or PDF file.');
        return;
      }
      if (!isWithinUploadLimit(file)) {
        setReplaceError('File is too large. Max 5MB for images, 10MB for PDFs.');
        return;
      }
      if (!isIdbAvailable()) {
        setReplaceError(idbErrorMessage(new Error('IndexedDB unavailable')));
        return;
      }

      const gen = ++replaceGenRef.current;
      const isActive = () => gen === replaceGenRef.current;

      setReplaceBusy(which);
      setReplaceError(null);

      const originalPreviewUrl = URL.createObjectURL(file);
      let ownedOriginalPreview = true;
      let pdfScanPreview: string | null = null;
      let extraction: IndianPassportExtraction | null = null;
      const orphanedOcrUrls: string[] = [];

      // Show the same scanner stage as the initial passport capture.
      setReuploadScanPreview(isPdfFile(file) ? null : originalPreviewUrl);

      try {
        const pdfPreviewPromise = isPdfFile(file)
          ? createPdfFirstPagePreviewUrl(file, { maxEdge: 1600 })
          : Promise.resolve<string | null>(null);

        try {
          const [raw, pdfPreview] = await Promise.all([
            extractIndianPassport(file),
            pdfPreviewPromise,
          ]);
          if (!isActive()) {
            if (pdfPreview) revokeIfObjectUrl(pdfPreview);
            revokeIfObjectUrl(raw.frontPreviewUrl);
            revokeIfObjectUrl(raw.backPreviewUrl);
            return;
          }
          if (pdfPreview) {
            pdfScanPreview = pdfPreview;
            setReuploadScanPreview(pdfPreview);
          }
          extraction = withUploadPreviews(raw, originalPreviewUrl, file);
          if (extraction.frontPreviewUrl === originalPreviewUrl) {
            ownedOriginalPreview = false;
          }
        } catch (error) {
          const pdfPreview = await pdfPreviewPromise.catch(() => null);
          if (!isActive()) {
            if (pdfPreview) revokeIfObjectUrl(pdfPreview);
            return;
          }
          if (pdfPreview) {
            pdfScanPreview = pdfPreview;
            setReuploadScanPreview(pdfPreview);
          }
          // Still store the file when OCR fails. Back-only pages often have no
          // MRZ and fail closed — keep the upload and let the user type fields.
          const message =
            error instanceof IndianPassportError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Could not read this passport. Try a clearer image.';
          setOcrWarnings(
            which === 'front'
              ? [
                  message,
                  'We could not auto-fill from this scan. Please enter your details manually.',
                ]
              : [
                  message,
                  'Back page uploaded. Enter address and parent details if needed.',
                ]
          );
        }

        if (!isActive()) return;

        if (which === 'front') {
          const frontUrl = extraction?.frontPreviewUrl ?? originalPreviewUrl;
          const frontBlob =
            (await urlToBlob(frontUrl)) ||
            (file.type ? file : new Blob([file], { type: file.type }));
          if (!isActive()) return;
          const savedFront = await putPassportSlotBlob({
            scope: draftScope,
            travellerId,
            slotKey: PASSPORT_FRONT_SLOT,
            blob: frontBlob,
            mimeHint: frontBlob.type || file.type,
            filenameHint: file.name || 'passport-front.bin',
          });
          if (!isActive()) return;
          invalidateSlot(PASSPORT_FRONT_SLOT);

          setFrontPreviewUrl((prev) => {
            if (prev !== initial.frontPreviewUrl) revokeIfObjectUrl(prev);
            return frontUrl;
          });
          setFrontMimeType(savedFront.mimeType);
          setFrontFilename(savedFront.filename);
          if (frontUrl === originalPreviewUrl) ownedOriginalPreview = false;

          const ocrBackUrl = extraction?.backPreviewUrl;
          if (ocrBackUrl) {
            const backBlob = await urlToBlob(ocrBackUrl);
            if (!isActive()) return;
            if (backBlob) {
              const savedBack = await putPassportSlotBlob({
                scope: draftScope,
                travellerId,
                slotKey: PASSPORT_BACK_SLOT,
                blob: backBlob,
                mimeHint: backBlob.type || 'image/jpeg',
                filenameHint: 'passport-back.jpg',
              });
              if (!isActive()) return;
              invalidateSlot(PASSPORT_BACK_SLOT);
              setBackPreviewUrl((prev) => {
                if (prev && prev !== initial.backPreviewUrl) {
                  revokeIfObjectUrl(prev);
                }
                return ocrBackUrl;
              });
              setBackMimeType(savedBack.mimeType);
              setBackFilename(savedBack.filename);
              syncDocumentsBack(
                ocrBackUrl,
                savedBack.mimeType,
                savedBack.filename,
                backBlob.size
              );
            } else {
              orphanedOcrUrls.push(ocrBackUrl);
            }
          }

          if (extraction) {
            setForm((current) =>
              fieldsFromExtraction(current, extraction!, 'front')
            );
            setOcrWarnings(extraction.warnings ?? []);
          }
        } else {
          // Back reupload: keep the uploaded file as the back image. If OCR also
          // found a separate back page in a multi-page PDF, prefer that page.
          const backUrl =
            extraction?.backPreviewUrl || originalPreviewUrl;
          const backBlob =
            (await urlToBlob(backUrl)) ||
            (file.type ? file : new Blob([file], { type: file.type }));
          if (!isActive()) return;
          const savedBack = await putPassportSlotBlob({
            scope: draftScope,
            travellerId,
            slotKey: PASSPORT_BACK_SLOT,
            blob: backBlob,
            mimeHint: backBlob.type || file.type,
            filenameHint: file.name || 'passport-back.bin',
          });
          if (!isActive()) return;
          invalidateSlot(PASSPORT_BACK_SLOT);

          setBackPreviewUrl((prev) => {
            if (prev && prev !== initial.backPreviewUrl) revokeIfObjectUrl(prev);
            return backUrl;
          });
          setBackMimeType(savedBack.mimeType);
          setBackFilename(savedBack.filename);
          syncDocumentsBack(
            backUrl,
            savedBack.mimeType,
            savedBack.filename,
            backBlob.size
          );
          if (backUrl === originalPreviewUrl) ownedOriginalPreview = false;

          // OCR may still emit a front crop for a full booklet PDF — do not
          // overwrite the stored front when the user only reuploaded the back.
          if (extraction?.frontPreviewUrl) {
            orphanedOcrUrls.push(extraction.frontPreviewUrl);
          }
          if (extraction?.backPreviewUrl && extraction.backPreviewUrl !== backUrl) {
            orphanedOcrUrls.push(extraction.backPreviewUrl);
          }

          if (extraction) {
            setForm((current) =>
              fieldsFromExtraction(current, extraction!, 'back')
            );
            if (extraction.warnings?.length) {
              setOcrWarnings(extraction.warnings);
            }
          }
        }
      } catch (error) {
        if (!isActive()) return;
        setReplaceError(idbErrorMessage(error));
        if (extraction?.frontPreviewUrl) {
          orphanedOcrUrls.push(extraction.frontPreviewUrl);
        }
        if (extraction?.backPreviewUrl) {
          orphanedOcrUrls.push(extraction.backPreviewUrl);
        }
      } finally {
        if (isActive()) {
          setReplaceBusy(null);
          setReuploadScanPreview(null);
        }
        if (ownedOriginalPreview) revokeIfObjectUrl(originalPreviewUrl);
        if (pdfScanPreview) revokeIfObjectUrl(pdfScanPreview);
        for (const url of orphanedOcrUrls) revokeIfObjectUrl(url);
      }
    },
    [
      draftScope,
      travellerId,
      invalidateSlot,
      syncDocumentsBack,
      initial.frontPreviewUrl,
      initial.backPreviewUrl,
    ]
  );

  const generalComplete = useMemo(
    () => (formConfig.showGeneralInfo ? isReviewComplete(form) : true),
    [form, formConfig.showGeneralInfo]
  );
  const coreTripIssues = useMemo(() => getCoreTripIssues(trip), [trip]);
  const multiStopIssues = useMemo(() => getMultiStopIssues(trip), [trip]);
  const tripStepIssues = useMemo(
    () => [...coreTripIssues, ...multiStopIssues],
    [coreTripIssues, multiStopIssues]
  );
  const tripComplete = useMemo(
    () =>
      formConfig.showTripDetails
        ? isCoreTripComplete(trip) && isMultiStopComplete(trip)
        : true,
    [trip, formConfig.showTripDetails]
  );
  const additionalIssues = useMemo(
    () => getAdditionalQuestionIssues(trip, formConfig.extraQuestions),
    [trip, formConfig.extraQuestions]
  );
  const additionalComplete = useMemo(
    () =>
      formConfig.extraQuestions.length === 0
        ? true
        : isAdditionalQuestionsComplete(trip, formConfig.extraQuestions),
    [trip, formConfig.extraQuestions]
  );
  const hasBackImage = hasPassportBackImage({
    passportBackUrl: backPreviewUrl,
    uploads: documents,
  });
  const visibleDocumentSlots = useMemo(
    () =>
      resolveDocumentSlotsWithPassportBack(
        getVisibleDocumentSlots(
          formConfig.documentSlots,
          formConfig.extraQuestions,
          trip.extra
        ),
        // Hide passport-back slot once a back image exists (OCR or documents).
        hasBackImage
      ),
    [
      formConfig.documentSlots,
      formConfig.extraQuestions,
      trip.extra,
      hasBackImage,
    ]
  );

  useEffect(() => {
    setDocuments((prev) => clearHiddenDocumentUploads(prev, visibleDocumentSlots));
  }, [visibleDocumentSlots]);

  const documentsComplete = useMemo(
    () => isDocumentsComplete(documents, visibleDocumentSlots),
    [documents, visibleDocumentSlots]
  );
  const unlocked = tabUnlockState({
    visibleTabs,
    generalComplete,
    tripComplete,
    additionalComplete,
    documentsComplete,
  });

  const [tab, setTab] = useState<ApplicationFormTabId>(() => {
    const initialVisibleSlots = resolveDocumentSlotsWithPassportBack(
      getVisibleDocumentSlots(
        formConfig.documentSlots,
        formConfig.extraQuestions,
        (savedTrip ?? emptyTripDetails()).extra
      ),
      hasPassportBackImage({
        passportBackUrl: initial.backPreviewUrl,
        uploads: savedDocuments,
      })
    );
    return resolvePreferredFormTab(preferredFormTab, {
      visibleTabs,
      generalComplete: formConfig.showGeneralInfo
        ? isReviewComplete(form)
        : true,
      tripComplete: formConfig.showTripDetails
        ? isCoreTripComplete(trip) && isMultiStopComplete(trip)
        : true,
      additionalComplete:
        formConfig.extraQuestions.length === 0
          ? true
          : isAdditionalQuestionsComplete(trip, formConfig.extraQuestions),
      documentsComplete: isDocumentsComplete(
        savedDocuments ?? [],
        initialVisibleSlots
      ),
    });
  });

  const selectTab = useCallback(
    (next: ApplicationFormTabId) => {
      setTab(next);
      onFormTabChange?.(next);
    },
    [onFormTabChange]
  );

  useEffect(() => {
    onFormTabChange?.(tab);
    // Announce the restored tab once on mount for localStorage cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageRootRef = useRef<HTMLDivElement>(null);

  // Keep each tab starting at the top of the scrollable overlay.
  useEffect(() => {
    const root = stageRootRef.current;
    let node: HTMLElement | null = root?.parentElement ?? null;
    while (node) {
      const { overflowY } = window.getComputedStyle(node);
      if (overflowY === 'auto' || overflowY === 'scroll') {
        node.scrollTop = 0;
        return;
      }
      node = node.parentElement;
    }
    window.scrollTo(0, 0);
  }, [tab]);

  const goNext = () => {
    if (stepCommitting) return;
    const index = visibleTabs.indexOf(tab);
    if (tab === 'general' && !generalComplete) return;
    if (tab === 'trip' && !tripComplete) return;
    if (tab === 'additional' && !additionalComplete) return;
    if (tab === 'documents' && !documentsComplete) return;
    if (tab === 'review') {
      onContinue(buildPayload());
      return;
    }

    const next = visibleTabs[index + 1];
    if (!next) return;

    // Flush debounced progress so the last field edits are in the draft
    // before the tab advances.
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }
    const payload = buildPayload();

    const advance = () => selectTab(next);
    const commit = onStepCommitRef.current;
    if (!commit) {
      onProgressRef.current?.(payload);
      advance();
      return;
    }

    setStepCommitting(true);
    void Promise.resolve(commit(payload))
      .catch((error) => {
        console.warn('[Draft] step commit failed', error);
      })
      .finally(() => {
        setStepCommitting(false);
        advance();
      });
  };

  const goBack = () => {
    const index = visibleTabs.indexOf(tab);
    if (index <= 0) {
      onBack();
      return;
    }
    selectTab(visibleTabs[index - 1]);
  };

  const continueLabel =
    tab === 'review'
      ? 'Submit application'
      : stepCommitting
        ? 'Saving…'
        : 'Continue';
  const continueDisabled =
    stepCommitting ||
    (tab === 'general' && !generalComplete) ||
    (tab === 'trip' && !tripComplete) ||
    (tab === 'additional' && !additionalComplete) ||
    (tab === 'documents' && !documentsComplete);

  const footerHint =
    tab === 'trip' && tripStepIssues.length > 0
      ? tripStepIssues[0]
      : tab === 'additional' && additionalIssues.length > 0
        ? additionalIssues[0]
        : replaceError;

  const firstTab = visibleTabs[0] ?? 'review';

  const displayName =
    formatProfileName(
      `${form.givenNames} ${form.surname}`.trim() || travellerName || ''
    ) || 'Traveller';

  return (
    <div ref={stageRootRef} className="min-h-dvh bg-white pb-28 sm:pb-0">
      <input
        ref={frontInputRef}
        type="file"
        accept={DOCUMENT_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void replacePassportImage('front', file);
        }}
      />
      <input
        ref={backInputRef}
        type="file"
        accept={DOCUMENT_FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void replacePassportImage('back', file);
        }}
      />

      {replaceBusy && (
        <div className="fixed inset-0 z-[100] overflow-hidden bg-white">
          <PassportScanStage
            previewUrl={reuploadScanPreview}
            statusText="Reading your details…"
            onBack={cancelReuploadScan}
            onClose={cancelReuploadScan}
          />
        </div>
      )}

      <div className="sticky top-0 z-20 border-b border-ash-divider/60 bg-white/95 backdrop-blur">
        <header className="relative flex items-center justify-between px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-ash bg-white px-3 py-1.5 text-sm text-portrait-ink shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[min(70%,20rem)] -translate-x-1/2 -translate-y-1/2 text-center sm:max-w-md">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-helper sm:text-xs">
              Complete application
            </p>
            <h1 className="truncate font-basier text-xl text-portrait-ink sm:text-2xl">
              {displayName}
            </h1>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full border border-ash p-2 text-slate-helper hover:text-portrait-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-6xl justify-center px-4 pb-3 sm:px-6">
          <AnimatedTabs
            items={tabMeta.map((item) => ({
              ...item,
              disabled: !unlocked[item.id],
            }))}
            value={tab}
            onChange={(id) => selectTab(id as ApplicationFormTabId)}
            tone="light"
            layoutId="passport-application-tabs"
            ariaLabel="Application sections"
            className="max-w-4xl"
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === 'general' && formConfig.showGeneralInfo && (
          <GeneralDetailsTab
            form={form}
            onChange={setForm}
            frontPreviewUrl={frontPreviewUrl}
            backPreviewUrl={backPreviewUrl}
            frontMimeType={frontMimeType}
            backMimeType={backMimeType}
            frontFilename={frontFilename}
            backFilename={backFilename}
            frontStorageKey={
              draftFileRefsProp?.find(
                (ref) => ref.slotKey === PASSPORT_FRONT_SLOT
              )?.storageKey
            }
            backStorageKey={
              draftFileRefsProp?.find(
                (ref) => ref.slotKey === PASSPORT_BACK_SLOT
              )?.storageKey
            }
            frontStorageUrl={
              draftFileRefsProp?.find(
                (ref) => ref.slotKey === PASSPORT_FRONT_SLOT
              )?.url
            }
            backStorageUrl={
              draftFileRefsProp?.find(
                (ref) => ref.slotKey === PASSPORT_BACK_SLOT
              )?.url
            }
            listingId={listingId}
            travellerId={travellerId}
            sessionUserId={sessionUserId}
            ownerUserId={ownerUserId}
            warnings={ocrWarnings}
            replaceBusy={replaceBusy}
            onEditFront={() => frontInputRef.current?.click()}
            onEditBack={
              backPreviewUrl ||
              draftFileRefsProp?.some(
                (ref) => ref.slotKey === PASSPORT_BACK_SLOT
              )
                ? () => backInputRef.current?.click()
                : undefined
            }
          />
        )}
        {tab === 'trip' && formConfig.showTripDetails && (
          <TripDetailsTab
            trip={trip}
            countryName={formConfig.countryName}
            tripSources={tripSources}
            onChange={setTrip}
          />
        )}
        {tab === 'additional' && formConfig.extraQuestions.length > 0 && (
          <AdditionalQuestionsTab
            trip={trip}
            extraQuestions={formConfig.extraQuestions}
            onChange={setTrip}
          />
        )}
        {tab === 'documents' && (
          <DocumentsTab
            listingId={listingId}
            passengerId={travellerId}
            sessionUserId={sessionUserId}
            ownerUserId={ownerUserId}
            slots={visibleDocumentSlots}
            uploads={documents}
            draftFileRefs={draftFileRefsProp}
            passportPreviewUrl={
              formConfig.showGeneralInfo ? frontPreviewUrl : undefined
            }
            passportBackPreviewUrl={
              formConfig.showGeneralInfo ? backPreviewUrl : undefined
            }
            passportFrontMimeType={frontMimeType}
            passportBackMimeType={backMimeType}
            passportFrontFilename={frontFilename}
            passportBackFilename={backFilename}
            passportReplaceBusy={replaceBusy}
            onReplacePassportFront={(file) => {
              void replacePassportImage('front', file);
            }}
            onReplacePassportBack={
              backPreviewUrl ||
              draftFileRefsProp?.some(
                (ref) => ref.slotKey === PASSPORT_BACK_SLOT
              )
                ? (file) => {
                    void replacePassportImage('back', file);
                  }
                : undefined
            }
            onChange={setDocuments}
          />
        )}
        {tab === 'review' && (
          <ReviewSubmitTab
            fields={form}
            trip={trip}
            extraQuestions={formConfig.extraQuestions}
            slots={visibleDocumentSlots}
            uploads={documents}
            countryName={formConfig.countryName}
            passportPreviewUrl={
              formConfig.showGeneralInfo ? frontPreviewUrl : undefined
            }
            passportBackPreviewUrl={
              formConfig.showGeneralInfo ? backPreviewUrl : undefined
            }
            passportFrontMimeType={frontMimeType}
            passportBackMimeType={backMimeType}
            passportFrontFilename={frontFilename}
            passportBackFilename={backFilename}
            showGeneralInfo={formConfig.showGeneralInfo}
            showTripDetails={formConfig.showTripDetails}
            onEditSection={selectTab}
            listingId={listingId}
            travellerId={travellerId}
            draftFileRefs={draftFileRefsProp}
            ownerUserId={ownerUserId}
            sessionUserId={sessionUserId}
          />
        )}

        <FormTabFooter
          continueLabel={continueLabel}
          continueLabelMobile={tab === 'review' ? 'Submit' : undefined}
          continueDisabled={continueDisabled}
          hint={footerHint}
          onContinue={goNext}
          onBack={goBack}
          backLabel={tab === firstTab ? 'Close' : 'Previous'}
          fixedOnMobile
        />
      </div>
    </div>
  );
}
