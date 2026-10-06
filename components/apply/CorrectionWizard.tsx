'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsPanel, Button } from '@/components/ui';
import { GeneralDetailsTab } from '@/components/apply/form/GeneralDetailsTab';
import { TripDetailsTab } from '@/components/apply/form/TripDetailsTab';
import { AdditionalQuestionsTab } from '@/components/apply/form/AdditionalQuestionsTab';
import { DocumentsTab } from '@/components/apply/form/DocumentsTab';
import { ReviewSubmitTab } from '@/components/apply/form/ReviewSubmitTab';
import { submitCorrection } from '@/app/(dashboard)/actions';
import {
  APPLICATION_FORM_TABS,
  getVisibleApplicationTabs,
  type ApplyFormConfig,
  type TravellerDocumentUpload,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import type { IndianPassportFields } from '@/lib/passport/types';

export interface CorrectionItemView {
  targetKey: string;
  label: string;
  comment: string;
  kind: string;
}

interface CorrectionWizardProps {
  applicationId: string;
  travellerId: string;
  travellerName: string;
  countryName: string;
  listingId: string;
  formConfig: ApplyFormConfig;
  passport: IndianPassportFields;
  trip: TravellerTripDetails;
  uploads: TravellerDocumentUpload[];
  frontPreviewUrl: string;
  backPreviewUrl?: string;
  items: CorrectionItemView[];
}

function readField(
  passport: IndianPassportFields,
  trip: TravellerTripDetails,
  targetKey: string
): string {
  if (targetKey.startsWith('passport.')) {
    const value = passport[targetKey.slice('passport.'.length) as keyof IndianPassportFields];
    return value == null ? '' : String(value);
  }
  if (targetKey.startsWith('trip.')) {
    const value = trip[targetKey.slice('trip.'.length) as keyof TravellerTripDetails];
    return value == null ? '' : String(value);
  }
  if (targetKey.startsWith('extra.')) {
    return trip.extra[targetKey.slice('extra.'.length)] ?? '';
  }
  return '';
}

function tabIdForTarget(targetKey: string): string {
  if (
    targetKey.startsWith('passport.') ||
    targetKey === 'passport-front' ||
    targetKey === 'passport-back'
  ) {
    return 'general';
  }
  if (targetKey.startsWith('trip.')) return 'trip';
  if (targetKey.startsWith('extra.')) return 'additional';
  return 'documents';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function CorrectionWizard({
  applicationId,
  travellerId,
  travellerName,
  countryName,
  listingId,
  formConfig,
  passport: initialPassport,
  trip: initialTrip,
  uploads: initialUploads,
  frontPreviewUrl,
  backPreviewUrl,
  items,
}: CorrectionWizardProps) {
  const router = useRouter();
  const frontInput = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);
  const initialPassportRef = useRef(initialPassport);
  const initialTripRef = useRef(initialTrip);
  const [passport, setPassport] = useState(initialPassport);
  const [trip, setTrip] = useState(initialTrip);
  const [uploads, setUploads] = useState(initialUploads);
  const [frontUrl, setFrontUrl] = useState(frontPreviewUrl);
  const [backUrl, setBackUrl] = useState(backPreviewUrl ?? '');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [tab, setTab] = useState('general');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const editableKeys = useMemo(
    () => new Set(items.map((item) => item.targetKey)),
    [items]
  );
  const comments = useMemo(
    () => Object.fromEntries(items.map((item) => [item.targetKey, item.comment])),
    [items]
  );

  const visible = getVisibleApplicationTabs(formConfig);
  const tabsWithChanges = new Set(items.map((item) => tabIdForTarget(item.targetKey)));
  const tabItems = APPLICATION_FORM_TABS.filter((item) =>
    visible.includes(item.id)
  ).map((item) => ({
    ...item,
    dot: tabsWithChanges.has(item.id),
  }));

  const documentFile = (slotKey: string): File | null => {
    if (slotKey === 'passport-front') return frontFile;
    if (slotKey === 'passport-back') return backFile;
    return uploads.find((item) => item.key === slotKey)?.file ?? null;
  };

  const itemReady = (item: CorrectionItemView) => {
    if (item.kind === 'document') return Boolean(documentFile(item.targetKey));
    const current = readField(passport, trip, item.targetKey).trim();
    const previous = readField(
      initialPassportRef.current,
      initialTripRef.current,
      item.targetKey
    ).trim();
    return current !== previous && current.length > 0;
  };

  const ready = items.every(itemReady);

  const jump = (targetKey: string) => {
    if (targetKey.startsWith('passport.') || targetKey.startsWith('passport-')) {
      setTab('general');
    } else if (targetKey.startsWith('trip.')) {
      setTab('trip');
    } else if (targetKey.startsWith('extra.')) {
      setTab('additional');
    } else {
      setTab('documents');
    }
    requestAnimationFrame(() => {
      document.getElementById(`correction-${targetKey}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const onImage = (which: 'front' | 'back', file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (which === 'front') {
      setFrontFile(file);
      setFrontUrl(url);
    } else {
      setBackFile(file);
      setBackUrl(url);
    }
  };

  const send = async () => {
    setError('');
    setSubmitting(true);
    try {
      const fields: Record<string, string> = {};
      const files: Array<{
        slotKey: string;
        filename: string;
        mimeType: string;
        bufferBase64: string;
      }> = [];

      for (const item of items) {
        if (item.kind === 'field') {
          fields[item.targetKey] = readField(passport, trip, item.targetKey).trim();
          continue;
        }
        const file = documentFile(item.targetKey);
        if (!file) {
          setError(`Upload a new file for ${item.label}`);
          return;
        }
        files.push({
          slotKey: item.targetKey,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          bufferBase64: await fileToBase64(file),
        });
      }

      const result = await submitCorrection({
        applicationId,
        travellerId,
        fields,
        files,
      });
      if (!result.success) {
        setError(result.message || 'Could not send the updates');
        return;
      }
      router.push(`/applications/visa/${applicationId}`);
      router.refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the updates');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-[#f3c9a0] bg-peach-wash px-5 py-4">
        <p className="font-switzer text-xs font-semibold uppercase tracking-wider text-portrait-ink">
          What we need · {travellerName}
        </p>
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.targetKey}>
              <button
                type="button"
                onClick={() => jump(item.targetKey)}
                className="text-left font-switzer text-sm text-portrait-ink"
              >
                <span className="font-semibold">{item.label}.</span> {item.comment}
                {itemReady(item) ? ' · updated' : ''}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <input
        ref={frontInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(event) => onImage('front', event.target.files?.[0])}
      />
      <input
        ref={backInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(event) => onImage('back', event.target.files?.[0])}
      />

      <Tabs
        items={[...tabItems]}
        value={tab}
        onChange={setTab}
        tone="light"
        layoutId={`correction-${applicationId}`}
        ariaLabel="Application sections"
      >
        {visible.includes('general') && (
          <TabsPanel id="general">
            <GeneralDetailsTab
              form={passport}
              onChange={setPassport}
              frontPreviewUrl={frontUrl}
              backPreviewUrl={backUrl || undefined}
              onEditFront={() => frontInput.current?.click()}
              onEditBack={() => backInput.current?.click()}
              editableKeys={editableKeys}
              comments={comments}
            />
          </TabsPanel>
        )}
        {visible.includes('trip') && (
          <TabsPanel id="trip">
            <TripDetailsTab
              trip={trip}
              countryName={countryName}
              onChange={setTrip}
              editableKeys={editableKeys}
              comments={comments}
            />
          </TabsPanel>
        )}
        {visible.includes('additional') && (
          <TabsPanel id="additional">
            <AdditionalQuestionsTab
              trip={trip}
              extraQuestions={formConfig.extraQuestions}
              onChange={setTrip}
              editableKeys={editableKeys}
              comments={comments}
            />
          </TabsPanel>
        )}
        {visible.includes('documents') && (
          <TabsPanel id="documents">
            <DocumentsTab
              listingId={listingId}
              passengerId={travellerId}
              slots={formConfig.documentSlots}
              uploads={uploads}
              onChange={setUploads}
              editableKeys={editableKeys}
              comments={comments}
              storage="memory"
              passportPreviewUrl={frontUrl || undefined}
            />
          </TabsPanel>
        )}
        {visible.includes('review') && (
          <TabsPanel id="review">
            <ReviewSubmitTab
              fields={passport}
              trip={trip}
              extraQuestions={formConfig.extraQuestions}
              slots={formConfig.documentSlots}
              uploads={uploads}
              countryName={countryName}
              passportPreviewUrl={frontUrl || undefined}
              passportBackPreviewUrl={backUrl || undefined}
              showGeneralInfo={formConfig.showGeneralInfo}
              showTripDetails={formConfig.showTripDetails}
              editableKeys={editableKeys}
            />
          </TabsPanel>
        )}
      </Tabs>

      {error && (
        <p className="font-switzer text-sm text-[#ff4940]" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          disabled={!ready || submitting}
          onClick={() => {
            void send();
          }}
        >
          {submitting ? 'Sending…' : 'Send updates'}
        </Button>
      </div>
    </div>
  );
}
