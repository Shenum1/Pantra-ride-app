import { createRequestHandler } from 'expo-server/adapter/vercel';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default createRequestHandler({
  build: path.join(__dirname, '../dist/server'),
});
