// TEMPORARY DIAGNOSTIC HANDLER — not the real app.
// Reports what Vercel's runtime actually resolves the expo-server vercel
// adapter to, since a static `import { createRequestHandler } from '...'`
// crashes before any of our code can run (ESM linking happens before
// execution). A dynamic import() lets us inspect it instead of guessing blind.
export default async function handler(req: unknown, res: any) {
  const report: Record<string, unknown> = { ok: true };

  try {
    const mod = await import('../node_modules/expo-server/build/mjs/vendor/vercel.js');
    report.relativeImport = {
      keys: Object.keys(mod),
      hasCreateRequestHandler: typeof (mod as any).createRequestHandler,
    };
  } catch (e) {
    report.relativeImportError = e instanceof Error ? e.message : String(e);
  }

  try {
    const mod = await import('expo-server/adapter/vercel');
    report.bareSpecifierImport = {
      keys: Object.keys(mod),
      hasCreateRequestHandler: typeof (mod as any).createRequestHandler,
    };
  } catch (e) {
    report.bareSpecifierImportError = e instanceof Error ? e.message : String(e);
  }

  try {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(__dirname, '../node_modules/expo-server/build/mjs/vendor/vercel.js');
    const content = readFileSync(filePath, 'utf-8');
    report.fileOnDisk = {
      path: filePath,
      length: content.length,
      firstLine: content.split('\n')[0],
      containsCreateRequestHandlerExport: content.includes('export function createRequestHandler') || content.includes('export const createRequestHandler'),
    };
  } catch (e) {
    report.fileReadError = e instanceof Error ? e.message : String(e);
  }

  res.setHeader('content-type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify(report, null, 2));
}
