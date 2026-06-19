# Pantra Ride — Admin Web Panel: Complete Build Guide

This document is everything a developer needs to build and deploy the standalone
Pantra Ride admin web panel from scratch. It connects to the same Supabase project
as the mobile app — no new backend, no new database.

---

## 1. What You Are Building

A private web application at (e.g.) `admin.pantraride.com` that lets the Pantra team:
- Monitor platform stats, revenue, and live ride activity
- Review and approve driver verification documents
- Manage driver payout requests
- Create and manage promo codes and reward tasks
- Browse all riders, drivers, and ride history
- Moderate driver ratings

It uses **Next.js** (web framework), **Supabase** (same database + auth as the mobile app),
and **Tailwind CSS** for styling.

---

## 2. Credentials You Need (get these from the project owner)

| Variable name | What it is | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client key | Supabase Dashboard → Settings → API → anon/public |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret server key (bypasses all security rules) | Supabase Dashboard → Settings → API → service_role |

> **IMPORTANT:** `SUPABASE_SERVICE_ROLE_KEY` is a master key that bypasses all database
> security. It must **never** appear in browser-side code or be committed to Git.
> It goes in a `.env.local` file only (which is gitignored by default in Next.js).

---

## 3. Initial Project Setup

Run these commands once in your terminal:

```bash
# Create a new Next.js project (choose: TypeScript yes, Tailwind yes, App Router yes)
npx create-next-app@latest pantra-admin

cd pantra-admin

# Install Supabase packages
npm install @supabase/supabase-js @supabase/ssr

# Install UI and utility packages
npm install recharts date-fns
npx shadcn-ui@latest init    # choose default options when prompted
npx shadcn-ui@latest add button input card table badge dialog select

# Install csv export for the Analytics screen
npm install papaparse
npm install --save-dev @types/papaparse
```

Create your environment file:

```bash
# Create .env.local in the project root (this file is gitignored automatically)
touch .env.local
```

