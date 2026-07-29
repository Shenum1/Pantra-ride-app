import { supabase } from './supabase';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || '';

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function trpcQuery<T = unknown>(procedure: string, input?: unknown): Promise<T> {
  const token = await getToken();
  const inputParam =
    input !== undefined
      ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
      : '';

  const res = await fetch(`${API_BASE}/api/trpc/${procedure}${inputParam}`, {
    headers: authHeaders(token),
  });

  const body = await res.json();

  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Request failed: ${procedure}`);
  }

  return (body.result?.data?.json ?? body.result?.data) as T;
}

export async function trpcMutate<T = unknown>(procedure: string, input: unknown): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${API_BASE}/api/trpc/${procedure}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({ json: input }),
  });

  const body = await res.json();

  if (!res.ok || body.error) {
    throw new Error(body.error?.message || `Request failed: ${procedure}`);
  }

  return (body.result?.data?.json ?? body.result?.data) as T;
}
