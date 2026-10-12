/**
 * **좌표 자리를 센다** — 상자 칸이 어디 있고, 그 칸에 어느 그림이 뜨고, 몇 이닝인가 (2026-09-29, M6 에 `placefind.ts` 에서 옮김).
 *
 * 찾기(`placefind.ts`)와 비교 캔버스(앱 `overlay.ts`)가 **같은 셈을** 쓴다. 따로 세면 캔버스가 찾기와 다른 그림을
 * 그 자리에 그린다. 파일을 안 읽는다 — 이름만 짓는다.
 */

import path from "node:path";
import type { FileTable } from "./types";

export type Box = { x: number; y: number; width: number; height: number };

export const isBox = (v: unknown): v is Box =>
  !!v && typeof v === "object" && ["x", "y", "width", "height"].every((k) => typeof (v as Record<string, unknown>)[k] === "number");

export const get = (root: unknown, dotted: string): unknown =>
  dotted.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), root);


/** 이닝 표 밖의 상자 자리 — **키가 곧 별칭이다** */
export function plainBoxes(gameData: unknown, tables: FileTable[]): { at: string; key: string }[] {
  const tableAt = new Set(tables.map((t) => t.table));
  const out: { at: string; key: string }[] = [];
  const walk = (v: unknown, at: string[]): void => {
    if (!v || typeof v !== "object") return;
    if (tableAt.has(at.join("."))) return;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (isBox(x)) out.push({ at: [...at, k].join("."), key: k });
      else walk(x, [...at, k]);
    }
  };
  walk(gameData, []);
  return out;
}

/** 이닝 표의 칸 — i 이닝 · s 번째 칸 · 그 칸에 뜨는 그림 번호 n(`shows`) · 그 그림 파일 */
export function tableCells(gameData: unknown, rscDir: string, tb: FileTable): { at: string; key: string; i: number; s: number; n: number; file: string }[] {
  const table = get(gameData, tb.table);
  if (!table || typeof table !== "object") return [];
  const shows = tb.shows ? get(gameData, tb.shows) : null;
  const inner = new RegExp(`^${tb.inner.replace("{j}", "(\\d+)")}$`);
  const outer = new RegExp(`^${tb.outer.replace("{i}", "(\\d+)")}$`);
  const out: { at: string; key: string; i: number; s: number; n: number; file: string }[] = [];
  for (const [ok, row] of Object.entries(table as Record<string, unknown>)) {
    const i = Number(outer.exec(ok)?.[1] ?? NaN);
    if (!Number.isFinite(i) || !row || typeof row !== "object") continue;
    for (const ik of Object.keys(row as Record<string, unknown>)) {
      const s = Number(inner.exec(ik)?.[1] ?? NaN);
      if (!Number.isFinite(s)) continue;
      const pick = Array.isArray(shows) ? (shows[i] as unknown[] | undefined)?.[s] : s;
      const n = typeof pick === "number" ? pick : s;
      const file = path.join(rscDir, tb.file.replace("{i}", String(i)).replace("{j}", String(n)));
      out.push({ at: `${tb.table}.${ok}.${ik}`, key: ik, i, s, n, file });
    }
  }
  return out;
}

/**
 * **상자 자리 전부 — 그 자리의 그림 파일과 이닝** (2026-09-29, M6). 비교 캔버스(앱 `overlay.ts`)가 채워 그릴 그림을
 * 찾기(`findPlaces`)와 **같은 셈으로** 고른다 — 따로 세면 캔버스가 찾기와 다른 그림을 그 자리에 그린다.
 */
export function boxSpots(inp: { gameData: unknown; imageOf: (alias: string) => string | null; rscDir: string; tables: FileTable[] }): { at: string; key: string; file: string | null; inning: number | null }[] {
  return [
    ...plainBoxes(inp.gameData, inp.tables).map((p) => ({ at: p.at, key: p.key, file: inp.imageOf(p.key), inning: null })),
    ...inp.tables.flatMap((tb) => tableCells(inp.gameData, inp.rscDir, tb).map((c) => ({ at: c.at, key: c.key, file: c.file, inning: c.i }))),
  ];
}

