'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { AnimatedTabs } from '@/components/ui';
import { DocumentsTab } from '@/components/apply/form/DocumentsTab';
import { FormTabFooter } from '@/components/apply/form/FormTabFooter';
import { GeneralDetailsTab } from '@/components/apply/form/GeneralDetailsTab';
import { ReviewSubmitTab } from '@/components/apply/form/ReviewSubmitTab';
import { TripDetailsTab } from '@/components/apply/form/TripDetailsTab';
import {
  APPLICATION_FORM_TABS,
  defaultApplyFormConfig,
  emptyTripDetails,
  firstIncompleteTab,
  getTripIssues,
  isDocumentsComplete,
  isTripComplete,
  tabUnlockState,
  type ApplicationFormTabId,
  type ApplyFormConfig,
  type TravellerDocumentUpload,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import type { IndianPassportFields } from '@/lib/passport/types';
import { isReviewComplete } from '@/lib/passport/schema';

export interface PassportApplicationPayload {
  fields: IndianPassportFields;
  tripDetails: TravellerTripDetails;
  documents: TravellerDocumentUpload[];
  frontPreviewUrl: string;
  backPreviewUrl?: string;
}

interface PassportReviewStageProps {
  initial: IndianPassportFields & {
    frontPreviewUrl: string;
    backPreviewUrl?: string;
    warnings?: string[];
  };
  formConfig?: ApplyFormConfig;
  savedTrip?: TravellerTripDetails;
  savedDocuments?: TravellerDocumentUpload[];
  arrivalPrefill?: string;
  onBack: () => void;
  onClose: () => void;
  onEditFront: () => void;
  onContinue: (data: PassportApplicationPayload) => void;
}

const TAB_ORDER: ApplicationFormTabId[] = [
  'general',
  'trip',
  'documents',
  'review',
];

export function PassportReviewStage({
  initial,
  formConfig: formConfigProp,
  savedTrip,
  savedDocuments,
  arrivalPrefill,
  onBack,
  onClose,
  onEditFront,
  onContinue,
}: PassportReviewStageProps) {
  const formConfig = formConfigProp ?? defaultApplyFormConfig();
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
      purpose: savedTrip?.purpose || formConfig.purpose,
      arrivalDate: savedTrip?.arrivalDate || arrivalPrefill || '',
      returnDate: savedTrip?.returnDate || '',
      arrivalCity: savedTrip?.arrivalCity || '',
      accommodationName: savedTrip?.accommodationName || '',
      accommodationAddress: savedTrip?.accommodationAddress || '',
      flightNumber: savedTrip?.flightNumber || '',
      extra: savedTrip?.extra,
    })
  );
  const [documents, setDocuments] = useState<TravellerDocumentUpload[]>(
    savedDocuments ?? []
  );

  const generalComplete = useMemo(() => isReviewComplete(form), [form]);
  const tripIssues = useMemo(
    () => getTripIssues(trip, formConfig.extraQuestions),
    [trip, formConfig.extraQuestions]
  );
  const tripComplete = tripIssues.length === 0;
  const documentsComplete = useMemo(
    () => isDocumentsComplete(documents, formConfig.documentSlots),
    [documents, formConfig.documentSlots]
  );
  const unlocked = tabUnlockState({
    generalComplete,
    tripComplete,
    documentsComplete,
  });

  const [tab, setTab] = useState<ApplicationFormTabId>(() =>
    firstIncompleteTab({
      generalComplete: isReviewComplete(form),
      tripComplete: isTripComplete(trip, formConfig.extraQuestions),
      documentsComplete: isDocumentsComplete(
        savedDocuments ?? [],
        formConfig.documentSlots
      ),
    })
  );

  const payload = (): PassportApplicationPayload => ({
    fields: form,
    tripDetails: trip,
    documents,
    frontPreviewUrl: initial.frontPreviewUrl,
    backPreviewUrl: initial.backPreviewUrl,
  });

  const goNext = () => {
    const index = TAB_ORDER.indexOf(tab);
    if (tab === 'general' && !generalComplete) return;
    if (tab === 'trip' && !tripComplete) return;
    if (tab === 'documents' && !documentsComplete) return;
    if (tab === 'review') {
      onContinue(payload());
      return;
    }
    setTab(TAB_ORDER[index + 1]);
  };

  const goBack = () => {
    const index = TAB_ORDER.indexOf(tab);
    if (index <= 0) {
      onBack();
      return;
    }
    setTab(TAB_ORDER[index - 1]);
  };

  const continueLabel =
    tab === 'review' ? 'Submit application' : 'Continue';
  const continueDisabled =
    (tab === 'general' && !generalComplete) ||
    (tab === 'trip' && !tripComplete) ||
    (tab === 'documents' && !documentsComplete);

  return (
    <div className="min-h-dvh bg-white">
      <header className="relative flex items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-ash bg-white px-3 py-1.5 text-sm text-portrait-ink shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <h1 className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-basier text-xl text-portrait-ink sm:text-2xl">
          Complete application
        </h1>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-full border border-ash p-2 text-slate-helper hover:text-portrait-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <AnimatedTabs
          items={APPLICATION_FORM_TABS.map((item) => ({
            ...item,
            disabled: !unlocked[item.id],
          }))}
          value={tab}
          onChange={(id) => setTab(id as ApplicationFormTabId)}
          tone="light"
          layoutId="passport-application-tabs"
          ariaLabel="Application sections"
        />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === 'general' && (
          <GeneralDetailsTab
            form={form}
            onChange={setForm}
            frontPreviewUrl={initial.frontPreviewUrl}
            backPreviewUrl={initial.backPreviewUrl}
            warnings={initial.warnings}
            onEditFront={onEditFront}
          />
        )}
        {tab === 'trip' && (
          <TripDetailsTab
            trip={trip}
            countryName={formConfig.countryName}
            extraQuestions={formConfig.extraQuestions}
            onChange={setTrip}
          />
        )}
        {tab === 'documents' && (
          <DocumentsTab
            slots={formConfig.documentSlots}
            uploads={documents}
            passportPreviewUrl={initial.frontPreviewUrl}
            onChange={setDocuments}
          />
        )}
        {tab === 'review' && (
          <ReviewSubmitTab
            fields={form}
            trip={trip}
            extraQuestions={formConfig.extraQuestions}
            slots={formConfig.documentSlots}
            uploads={documents}
            countryName={formConfig.countryName}
          />
        )}

        <FormTabFooter
          continueLabel={continueLabel}
          continueDisabled={continueDisabled}
          hint={
            tab === 'trip' && tripIssues.length > 0 ? tripIssues[0] : null
          }
          onContinue={goNext}
          onBack={goBack}
          backLabel={tab === 'general' ? 'Close' : 'Previous'}
        />
      </div>
    </div>
  );
}
