import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { requestPasswordResetEmail, verifyResetCode } from '../lib/passwordResetService';
import { Button } from '../components/ui/Button';

type Step = 'request' | 'verify';

const COOLDOWN_SECONDS = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const cooldownRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(cooldownRef.current);
  }, [cooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    console.log('ForgotPassword: requesting reset code', { email });
    await requestPasswordResetEmail(email);
    console.log('ForgotPassword: reset code request sent');
    setLoading(false);
    setStep('verify');
    setCooldown(COOLDOWN_SECONDS);
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    console.log('ForgotPassword: resending reset code', { email });
    await requestPasswordResetEmail(email);
    setLoading(false);
    setCooldown(COOLDOWN_SECONDS);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError('Enter the verification code from your email.');
      return;
    }

    setLoading(true);
    try {
      console.log('ForgotPassword: verifying reset code');
      await verifyResetCode(email, code);
      console.log('ForgotPassword: code verified, recovery session established');
      navigate('/update-password');
    } catch (err: any) {
      console.error('ForgotPassword: code verification failed', err);
      setError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-8">
        <h1 className="mb-1 text-xl font-bold text-slate-900">
          Pantra <span className="text-primary">Admin</span>
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {step === 'request' ? 'Reset your password' : 'Enter the verification code'}
        </p>

        {step === 'request' && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="admin@example.com"
                autoFocus
              />
            </div>

            {error && (
              <p className="rounded-md border border-danger/20 bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <Button type="submit" variant="primary" disabled={loading} className="w-full py-2.5">
              {loading ? 'Sending code…' : 'Send verification code'}
            </Button>

            <Link to="/login" className="block text-center text-sm font-medium text-slate-500 hover:underline">
              Back to sign in
            </Link>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-sm text-slate-500">
              If an account exists for <span className="font-medium text-slate-700">{email}</span>, we&apos;ve sent a
              verification code. Check your inbox.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Verification code</label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Enter code"
                autoFocus
              />
            </div>

            {error && (
              <p className="rounded-md border border-danger/20 bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <Button type="submit" variant="primary" disabled={loading} className="w-full py-2.5">
              {loading ? 'Verifying…' : 'Verify code'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={loading || cooldown > 0}
              onClick={handleResendCode}
              className="w-full py-2.5"
            >
              {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep('request');
                setCode('');
                setError(null);
              }}
              className="block w-full text-center text-sm font-medium text-slate-500 hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
