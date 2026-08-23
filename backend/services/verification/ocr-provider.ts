import type { DriverDocumentType, OcrExtractionResult } from './types';

export interface OcrProvider {
  extract(documentType: DriverDocumentType, storagePath: string): Promise<OcrExtractionResult>;
}

/**
 * The only OCR provider shipped in this pass. It never fabricates a successful
 * extraction — it honestly reports that no OCR vendor is configured, which the
 * state machine (lib/driver-verification-state-machine.ts) treats as "route to
 * human review", never as a silent pass. This is intentional: a correctly-shaped
 * document is not proof its contents match what the driver typed.
 */
export class NoopOcrProvider implements OcrProvider {
  async extract(_documentType: DriverDocumentType, _storagePath: string): Promise<OcrExtractionResult> {
    return {
      status: 'not_configured',
      extractedFields: {},
      provider: 'none',
    };
  }
}

let hasWarnedNoProvider = false;

/**
 * Reads OCR_PROVIDER (server-only env var, never EXPO_PUBLIC_*) to select an OCR
 * implementation. No real vendor is wired up in this pass — any value other than a
 * recognized provider name falls back to NoopOcrProvider. Plugging in a real vendor
 * later means adding a case here and setting the env var; nothing else in the
 * verification engine, tRPC surface, or DB schema needs to change.
 */
export function getConfiguredOcrProvider(): OcrProvider {
  const providerName = process.env.OCR_PROVIDER;

  if (!providerName) {
    return new NoopOcrProvider();
  }

  // No vendor implementations exist yet — every recognized-but-unimplemented name
  // still falls back to the safe no-op rather than throwing, so a misconfigured env
  // var degrades to "manual review" instead of crashing the verification pipeline.
  if (!hasWarnedNoProvider) {
    console.warn(
      `[driver-verification] OCR_PROVIDER="${providerName}" is set, but no OCR vendor is implemented in this codebase yet. Falling back to manual review for all document-consistency checks.`
    );
    hasWarnedNoProvider = true;
  }

  return new NoopOcrProvider();
}
