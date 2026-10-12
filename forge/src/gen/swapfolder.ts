// 새 회차의 리소스 폴더 훑기 · 이름 무리로 묶기.
//
// 2026-09-30 에 `swap.ts` 에서 옮김 — 477줄이라. **동작 변화 없음.** 까닭 · 잰 값은 `swap.ts` 머리말.

import fs from "fs";
import path from "path";
import { rscDir, walk } from "./files";
import type { Swap } from "./swap";
import { stem } from "./swapnames";
// 새 회차의 리소스 폴더를 훑습니다. `readme.md` 는 빈 폴더를 git 에 남기려고
// 넣어 둔 것이라 리소스가 아닙니다.
export function readFolder(code: string): { dir: string; files: string[]; exists: boolean } {
  // **자리를 여기서 조립하지 않습니다.** 사람이 리소스 자리를 옮겨 둘 수 있어
  // (`.user.json` 의 `rscRoot`), 두 벌로 셈하면 화면과 맞추기가 다른 폴더를 봅니다.
  const dir = rscDir(code);
  if (!dir) return { dir: "", files: [], exists: false };
  if (!fs.existsSync(dir)) return { dir, files: [], exists: false };

  const files: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) {
      // **`_` 로 시작하는 폴더는 리소스가 아닙니다.** figma 화면 캡처(`_figma`)
      // 처럼 **판단에 쓰려고 넣어 두는 것**을 둘 자리입니다. 안 걸러 내면
      // 「폴더에 남은 파일」로 세어져 자리 후보로 나오고, 스크린샷을 액티비티
      // 리소스로 고르게 됩니다 (2026-09-15).
      if (entry.startsWith("_")) continue;
      // **한 겹만 들어가면 안 됩니다** (2026-09-21). 여기서 `fs.readdirSync(p)` 로
      // 한 겹만 읽고 있었는데, 소리는 **두 겹**입니다 —
      // `sounds/narration/SL_ma_com_nar01.mp3`. 그래서 맞추기에 올라간 소리
      // 후보가 `sounds/bgm`·`sounds/narration`·`sounds/sfx` **폴더 이름 셋뿐**이었고,
      // 소리 자리는 **고를 것이 하나도 없는 채로** 「못 맞춤」이 됐습니다.
      // `MAL2M07W2S1` 에서 87자리 중 16자리만 맞은 까닭이 이것이고, AI 에게
      // 물었을 때도 「폴더의 실제 파일 목록을 볼 수 없다」는 답이 스물아홉 번 왔습니다.
      // **`files.ts` 의 `walk` 와 같은 눈으로 봅니다** — 그쪽 주석이 이미
      // 「`swap` 의 `spare` 는 이 꼴로 온다」고 적어 두고 있었는데 실제로는 아니었습니다.
      for (const f of walk(dir, entry)) if (!f.endsWith("readme.md")) files.push(f);
    } else if (entry !== "readme.md") {
      files.push(entry);
    }
  }
  return { dir, files, exists: true };
}

// ─── 무리 ────────────────────────────────────────────────────────────────

// 못 맞은 것을 하나씩 늘어놓으면 예순 줄이 됩니다. 실제로는 **무리를 지어**
// 있습니다 — `SL_ma_108_s2_nar02~29` 스물여덟 개가 `SL_ma_125_s3_nar03~12` 열
// 개로 바뀐 것이지, 예순 가지 문제가 아닙니다.
//
// 무리 열쇠는 **숫자 뭉치를 `#` 로** 바꾼 이름입니다. 그러면 회차 번호도 낱개
// 번호도 함께 지워져 `sounds/sl_ma_#_s#_nar#.mp3` 하나로 모입니다.
// 확장자는 가리지 않습니다 — `.mp3` 가 `.mp#` 로 나오면 읽기만 나빠집니다.
export function familyOf(rel: string): string {
  const ext = /\.[a-z0-9]+$/i.exec(rel)?.[0] ?? "";
  return stem(rel).toLowerCase().replace(/\d+/g, "#") + ext.toLowerCase();
}

export type FamilyRow = { family: string; origin: number; folder: number };

export function families(swap: Swap): FamilyRow[] {
  const origin = new Map<string, number>();
  const folder = new Map<string, number>();
  for (const m of swap.misses) origin.set(familyOf(m.file), (origin.get(familyOf(m.file)) ?? 0) + 1);
  for (const f of swap.spare) folder.set(familyOf(f), (folder.get(familyOf(f)) ?? 0) + 1);

  const keys = new Set([...origin.keys(), ...folder.keys()]);
  return [...keys]
    .map((family) => ({ family, origin: origin.get(family) ?? 0, folder: folder.get(family) ?? 0 }))
    .sort((a, b) => b.origin + b.folder - (a.origin + a.folder) || a.family.localeCompare(b.family));
}

