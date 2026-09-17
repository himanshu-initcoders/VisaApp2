'use client';

import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { indianMobileSchema, mobileOtpSchema } from '@/lib/validations/auth';

export interface MobileOtpSignInProps {
  otpLength?: number;
  onOtpComplete?: (payload: { phone: string; otp: string }) => void;
}

export function MobileOtpSignIn({
  otpLength = 5,
  onOtpComplete,
}: MobileOtpSignInProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otp, setOtp] = useState<string[]>(() => Array(otpLength).fill(''));
  const [otpComplete, setOtpComplete] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, '').slice(0, 10));
    if (phoneError) setPhoneError(null);
  };

  const handleGetOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = indianMobileSchema.safeParse(phone);
    if (!result.success) {
      setPhoneError(
        result.error.issues[0]?.message ??
          'Enter a valid Indian mobile number'
      );
      return;
    }

    setOtp(Array(otpLength).fill(''));
    setOtpComplete(false);
    setStep('otp');
    requestAnimationFrame(() => otpRefs.current[0]?.focus());
  };

  const commitOtp = (next: string[]) => {
    setOtp(next);
    const value = next.join('');
    const isComplete =
      otpLength === 5
        ? mobileOtpSchema.safeParse(value).success
        : value.length === otpLength && /^\d+$/.test(value);
    setOtpComplete(isComplete);
    if (isComplete) {
      onOtpComplete?.({ phone, otp: value });
    }
  };

  const handleOtpChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      const next = [...otp];
      next[index] = '';
      commitOtp(next);
      return;
    }

    if (digits.length > 1) {
      const next = [...otp];
      for (let offset = 0; offset < digits.length && index + offset < otpLength; offset += 1) {
        next[index + offset] = digits[offset]!;
      }
      commitOtp(next);
      otpRefs.current[Math.min(index + digits.length, otpLength - 1)]?.focus();
      return;
    }

    const next = [...otp];
    next[index] = digits;
    commitOtp(next);
    if (index < otpLength - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      event.preventDefault();
      const next = [...otp];
      next[index - 1] = '';
      commitOtp(next);
      otpRefs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
    }

    if (event.key === 'ArrowRight' && index < otpLength - 1) {
      event.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, otpLength);
    if (!digits) return;

    const next = Array(otpLength).fill('');
    for (let i = 0; i < digits.length; i += 1) {
      next[i] = digits[i]!;
    }
    commitOtp(next);
    otpRefs.current[Math.min(digits.length, otpLength - 1)]?.focus();
  };

  const handleChangeNumber = () => {
    setStep('phone');
    setOtp(Array(otpLength).fill(''));
    setOtpComplete(false);
  };

  if (step === 'otp') {
    return (
      <div className="space-y-5">
        <div>
          <p className="font-switzer text-sm text-slate-helper">
            Enter the {otpLength}-digit OTP sent to
          </p>
          <p className="mt-1 font-switzer text-base font-medium text-portrait-ink">
            +91 {phone}
          </p>
        </div>

        <div className="flex justify-between gap-2">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(node) => {
                otpRefs.current[index] = node;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={otpLength}
              aria-label={`OTP digit ${index + 1}`}
              value={digit}
              onChange={(event) => handleOtpChange(index, event.target.value)}
              onKeyDown={(event) => handleOtpKeyDown(index, event)}
              onPaste={handleOtpPaste}
              className={cn(
                'h-12 w-12 rounded-input border bg-white text-center font-switzer text-lg text-portrait-ink',
                'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:border-transparent',
                otpComplete ? 'border-portrait-ink' : 'border-ash'
              )}
            />
          ))}
        </div>

        {otpComplete && (
          <p className="font-switzer text-sm text-slate-helper">OTP entered</p>
        )}

        <button
          type="button"
          onClick={handleChangeNumber}
          className="font-switzer text-sm text-portrait-ink hover:opacity-80"
        >
          Change number
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleGetOtp} className="space-y-4">
      <div className="w-full">
        <label
          htmlFor="mobile-otp-phone"
          className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
        >
          Mobile number
        </label>
        <div
          className={cn(
            'flex items-center rounded-input border bg-white',
            phoneError
              ? 'border-red-500 focus-within:ring-red-500'
              : 'border-ash',
            'focus-within:ring-2 focus-within:ring-portrait-ink focus-within:border-transparent'
          )}
        >
          <span className="flex shrink-0 items-center gap-1.5 border-r border-ash px-3 py-2.5 font-switzer text-sm font-medium text-portrait-ink">
            <span className="rounded bg-sky-wash px-1.5 py-0.5 text-[10px] font-semibold">
              IN
            </span>
            +91
          </span>
          <input
            id="mobile-otp-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="9876543210"
            value={phone}
            onChange={(event) => handlePhoneChange(event.target.value)}
            className="w-full bg-transparent px-4 py-2.5 font-switzer text-base text-portrait-ink placeholder:text-slate-helper focus:outline-none"
          />
        </div>
        {phoneError && (
          <p className="mt-1.5 font-switzer text-sm text-red-600">{phoneError}</p>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full">
        Get OTP
      </Button>
    </form>
  );
}
