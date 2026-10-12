// 재현 검사 — 값 견주기 · 레시피에 얹을 별칭.
//
// `checkRepro.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `checkRepro.ts` 에서 가져다 씁니다.

import { assetAliases } from "@/gen/survey";
import type { AssetKind, RecipeAsset } from "@/gen/types";

const EXT: Record<AssetKind, string> = {
  image: ".png",
  sound: ".mp3",
  lottie: ".json",
  font: ".woff",
};

// `check:spec` 과 같은 재료를 씁니다. 그 액티비티가 실제로 쓰는 별칭을 그대로
// 얹고, 파일 이름은 지어냅니다 — 별칭이 맞는지만 보면 되니까요.
export function assetsOf(dir: string): Partial<Record<AssetKind, RecipeAsset[]>> {
  const out: Partial<Record<AssetKind, RecipeAsset[]>> = {};
  // 한 이름이 그림이면서 소리일 수 있습니다 — 갈래마다 한 줄씩 넣습니다.
  for (const [alias, kinds] of assetAliases(dir)) {
    for (const kind of kinds)
      (out[kind] ??= []).push({ alias, file: alias + EXT[kind] });
  }
  return out;
}

// ─── 견주는 법 ───────────────────────────────────────────────────────────

// 글자. 줄끝(CRLF)과 줄 뒤 공백, 파일 끝 빈 줄만 맞춥니다.
// **따옴표와 들여쓰기는 맞추지 않습니다** — 그것까지 같아야 「같은 글자」입니다.
export function normText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "\n");
}

// 값. 두 가지를 **갈라서** 셉니다.
//
//   잃음·다름   원본에 있던 값이 사라지거나 바뀐 것.   **이것이 실패입니다**
//   더함        원본에 없던 자리를 뽑은 것이 채운 것.  실패가 아닙니다
//
// **더한 것은 대개 스펙이 적어 둔 기본값**입니다. 모듈이 안 적힌 자리를
// 어떤 값으로 치는지 스펙에 적어 뒀으면, 생성기가 그것을 글자로 남깁니다.
// 원본과 글자는 달라도 모듈이 읽는 값은 같습니다. 다만 **스펙에 적은 기본값이
// 모듈의 기본값과 다르면 그때는 진짜 사고**라, 세어서 눈에 띄게 둡니다.
export type Diff = { lost: string[]; added: string[] };

export function diffValue(
  a: unknown,
  b: unknown,
  at: string,
  out: Diff,
  limit = 6,
): void {
  if (out.lost.length >= limit) return;
  if (a === b) return;

  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr !== bArr) {
    out.lost.push(
      `${at} — 원본은 ${aArr ? "배열" : kindOf(a)}, 뽑은 것은 ${bArr ? "배열" : kindOf(b)}`,
    );
    return;
  }
  if (aArr && bArr) {
    if (a.length !== b.length) {
      out.lost.push(
        `${at} — 칸 수가 다릅니다 (원본 ${a.length} · 뽑은 것 ${b.length})`,
      );
      return;
    }
    for (let i = 0; i < a.length; i += 1)
      diffValue(a[i], b[i], `${at}[${i}]`, out, limit);
    return;
  }

  const aObj = isPlainObject(a);
  const bObj = isPlainObject(b);
  if (aObj && bObj) {
    for (const k of Object.keys(a)) {
      if (!(k in b)) {
        out.lost.push(`${at}.${k} — 뽑은 것에 없습니다`);
        if (out.lost.length >= limit) return;
        continue;
      }
      diffValue(a[k], b[k], `${at}.${k}`, out, limit);
    }
    for (const k of Object.keys(b)) {
      if (!(k in a)) out.added.push(`${at}.${k}=${show(b[k])}`);
    }
    return;
  }
  if (aObj !== bObj) {
    out.lost.push(`${at} — 원본은 ${kindOf(a)}, 뽑은 것은 ${kindOf(b)}`);
    return;
  }
  out.lost.push(`${at} — 원본 ${show(a)} · 뽑은 것 ${show(b)}`);
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function kindOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "배열";
  if (isPlainObject(v)) return "객체";
  return typeof v;
}

function show(v: unknown): string {
  const s = JSON.stringify(v);
  return s === undefined ? "없음" : s.length > 40 ? s.slice(0, 40) + "…" : s;
}

// **주석은 빼고 견줍니다.** 원본의 `Activity.ts` 는 사람이 쓴 것이라 손메모가
// 붙어 있습니다 — 실제로 첫 판에 `await M27.handle.finish(); // <- eop 여기에서호충`
// 하나 때문에 걸렸습니다. 생성기가 남의 메모를 되살릴 수는 없고, 그것이 없다고
// 액티비티가 달라지지도 않습니다. **코드가 같은지만 봅니다.**
//
// 따옴표 안의 `//` 는 건드리지 않으려고 **앞에 빈칸이 있는 것만** 자릅니다.
// import 경로(`@_common/sparkLib/…`)에는 ` //` 가 나오지 않습니다.
