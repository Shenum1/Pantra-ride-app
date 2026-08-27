import type { BadgeTone } from '../components/ui/StatusLabel';

export const rideStatusTone: Record<string, BadgeTone> = {
  pending: 'pending',
  accepted: 'pending',
  'in-progress': 'pending',
  completed: 'success',
  cancelled: 'danger',
};

export const payoutStatusTone: Record<string, BadgeTone> = {
  pending: 'pending',
  processing: 'pending',
  completed: 'success',
  failed: 'danger',
};

export const documentStatusTone: Record<string, BadgeTone> = {
  pending: 'pending',
  approved: 'success',
  rejected: 'danger',
};

export const driverVerificationStatusTone: Record<string, BadgeTone> = {
  PENDING: 'neutral',
  DOCUMENTS_SUBMITTED: 'pending',
  VERIFYING: 'pending',
  MANUAL_REVIEW: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
};

export const accountStatusTone: Record<string, BadgeTone> = {
  active: 'success',
  inactive: 'neutral',
};

export const ticketStatusTone: Record<string, BadgeTone> = {
  open: 'pending',
  in_progress: 'pending',
  resolved: 'success',
  closed: 'neutral',
};

export const ticketPriorityTone: Record<string, BadgeTone> = {
  low: 'neutral',
  normal: 'pending',
  high: 'warning',
  urgent: 'danger',
};

export const paymentStatusTone: Record<string, BadgeTone> = {
  completed: 'success',
  successful: 'success',
  pending: 'pending',
  failed: 'danger',
  cancelled: 'danger',
  refunded: 'neutral',
};
