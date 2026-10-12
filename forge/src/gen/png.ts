/**
 * **PNG 를 픽셀로 읽는다** — `node:zlib` 만 쓴다 (2026-09-28, 바깥 의존은 typescript 하나).
 *
 * 그림 맞추기(`imgfind.ts`)가 figma 화면과 리소스 그림을 픽셀로 견주려고 쓴다.
 * 8비트 RGB·RGBA·회색·회색+알파, 팔레트(1·2·4·8비트, `tRNS` 투명)를 읽는다.
 * 리소스는 팔레트로 줄여 둔 것이 많다(pngquant). 인터레이스·16비트는 안 읽고 null 을 준다 —
 * 모르는 꼴을 짐작해 읽으면 틀린 픽셀로 조용히 틀린 좌표가 나온다.
 */

import fs from "node:fs";
import zlib from "node:zlib";

/** RGBA 한 줄로 편 픽셀. `data[(y*w+x)*4 + c]` */
export type Bitmap = { w: number; h: number; data: Uint8Array };

const SIG = "89504e470d0a1a0a";

export function readPng(file: string): Bitmap | null {
  let buf: Buffer;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return null;
  }
  return decodePng(buf);
}

/** 크기만 — 머리(IHDR)만 읽는다. PNG 가 아니면 null */
export function pngSize(file: string): { w: number; h: number } | null {
  try {
    const fd = fs.openSync(file, "r");
    const head = Buffer.alloc(24);
    fs.readSync(fd, head, 0, 24, 0);
    fs.closeSync(fd);
    if (head.subarray(0, 8).toString("hex") !== SIG) return null;
    return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
  } catch {
    return null;
  }
}

export function decodePng(buf: Buffer): Bitmap | null {
  if (buf.subarray(0, 8).toString("hex") !== SIG) return null;
  let at = 8;
  let w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (at + 8 <= buf.length) {
    const len = buf.readUInt32BE(at);
    const kind = buf.toString("ascii", at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (kind === "IHDR") {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      depth = body[8] as number;
      type = body[9] as number;
      interlace = body[12] as number;
    } else if (kind === "PLTE") palette = body;
    else if (kind === "tRNS") trns = body;
    else if (kind === "IDAT") idat.push(body);
    else if (kind === "IEND") break;
    at += 12 + len;
  }
  if (!w || !h || interlace) return null;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type as 0 | 2 | 3 | 4 | 6];
  if (!channels) return null;
  if (depth !== 8 && !(type === 3 && [1, 2, 4].includes(depth))) return null;
  if (type === 3 && !palette) return null;

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = Math.max(1, (channels * depth) >> 3); // 필터가 보는 바이트 거리
  const stride = Math.ceil((w * channels * depth) / 8);
  const rows = new Uint8Array(stride * h);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y += 1) {
    const f = raw[y * (stride + 1)] as number;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = rows.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? (out[i - bpp] as number) : 0;
      const b = prev[i] as number;
      const c = i >= bpp ? (prev[i - bpp] as number) : 0;
      const x = line[i] as number;
      let v = x;
      if (f === 1) v = x + a;
      else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else if (f !== 0) return null;
      out[i] = v & 255;
    }
    prev = out;
  }

  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const row = rows.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 4;
      if (type === 3) {
        const per = 8 / depth;
        const byte = row[Math.floor(x / per)] as number;
        const idx = depth === 8 ? byte : (byte >> (8 - depth * ((x % per) + 1))) & ((1 << depth) - 1);
        data[o] = palette![idx * 3] ?? 0;
        data[o + 1] = palette![idx * 3 + 1] ?? 0;
        data[o + 2] = palette![idx * 3 + 2] ?? 0;
        data[o + 3] = trns && idx < trns.length ? (trns[idx] as number) : 255;
      } else if (type === 6) {
        data.set(row.subarray(x * 4, x * 4 + 4), o);
      } else if (type === 2) {
        data.set(row.subarray(x * 3, x * 3 + 3), o);
        data[o + 3] = 255;
      } else if (type === 0) {
        data[o] = data[o + 1] = data[o + 2] = row[x] as number;
        data[o + 3] = 255;
      } else {
        data[o] = data[o + 1] = data[o + 2] = row[x * 2] as number;
        data[o + 3] = row[x * 2 + 1] as number;
      }
    }
  }
  return { w, h, data };
}