Paste into `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

---

## 4. Project File Structure

```
pantra-admin/
├── .env.local                         ← secret keys (never commit this)
├── middleware.ts                       ← auth guard on every /admin/* route
├── app/
│   ├── admin/
│   │   ├── login/
│   │   │   └── page.tsx               ← login form
│   │   ├── dashboard/
│   │   │   └── page.tsx               ← stats + charts
│   │   ├── rides/
│   │   │   ├── page.tsx               ← rides table
│   │   │   └── [id]/page.tsx          ← ride detail
│   │   ├── users/
│   │   │   ├── page.tsx               ← riders + drivers list
│   │   │   └── [id]/page.tsx          ← user/driver detail
│   │   ├── verification/
│   │   │   └── page.tsx               ← document review queue
│   │   ├── analytics/
│   │   │   └── page.tsx               ← revenue charts + reports
│   │   ├── payouts/
│   │   │   └── page.tsx               ← payout requests
│   │   ├── promotions/
│   │   │   └── page.tsx               ← promo code management
│   │   ├── reward-tasks/
│   │   │   └── page.tsx               ← task management
│   │   ├── ratings/
│   │   │   └── page.tsx               ← ratings moderation
│   │   ├── support/
│   │   │   └── page.tsx               ← support tickets (placeholder)
│   │   ├── notifications/
│   │   │   └── page.tsx               ← push notifications (placeholder)
│   │   ├── settings/
│   │   │   └── page.tsx               ← profile + sign out
│   │   └── layout.tsx                 ← shared sidebar layout for all /admin/* pages
│   └── api/
│       └── admin/
│           ├── approve-document/route.ts
│           ├── reject-document/route.ts
│           ├── mark-payout/route.ts
│           ├── create-promo/route.ts
│           ├── toggle-promo/route.ts
│           ├── create-task/route.ts
│           ├── toggle-task/route.ts
│           ├── delete-rating/route.ts
│           └── force-cancel-ride/route.ts
└── lib/
    ├── supabase/
    │   ├── client.ts                  ← browser Supabase client (anon key)
    │   ├── server.ts                  ← server Supabase client (anon key + cookies)
    │   └── admin.ts                   ← admin Supabase client (service role key)
    └── utils.ts                       ← shared helpers
```

---

## 5. Supabase Client Files

Create three separate Supabase client files — each serves a different purpose.

### `lib/supabase/client.ts` — browser client (used in Client Components)
```ts
import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
```

### `lib/supabase/server.ts` — server client with cookie session (used in Server Components)
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createClient = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return cookieStore.get(name)?.value; },
        set(name, value, options) { cookieStore.set({ name, value, ...options }); },
        remove(name, options) { cookieStore.set({ name, value: '', ...options }); },
      },
    }
  );
};
```

### `lib/supabase/admin.ts` — admin client (service role key — server only)
```ts
import { createClient } from '@supabase/supabase-js';

// This bypasses ALL Row Level Security. Only use server-side.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

---

## 6. Auth Middleware (protects all /admin/* routes)

Create `middleware.ts` in the project root:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value; },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Allow the login page through
  if (request.nextUrl.pathname === '/admin/login') {
    return response;
  }

  // For all other /admin/* routes: check session + admin role
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // Check admin role in database
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('uid', session.user.id)
    .single();

  if (profile?.role !== 'admin') {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
```

---

## 7. Login Page

### `app/admin/login/page.tsx`
```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();

    // 1. Sign in with Supabase
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setError(signInError.message); setLoading(false); return; }

    // 2. Check admin role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('uid', data.user.id)
      .single();

    if (profile?.role !== 'admin') {
      await supabase.auth.signOut();
      setError('This account does not have admin access.');
      setLoading(false);
      return;
    }

    // 3. Success — redirect to dashboard
    router.push('/admin/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pantra Admin</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to manage the platform</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email" placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)} required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit" disabled={loading}
            className="w-full bg-purple-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## 8. Pattern for Server Components (reading data)

Use this pattern for every page that needs to fetch data. Data is fetched on the server — no loading spinners, no client-side fetching for the initial page load.

```tsx
// app/admin/dashboard/page.tsx
import { supabaseAdmin } from '@/lib/supabase/admin';

export default async function DashboardPage() {
  const [usersResult, driversResult, ridesResult, revenueResult] = await Promise.all([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('drivers').select('*', { count: 'exact', head: true }).eq('isOnline', true),
    supabaseAdmin.from('rides').select('*', { count: 'exact', head: true })
      .gte('createdAt', new Date().toISOString().split('T')[0]),
    supabaseAdmin.from('rides').select('fare').eq('status', 'completed'),
  ]);

  const totalUsers = usersResult.count ?? 0;
  const activeDrivers = driversResult.count ?? 0;
  const ridesToday = ridesResult.count ?? 0;
  const grossFares = revenueResult.data?.reduce((sum, r) => sum + (r.fare ?? 0), 0) ?? 0;
  const companyEarnings = Math.round(grossFares * 0.2); // 20% platform commission

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Users" value={totalUsers.toLocaleString()} />
        <StatCard label="Online Drivers" value={activeDrivers.toLocaleString()} />
        <StatCard label="Rides Today" value={ridesToday.toLocaleString()} />
        <StatCard label="Gross Fares" value={`₦${grossFares.toLocaleString()}`} />
        <StatCard label="Company Earnings (20%)" value={`₦${companyEarnings.toLocaleString()}`} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
```

---

## 9. Pattern for API Routes (write operations)

Use this pattern for every action that changes data (approve, reject, create, delete).
The service role key is only used server-side — never in the browser.

```ts
// app/api/admin/approve-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  // 1. Verify the caller is an authenticated admin
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('users').select('role').eq('uid', session.user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // 2. Parse the request body
  const { documentId, driverId } = await req.json();

  // 3. Run the change using the service role key
  const { error: updateError } = await supabaseAdmin
    .from('driver_documents')
    .update({ status: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: session.user.id })
    .eq('id', documentId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // 4. Recalculate driver verification progress
  const { data: docs } = await supabaseAdmin
    .from('driver_documents')
    .select('type')
    .eq('driverId', driverId)
    .eq('status', 'approved');

  const requiredTypes = ['license', 'insurance', 'registration', 'background_check', 'vehicle_inspection'];
  const approvedTypes = new Set(docs?.map(d => d.type) ?? []);
  const approvedCount = requiredTypes.filter(t => approvedTypes.has(t)).length;
  const progress = (approvedCount / 5) * 100;
  const isVerified = approvedCount === 5;

  await supabaseAdmin.from('drivers').update({ verificationProgress: progress, isVerified }).eq('id', driverId);

  return NextResponse.json({ success: true, isVerified, progress });
}
```

Every other write operation follows this same pattern:
1. Verify the caller is an admin session
2. Parse the request body
3. Run the database change with `supabaseAdmin`

---

## 10. Screen-by-Screen Data Specifications

> **Revenue model:** Pantra charges riders the full fare. Drivers keep 80% (paid out via `driver_payouts`). Pantra keeps 20% as platform commission. Always display **Company Earnings = SUM(fare) × 0.2** as the business revenue figure — not the gross fare total.

### Dashboard
**Stats row (7 cards):**
```ts
const { count: totalUsers } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true });
const { count: activeDrivers } = await supabaseAdmin.from('drivers').select('*', { count: 'exact', head: true }).eq('isOnline', true);
const { data: revenueData } = await supabaseAdmin.from('rides').select('fare').eq('status', 'completed');
const grossFares = revenueData?.reduce((s, r) => s + (r.fare ?? 0), 0) ?? 0;
const companyEarnings = Math.round(grossFares * 0.2); // 20% platform commission — what Pantra actually keeps
const today = new Date().toISOString().split('T')[0];
const { count: ridesToday } = await supabaseAdmin.from('rides').select('*', { count: 'exact', head: true }).gte('createdAt', today);
const { count: pendingVerifications } = await supabaseAdmin.from('driver_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending');
const { count: pendingPayouts } = await supabaseAdmin.from('driver_payouts').select('*', { count: 'exact', head: true }).eq('status', 'pending');
```

**Revenue chart (last 30 days):**
```sql
SELECT
  DATE("completedAt") as date,
  COUNT(*)::int as ride_count,
  COALESCE(SUM(fare), 0) as gross_fare,
  COALESCE(SUM(fare * 0.2), 0) as company_commission
FROM public.rides
WHERE status = 'completed' AND "completedAt" >= NOW() - INTERVAL '30 days'
GROUP BY DATE("completedAt") ORDER BY date ASC
```
Use `recharts` `<LineChart>` to render. Call this via `supabaseAdmin.rpc()` or a raw fetch.
Plot `company_commission` as the primary line (Pantra's daily earnings). Include `gross_fare` as a muted secondary line for reference.

**Recent Activity (merged feed, top 5 by date):**
```ts
const [users, drivers, rides] = await Promise.all([
  supabaseAdmin.from('users').select('uid,displayName,email,createdAt').eq('role','rider').order('createdAt',{ascending:false}).limit(5),
  supabaseAdmin.from('drivers').select('id,name,email,createdAt').order('createdAt',{ascending:false}).limit(5),
  supabaseAdmin.from('rides').select('id,fare,completedAt').eq('status','completed').order('completedAt',{ascending:false}).limit(5),
]);
// Merge all three arrays in JS, sort by date descending, take top 5
```

---

### Rides Management
```ts
// Paginated (25 per page). `page` comes from a URL search param.
const { data: rides } = await supabaseAdmin
  .from('rides')
  .select(`
    id, status, rideType, fare, pickupAddress, dropoffAddress,
    createdAt, completedAt, cancelledAt, paymentMethod, promoCode,
    users!rides_userId_fkey (displayName, email),
    drivers!rides_driverId_fkey (name, email)
  `)
  .order('createdAt', { ascending: false })
  .range(page * 25, (page + 1) * 25 - 1);
```

**Ride detail — fetch rating:**
```ts
const { data: rating } = await supabaseAdmin.from('ratings').select('rating, comment, tags').eq('rideId', rideId).single();
```

**Force cancel (API Route):**
```ts
await supabaseAdmin.from('rides')
  .update({ status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: 'admin_action' })
  .eq('id', rideId);
```

---

### User Management

**Riders list:**
```ts
const { data: riders } = await supabaseAdmin
  .from('users').select('uid, displayName, email, phoneNumber, createdAt, rating').eq('role', 'rider').order('createdAt', { ascending: false });

// Fetch wallet balances + ride counts separately, then merge by userId in JavaScript
const { data: wallets } = await supabaseAdmin.from('wallets').select('userId, balance');
const { data: rideCounts } = await supabaseAdmin.from('rides').select('userId').eq('status', 'completed');
```

**Drivers list:**
```ts
const { data: drivers } = await supabaseAdmin
  .from('drivers')
  .select('id, name, email, phone, isOnline, isVerified, verificationProgress, totalRides, rating, createdAt, earnings, vehicle')
  .order('createdAt', { ascending: false });
```

**Rider detail page:**
```ts
const [profile, rides, wallet, walletTxns, promoUses, points] = await Promise.all([
  supabaseAdmin.from('users').select('*').eq('uid', userId).single(),
  supabaseAdmin.from('rides').select('*').eq('userId', userId).order('createdAt',{ascending:false}).limit(10),
  supabaseAdmin.from('wallets').select('balance').eq('userId', userId).single(),
  supabaseAdmin.from('wallet_transactions').select('*').eq('userId', userId).order('createdAt',{ascending:false}).limit(10),
  supabaseAdmin.from('user_promo_uses').select('*, promotions(code, discountPercentage)').eq('userId', userId),
  supabaseAdmin.from('user_points_balance').select('balance').eq('userId', userId).single(),
]);
```

**Driver detail page:**
```ts
const [profile, rides, docs, ratings, banks, payouts] = await Promise.all([
  supabaseAdmin.from('drivers').select('*').eq('id', driverId).single(),
  supabaseAdmin.from('rides').select('*').eq('driverId', driverId).order('createdAt',{ascending:false}).limit(10),
  supabaseAdmin.from('driver_documents').select('*').eq('driverId', driverId),
  supabaseAdmin.from('ratings').select('*, users(displayName)').eq('driverId', driverId).order('createdAt',{ascending:false}).limit(10),
  supabaseAdmin.from('driver_bank_accounts').select('*').eq('driverId', driverId),
  supabaseAdmin.from('driver_payouts').select('*').eq('driverId', driverId).order('requestedAt',{ascending:false}).limit(10),
]);
```

---

### Driver Verification
```ts
const { data: docs } = await supabaseAdmin
  .from('driver_documents')
  .select('*, drivers(id, name, email, verificationProgress)')
  .eq('status', statusFilter)   // 'pending' | 'approved' | 'rejected' | 'all'
  .order('uploadedAt', { ascending: true })
  .limit(100);

// Generate signed URL for each document (1-hour expiry, server-side only)
const docsWithUrls = await Promise.all(docs.map(async (doc) => {
  if (!doc.documentUrl || doc.documentUrl === 'system_generated') return { ...doc, signedUrl: null };
  const { data } = await supabaseAdmin.storage.from('documents').createSignedUrl(doc.documentUrl, 3600);
  return { ...doc, signedUrl: data?.signedUrl ?? null };
}));
```

**Document type display labels:**
```ts
const DOC_LABELS: Record<string, string> = {
  license: "Driver's License",
  insurance: 'Vehicle Insurance',
  registration: 'Vehicle Registration',
  vehicle_inspection: 'Vehicle Inspection',
  background_check: 'Background Check',
};
```

**Approve/Reject from UI:**
```ts
// In a Client Component — calls the API Route, then refreshes the page
await fetch('/api/admin/approve-document', {
  method: 'POST',
  body: JSON.stringify({ documentId: doc.id, driverId: doc.drivers.id }),
});
router.refresh(); // re-fetches the Server Component data
```

**Reject API Route** also needs `rejectionReason` in the body:
```ts
await supabaseAdmin.from('driver_documents')
  .update({ status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: session.user.id, rejectionReason: reason || 'Document rejected by admin' })
  .eq('id', documentId);
// Then same verification progress recalculation as approve
```

---

### Analytics & Reports
```ts
// Cancellation rate
const { count: total } = await supabaseAdmin.from('rides').select('*',{count:'exact',head:true});
const { count: cancelled } = await supabaseAdmin.from('rides').select('*',{count:'exact',head:true}).eq('status','cancelled');
const cancelRate = total ? ((cancelled ?? 0) / total * 100).toFixed(1) : '0';

// Revenue by ride type — company earns 20% of each fare
const { data: byType } = await supabaseAdmin.from('rides').select('rideType, fare').eq('status', 'completed');
// Group in JS: { rideType → { grossFare: sum(fare), commission: sum(fare * 0.2) } }
// Display the commission column in the chart — not the gross fare.

// Payment methods breakdown — group in JavaScript
const { data: payments } = await supabaseAdmin.from('rides').select('paymentMethod').eq('status','completed');

// New signups by day (last 30 days)
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const { data: newUsers } = await supabaseAdmin.from('users').select('createdAt').gte('createdAt', thirtyDaysAgo);

// Outstanding points liability (500 pts = ₦8,000 / 1 pt = ₦16)
const { data: pointsBalance } = await supabaseAdmin.from('user_points_balance').select('balance');
const totalPoints = pointsBalance?.reduce((s, r) => s + r.balance, 0) ?? 0;
const totalValueNGN = totalPoints * 16;
```

**Charts (use recharts):**
- `<LineChart>` — daily company earnings (20% commission) over 30 days, with gross fares as a secondary reference line
- `<BarChart>` — commission by ride type (Standard / Comfort / XL)
- `<PieChart>` — payment methods (card / cash / wallet)
- `<BarChart>` — new users per day

**CSV Export:**
```ts
import Papa from 'papaparse';
const csv = Papa.unparse(rides);
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = 'rides-export.csv'; a.click();
```

---

### Driver Payouts
```ts
const { data: payouts } = await supabaseAdmin
  .from('driver_payouts')
  .select('id, amount, status, requestedAt, completedAt, failureReason, driverId, driver_bank_accounts(bankName, accountNumber, accountName)')
  .eq('status', statusFilter)
  .order('requestedAt', { ascending: true });

// driverId is TEXT — join drivers separately
const driverIds = [...new Set(payouts?.map(p => p.driverId) ?? [])];
const { data: driverInfo } = await supabaseAdmin.from('drivers').select('id, name, email, phone').in('id', driverIds);
```

**Mark completed (API Route):**
```ts
await supabaseAdmin.from('driver_payouts').update({ status: 'completed', completedAt: new Date().toISOString() }).eq('id', payoutId);
```

**Mark failed (API Route):**
```ts
await supabaseAdmin.from('driver_payouts').update({ status: 'failed', failureReason: reason }).eq('id', payoutId);
```

---

### Promotions Management
```ts
const { data: promos } = await supabaseAdmin
  .from('promotions')
  .select('*, user_promo_uses(count)')
  .order('createdAt', { ascending: false });
```

**Create (API Route):**
```ts
await supabaseAdmin.from('promotions').insert({
  code: code.toUpperCase(), description, discountPercentage,
  maxDiscountNGN: maxDiscountNGN || null,
  maxUses: maxUses || null,
  validFrom: validFrom || new Date().toISOString(),
  validUntil, isActive: true,
});
```

**Toggle (API Route):**
```ts
const { data: current } = await supabaseAdmin.from('promotions').select('isActive').eq('id', promoId).single();
await supabaseAdmin.from('promotions').update({ isActive: !current.isActive }).eq('id', promoId);
```

---

### Reward Tasks Management
```ts
const { data: tasks } = await supabaseAdmin.from('reward_tasks').select('*').order('createdAt', { ascending: false });
```

**Create (API Route):**
```ts
await supabaseAdmin.from('reward_tasks').insert({
  type,           // 'youtube_video' | 'social_share'
  title, description, url,
  pointsReward,   // e.g. 500  (always show "= ₦{points * 16}" in UI — 1 pt = ₦16)
  minWatchSeconds: type === 'youtube_video' ? minWatchSeconds : null,
  maxCompletionsPerUser: maxCompletionsPerUser ?? 1,
  validUntil: validUntil || null,
  isActive: true,
});
```

**Toggle (API Route):**
```ts
const { data: current } = await supabaseAdmin.from('reward_tasks').select('isActive').eq('id', taskId).single();
await supabaseAdmin.from('reward_tasks').update({ isActive: !current.isActive }).eq('id', taskId);
```

---

### Ratings Moderation
```ts
const { data: ratings } = await supabaseAdmin
  .from('ratings')
  .select('id, rating, comment, tags, createdAt, users!ratings_userId_fkey(displayName, email), drivers!ratings_driverId_fkey(id, name, email, rating)')
  .order('createdAt', { ascending: false })
  .limit(50);
```

**Delete rating + recalculate driver average (API Route):**
```ts
const { data: r } = await supabaseAdmin.from('ratings').select('driverId').eq('id', ratingId).single();
await supabaseAdmin.from('ratings').delete().eq('id', ratingId);
const { data: remaining } = await supabaseAdmin.from('ratings').select('rating').eq('driverId', r.driverId);
const avg = remaining?.length ? remaining.reduce((s, x) => s + x.rating, 0) / remaining.length : 5;
await supabaseAdmin.from('drivers').update({ rating: Math.round(avg * 10) / 10, totalRatings: remaining?.length ?? 0 }).eq('id', r.driverId);
```

---

### Support Tickets (placeholder — no table exists yet)
```tsx
export default function SupportPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Support Tickets</h1>
      <p className="text-gray-500">Support ticket management is not yet configured. Create the support_tickets table in Supabase to enable this feature.</p>
    </div>
  );
}
```

**Optional — create the table in Supabase SQL Editor if building it now:**
```sql
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES public.users(uid),
  "userName" TEXT, "userEmail" TEXT,
  title TEXT NOT NULL, description TEXT NOT NULL,
  category TEXT CHECK (category IN ('payment', 'driver', 'technical', 'general')) DEFAULT 'general',
  priority TEXT CHECK (priority IN ('urgent', 'high', 'medium', 'low')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')) DEFAULT 'open',
  "assignedTo" UUID, "adminNotes" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(), "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_own" ON public.support_tickets FOR ALL USING (auth.uid() = "userId");
```

---

### Notifications (placeholder — push tokens not yet stored)
```tsx
export default function NotificationsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Push Notifications</h1>
      <p className="text-gray-500">Requires Expo push tokens to be stored in Supabase. Not yet implemented in the mobile app. Build the UI now and wire it up later.</p>
    </div>
  );
}
```
Future: fetch `expoPushToken` per user from Supabase, POST to `https://exp.host/--/api/v2/push/send`.

---

### Sidebar Layout (`app/admin/layout.tsx`)
```tsx
import Link from 'next/link';

const navItems = [
  { href: '/admin/dashboard',     label: 'Dashboard' },
  { href: '/admin/rides',         label: 'Rides' },
  { href: '/admin/users',         label: 'Users' },
  { href: '/admin/verification',  label: 'Verification' },
  { href: '/admin/analytics',     label: 'Analytics' },
  { href: '/admin/payouts',       label: 'Payouts' },
  { href: '/admin/promotions',    label: 'Promotions' },
  { href: '/admin/reward-tasks',  label: 'Reward Tasks' },
  { href: '/admin/ratings',       label: 'Ratings' },
  { href: '/admin/support',       label: 'Support' },
  { href: '/admin/notifications', label: 'Notifications' },
  { href: '/admin/settings',      label: 'Settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r flex flex-col py-6 px-4 gap-1">
        <div className="text-lg font-bold text-purple-600 mb-6 px-2">Pantra Admin</div>
        {navItems.map(item => (
          <Link key={item.href} href={item.href}
            className="text-sm px-3 py-2 rounded-lg hover:bg-purple-50 hover:text-purple-700 text-gray-700">
            {item.label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
```

---

## 11. Database Tables Quick Reference

| Table | PK column | Notes |
|---|---|---|
| `public.users` | `uid` | **PK is `uid` not `id`** — matches `auth.users.id` |
| `public.drivers` | `id` | Driver profiles |
| `public.rides` | `id` | All ride records |
| `public.ratings` | `id` | Driver ratings from riders |
| `public.driver_documents` | `id` | Verification document uploads |
| `public.driver_payouts` | `id` | Driver withdrawal requests |
| `public.driver_bank_accounts` | `id` | Driver bank details |
| `public.promotions` | `id` | Promo codes |
| `public.user_promo_uses` | `id` | Per-user promo usage |
| `public.reward_tasks` | `id` | YouTube / social share tasks |
| `public.user_task_completions` | `id` | Task completion records |
| `public.points_transactions` | `id` | Points ledger (+ earn / − spend) |
| `public.user_points_balance` | — | **VIEW** — live balance per user (`userId`, `balance`) |
| `public.wallets` | `userId` | Rider wallet balances |
| `public.wallet_transactions` | `id` | Rider wallet ledger |

**Storage buckets:**
- `avatars` — public, profile photos
- `documents` — **private**, driver verification files (service role key required for signed URLs)

---

## 12. Critical Column Notes

- `public.users` PK is `uid` — always use `uid`, never `id`, in queries
- `public.driver_payouts.driverId` is `TEXT` (not a UUID FK) — cast when joining: `dp."driverId"::uuid = d.id`
- `public.rides.status` values: `'pending' | 'accepted' | 'in-progress' | 'completed' | 'cancelled'`
- `public.drivers.earnings` is JSONB: `{ today, thisWeek, thisMonth, total }`
- `public.drivers.vehicle` is JSONB: `{ make, model, year, color, licensePlate, type }`
- Points conversion: **1 pt = ₦16** (500 pts = ₦8,000) — always show the NGN equivalent in the UI

---

## 13. Deployment to Vercel

```bash
npm install -g vercel
vercel   # follow prompts, link to GitHub repo for auto-deploys
```

Then in the Vercel dashboard → Project → Settings → Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 14. Migration Status (already run in Supabase)

| Migration | Status | Screen |
|---|---|---|
| `supabase-schema-promotions.sql` | ✅ Run | Promotions |
| `supabase-schema-rewards.sql` | ✅ Run | Reward Tasks |
| `supabase-schema-driver-payouts.sql` | ✅ Run | Payouts |
| `supabase-schema-wallet.sql` | ✅ Run | User detail |
| `supabase-schema-ratings.sql` | ✅ Run | Ratings |
| `supabase-schema-saved-locations.sql` | ✅ Run | User detail |
| `supabase-schema-driver-documents.sql` | ✅ Run | Verification |
| `support_tickets` table | ❌ Not created | Support (create if needed) |

---

## 15. Priority Build Order

1. Login + middleware
2. Sidebar layout
3. Dashboard (stats + revenue chart)
4. Driver Verification (active review queue)
5. Rides Management (operational visibility)
6. Driver Payouts (financial queue)
7. Reward Tasks *(urgent — YouTube tasks need to be added from here)*
8. Promotions
9. Users list + detail pages
10. Analytics & Reports
11. Ratings Moderation
12. Notifications (placeholder)
13. Support (placeholder or full build)
14. Settings (sign out + profile)
