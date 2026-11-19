'use client';

import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState,
} from 'react';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  indianMobileSchema,
  mobileOtpSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from '@/lib/validations/auth';
import { requestOtp } from '@/lib/auth/otp';
import { trackEvent } from '@/lib/analytics/gtm';

type AuthStep = 'phone' | 'otp';

export interface ApplicantAuthPanelProps {
  otpLength?: number;
  variant?: 'page' | 'checkout-embed' | 'modal-embed';
  redirectTo?: string;
  analyticsContext?: 'signin' | 'apply_modal' | 'checkout' | 'save_draft';
  onVerified?: (payload: { phone: string; userId: string }) => void;
}

export function ApplicantAuthPanel({
  otpLength = 5,
  variant = 'page',
  redirectTo,
  analyticsContext,
  onVerified,
}: ApplicantAuthPanelProps) {
  const authContext =
    analyticsContext ??
    (variant === 'checkout-embed' || variant === 'modal-embed'
      ? 'checkout'
      : 'signin');
  const router = useRouter();

  const [step, setStep] = useState<AuthStep>('phone');
  const [accountExists, setAccountExists] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [otp, setOtp] = useState<string[]>(() => Array(otpLength).fill(''));
  const [otpComplete, setOtpComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const verifyingRef = useRef(false);
  const sendingRef = useRef(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const clearMessages = () => {
    setError(null);
    setNotice(null);
    setFieldErrors({});
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, '').slice(0, 10));
    if (fieldErrors.phone) {
      setFieldErrors((prev) => {
        const { phone: _removed, ...rest } = prev;
        return rest;
      });
    }
    if (error) setError(null);
  };

  const handleGetOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || verifyingRef.current || sendingRef.current) return;
    clearMessages();

    const parsed = requestOtpSchema.safeParse({ phone });
    if (!parsed.success) {
      setFieldErrors({
        phone:
          parsed.error.issues[0]?.message ??
          'Enter a valid Indian mobile number',
      });
      return;
    }

    sendingRef.current = true;
    setLoading(true);
    try {
      const response = await requestOtp({ phone: parsed.data.phone });
      if (!response.success) {
        setError(response.error);
        return;
      }
      trackEvent('auth_otp_requested', {
        context: authContext,
        method: 'phone_otp',
        intent: response.accountExists ? 'login' : 'register',
      });
      setPhone(parsed.data.phone);
      setAccountExists(response.accountExists);
      setOtp(Array(otpLength).fill(''));
      setOtpComplete(false);
      setStep('otp');
      requestAnimationFrame(() => {
        if (!response.accountExists) {
          document.getElementById('applicant-auth-name')?.focus();
        } else {
          otpRefs.current[0]?.focus();
        }
      });
    } catch {
      setError('Could not send OTP. Please try again.');
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading || verifyingRef.current || sendingRef.current) return;
    sendingRef.current = true;
    setResending(true);
    setLoading(true);
    setError(null);
    setNotice(null);
    setOtp(Array(otpLength).fill(''));
    setOtpComplete(false);

    try {
      const response = await requestOtp({ phone });
      if (!response.success) {
        setError(response.error);
        return;
      }
      setAccountExists(response.accountExists);
      trackEvent('auth_otp_requested', {
        context: authContext,
        method: 'phone_otp',
        intent: response.accountExists ? 'login' : 'register',
      });
      setNotice('New code sent on WhatsApp. Use the newest code.');
      requestAnimationFrame(() => otpRefs.current[0]?.focus());
    } catch {
      setError('Could not send OTP. Please try again.');
    } finally {
      sendingRef.current = false;
      setResending(false);
      setLoading(false);
    }
  };

  const verifyAndSignIn = async (otpValue: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setResending(false);
    setLoading(true);
    setError(null);
    setNotice(null);

    const intent = accountExists ? 'login' : 'register';
    const digits = otpValue.replace(/\D/g, '');

    try {
      if (!accountExists) {
        const profile = verifyOtpSchema.safeParse({
          phone,
          otp: digits,
          name,
          email,
        });
        if (!profile.success) {
          const nextErrors: Record<string, string> = {};
          for (const issue of profile.error.issues) {
            const key = String(issue.path[0] ?? '');
            if (key && key !== 'otp' && !nextErrors[key]) {
              nextErrors[key] = issue.message;
            }
          }
          if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            return;
          }
          setError(profile.error.issues[0]?.message ?? 'Invalid details');
          return;
        }
      } else {
        const otpCheck = mobileOtpSchema.safeParse(digits);
        if (!otpCheck.success) {
          setError(otpCheck.error.issues[0]?.message ?? 'Enter a valid OTP');
          return;
        }
      }

      const phoneCheck = indianMobileSchema.safeParse(phone);
      if (!phoneCheck.success) {
        setError('Invalid mobile number. Go back and try again.');
        return;
      }

      const result = await signIn('phone-otp', {
        phone: phoneCheck.data,
        otp: digits,
        ...(accountExists
          ? {}
          : { name: name.trim(), email: email.trim().toLowerCase() }),
        redirect: false,
      });

      if (result?.error) {
        const code =
          typeof (result as { code?: string }).code === 'string'
            ? (result as { code?: string }).code
            : undefined;
        trackEvent('login_failed', {
          method: 'phone_otp',
          error_code:
            code === 'deactivated'
              ? 'deactivated'
              : code === 'profile_required'
                ? 'profile_required'
                : result.error === 'CredentialsSignin'
                  ? 'invalid_otp'
                  : 'unknown',
          context: authContext,
          intent,
        });
        setError(
          code === 'deactivated'
            ? 'This account has been deactivated.'
            : code === 'profile_required'
              ? 'Name and email are required to create an account.'
              : 'Invalid OTP. Please try again.'
        );
        return;
      }

      trackEvent('login', {
        method: 'phone_otp',
        context: authContext,
        intent,
      });

      const session = await getSession();
      const userId = session?.user?.id ?? '';
      onVerified?.({ phone: phoneCheck.data, userId });
      router.refresh();

      if (variant === 'page') {
        const role = session?.user?.role;
        const isStaff = role === 'admin' || role === 'reviewer';

        if (isStaff) {
          const staffTarget =
            redirectTo && redirectTo.startsWith('/admin')
              ? redirectTo
              : '/admin';
          router.push(staffTarget);
        } else if (redirectTo) {
          router.push(redirectTo);
        } else if (!onVerified) {
          router.push('/');
        }
      }
    } catch {
      setError('Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
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
      // For new accounts, wait until name + email are filled — verify on submit button
      // or when OTP completes if profile already valid.
      if (!accountExists) {
        const profile = verifyOtpSchema.safeParse({
          phone,
          otp: value,
          name,
          email,
        });
        if (!profile.success) {
          return;
        }
      }
      void verifyAndSignIn(value);
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
      for (
        let offset = 0;
        offset < digits.length && index + offset < otpLength;
        offset += 1
      ) {
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
    setError(null);
    setNotice(null);
    setFieldErrors({});
  };

  const handleVerifySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = otp.join('');
    void verifyAndSignIn(value);
  };

  const shellClass =
    variant === 'checkout-embed'
      ? 'rounded-[24px] border border-ash bg-white p-5 text-left shadow-sm'
      : '';

  const fieldClass = (hasError?: boolean) =>
    cn(
      'box-border block !w-full min-w-0 rounded-input border bg-white px-4 py-2.5',
      'font-switzer text-base text-portrait-ink',
      'placeholder:text-slate-helper',
      'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:border-transparent',
      'disabled:opacity-60',
      hasError ? 'border-red-500' : 'border-ash'
    );

  if (step === 'otp') {
    return (
      <form
        onSubmit={handleVerifySubmit}
        className={cn('flex w-full min-w-0 flex-col gap-3', shellClass)}
      >
        {variant === 'checkout-embed' && (
          <div className="w-full">
            <h2 className="font-basier text-xl text-portrait-ink">
              {accountExists ? 'Enter your code' : 'Create your account'}
            </h2>
            <p className="mt-1 text-sm text-slate-helper">
              We sent a {otpLength}-digit code on WhatsApp.
            </p>
          </div>
        )}

        <div className="w-full">
          <p className="font-switzer text-sm text-slate-helper">
            OTP sent to{' '}
            <span className="font-medium text-portrait-ink">+91 {phone}</span>
            <span className="text-slate-helper"> · expires in 10 min</span>
          </p>
        </div>

        {!accountExists && (
          <>
            <div className="flex w-full min-w-0 flex-col">
              <label
                htmlFor="applicant-auth-name"
                className="mb-1.5 block font-switzer text-sm font-medium text-portrait-ink"
              >
                Full name
              </label>
              <input
                id="applicant-auth-name"
                type="text"
                autoComplete="name"
                placeholder="Priya Sharma"
                value={name}
                disabled={loading}
                onChange={(event) => {
                  setName(event.target.value);
                  if (fieldErrors.name || error) clearMessages();
                }}
                className={fieldClass(Boolean(fieldErrors.name))}
              />
              {fieldErrors.name && (
                <p className="mt-1 font-switzer text-sm text-red-600">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="flex w-full min-w-0 flex-col">
              <label
                htmlFor="applicant-auth-email"
                className="mb-1.5 block font-switzer text-sm font-medium text-portrait-ink"
              >
                Email
              </label>
              <input
                id="applicant-auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={loading}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (fieldErrors.email || error) clearMessages();
                }}
                className={fieldClass(Boolean(fieldErrors.email))}
              />
              {fieldErrors.email && (
                <p className="mt-1 font-switzer text-sm text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>
          </>
        )}

        <div className="w-full min-w-0">
          <p className="mb-1.5 font-switzer text-sm font-medium text-portrait-ink">
            Enter OTP
          </p>
          <div className="flex w-full gap-2">
            {otp.map((digit, index) => (
              <div key={index} className="min-w-0 flex-1">
                <input
                  ref={(node) => {
                    otpRefs.current[index] = node;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  size={1}
                  aria-label={`OTP digit ${index + 1}`}
                  value={digit}
                  disabled={loading}
                  onChange={(event) =>
                    handleOtpChange(index, event.target.value)
                  }
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onPaste={handleOtpPaste}
                  className={cn(
                    'box-border block h-11 w-full rounded-input border bg-white text-center font-switzer text-lg text-portrait-ink',
                    'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:border-transparent',
                    'disabled:opacity-60',
                    otpComplete ? 'border-portrait-ink' : 'border-ash'
                  )}
                />
              </div>
            ))}
          </div>
        </div>

        {loading && (
          <p className="font-switzer text-sm text-slate-helper">
            {resending
              ? 'Sending a new code…'
              : accountExists
                ? 'Signing you in…'
                : 'Creating your account…'}
          </p>
        )}
        {notice && (
          <p className="font-switzer text-sm text-portrait-ink">{notice}</p>
        )}
        {error && (
          <p className="font-switzer text-sm text-red-600">{error}</p>
        )}

        {!accountExists && (
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={loading || !otpComplete}
          >
            {loading ? 'Please wait…' : 'Verify & create account'}
          </Button>
        )}

        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 pb-1">
          <button
            type="button"
            onClick={handleChangeNumber}
            disabled={loading}
            className="font-switzer text-sm text-portrait-ink hover:opacity-80 disabled:opacity-50"
          >
            Change number
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void handleResend();
            }}
            className="font-switzer text-sm text-slate-helper hover:text-portrait-ink disabled:opacity-50"
          >
            Resend code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleGetOtp}
      className={cn('flex w-full min-w-0 flex-col gap-4', shellClass)}
    >
      {variant === 'checkout-embed' && (
        <div className="w-full">
          <h2 className="font-basier text-xl text-portrait-ink">
            Sign in to continue
          </h2>
          <p className="mt-1 text-sm text-slate-helper">
            We will send a one-time code on WhatsApp.
          </p>
        </div>
      )}

      <div className="flex w-full min-w-0 flex-col">
        <label
          htmlFor="applicant-auth-phone"
          className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
        >
          Mobile number
        </label>
        <div
          className={cn(
            'flex w-full min-w-0 items-center rounded-input border bg-white',
            fieldErrors.phone
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
            id="applicant-auth-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="9876543210"
            value={phone}
            disabled={loading}
            onChange={(event) => handlePhoneChange(event.target.value)}
            className="box-border min-w-0 flex-1 bg-transparent px-4 py-2.5 font-switzer text-base text-portrait-ink placeholder:text-slate-helper focus:outline-none disabled:opacity-60"
          />
        </div>
        {fieldErrors.phone && (
          <p className="mt-1.5 font-switzer text-sm text-red-600">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      {error && (
        <p className="font-switzer text-sm text-red-600">{error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading}
      >
        {loading ? 'Sending…' : 'Send OTP on WhatsApp'}
      </Button>
    </form>
  );
}
