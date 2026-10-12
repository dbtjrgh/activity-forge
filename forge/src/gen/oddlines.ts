// Activity.ts — 하나만 빠진 줄.
//
// `odd.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `odd.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import { type Sample } from "./survey";
import type { Odd } from "./odd";

// ─── Activity.ts — 하나만 빠진 줄 ────────────────────────────────────────
//
// 8호 ②가 여기였습니다. GameData 만 보면 못 찾습니다.
//
// **빠진 줄만 봅니다. 혼자만 있는 줄은 안 봅니다.** 남들에게 없는 줄은 대개
// 그 액티비티의 사정(추가 리소스·예외 처리)이라 짚어 봐야 다 헛말이 됩니다.
// 남들에게 다 있는 줄이 없는 것은 그렇지 않습니다.
export function oddLines(users: Sample[], min: number): Odd[] {
  const lines = new Map<string, Set<string>>(); // 액티비티 → 줄(빈칸 지운 열쇠)
  const shown = new Map<string, string>(); // 열쇠 → 사람이 볼 원래 줄
  const order: string[] = []; // 처음 본 차례. 파일에 적힌 차례대로 냅니다.
  const owners = new Map<string, string[]>(); // 줄 → 그 줄을 가진 액티비티

  for (const u of users) {
    let text: string;
    try {
      text = fs.readFileSync(path.join(u.dir, "Activity.ts"), "utf8");
    } catch {
      continue;
    }
    const set = new Set<string>();
    for (const line of meaningfulLines(text, u.code)) {
      // **적는 버릇의 차이는 열쇠에서 지웁니다.** 같은 코드인데 한쪽이
      // `for( const v` 로, 다른 쪽이 `for (const v` 로 적혀 있으면 다른 줄로
      // 세어, MA/M35 에서 포매터 차이 하나가 「빠진 줄 13개」로 나왔습니다.
      // 따옴표와 끝 세미콜론도 같습니다 — `from './GameData';` 는 저장소에
      // 네 가지 꼴로 적혀 있고(홑·겹 × 세미콜론 있고 없고) 어느 것이든
      // 같은 줄입니다. **글자를 지우는 것이 아니라 열쇠만 뭉갭니다** —
      // 화면에는 실제로 적힌 줄을 그대로 냅니다.
      const key = line.replace(/\s+/g, "").replace(/'/g, '"').replace(/;+$/, "");
      set.add(key);
      if (!shown.has(key)) shown.set(key, line);
    }
    lines.set(u.code, set);
    for (const key of set) {
      if (!owners.has(key)) {
        owners.set(key, []);
        order.push(key);
      }
      (owners.get(key) as string[]).push(u.code);
    }
  }

  const codes = [...lines.keys()];
  if (codes.length < min) return [];

  const out: Odd[] = [];
  for (const key of order) {
    const has = owners.get(key) as string[];
    if (has.length !== codes.length - 1) continue;
    const missing = codes.find((c) => !(lines.get(c) as Set<string>).has(key));
    if (!missing) continue;
    const cousin = kin(key, lines.get(missing) as Set<string>);
    out.push({
      where: "Activity.ts",
      kind: "빠짐",
      code: missing,
      what: shown.get(key) ?? key,
      ...(cousin ? { mine: shown.get(cousin) ?? cousin } : {}),
      otherCodes: has,
    });
  }
  return out;
}

// **없는 것과 다르게 적힌 것은 다른 말입니다.**
//
// KO/K12 의 KOL1M01W1S2 는 `this.K12.onLoad();` 가 없다고 나왔는데, 실은
// `await this.K12.onLoad();` 라고 적혀 있었습니다. 「없습니다」라고만 하면
// 보러 간 사람이 어리둥절합니다 — 있는데요. MA/M24 도 같습니다. 그쪽은
// `eop.show()` 대신 `eop.show(점수)` 였습니다.
//
// 그래서 빠졌다고 말하기 전에 **그 액티비티에 사촌 줄이 있는지** 봅니다.
// 앞뒤로 겹치는 만큼이 짧은 쪽의 6할 반을 넘으면 사촌으로 봅니다. 짚는 것을
// 없애지는 않습니다 — `await` 하나가 진짜로 문제인 자리가 있습니다.
//
// **짧은 줄은 사촌으로 삼지 않습니다.** 닫는 괄호 한 자만 있는 줄은 무엇과도
// 끝 글자가 겹쳐서, `this.K12.onAffordanceOn()` 의 사촌이 `)` 로 잡혔습니다.
function kin(key: string, mine: Set<string>): string | null {
  let best: string | null = null;
  let score = 0.65;
  for (const other of mine) {
    if (other.length < 10) continue;
    const s = overlap(key, other);
    if (s > score) {
      score = s;
      best = other;
    }
  }
  return best;
}

function overlap(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  if (n < 10) return 0;
  let head = 0;
  while (head < n && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < n - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
  return (head + tail) / n;
}

// 견줄 값이 되는 줄만 남깁니다.
//
// **블록 주석을 진짜로 걷어냅니다.** 두 줄 주석 표시로 시작하는 줄만 빼면
// 여러 줄 주석 안의 기획서 링크와 설명이 코드로 세어집니다 — EN/E07 의 네
// 액티비티가 주석 첫 줄에 원본 학습코드를 적어 둬서 「ENL3M01W1S1 에만
// ENL3M01W1S1 이 없다」가 났습니다.
//
// 학습코드가 박힌 줄(`mStudyCode`)도 뺍니다. 액티비티마다 다른 것이 당연해서
// 견줄 것이 못 됩니다.
function meaningfulLines(text: string, code: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = strip(raw, inBlock);
    inBlock = line.inBlock;
    const trimmed = line.text.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    if (trimmed.startsWith("//")) continue;
    if (trimmed.includes(code)) continue;
    out.push(trimmed);
  }
  return out;
}

// 한 줄에서 여러 줄 주석을 걷어냅니다. 한 줄 안에서 열고 닫는 것까지 봅니다.
// 문자열 안에 그 표시가 들어 있으면 잘못 가리지만, 견주는 데 쓰는 열쇠라
// **양쪽이 똑같이** 틀립니다 — 짚어 낼 것이 달라지지 않습니다.
function strip(raw: string, inBlock: boolean): { text: string; inBlock: boolean } {
  let text = "";
  let rest = raw;
  let open = inBlock;
  while (rest) {
    if (open) {
      const end = rest.indexOf("*/");
      if (end < 0) return { text, inBlock: true };
      rest = rest.slice(end + 2);
      open = false;
      continue;
    }
    const begin = rest.indexOf("/*");
    if (begin < 0) return { text: text + rest, inBlock: false };
    text += rest.slice(0, begin);
    rest = rest.slice(begin + 2);
    open = true;
  }
  return { text, inBlock: open };
}
