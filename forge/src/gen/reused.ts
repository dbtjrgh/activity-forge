// 다른 호의 파일을 그대로 다시 쓴 완성본인가 — 원본 후보에서 뒤로 미룬다 (2026-10-01, `layoutorigin.ts` 가 부른다).
//
// 9호 KOL1M08W2S2(K32Type2) 의 첫 후보가 6호(방학호) KOL1M11W2S2 였다. 6호는 3호 것을 **파일 79개 전부 바이트까지** 그대로 썼다.
// 그것을 원본으로 뜨자 앱이 「두 호가 똑같이 쓴 파일」로 보고 3호 애니메이션 · 내레이션을 9호 폴더에 가져왔다.
//
// **이름으로만 가르면 틀린다 — 잰 값이다.** 처음에는 「파일 이름의 학습코드가 남의 호인 것이 더 많으면」으로 갈랐더니 9호 97개 가운데
// 23개의 원본이 7 · 8호에서 1 · 2호로 밀렸다. 7 · 8호도 2호 이름을 그대로 물려 쓰는 일이 흔하다(내용은 새것). 바이트로 재 보니
// 갈림이 뚜렷했다 — KOL1M11W2S2 는 3호와 **100%**, 밀렸던 22개는 가장 많이 같은 호와도 6~79%(공용 파일만 같다).
// 그래서 ① 이름의 학습코드가 남의 호인 것이 더 많고 ② 그 호의 같은 칸 폴더와 **`SAME` 이상이 바이트까지 같을 때만** 다시 쓴 호다.
// 바이트 대조는 ①을 넘은 후보만, 그 한 호하고만 한다(원본 고르기는 판마다 돈다).

import fs from "node:fs";
import path from "node:path";
import { doneFile, fileOf, rscOfDone } from "./common";
import { parseStudyCode } from "./spec";

/** 파일 이름 앞의 학습코드 — `kol1m04w2s2_` · `Ko_L1_M03_W2_S2_` 의 M 번호 */
const HEAD = /^(?:ko|en|ma)_?l\d_?m(\d\d)_?w\d_?s\d_/i;
const SAME = 0.95;

const seen = new Map<string, boolean>();

function same(a: string, b: string): boolean {
  try {
    return fs.statSync(a).size === fs.statSync(b).size && fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

function judge(code: string): boolean {
  const s = parseStudyCode(code);
  if (!s) return false;
  const rels = [...new Set(fileOf(code).values())];
  // ① 이름에 붙은 학습코드 — 자기 호보다 남의 호가 많은가, 그중 제일 많은 호는
  let own = 0;
  const other = new Map<number, number>();
  for (const rel of rels) {
    const m = HEAD.exec(path.posix.basename(rel));
    if (!m) continue;
    const month = Number(m[1]);
    if (month === s.month) own += 1;
    else other.set(month, (other.get(month) ?? 0) + 1);
  }
  const top = [...other].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] <= own) return false;
  // ② 그 호의 같은 칸 폴더와 바이트까지 같은 파일이 SAME 이상인가
  const month = String(top[0]).padStart(2, "0");
  const twin = rscOfDone(`${s.subject}L${s.level}M${month}W${s.week}S${s.session}`);
  const mine = rscOfDone(code);
  if (!rels.length || !fs.existsSync(twin)) return false;
  const n = rels.filter((r) => same(doneFile(mine, r), doneFile(twin, r))).length;
  return n / rels.length >= SAME;
}

export function reusesOther(code: string): boolean {
  const hit = seen.get(code);
  if (hit !== undefined) return hit;
  const out = judge(code);
  seen.set(code, out);
  return out;
}
