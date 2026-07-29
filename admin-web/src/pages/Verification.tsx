import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldX, Clock, ExternalLink } from 'lucide-react';
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

export default function Verification() {
  const [data, setData] = useState<DriverDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = (status: typeof statusFilter) => {
    setLoading(true);
    setError(null);
    trpcQuery<DocsResponse>('admin.driverDocuments', { status })
      .then((res) => setData(res.documents))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  const review = async (id: string, decision: 'approved' | 'rejected', reason?: string) => {
    setProcessing(id);
    try {
      await trpcMutate('admin.reviewDocument', { documentId: id, decision, rejectionReason: reason });
      setData((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setProcessing(null);
      setRejectModal(null);
      setRejectReason('');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Driver Verification</h1>

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
                      onClick={() => review(doc.id, 'approved')}
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
                onClick={() => review(rejectModal.id, 'rejected', rejectReason || undefined)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
