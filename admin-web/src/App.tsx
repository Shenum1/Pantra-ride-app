import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Drivers from './pages/Drivers';
import DriverDetail from './pages/DriverDetail';
import Riders from './pages/Riders';
import RiderDetail from './pages/RiderDetail';
import Verification from './pages/Verification';
import Trips from './pages/Trips';
import Payments from './pages/Payments';
import Payouts from './pages/Payouts';
import Pricing from './pages/Pricing';
import Promotions from './pages/Promotions';
import Support from './pages/Support';
import SupportTicketDetail from './pages/SupportTicketDetail';

function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}

function AuthenticatedLayout() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return <Layout user={user} logout={logout} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth />}>
          <Route element={<AuthenticatedLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/drivers/:id" element={<DriverDetail />} />
            <Route path="/riders" element={<Riders />} />
            <Route path="/riders/:id" element={<RiderDetail />} />
            <Route path="/verification" element={<Verification />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/payouts" element={<Payouts />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/support" element={<Support />} />
            <Route path="/support/:id" element={<SupportTicketDetail />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
