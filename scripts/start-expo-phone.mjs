import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

const isWindows = process.platform === 'win32';
const command = isWindows ? '.\\node_modules\\.bin\\expo.cmd' : './node_modules/.bin/expo';

const nets = networkInterfaces();
for (const iface of Object.values(nets)) {
  for (const net of iface ?? []) {
    if (net.family === 'IPv4' && !net.internal) {
      console.log(`\nLocal IP: ${net.address} — make sure your phone is on the same Wi-Fi\n`);
    }
  }
}

const child = spawn(command, ['start', '--lan'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    EXPO_NO_DOCTOR: '1',
    EXPO_NO_DEPENDENCY_VALIDATION: '1',
  },
  shell: isWindows,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
