import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recoveryClient } from '../lib/recoveryClient';
import { completePasswordReset, discardRecoverySession } from '../lib/passwordResetService';
import { Button } from '../components/ui/Button';

type SessionStatus = 'checking' | 'ready' | 'invalid';

const MIN_PASSWORD_LENGTH = 8;

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The recovery session only exists if the user just came from
    // ForgotPassword's verify-code step (recoveryClient is an in-memory,
    // unpersisted client — a fresh page load / direct visit here has no
    // session at all).
    recoveryClient.auth.getSession().then(({ data }) => {
      const status = data.session ? 'ready' : 'invalid';
      console.log('UpdatePassword: recovery session check resolved as', status);
      setSessionStatus(status);
    });
  }, []);

  useEffect(() => {
    if (sessionStatus === 'invalid') {
      console.warn('UpdatePassword: no active recovery session, redirecting to login');
      navigate('/login', {
        replace: true,
        state: { error: 'Your session expired. Please request a new verification code.' },
      });
    }
  }, [sessionStatus, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      console.log('UpdatePassword: submitting new password');
      await completePasswordReset(newPassword);
      console.log('UpdatePassword: password updated');
      navigate('/login', {
        replace: true,
        state: { success: 'Password updated. Please sign in.' },
      });
    } catch (err: any) {
      console.error('UpdatePassword: updateUser failed', err);
      setError(err.message || 'Could not update your password. Please try again.');
    } finally {
      await discardRecoverySession();
      setSubmitting(false);
    }
  };

  if (sessionStatus !== 'ready') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-8">
        <h1 className="mb-1 text-xl font-bold text-slate-900">
          Pantra <span className="text-primary">Admin</span>
        </h1>
        <p className="mb-6 text-sm text-slate-500">Choose a new password</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="••••••••"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-md border border-danger/20 bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <Button type="submit" variant="primary" disabled={submitting} className="w-full py-2.5">
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
