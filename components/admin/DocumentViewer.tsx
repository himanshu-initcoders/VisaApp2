'use client';

import { useState } from 'react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import { verifyDocument } from '@/app/(admin)/actions';
import type { DocumentWithVerification } from '@/types/admin';
import { cn } from '@/lib/utils';

/**
 * Document Viewer Component
 *
 * Display and verify uploaded documents:
 * - Grid of document cards
 * - Document type, filename, upload date, verification status
 * - Verify/Reject buttons for unverified documents
 * - Verification notes input for rejection
 */

interface DocumentViewerProps {
  documents: DocumentWithVerification[];
  onDocumentVerified?: () => void;
}

export function DocumentViewer({ documents, onDocumentVerified }: DocumentViewerProps) {
  const [verifying, setVerifying] = useState<string | null>(null);
  const [rejectingDoc, setRejectingDoc] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 mx-auto text-slate-helper mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p className="font-switzer text-sm text-slate-helper">
          No documents uploaded yet
        </p>
      </div>
    );
  }

  const handleVerify = async (documentId: string) => {
    setVerifying(documentId);
    try {
      const result = await verifyDocument({
        documentId,
        verified: true,
      });

      if (result.success) {
        onDocumentVerified?.();
      } else {
        alert(result.message || 'Failed to verify document');
      }
    } catch (error) {
      alert('An error occurred while verifying the document');
    } finally {
      setVerifying(null);
    }
  };

  const handleReject = async (documentId: string) => {
    if (!rejectNotes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setVerifying(documentId);
    try {
      const result = await verifyDocument({
        documentId,
        verified: false,
        notes: rejectNotes.trim(),
      });

      if (result.success) {
        setRejectingDoc(null);
        setRejectNotes('');
        onDocumentVerified?.();
      } else {
        alert(result.message || 'Failed to reject document');
      }
    } catch (error) {
      alert('An error occurred while rejecting the document');
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {documents.map((doc) => (
        <Card
          key={doc.id}
          className={cn(
            'transition-colors',
            doc.verified === true && 'bg-mint-wash/30',
            doc.verified === false && 'bg-red-50/30',
            doc.verified === null && 'bg-peach-wash/30'
          )}
        >
          <CardContent className="pt-4">
            <div className="space-y-3">
              {/* Document type and status */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-switzer text-sm font-semibold text-portrait-ink">
                    {doc.documentType}
                  </h4>
                  <p className="font-switzer text-xs text-slate-helper mt-1">
                    {doc.filename}
                  </p>
                </div>
                <Badge
                  variant={
                    doc.verified === true
                      ? 'approved'
                      : doc.verified === false
                      ? 'rejected'
                      : 'pending'
                  }
                >
                  {doc.verified === true
                    ? 'Verified'
                    : doc.verified === false
                    ? 'Rejected'
                    : 'Unverified'}
                </Badge>
              </div>

              {/* File info */}
              <div className="flex items-center gap-2 text-xs text-slate-helper font-switzer">
                <span>
                  {doc.fileSize
                    ? `${(doc.fileSize / 1024).toFixed(1)} KB`
                    : 'Unknown size'}
                </span>
                <span>•</span>
                <span>
                  {new Date(doc.uploadedAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>

              {/* Verification notes (if rejected) */}
              {doc.verified === false && doc.verificationNotes && (
                <div className="bg-red-100 p-2 rounded-lg">
                  <p className="font-switzer text-xs text-red-800">
                    <span className="font-semibold">Reason: </span>
                    {doc.verificationNotes}
                  </p>
                </div>
              )}

              {/* Reject notes input (when rejecting) */}
              {rejectingDoc === doc.id && (
                <div>
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    rows={3}
                    maxLength={500}
                    className={cn(
                      'w-full font-switzer text-xs text-portrait-ink',
                      'bg-white border border-ash rounded-lg',
                      'px-3 py-2',
                      'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-opacity-20',
                      'resize-none'
                    )}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Preview button - always available */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Open document in new tab (would need S3 presigned URL)
                    alert('Document preview functionality will be implemented with S3 URLs');
                  }}
                  className="text-xs"
                >
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  Preview
                </Button>

                {/* Verify/Reject buttons - only for unverified documents */}
                {doc.verified === null && (
                  <>
                    {rejectingDoc === doc.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRejectingDoc(null);
                            setRejectNotes('');
                          }}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleReject(doc.id)}
                          disabled={verifying === doc.id || !rejectNotes.trim()}
                          className="text-xs"
                        >
                          {verifying === doc.id ? 'Rejecting...' : 'Confirm Reject'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRejectingDoc(doc.id);
                            setRejectNotes('');
                          }}
                          disabled={verifying === doc.id}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleVerify(doc.id)}
                          disabled={verifying === doc.id}
                          className="text-xs"
                        >
                          {verifying === doc.id ? 'Verifying...' : 'Verify'}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
