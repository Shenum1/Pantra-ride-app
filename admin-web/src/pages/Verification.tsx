import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldX, ShieldAlert, ExternalLink } from 'lucide-react';
import { trpcMutate } from '../lib/api';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { CardSkeleton } from '../components/ui/Skeleton';
import { documentStatusTone, driverVerificationStatusTone } from '../lib/status';

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
  drivers_license_front: "Driver's License (front)",
  drivers_license_back: "Driver's License (back)",
  driver_selfie: 'Selfie',
  vehicle_registration: 'Vehicle Registration',
  proof_of_ownership: 'Proof of Ownership',
  roadworthiness: 'Roadworthiness Certificate',
};

const DRIVER_FILTERS: { key: DriverStatusFilter; label: string }[] = [
  { key: 'MANUAL_REVIEW', label: 'Manual review' },
  { key: 'DOCUMENTS_SUBMITTED', label: 'Submitted' },
  { key: 'VERIFYING', label: 'Verifying' },
  { key: 'all', label: 'All' },
];

const DOC_FILTERS = ['pending', 'approved', 'rejected', 'all'] as const;

function FilterPill<T extends string>({ value, current, label, onClick }: { value: T; current: T; label: string; onClick: (v: T) => void }) {
  return (
    <button
      onClick={() => onClick(value)}
      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors
        ${current === value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
    >
      {label}
    </button>
  );
}

export default function Verification() {
  const [viewMode, setViewMode] = useState<'drivers' | 'documents'>('drivers');

  const [statusFilter, setStatusFilter] = useState<(typeof DOC_FILTERS)[number]>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);

  const [driverStatusFilter, setDriverStatusFilter] = useState<DriverStatusFilter>('MANUAL_REVIEW');
  const [decidingDriver, setDecidingDriver] = useState<{ id: string; decision: DriverDecision } | null>(null);
  const [decidingProcessing, setDecidingProcessing] = useState(false);

  const {
    data: docsData,
    loading: docsLoading,
    error: docsError,
    setData: setDocsData,
  } = useTrpcQuery<DocsResponse>('admin.driverDocuments', { status: statusFilter }, [statusFilter]);

  const {
    data: driversData,
    loading: driversLoading,
    error: driversError,
    refetch: refetchDrivers,
  } = useTrpcQuery<DriversResponse>('admin.driverVerification.list', { status: driverStatusFilter }, [driverStatusFilter]);

  const documents = docsData?.documents ?? [];
  const drivers = driversData?.drivers ?? [];

  const review = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessing(id);
    try {
      await trpcMutate('admin.reviewDocument', { documentId: id, action, rejectionReason: reason });
      setDocsData((prev) => (prev ? { documents: prev.documents.filter((d) => d.id !== id) } : prev));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setProcessing(null);
      setRejectModal(null);
    }
  };

  const decideDriver = async (driverId: string, decision: DriverDecision, reason?: string) => {
    setDecidingProcessing(true);
    try {
      await trpcMutate('admin.driverVerification.decide', { driverId, decision, reason });
      refetchDrivers();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDecidingProcessing(false);
      setDecidingDriver(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Verification</h1>
        <p className="mt-1 text-sm text-slate-500">The actionable queue — drivers and documents waiting on a decision.</p>
      </div>

      <div className="flex gap-2">
        {(['drivers', 'documents'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`rounded-md px-4 py-2 text-sm font-semibold capitalize transition-colors
              ${viewMode === mode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {mode}
          </button>
        ))}
      </div>

      {viewMode === 'drivers' ? (
        <>
          <div className="flex flex-wrap gap-2">
            {DRIVER_FILTERS.map((f) => (
              <FilterPill key={f.key} value={f.key} current={driverStatusFilter} label={f.label} onClick={setDriverStatusFilter} />
            ))}
          </div>

          {driversError ? (
            <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{driversError}</div>
          ) : driversLoading ? (
            <CardSkeleton count={6} />
          ) : drivers.length === 0 ? (
            <EmptyState title="Nothing to review" description="No drivers match this filter right now." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {drivers.map((driver) => (
                <div key={driver.id} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link to={`/drivers/${driver.id}`} className="text-sm font-semibold text-slate-900 hover:text-primary">
                        {driver.fullLegalName || driver.name || 'Unnamed driver'}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{driver.email}</p>
                      <p className="text-xs text-slate-400">
                        {driver.operatingState || '—'} · {driver.vehicleCategory || '—'} · {Math.round(driver.verificationProgress ?? 0)}% docs
                      </p>
                    </div>
                    <Badge tone={driverVerificationStatusTone[driver.verificationStatus] ?? 'neutral'}>
                      {driver.verificationStatus.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  </div>

                  {driver.rejectionReason && (
                    <p className="rounded-md bg-danger-tint px-2.5 py-1.5 text-xs text-danger">{driver.rejectionReason}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button variant="success" size="sm" className="flex-1" disabled={decidingProcessing} onClick={() => decideDriver(driver.id, 'VERIFIED')}>
                      <ShieldCheck size={13} />
                      Verify
                    </Button>
                    <Button variant="warning" size="sm" className="flex-1" disabled={decidingProcessing} onClick={() => setDecidingDriver({ id: driver.id, decision: 'MANUAL_REVIEW' })}>
                      <ShieldAlert size={13} />
                      Flag
                    </Button>
                    <Button variant="danger" size="sm" className="flex-1" disabled={decidingProcessing} onClick={() => setDecidingDriver({ id: driver.id, decision: 'REJECTED' })}>
                      <ShieldX size={13} />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {decidingDriver && (
            <ConfirmModal
              title={decidingDriver.decision === 'REJECTED' ? 'Reject driver' : 'Flag for manual review'}
              description="The driver will see this reason."
              reasonLabel="Reason"
              reasonPlaceholder="Reason (optional)"
              confirmLabel="Confirm"
              confirmVariant={decidingDriver.decision === 'REJECTED' ? 'danger' : 'warning'}
              processing={decidingProcessing}
              onCancel={() => setDecidingDriver(null)}
              onConfirm={(reason) => decideDriver(decidingDriver.id, decidingDriver.decision, reason)}
            />
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {DOC_FILTERS.map((s) => (
              <FilterPill key={s} value={s} current={statusFilter} label={s} onClick={setStatusFilter} />
            ))}
          </div>

          {docsError ? (
            <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{docsError}</div>
          ) : docsLoading ? (
            <CardSkeleton count={6} />
          ) : documents.length === 0 ? (
            <EmptyState title="No documents" description={`No ${statusFilter === 'all' ? '' : statusFilter} documents right now.`} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {documents.map((doc) => (
                <div key={doc.id} className="overflow-hidden rounded-md border border-slate-200 bg-white">
                  {doc.signedUrl ? (
                    <div className="relative h-44 bg-slate-100">
                      <img src={doc.signedUrl} alt={DOC_LABELS[doc.type] || doc.type} className="h-full w-full object-cover" />
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 hover:bg-white"
                      >
                        <ExternalLink size={14} className="text-slate-600" />
                      </a>
                    </div>
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-slate-100 text-sm text-slate-400">No preview available</div>
                  )}

                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{DOC_LABELS[doc.type] || doc.type}</p>
                        <Link to={`/drivers/${doc.driverId}`} className="mt-0.5 block text-xs text-slate-500 hover:text-primary">
                          {doc.driverName || doc.driverId}
                        </Link>
                      </div>
                      <Badge tone={documentStatusTone[doc.status]}>{doc.status}</Badge>
                    </div>

                    <div className="text-xs text-slate-400">
                      Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                      {doc.expiryDate && ` · Expires ${new Date(doc.expiryDate).toLocaleDateString()}`}
                    </div>

                    {doc.rejectionReason && (
                      <p className="rounded-md bg-danger-tint px-2.5 py-1.5 text-xs text-danger">Rejected: {doc.rejectionReason}</p>
                    )}

                    {doc.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <Button variant="success" size="sm" className="flex-1" disabled={processing === doc.id} onClick={() => review(doc.id, 'approve')}>
                          <ShieldCheck size={13} />
                          Approve
                        </Button>
                        <Button variant="danger" size="sm" className="flex-1" disabled={processing === doc.id} onClick={() => setRejectModal({ id: doc.id })}>
                          <ShieldX size={13} />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {rejectModal && (
            <ConfirmModal
              title="Reject document"
              reasonLabel="Reason"
              reasonPlaceholder="Enter rejection reason (optional)"
              confirmLabel="Reject"
              confirmVariant="danger"
              processing={processing === rejectModal.id}
              onCancel={() => setRejectModal(null)}
              onConfirm={(reason) => review(rejectModal.id, 'reject', reason)}
            />
          )}
        </>
      )}
    </div>
  );
}
