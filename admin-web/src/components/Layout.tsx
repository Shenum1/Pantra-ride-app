import { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  IdCard,
  Users,
  ShieldCheck,
  Wallet,
  Receipt,
  SlidersHorizontal,
  Percent,
  LifeBuoy,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import type { AdminUser } from '../hooks/useAuth';
import { trpcQuery } from '../lib/api';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/trips', label: 'Trips', icon: Car },
  { to: '/drivers', label: 'Drivers', icon: IdCard },
  { to: '/riders', label: 'Riders', icon: Users },
  { to: '/verification', label: 'Verification', icon: ShieldCheck },
  { to: '/support', label: 'Support', icon: LifeBuoy },
  { to: '/payments', label: 'Payments', icon: Receipt },
  { to: '/payouts', label: 'Payouts', icon: Wallet },
  { to: '/pricing', label: 'Pricing', icon: SlidersHorizontal },
  { to: '/promotions', label: 'Promotions', icon: Percent },
];

export default function Layout({ user, logout }: { user: AdminUser; logout: () => void }) {
  const [open, setOpen] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<number | null>(null);

  useEffect(() => {
    trpcQuery<{ drivers: unknown[] }>('admin.driverVerification.list', { status: 'MANUAL_REVIEW' })
      .then((res) => setPendingVerification(res.drivers.length))
      .catch(() => setPendingVerification(null));
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 transform flex-col border-r border-slate-200 bg-white transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
      >
        <div className="border-b border-slate-100 px-5 py-5">
          <span className="text-[15px] font-bold tracking-tight text-slate-900">
            Pantra <span className="font-semibold text-primary">Admin</span>
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                ${isActive ? 'bg-primary-tint text-primary' : 'text-slate-600 hover:bg-slate-100'}`
              }
            >
              <span className="flex items-center gap-2.5">
                <Icon size={17} />
                {label}
              </span>
              {label === 'Verification' && pendingVerification ? (
                <span className="rounded-full bg-warning-tint px-1.5 py-0.5 text-[11px] font-semibold text-warning">
                  {pendingVerification}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-4 py-4">
          <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
          <p className="mb-3 truncate text-xs text-slate-400">{user.email}</p>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-danger"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 hover:bg-slate-100">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-bold text-slate-900">
            Pantra <span className="text-primary">Admin</span>
          </span>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
