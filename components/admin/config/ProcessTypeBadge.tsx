import React from 'react';
import { cn } from '@/lib/utils';

export interface ProcessTypeBadgeProps {
  type: 'electronic_travel_authorisation' | 'afc' | 'visa' | 'appointment' | 'visa_on_arrival' | 'sticker_visa' | 'visa_free';
  className?: string;
}

/**
 * ProcessTypeBadge Component - Portrait Design System
 *
 * Color-coded badges for different visa process types:
 * - eTA: Mint Wash (#d7ffe2)
 * - AFC: Sky Wash (#e8f1ff)
 * - Visa: Peach Wash (#ffebd6)
 * - Appointment: Rainbow gradient outline
 * - Other types: Default ash background
 *
 * @example
 * <ProcessTypeBadge type="electronic_travel_authorisation" />
 */
export function ProcessTypeBadge({ type, className }: ProcessTypeBadgeProps) {
  const getBadgeStyles = () => {
    switch (type) {
      case 'electronic_travel_authorisation':
        return {
          bg: 'bg-mint-wash',
          text: 'text-portrait-ink',
          label: 'eTA'
        };
      case 'afc':
        return {
          bg: 'bg-sky-wash',
          text: 'text-portrait-ink',
          label: 'AFC'
        };
      case 'visa':
      case 'sticker_visa':
        return {
          bg: 'bg-peach-wash',
          text: 'text-portrait-ink',
          label: type === 'sticker_visa' ? 'Sticker Visa' : 'Visa'
        };
      case 'appointment':
        return {
          bg: 'bg-gradient-to-r from-blue-500 via-pink-500 to-green-500 p-[1.5px]',
          text: 'text-portrait-ink',
          label: 'Appointment',
          isGradient: true
        };
      case 'visa_on_arrival':
        return {
          bg: 'bg-ash-divider',
          text: 'text-portrait-ink',
          label: 'Visa on Arrival'
        };
      case 'visa_free':
        return {
          bg: 'bg-mint-wash',
          text: 'text-portrait-ink',
          label: 'Visa Free'
        };
      default:
        return {
          bg: 'bg-ash-divider',
          text: 'text-slate-helper',
          label: 'Unknown'
        };
    }
  };

  const styles = getBadgeStyles();

  if (styles.isGradient) {
    // Rainbow gradient outline style for appointments
    return (
      <span className={cn('inline-flex rounded-full', styles.bg, className)}>
        <span className={cn(
          'px-3 py-1 text-xs font-medium rounded-full bg-white',
          styles.text
        )}>
          {styles.label}
        </span>
      </span>
    );
  }

  // Regular filled badge
  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
      styles.bg,
      styles.text,
      className
    )}>
      {styles.label}
    </span>
  );
}
