import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldX, ShieldAlert, Clock, ExternalLink } from 'lucide-react';
import { trpcQuery, trpcMutate } from '../lib/api';

interface DriverDoc {
  id: string;
  driverId: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
  rejectionReason?: string;
  expiryDate?: string;
  signedUrl?: string;
  driverName?: string;
  driverEmail?: string;
}

interface DocsResponse {
  documents: DriverDoc[];
}

type DriverVerificationStatus = 'PENDING' | 'DOCUMENTS_SUBMITTED' | 'VERIFYING' | 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
type DriverStatusFilter = 'DOCUMENTS_SUBMITTED' | 'VERIFYING' | 'MANUAL_REVIEW' | 'all';
type DriverDecision = 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';

interface DriverVerificationRow {
  id: string;
  name?: string;
  email?: string;
  fullLegalName?: string;
  operatingState?: string;
  vehicleCategory?: string;
  verificationStatus: DriverVerificationStatus;
  verificationProgress?: number;
  rejectionReason?: string;
}

interface DriversResponse {
  drivers: DriverVerificationRow[];
}

const DOC_LABELS: Record<string, string> = {
  license: "Driver's License",
  insurance: 'Vehicle Insurance',
  registration: 'Vehicle Registration',
  background_check: 'Background Check',
  vehicle_inspection: 'Vehicle Inspection',
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const DRIVER_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  DOCUMENTS_SUBMITTED: 'bg-yellow-100 text-yellow-700',
  VERIFYING: 'bg-yellow-100 text-yellow-700',
  MANUAL_REVIEW: 'bg-yellow-100 text-yellow-700',
  VERIFIED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const DRIVER_FILTERS: { key: DriverStatusFilter; label: string }[] = [
  { key: 'MANUAL_REVIEW', label: 'Manual Review' },
  { key: 'DOCUMENTS_SUBMITTED', label: 'Submitted' },
  { key: 'VERIFYING', label: 'Verifying' },
  { key: 'all', label: 'All' },
];

export default function Verification() {
  const [viewMode, setViewMode] = useState<'drivers' | 'documents'>('drivers');

  const [data, setData] = useState<DriverDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [drivers, setDrivers] = useState<DriverVerificationRow[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [driverStatusFilter, setDriverStatusFilter] = useState<DriverStatusFilter>('MANUAL_REVIEW');
  const [decidingDriver, setDecidingDriver] = useState<{ id: string; decision: DriverDecision } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [decidingProcessing, setDecidingProcessing] = useState(false);

  const load = (status: typeof statusFilter) => {
    setLoading(true);
    setError(null);
    trpcQuery<DocsResponse>('admin.driverDocuments', { status })
      .then((res) => setData(res.documents))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  const loadDrivers = (status: DriverStatusFilter) => {
    setDriversLoading(true);
    setDriversError(null);
    trpcQuery<DriversResponse>('admin.driverVerification.list', { status })
      .then((res) => setDrivers(res.drivers))
      .catch((e: Error) => setDriversError(e.message))
      .finally(() => setDriversLoading(false));
  };

  useEffect(() => { loadDrivers(driverStatusFilter); }, [driverStatusFilter]);

  const review = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessing(id);
    try {
      await trpcMutate('admin.reviewDocument', { documentId: id, action, rejectionReason: reason });
      setData((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setProcessing(null);
      setRejectModal(null);
      setRejectReason('');
    }
  };

  const decideDriver = async (driverId: string, decision: DriverDecision, reason?: string) => {
    setDecidingProcessing(true);
    try {
      await trpcMutate('admin.driverVerification.decide', { driverId, decision, reason });
      loadDrivers(driverStatusFilter);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDecidingProcessing(false);
      setDecidingDriver(null);
      setDecisionReason('');
    }
  };

  const openDriverDecision = (driverId: string, decision: 'REJECTED' | 'MANUAL_REVIEW') => {
    setDecidingDriver({ id: driverId, decision });
    setDecisionReason('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Driver Verification</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('drivers')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors
            ${viewMode === 'drivers' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Drivers
        </button>
        <button
          onClick={() => setViewMode('documents')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors
            ${viewMode === 'documents' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Documents
        </button>
      </div>

      {viewMode === 'drivers' ? (
        <>
          <div className="flex gap-2 flex-wrap">
            {DRIVER_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setDriverStatusFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                  ${driverStatusFilter === f.key ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {driversLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : driversError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{driversError}</div>
          ) : drivers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              No drivers found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {drivers.map((driver) => (
                <div key={driver.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {driver.fullLegalName || driver.name || 'Unnamed Driver'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{driver.email}</p>
                      <p className="text-xs text-gray-400">
                        {driver.operatingState || '—'} · {driver.vehicleCategory || '—'} ·{' '}
                        {Math.round(driver.verificationProgress ?? 0)}% docs submitted
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${DRIVER_STATUS_STYLE[driver.verificationStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {driver.verificationStatus}
                    </span>
                  </div>

                  {driver.rejectionReason && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                      Reason: {driver.rejectionReason}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={decidingProcessing}
                      onClick={() => openDriverDecision(driver.id, 'REJECTED')}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ShieldX size={13} />
                      Reject
                    </button>
                    <button
                      disabled={decidingProcessing}
                      onClick={() => openDriverDecision(driver.id, 'MANUAL_REVIEW')}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ShieldAlert size={13} />
                      Flag
                    </button>
                    <button
                      disabled={decidingProcessing}
                      onClick={() => decideDriver(driver.id, 'VERIFIED')}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck size={13} />
                      Verify
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {decidingDriver && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
                <h3 className="font-semibold text-gray-900">
                  {decidingDriver.decision === 'REJECTED' ? 'Reject Driver' : 'Flag for Manual Review'}
                </h3>
                <p className="text-sm text-gray-500">Explain the reason — the driver will see this.</p>
                <textarea
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Reason (optional)"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setDecidingDriver(null); setDecisionReason(''); }}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={decidingProcessing}
                    onClick={() => decideDriver(decidingDriver.id, decidingDriver.decision, decisionReason || undefined)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
      <>
      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize
              ${statusFilter === s ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No {statusFilter === 'all' ? '' : statusFilter} documents.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {doc.signedUrl ? (
                <div className="relative h-44 bg-gray-100">
                  <img
                    src={doc.signedUrl}
                    alt={DOC_LABELS[doc.type] || doc.type}
                    className="w-full h-full object-cover"
                  />
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute top-2 right-2 bg-white/90 rounded-md p-1.5 hover:bg-white"
                  >
                    <ExternalLink size={14} className="text-gray-600" />
                  </a>
                </div>
              ) : (
                <div className="h-44 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                  No preview available
                </div>
              )}

              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {DOC_LABELS[doc.type] || doc.type}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{doc.driverName || doc.driverId}</p>
                    {doc.driverEmail && (
                      <p className="text-xs text-gray-400">{doc.driverEmail}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_STYLE[doc.status]}`}>
                    <Clock size={10} />
                    {doc.status}
                  </span>
                </div>

                <div className="text-xs text-gray-400">
                  Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                  {doc.expiryDate && ` · Expires ${new Date(doc.expiryDate).toLocaleDateString()}`}
                </div>

                {doc.rejectionReason && (
                  <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    Rejected: {doc.rejectionReason}
                  </p>
                )}

                {doc.status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={processing === doc.id}
                      onClick={() => review(doc.id, 'approve')}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ShieldCheck size={13} />
                      Approve
                    </button>
                    <button
                      disabled={processing === doc.id}
                      onClick={() => setRejectModal({ id: doc.id })}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ShieldX size={13} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Reject Document</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason (optional)"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => review(rejectModal.id, 'reject', rejectReason || undefined)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
