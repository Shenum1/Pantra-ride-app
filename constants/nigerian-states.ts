// All 36 Nigerian states plus the FCT. Must match the "state" values seeded into
// driver_verification_requirements (see
// database/schemas/supabase-schema-driver-verification-v2.sql) and the fallback keys
// in lib/driver-verification-config.ts exactly — these are the strings actually used
// to resolve which documents are required.
//
// Every state is listed (and searchable) during registration so the picker reflects
// the whole country, but only LAUNCHED_STATES below are actually selectable — see
// that constant for the launch-sequencing distinction.
export const NIGERIAN_STATES = [
  'Abia', 'Abuja (FCT)', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

// States actually open for driver registration right now. The registration wizard
// shows every state in NIGERIAN_STATES (so the picker doesn't visibly shrink/grow as
// launch states change) but only lets a driver select one from this list — the rest
// render disabled with a "coming soon" treatment. Expand this list as new states
// launch; it does not need to match driver_verification_requirements seeding, which
// governs document rules once a state IS launched, not launch sequencing.
export const LAUNCHED_STATES: NigerianState[] = ['Abuja (FCT)'];
