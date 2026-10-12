// 화면이 부르는 일 한 벌.
//
// **HTTP(`server.ts`)와 데스크톱 앱의 IPC 가 같은 함수를 부릅니다.** 전에는 이
// 로직이 `server.ts` 안에서 라우트와 섞여 있었습니다. 앱으로 옮기려면 같은 것을
// 한 벌 더 써야 했고, 입구가 두 벌이면 **한쪽만 고치는 날**이 옵니다 —
// `activityModules.ts` 가 정본을 못 박은 것과 같은 까닭입니다.
//
// **돌려주는 모양은 지금 서버가 내보내던 JSON 그대로입니다.** 화면
// (`ui/index.html`, 2965줄)을 한 줄도 고치지 않고 앱으로 옮기려고 그렇게
// 맞췄습니다. 모양을 바꾸려면 화면과 함께 바꿔야 합니다.
//
// **예외를 던지지 않습니다.** `{ ok: false, error }` 로 돌려주고, 화면은 그
// 글자를 그대로 띄웁니다. 던지면 「눌러도 아무 일이 없다」가 됩니다.

import { loadUser, saveUser, type DevUser } from "./user";
import { defaultRoot, openFolders, refFolders, type RefFolder } from "./open";
import { listFiles, prepareDir } from "./files";
import { pickRoot, type RootPick } from "./paths";
import { boardOf, moduleOrder, skippedOf } from "./layout";
// ── 진행판 ──────────────────────────────────────────────────────────

export function board(subject: string, issue: string) {
  const s = subject.toUpperCase();
  const i = issue.padStart(2, "0");
  return {
    ok: true as const,
    subject: s,
    issue: i,
    rows: boardOf(s, i),
    groups: moduleOrder(s, i),
    skipped: skippedOf(s, i),
  };
}

// 작업 폴더. **화면 맨 위에 늘 띄워 둡니다** — 「왜 내 액티비티가 안 보이지」가
// 한눈에 풀립니다. 서버는 여기에 stale 여부를 덧붙이고, 앱은 그러지 않습니다
// (번들이라 소스 시각을 볼 것이 없습니다).
export function workspace(): { cwd: string; root: RootPick } {
  const root = pickRoot();
  return { cwd: root.dir, root };
}

// ── 만드는 사람 ─────────────────────────────────────────────────────

export function user(): DevUser {
  return loadUser();
}

export function setUser(patch: Partial<DevUser>): DevUser {
  return saveUser(patch);
}

// ── 폴더 ────────────────────────────────────────────────────────────

// 전에 만든 액티비티의 리소스·소스 폴더를 탐색기로 엽니다.
// **여는 것뿐이고 고치지 않습니다** — 참고하려고 보는 자리입니다.
export function openRef(code: string): { ok: boolean; folders: RefFolder[]; error?: string } {
  const folders = refFolders(code, defaultRoot());
  if (!folders.length) return { ok: false, folders: [], error: "학습코드가 아닙니다." };
  openFolders(folders);
  return { ok: true, folders };
}

// 리소스 폴더에 실제로 놓인 파일 목록. 화면이 파일명을 「고르게」 해 줍니다.
export function files(code: string) {
  const listing = listFiles(code);
  if (!listing) return { ok: false as const, error: "학습코드가 아닙니다." };
  return { ok: true as const, ...listing };
}

// 리소스를 부어 넣을 빈 폴더를 먼저 만들고 탐색기로 엽니다.
export function resourceDir(code: string) {
  const dir = prepareDir(code);
  if (!dir) return { ok: false as const, error: "학습코드가 아닙니다." };
  openFolders([{ label: "리소스", dir, exists: true }]);
  return { ok: true as const, dir };
}


//
// **스펙 · 만들기 쪽은 떼어 냈습니다** (2026-09-30, 222줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   apifail        못 간 결과의 모양 — 던지지 않고 `{ ok: false, error }`
//   apispec        스펙 — 목록 · 한 장 · 초안 · 쓰기
//   apimake        배치표와 클론 · 만들기

export { type SpecSummary, specs, spec, modules, draft, writeSpec } from "./apispec";
export { layoutFor, clone, check, generate } from "./apimake";
