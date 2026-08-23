import type {
  AuthenticityResult,
  AuthenticityDriverLicenseInput,
  AuthenticityVehicleRegistrationInput,
} from './types';

export interface AuthenticityProvider {
  verifyDriverLicense(input: AuthenticityDriverLicenseInput): Promise<AuthenticityResult>;
  verifyVehicleRegistration(input: AuthenticityVehicleRegistrationInput): Promise<AuthenticityResult>;
}

/**
 * The only authenticity provider shipped in this pass. There is no authorized
 * integration with FRSC, VIS, or any other Nigerian government verification service
 * in this codebase — scraping a government website or fabricating a "verified"
 * response is explicitly disallowed. Every method here is structurally incapable of
 * returning 'verified': it always routes to a human admin instead.
 */
export class ManualReviewAuthenticityProvider implements AuthenticityProvider {
  private static readonly REASON =
    'No authorized government verification API is configured for this deployment.';

  async verifyDriverLicense(_input: AuthenticityDriverLicenseInput): Promise<AuthenticityResult> {
    return { status: 'manual_review', provider: 'none', reason: ManualReviewAuthenticityProvider.REASON };
  }

  async verifyVehicleRegistration(
    _input: AuthenticityVehicleRegistrationInput
  ): Promise<AuthenticityResult> {
    return { status: 'manual_review', provider: 'none', reason: ManualReviewAuthenticityProvider.REASON };
  }
}

let hasWarnedNoProvider = false;

/**
 * Reads AUTHENTICITY_PROVIDER (server-only env var) to select an authenticity-check
 * implementation. Unset or unrecognized ⇒ ManualReviewAuthenticityProvider — the
 * safe default that this pass ships with. Plugging in a real, authorized government
 * or licensed KYC-aggregator API later means adding a case here and setting the env
 * var; the tRPC surface and DB schema never need to change.
 */
export function getConfiguredAuthenticityProvider(): AuthenticityProvider {
  const providerName = process.env.AUTHENTICITY_PROVIDER;

  if (!providerName) {
    return new ManualReviewAuthenticityProvider();
  }

  if (!hasWarnedNoProvider) {
    console.warn(
      `[driver-verification] AUTHENTICITY_PROVIDER="${providerName}" is set, but no authenticity vendor is implemented in this codebase yet. Falling back to manual review for all authenticity checks.`
    );
    hasWarnedNoProvider = true;
  }

  return new ManualReviewAuthenticityProvider();
}
