'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsPanel,
} from '@/components/ui';
import { PaymentHistory } from '@/components/applications/PaymentHistory';
import { ConversationThread } from '@/components/visa/ConversationThread';
import { markApplicantConversationRead } from '@/app/(dashboard)/actions';
import type { CommentView } from '@/lib/visa/corrections';
import type { ActionResponse, ApplicationPaymentItem } from '@/types/admin';

interface ApplicantActivityTabsProps {
  applicationId: string;
  hasUnreadConversation: boolean;
  comments: CommentView[];
  payments: ApplicationPaymentItem[];
  postComment: (input: {
    applicationId: string;
    body: string;
  }) => Promise<ActionResponse>;
  children: ReactNode;
}

export function ApplicantActivityTabs({
  applicationId,
  hasUnreadConversation,
  comments,
  payments,
  postComment,
  children,
}: ApplicantActivityTabsProps) {
  const [tab, setTab] = useState('application');
  const [showDot, setShowDot] = useState(hasUnreadConversation);
  const markedRef = useRef(false);

  useEffect(() => {
    if (tab !== 'conversation' || !hasUnreadConversation || markedRef.current) {
      return;
    }
    markedRef.current = true;
    void markApplicantConversationRead(applicationId);
  }, [applicationId, hasUnreadConversation, tab]);

  const handleChange = (id: string) => {
    setTab(id);
    if (id === 'conversation') {
      setShowDot(false);
    }
  };

  return (
    <Tabs
      items={[
        { id: 'application', label: 'Application information' },
        {
          id: 'conversation',
          label: 'Conversation',
          dot: showDot,
          dotLabel: 'New message',
        },
        { id: 'payments', label: 'Payment history' },
      ]}
      value={tab}
      onChange={handleChange}
      tone="light"
      layoutId={`applicant-visa-activity-${applicationId}`}
      ariaLabel="Application sections"
    >
      <TabsPanel id="application" className="mt-4">
        {children}
      </TabsPanel>
      <TabsPanel id="conversation" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <ConversationThread
              applicationId={applicationId}
              comments={comments}
              postComment={postComment}
            />
          </CardContent>
        </Card>
      </TabsPanel>
      <TabsPanel id="payments" className="mt-4">
        <PaymentHistory payments={payments} />
      </TabsPanel>
    </Tabs>
  );
}
