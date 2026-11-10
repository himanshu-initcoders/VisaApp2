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
  requestEmailLoginOtpSchema,
  requestEmailRegisterOtpSchema,
} from '@/lib/validations/auth';
import {
  completeEmailOtp,
  requestEmailLoginOtp,
  requestEmailRegisterOtp,
} from '@/lib/auth/email-otp';
import { trackEvent } from '@/lib/analytics/gtm';

type AuthTab = 'login' | 'register';
type AuthStep = 'form' | 'otp';

export interface ApplicantAuthPanelProps {
  otpLength?: number;
  variant?: 'page' | 'checkout-embed' | 'modal-embed';
  redirectTo?: string;
  analyticsContext?: 'signin' | 'apply_modal' | 'checkout' | 'save_draft';
  onVerified?: (payload: { email: string; userId: string }) => void;
  defaultTab?: AuthTab;
}

export function ApplicantAuthPanel({
  otpLength = 5,
  variant = 'page',
  redirectTo,
  analyticsContext,
  onVerified,
  defaultTab = 'login',
}: ApplicantAuthPanelProps) {
  const authContext =
    analyticsContext ??
    (variant === 'checkout-embed' || variant === 'modal-embed'
      ? 'checkout'
      : 'signin');
  const router = useRouter();

  const [tab, setTab] = useState<AuthTab>(defaultTab);
  const [step, setStep] = useState<AuthStep>('form');
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

  const switchTab = (next: AuthTab) => {
    setTab(next);
    setStep('form');
    setOtp(Array(otpLength).fill(''));
    setOtpComplete(false);
    clearMessages();
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

    if (tab === 'login') {
      const parsed = requestEmailLoginOtpSchema.safeParse({ email });
      if (!parsed.success) {
        setFieldErrors({
          email:
            parsed.error.issues[0]?.message ?? 'Enter a valid email address',
        });
        return;
      }

      sendingRef.current = true;
      setLoading(true);
      try {
        const response = await requestEmailLoginOtp({ email: parsed.data.email });
        if (!response.success) {
          setError(response.error);
          return;
        }
        trackEvent('auth_otp_requested', {
          context: authContext,
          method: 'email_otp',
          intent: 'login',
        });
        setEmail(parsed.data.email);
        setOtp(Array(otpLength).fill(''));
        setOtpComplete(false);
        setStep('otp');
        requestAnimationFrame(() => otpRefs.current[0]?.focus());
      } catch {
        setError('Could not send OTP. Please try again.');
      } finally {
        sendingRef.current = false;
        setLoading(false);
      }
      return;
    }

    const parsed = requestEmailRegisterOtpSchema.safeParse({
      name,
      email,
      phone,
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      return;
    }

    const phoneCheck = indianMobileSchema.safeParse(parsed.data.phone);
    if (!phoneCheck.success) {
      setFieldErrors({
        phone:
          phoneCheck.error.issues[0]?.message ??
          'Enter a valid Indian mobile number',
      });
      return;
    }

    sendingRef.current = true;
    setLoading(true);
    try {
      const response = await requestEmailRegisterOtp(parsed.data);
      if (!response.success) {
        setError(response.error);
        return;
      }
      trackEvent('auth_otp_requested', {
        context: authContext,
        method: 'email_otp',
        intent: 'register',
      });
      setName(parsed.data.name);
      setEmail(parsed.data.email);
      setPhone(parsed.data.phone);
      setOtp(Array(otpLength).fill(''));
      setOtpComplete(false);
      setStep('otp');
      requestAnimationFrame(() => otpRefs.current[0]?.focus());
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
      const response =
        tab === 'login'
          ? await requestEmailLoginOtp({ email, resend: true })
          : await requestEmailRegisterOtp({
              name,
              email,
              phone,
              resend: true,
            });
      if (!response.success) {
        setError(response.error);
        return;
      }
      trackEvent('auth_otp_requested', {
        context: authContext,
        method: 'email_otp',
        intent: tab === 'register' ? 'register' : 'login',
      });
      setNotice(
        response.sent
          ? 'New code sent. Use the newest email.'
          : 'That code is still valid. Check your inbox and spam.'
      );
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

    const intent = tab === 'register' ? 'register' : 'login';
    const digits = otpValue.replace(/\D/g, '');

    try {
      // Verify OTP in a server action (same path as send), then open the
      // Auth.js session with a short-lived proof — not the raw OTP.
      const verified = await completeEmailOtp({
        email,
        otp: digits,
        intent,
      });

      if (!verified.success) {
        const message = verified.error;
        trackEvent('login_failed', {
          method: 'email_otp',
          error_code: /deactivated/i.test(message)
            ? 'deactivated'
            : /no account/i.test(message)
              ? 'no_account'
              : /invalid otp/i.test(message)
                ? 'invalid_otp'
                : 'unknown',
          context: authContext,
          intent,
        });
        setError(message);
        return;
      }

      const result = await signIn('email-otp', {
        email: verified.email,
        proof: verified.proof,
        redirect: false,
      });

      if (result?.error) {
        const code =
          typeof (result as { code?: string }).code === 'string'
            ? (result as { code?: string }).code
            : undefined;
        trackEvent('login_failed', {
          method: 'email_otp',
          error_code:
            code === 'deactivated'
              ? 'deactivated'
              : result.error === 'CredentialsSignin'
                ? 'invalid_otp'
                : 'unknown',
          context: authContext,
          intent,
        });
        setError(
          code === 'deactivated'
            ? 'This account has been deactivated.'
            : 'Sign-in failed after OTP verification. Please request a new code.'
        );
        return;
      }

      trackEvent('login', {
        method: 'email_otp',
        context: authContext,
        intent,
      });
      onVerified?.({ email: verified.email, userId: '' });
      router.refresh();

      if (variant === 'page') {
        const session = await getSession();
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
          router.push('/dashboard');
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

  const handleChangeDetails = () => {
    setStep('form');
    setOtp(Array(otpLength).fill(''));
    setOtpComplete(false);
    setError(null);
    setNotice(null);
  };

  const shellClass =
    variant === 'checkout-embed'
      ? 'rounded-[24px] border border-ash bg-white p-5 text-left shadow-sm'
      : '';

  const tabs = (
    <div
      role="tablist"
      aria-label="Account access"
      className="flex rounded-full border border-ash bg-mist/40 p-1"
    >
      {(
        [
          { id: 'login' as const, label: 'Login' },
          { id: 'register' as const, label: 'Create Account' },
        ] as const
      ).map((item) => {
        const selected = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={loading || step === 'otp'}
            onClick={() => switchTab(item.id)}
            className={cn(
              'flex-1 rounded-full px-3 py-2 font-switzer text-sm font-medium transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-60',
              selected
                ? 'bg-white text-portrait-ink shadow-sm'
                : 'text-slate-helper hover:text-portrait-ink'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  if (step === 'otp') {
    return (
      <div className={cn('space-y-5', shellClass)}>
        {variant === 'checkout-embed' && (
          <div>
            <h2 className="font-basier text-xl text-portrait-ink">
              {tab === 'register' ? 'Verify your email' : 'Enter your code'}
            </h2>
            <p className="mt-1 text-sm text-slate-helper">
              We sent a {otpLength}-digit code to your email.
            </p>
          </div>
        )}

        {tabs}

        <div>
          <p className="font-switzer text-sm text-slate-helper">
            Enter the {otpLength}-digit OTP sent to
          </p>
          <p className="mt-1 font-switzer text-base font-medium text-portrait-ink">
            {email}
          </p>
          <p className="mt-2 text-xs text-slate-helper">
            Use the newest email only (ignore older codes). Check spam too —
            the code expires in 10 minutes.
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
              disabled={loading}
              onChange={(event) => handleOtpChange(index, event.target.value)}
              onKeyDown={(event) => handleOtpKeyDown(index, event)}
              onPaste={handleOtpPaste}
              className={cn(
                'h-12 w-12 rounded-input border bg-white text-center font-switzer text-lg text-portrait-ink',
                'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:border-transparent',
                'disabled:opacity-60',
                otpComplete ? 'border-portrait-ink' : 'border-ash'
              )}
            />
          ))}
        </div>

        {loading && (
          <p className="font-switzer text-sm text-slate-helper">
            {resending
              ? 'Sending a new code…'
              : tab === 'register'
                ? 'Creating your account…'
                : 'Signing you in…'}
          </p>
        )}
        {notice && (
          <p className="font-switzer text-sm text-portrait-ink">{notice}</p>
        )}
        {error && (
          <p className="font-switzer text-sm text-red-600">{error}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={handleChangeDetails}
            disabled={loading}
            className="font-switzer text-sm text-portrait-ink hover:opacity-80 disabled:opacity-50"
          >
            Change details
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
      </div>
    );
  }

  return (
    <form onSubmit={handleGetOtp} className={cn('space-y-4', shellClass)}>
      {variant === 'checkout-embed' && (
        <div>
          <h2 className="font-basier text-xl text-portrait-ink">
            Sign in to continue
          </h2>
          <p className="mt-1 text-sm text-slate-helper">
            Verify your email before checkout.
          </p>
        </div>
      )}

      {tabs}

      {tab === 'register' && (
        <div className="w-full">
          <label
            htmlFor="applicant-auth-name"
            className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
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
            className={cn(
              'w-full rounded-input border bg-white px-4 py-2.5 font-switzer text-base text-portrait-ink',
              'placeholder:text-slate-helper focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:border-transparent',
              'disabled:opacity-60',
              fieldErrors.name ? 'border-red-500' : 'border-ash'
            )}
          />
          {fieldErrors.name && (
            <p className="mt-1.5 font-switzer text-sm text-red-600">
              {fieldErrors.name}
            </p>
          )}
        </div>
      )}

      <div className="w-full">
        <label
          htmlFor="applicant-auth-email"
          className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
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
          className={cn(
            'w-full rounded-input border bg-white px-4 py-2.5 font-switzer text-base text-portrait-ink',
            'placeholder:text-slate-helper focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:border-transparent',
            'disabled:opacity-60',
            fieldErrors.email ? 'border-red-500' : 'border-ash'
          )}
        />
        {fieldErrors.email && (
          <p className="mt-1.5 font-switzer text-sm text-red-600">
            {fieldErrors.email}
          </p>
        )}
      </div>

      {tab === 'register' && (
        <div className="w-full">
          <label
            htmlFor="applicant-auth-phone"
            className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
          >
            Mobile number
          </label>
          <div
            className={cn(
              'flex items-center rounded-input border bg-white',
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
              className="w-full bg-transparent px-4 py-2.5 font-switzer text-base text-portrait-ink placeholder:text-slate-helper focus:outline-none disabled:opacity-60"
            />
          </div>
          {fieldErrors.phone && (
            <p className="mt-1.5 font-switzer text-sm text-red-600">
              {fieldErrors.phone}
            </p>
          )}
        </div>
      )}

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
        {loading ? 'Sending…' : 'Send OTP'}
      </Button>
    </form>
  );
}
