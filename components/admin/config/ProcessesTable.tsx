'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ProcessTypeBadge } from './ProcessTypeBadge';

interface ProcessWithCountry {
  id: string;
  processName: string;
  processType:
    | 'electronic_travel_authorisation'
    | 'afc'
    | 'visa'
    | 'appointment'
    | 'visa_on_arrival'
    | 'sticker_visa'
    | 'visa_free';
  purpose: string;
  standardEtaDuration: number | null;
  standardEtaUnit: string | null;
  country: {
    name: string;
    iso2Code: string;
  };
  prices: Array<{
    id: string;
    governmentFeeAmount: string | null;
    serviceFeeAmount: string | null;
    governmentGstFeeAmount: string | null;
    entryLengthStayAmount: number | null;
    entryLengthStayUnit: string | null;
    sortOrder: number;
  }>;
}

interface ProcessesTableProps {
  processes: ProcessWithCountry[];
}

function firstPackageLabel(prices: ProcessWithCountry['prices']) {
  const first = prices[0];
  if (!first) return '—';
  const total =
    parseFloat(first.governmentFeeAmount || '0') +
    parseFloat(first.serviceFeeAmount || '0') +
    parseFloat(first.governmentGstFeeAmount || '0');
  const price = total === 0 ? 'FREE' : `₹${Math.round(total).toLocaleString('en-IN')}`;
  const days =
    first.entryLengthStayAmount && first.entryLengthStayUnit
      ? ` · ${first.entryLengthStayAmount} ${first.entryLengthStayUnit}`
      : '';
  return `${price}${days}`;
}

export function ProcessesTable({ processes }: ProcessesTableProps) {
  const getFlag = (iso2Code: string) => {
    const codePoints = iso2Code
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const formatETA = (duration: number | null, unit: string | null) => {
    if (!duration || !unit) return '—';
    return `${duration} ${unit}`;
  };

  if (processes.length === 0) {
    return (
      <div className="bg-white border border-ash-divider rounded-3xl p-12 text-center">
        <p className="text-slate-helper">No visa listings found</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-ash-divider rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ash-divider bg-sky-wash/30">
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-helper uppercase tracking-wider">
                Country
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-helper uppercase tracking-wider">
                Visa Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-helper uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-helper uppercase tracking-wider">
                Purpose
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-slate-helper uppercase tracking-wider">
                From
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-slate-helper uppercase tracking-wider">
                ETA
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-slate-helper uppercase tracking-wider">
                Packages
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-slate-helper uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ash-divider">
            {processes.map((process) => (
              <tr key={process.id} className="hover:bg-mint-wash/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getFlag(process.country.iso2Code)}</span>
                    <span className="text-sm font-medium text-portrait-ink">
                      {process.country.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Link
                    href={`/admin/config/visa-listings/${process.id}`}
                    className="text-sm font-medium text-portrait-ink hover:text-nautical-teal"
                  >
                    {process.processName}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <ProcessTypeBadge type={process.processType} />
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-helper capitalize">
                    {process.purpose.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-medium text-portrait-ink text-sm">
                    {firstPackageLabel(process.prices)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm text-slate-helper">
                    {formatETA(process.standardEtaDuration, process.standardEtaUnit)}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-mint-wash text-portrait-ink text-xs font-medium">
                    {process.prices.length}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/admin/config/visa-listings/${process.id}`}
                    className={cn(
                      'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                      'text-portrait-ink hover:bg-mint-wash'
                    )}
                  >
                    View Details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
