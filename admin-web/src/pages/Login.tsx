import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';

interface LoginLocationState {
  success?: string;
  error?: string;
}

export default function Login() {
  const { login, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectState = (location.state as LoginLocationState | null) ?? null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(redirectState?.error ?? null);
  const [notice] = useState<string | null>(redirectState?.success ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) navigate('/');
    else setError(authError || 'Login failed.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-8">
        <h1 className="mb-1 text-xl font-bold text-slate-900">
          Pantra <span className="text-primary">Admin</span>
        </h1>
        <p className="mb-6 text-sm text-slate-500">Sign in to your admin account</p>

        {notice && (
          <p className="mb-4 rounded-md border border-success/20 bg-success-tint px-3 py-2 text-sm text-success">{notice}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="rounded-md border border-danger/20 bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}

          <Button type="submit" variant="primary" disabled={loading} className="w-full py-2.5">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
