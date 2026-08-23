import { useEffect, useState } from 'react';
import { Users, Car, Wallet, Activity } from 'lucide-react';
import { trpcQuery } from '../lib/api';

interface OverviewData {
  totalUsers: number;
  totalRiders: number;
  totalDrivers: number;
  activeDrivers: number;
  ridesToday: number;
  totalRevenue: number;
  totalPlatformCommission: number;
  totalDriverEarnings: number;
  recentActivity: { id: string; type: string; title: string; subtitle: string; createdAt: string }[];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trpcQuery<OverviewData>('admin.overview')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        {error}
      </div>
    );
  }

  const stats = [
    { label: 'Total Users', value: data?.totalUsers ?? 0, icon: Users, color: 'text-blue-500' },
    { label: 'Riders', value: data?.totalRiders ?? 0, icon: Users, color: 'text-green-500' },
    { label: 'Drivers', value: data?.totalDrivers ?? 0, icon: Car, color: 'text-purple-500' },
    { label: 'Online Drivers', value: data?.activeDrivers ?? 0, icon: Activity, color: 'text-orange-500' },
    { label: 'Rides Today', value: data?.ridesToday ?? 0, icon: Car, color: 'text-primary' },
    { label: 'Total Revenue', value: `₦${(data?.totalRevenue ?? 0).toLocaleString()}`, icon: Wallet, color: 'text-emerald-500' },
    { label: 'Platform Commission', value: `₦${(data?.totalPlatformCommission ?? 0).toLocaleString()}`, icon: Wallet, color: 'text-pink-500' },
    { label: 'Driver Earnings', value: `₦${(data?.totalDriverEarnings ?? 0).toLocaleString()}`, icon: Wallet, color: 'text-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Recent Activity</h2>
        </div>
        <ul className="divide-y divide-gray-50">
          {(data?.recentActivity ?? []).length === 0 ? (
            <li className="px-5 py-8 text-center text-gray-400 text-sm">No recent activity</li>
          ) : (
            (data?.recentActivity ?? []).map((item) => (
              <li key={item.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.subtitle}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-4">{timeAgo(item.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
