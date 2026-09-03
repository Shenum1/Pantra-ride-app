import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react';
import { useTrpcQuery } from '../hooks/useTrpcQuery';
import { trpcMutate } from '../lib/api';
import { StatusLabel } from '../components/ui/StatusLabel';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Field } from '../components/ui/Field';
import { Table, type TableColumn } from '../components/ui/Table';
import { driverVerificationStatusTone, documentStatusTone } from '../lib/status';

interface DriverDetailData {
  driver: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    fullLegalName: string | null;
    dateOfBirth: string | null;
    operatingState: string | null;
    vehicleCategory: string | null;
    verificationStatus: string;
    verificationProgress: number | null;
    verificationStatusUpdatedAt: string | null;
    rejectionReason: string | null;
    emailVerifiedAt: string | null;
    licenseNumber: string | null;
    licenseCategory: string | null;
    licenseIssueDate: string | null;
    licenseExpiryDate: string | null;
    vehiclePlateNumber: string | null;
    vehicleVin: string | null;
    vehicleEngineNumber: string | null;
  };
  requiredDocuments: string[];
  documents: {
    id: string;
    type: string;
    status: 'pending' | 'approved' | 'rejected';
    uploadedAt: string;
    rejectionReason?: string;
    expiryDate?: string;
    signedUrl?: string;
  }[];
  checks: {
    id: string;
    documentId: string | null;
    checkType: string;
    status: string;
    provider: string | null;
    checkedAt: string;
  }[];
  auditLog: {
    id: string;
    actorType: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    reason: string | null;
    createdAt: string;
  }[];
}

