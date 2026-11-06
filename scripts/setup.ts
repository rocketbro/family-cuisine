// Gets a checkout ready: makes .env from the example if there isn't one, and fills in VAPID keys if
// they're blank. Safe to run again: it never changes a value that's already set. Prints no secrets.
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';

const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, '.env');

if (!fs.existsSync(envFile)) {
  fs.copyFileSync(path.join(root, '.env.example'), envFile);
  console.log('Made .env from .env.example.');
}
fs.chmodSync(envFile, 0o600);

let text = fs.readFileSync(envFile, 'utf8');
const isBlank = (name: string) => !new RegExp(`^${name}=.+`, 'm').test(text);
const put = (name: string, value: string) => {
  const line = new RegExp(`^${name}=$`, 'm');
  text = line.test(text) ? text.replace(line, `${name}=${value}`) : `${text.trimEnd()}\n${name}=${value}\n`;
};

if (isBlank('VAPID_PUBLIC_KEY') && isBlank('VAPID_PRIVATE_KEY')) {
  const keys = webpush.generateVAPIDKeys();
  put('VAPID_PUBLIC_KEY', keys.publicKey);
  put('VAPID_PRIVATE_KEY', keys.privateKey);
  fs.writeFileSync(envFile, text);
  console.log('Wrote new VAPID keys to .env.');
} else {
  console.log('VAPID keys are already set; left them alone.');
}
console.log('Next: npm run build, then npm start.');
