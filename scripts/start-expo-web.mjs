import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const command = isWindows ? '.\\node_modules\\.bin\\expo.cmd' : './node_modules/.bin/expo';
const child = spawn(command, ['start', '--web', '--localhost', '--port', '8081'], {
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