type Decision = 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, refetch } = useTrpcQuery<DriverDetailData>(
    'admin.driverVerification.getDriverDetail',
    { driverId: id },
    [id]
  );
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [processing, setProcessing] = useState(false);

  const decide = async (decision: Decision, reason?: string) => {
    if (!id) return;
    setProcessing(true);
    try {
      await trpcMutate('admin.driverVerification.decide', { driverId: id, decision, reason });
      refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setProcessing(false);
      setConfirming(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-400">Loading driver…</p>;
  }

  if (error || !data) {
    return <div className="rounded-md border border-danger/20 bg-danger-tint p-6 text-sm text-danger">{error || 'Driver not found.'}</div>;
  }

  const { driver, requiredDocuments, documents, checks, auditLog } = data;
  const documentsByType = new Map(documents.map((d) => [d.type, d]));

  const checksColumns: TableColumn<DriverDetailData['checks'][number]>[] = [
    { key: 'check', header: 'Check', render: (c) => <span className="capitalize text-slate-700">{c.checkType.replace(/_/g, ' ')}</span> },
    { key: 'status', header: 'Status', render: (c) => <span className="capitalize text-slate-700">{c.status.replace(/_/g, ' ')}</span> },
    { key: 'provider', header: 'Provider', render: (c) => <span className="text-slate-500">{c.provider || '—'}</span> },
    { key: 'checked', header: 'Checked', render: (c) => <span className="text-slate-500">{new Date(c.checkedAt).toLocaleString()}</span> },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link to="/drivers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} />
          Drivers
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-bold tracking-tight text-slate-900">
              {driver.fullLegalName || driver.name || 'Unnamed driver'}
            </h1>
            <StatusLabel tone={driverVerificationStatusTone[driver.verificationStatus] ?? 'neutral'}>
              {driver.verificationStatus.replace(/_/g, ' ').toLowerCase()}
            </StatusLabel>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {driver.email || '—'} · {driver.phone || '—'}
          </p>
          {driver.rejectionReason && (
            <p className="mt-2 rounded-md bg-danger-tint px-3 py-1.5 text-sm text-danger">{driver.rejectionReason}</p>
          )}
        </div>

        <div className="flex gap-2">
          {driver.verificationStatus !== 'VERIFIED' && (
            <Button variant="success" size="sm" onClick={() => decide('VERIFIED')} disabled={processing}>
              <ShieldCheck size={14} />
              Verify
            </Button>
          )}
          {driver.verificationStatus !== 'MANUAL_REVIEW' && (
            <Button variant="warning" size="sm" onClick={() => setConfirming('MANUAL_REVIEW')} disabled={processing}>
              <ShieldAlert size={14} />
              Flag
            </Button>
          )}
          {driver.verificationStatus !== 'REJECTED' && (
            <Button variant="danger" size="sm" onClick={() => setConfirming('REJECTED')} disabled={processing}>
              <ShieldX size={14} />
              Reject
            </Button>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Profile</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-slate-200 bg-white p-5 md:grid-cols-3">
          <Field label="Date of birth" value={driver.dateOfBirth} />
          <Field label="Operating state" value={driver.operatingState} />
          <Field label="Vehicle category" value={driver.vehicleCategory} />
          <Field label="Email verified" value={driver.emailVerifiedAt ? new Date(driver.emailVerifiedAt).toLocaleDateString() : 'Not verified'} />
          <Field label="Verification progress" value={`${Math.round(driver.verificationProgress ?? 0)}%`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">License &amp; vehicle</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-slate-200 bg-white p-5 md:grid-cols-3">
          <Field label="License number" value={driver.licenseNumber} />
          <Field label="License category" value={driver.licenseCategory} />
          <Field label="License expiry" value={driver.licenseExpiryDate ? new Date(driver.licenseExpiryDate).toLocaleDateString() : null} />
          <Field label="Plate number" value={driver.vehiclePlateNumber} />
          <Field label="VIN" value={driver.vehicleVin} />
          <Field label="Engine number" value={driver.vehicleEngineNumber} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Documents</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {requiredDocuments.length === 0 ? (
            <p className="text-sm text-slate-400">No document requirements resolved for this state/category yet.</p>
          ) : (
            requiredDocuments.map((type) => {
              const doc = documentsByType.get(type);
              return (
                <div key={type} className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800 capitalize">{type.replace(/_/g, ' ')}</p>
                    {doc ? (
                      <p className="mt-0.5 text-xs text-slate-400">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-400">Not submitted</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {doc ? <StatusLabel tone={documentStatusTone[doc.status]}>{doc.status}</StatusLabel> : <StatusLabel tone="neutral">missing</StatusLabel>}
                    {doc?.signedUrl && (
                      <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="rounded-md p-1.5 hover:bg-slate-100">
                        <ExternalLink size={14} className="text-slate-500" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {checks.length > 0 && (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Verification checks</h2>
          <Table
            columns={checksColumns}
            rows={checks}
            rowKey={(c) => c.id}
          />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Audit log</h2>
        {auditLog.length === 0 ? (
          <p className="text-sm text-slate-400">No verification events recorded yet.</p>
        ) : (
          <ol className="space-y-0 rounded-md border border-slate-200 bg-white">
            {auditLog.map((entry, i) => (
              <li
                key={entry.id}
                className={`px-4 py-3 text-sm ${i !== auditLog.length - 1 ? 'border-b border-slate-100' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-800">
                    {entry.eventType.replace(/_/g, ' ').toLowerCase()}
                    {entry.fromStatus && entry.toStatus ? (
                      <span className="font-normal text-slate-400"> — {entry.fromStatus} → {entry.toStatus}</span>
                    ) : null}
                  </p>
                  <span className="font-mono text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                {entry.reason && <p className="mt-0.5 text-xs text-slate-500">{entry.reason}</p>}
                <p className="mt-0.5 text-xs capitalize text-slate-400">by {entry.actorType}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {confirming && (
        <ConfirmModal
          title={confirming === 'REJECTED' ? 'Reject driver' : 'Flag for manual review'}
          description="The driver will see this reason."
          reasonLabel="Reason"
          reasonPlaceholder="Explain why…"
          confirmLabel={confirming === 'REJECTED' ? 'Reject' : 'Flag'}
          confirmVariant={confirming === 'REJECTED' ? 'danger' : 'warning'}
          processing={processing}
          onCancel={() => setConfirming(null)}
          onConfirm={(reason) => decide(confirming, reason)}
        />
      )}
    </div>
  );
}
