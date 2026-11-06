// The receipts themselves, kept as they came on the server's disk, and made ready for the model.
// A long screenshot is cut into overlapping pages, because shrunk to one image it can't be read.
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import type { ModelFile } from '../../application/ports/ai.ts';
import type { ReceiptFile, ReceiptFilePort } from '../../application/ports/receipts.ts';
import { UserError } from '../../application/user-error.ts';

const FILE = /^[a-f0-9-]{36}\.(pdf|jpg|png|heic|webp)$/;
const PAGE_WIDTH = 1500;
/** Taller than this and one image won't stay legible. */
const PAGE_RATIO = 1.8;
const OVERLAP = 0.1;
const PDF_LIMIT = 30 * 1024 * 1024;
/** Receipts are the household's record and are never deleted on their own, so this just guards the disk. */
const STORE_LIMIT = 5 * 1024 * 1024 * 1024;

const typeOf = (data: Buffer): ReceiptFile['type'] => {
  if (data.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
  if (data[0] === 0x89 && data[1] === 0x50) return 'image/png';
  if (data.subarray(4, 8).toString('latin1') === 'ftyp') return 'image/heic';
  if (data.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  throw new UserError('That file isn’t a photo or a PDF.', 415);
};
const EXTENSION = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp' } as const;

/** iPhone photos can arrive as HEIC, which this build of sharp can't open. macOS can, with `sips`; elsewhere we say so. */
async function readableImage(data: Buffer, type: ReceiptFile['type'], platform: string): Promise<Buffer> {
  if (type !== 'image/heic') return data;
  if (platform !== 'darwin') throw new UserError('This server can’t read HEIC photos; that takes macOS. Add a screenshot or a JPEG instead, or on iPhone choose Settings → Camera → Formats → Most Compatible.', 415);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-receipt-'));
  try {
    const from = path.join(dir, 'in.heic');
    const to = path.join(dir, 'out.jpg');
    fs.writeFileSync(from, data);
    await promisify(execFile)('/usr/bin/sips', ['-s', 'format', 'jpeg', from, '--out', to]);
    return fs.readFileSync(to);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function pagesOf(data: Buffer): Promise<ModelFile[]> {
  const upright = await sharp(data).rotate().resize({ width: PAGE_WIDTH, withoutEnlargement: true }).toBuffer();
  const { width, height } = await sharp(upright).metadata();
  const pageHeight = Math.round(width * PAGE_RATIO);
  const tops: number[] = [];
  for (let top = 0; ; top += Math.round(pageHeight * (1 - OVERLAP))) {
    tops.push(Math.min(top, Math.max(0, height - pageHeight)));
    if (top + pageHeight >= height) break;
  }
  return Promise.all(tops.map(async top => {
    const page = await sharp(upright).extract({ left: 0, top, width, height: Math.min(pageHeight, height - top) }).jpeg({ quality: 88 }).toBuffer();
    return { mediaType: 'image/jpeg' as const, data: page.toString('base64') };
  }));
}

export function fileReceiptStore(dir: string, platform: string = process.platform): ReceiptFilePort {
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = (file: string) => {
    if (!FILE.test(file)) throw new UserError('That receipt isn’t available.', 404);
    return path.join(dir, file);
  };
  return {
    save(data) {
      const type = typeOf(data);
      if (type === 'application/pdf' && data.length > PDF_LIMIT) throw new UserError('That PDF is too big. Try a screenshot instead.', 413);
      const used = fs.readdirSync(dir).reduce((sum, name) => sum + fs.statSync(path.join(dir, name)).size, 0);
      if (used + data.length > STORE_LIMIT) throw new UserError('The server is keeping as many receipts as it has room for. Delete some old ones first.', 507);
      const file = `${randomUUID()}.${EXTENSION[type]}`;
      fs.writeFileSync(fullPath(file), data);
      return { file, type };
    },
    read: file => fs.readFileSync(fullPath(file.file)),
    remove(file) { fs.rmSync(fullPath(file.file), { force: true }); },
    async forModel(file) {
      const data = fs.readFileSync(fullPath(file.file));
      if (file.type === 'application/pdf') return [{ mediaType: 'application/pdf', data: data.toString('base64') }];
      return pagesOf(await readableImage(data, file.type, platform));
    },
  };
}
