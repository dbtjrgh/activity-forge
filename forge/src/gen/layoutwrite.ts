// 배치표에 적기 — 사람이 정한 칸 한 자리 얹기 · 화면이 여는 빈 배치표.
//
// 2026-09-30 에 `layout.ts` 에서 옮김 — 1007줄이라. **동작 변화 없음.** 까닭 · 전체 그림은 `layout.ts` 머리말이 정본이고, 바깥은 여태처럼 `layout.ts` 에서 가져다 쓴다.

import fs from "fs";
import path from "path";
import { repoPath } from "./paths";

// 사람이 정한 차시를 배치표에 적어 둡니다 — **다음부터 안 묻는 자리**입니다.
//
// **까닭 없이는 안 받습니다.** `_layout` 파일 자신이 「정한 까닭을 why 에
// 남깁니다 — 나중에 「왜 이걸로 했지」를 다시 묻지 않으려는 것입니다」라고
// 적어 두었습니다. 화면에서 올리는 것도 같은 규칙을 따릅니다.
//
// **파일을 통째로 갈지 않습니다.** `skip`·`skipNote` 와 남이 적어 둔 다른
// 차시가 같은 파일에 있습니다. 그 자리만 얹습니다.
export function writeLayoutPick(
  subject: string,
  issue: string,
  slot: string,
  pick: { module: string; why: string; origin?: string },
): { ok: boolean; file: string; error?: string } {
  const file = repoPath("_layout", `${subject}${issue}.json`);
  if (!/^(MA|KO|EN)$/.test(subject)) return { ok: false, file, error: "과목이 이상합니다." };
  if (!/^\d\d$/.test(issue)) return { ok: false, file, error: "호가 이상합니다." };
  if (!/^L\dW\dS\d$/.test(slot)) return { ok: false, file, error: `칸 이름이 이상합니다: ${slot}` };
  if (!/^[A-Za-z0-9_+]+$/.test(pick.module)) {
    return { ok: false, file, error: `모듈 이름이 이상합니다: ${pick.module}` };
  }
  if (!pick.why.trim()) {
    return { ok: false, file, error: "왜 그 모듈인지를 적어야 배치표에 남깁니다." };
  }

  let doc: { slots?: Record<string, unknown> } & Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      doc = parsed as typeof doc;
    }
  } catch {
    // 파일이 없으면 새로 만듭니다 — 이 호에서 사람이 처음 정한 것입니다.
  }
  if (typeof doc.subject !== "string") doc.subject = subject;
  if (typeof doc.issue !== "string") doc.issue = issue;
  const slots = (doc.slots && typeof doc.slots === "object" ? doc.slots : {}) as Record<string, unknown>;
  slots[slot] = {
    module: pick.module,
    why: pick.why.trim(),
    ...(pick.origin ? { origin: pick.origin } : {}),
  };
  doc.slots = slots;

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
  } catch (e) {
    return { ok: false, file, error: (e as Error).message };
  }
  return { ok: true, file };
}

// **원본만 적기 · 지우기** (2026-09-30, 앱의 「원본 바꾸기」). 모듈은 건드리지 않는다 —
// 사람이 모듈까지 정한 칸이면 그 자리에 `origin` 만 얹고, 아니면 `originOnly` 칸을 새로 둔다(`layoutcore.ts` 가 모듈 판정에서 뺀다).
// **되돌리기(`origin: null`)는 작업대에서 바꾼 것만 원래대로** — `originOnly` 칸은 통째로 빼고, 모듈을 정한 칸은
// 사람이 파일에 적어 둔 원본(처음 바꿀 때 `originWas` 에 남긴 것)으로 돌린다. 파일에 적힌 원본을 지우지는 않는다.
// 줄 끝(CRLF · LF)은 파일 그대로 쓴다 — 바꾸면 내용이 같아도 배치표가 바뀐 것으로 뜬다.
// **후보인지는 여기서 안 본다** — 부르는 쪽이 `originChoices` 로 본다. 틀린 것이 적히면 `originFor` 가 멈추고 까닭을 말한다.
export function writeLayoutOrigin(
  subject: string,
  issue: string,
  slot: string,
  pick: { origin: string | null; why: string },
): { ok: boolean; file: string; error?: string } {
  const file = repoPath("_layout", `${subject}${issue}.json`);
  if (!/^(MA|KO|EN)$/.test(subject)) return { ok: false, file, error: "과목이 이상합니다." };
  if (!/^\d\d$/.test(issue)) return { ok: false, file, error: "호가 이상합니다." };
  if (!/^L\dW\dS\d$/.test(slot)) return { ok: false, file, error: `칸 이름이 이상합니다: ${slot}` };
  if (pick.origin !== null && !/^(MA|KO|EN)L\dM\d\dW\dS\d$/.test(pick.origin)) {
    return { ok: false, file, error: `학습코드가 이상합니다: ${pick.origin}` };
  }

  let doc: { slots?: Record<string, unknown> } & Record<string, unknown> = {};
  let nl = "\n";
  try {
    const raw = fs.readFileSync(file, "utf8");
    if (raw.includes("\r\n")) nl = "\r\n";
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) doc = parsed as typeof doc;
  } catch {
    if (pick.origin === null) return { ok: true, file }; // 되돌릴 것이 없다
  }
  if (typeof doc.subject !== "string") doc.subject = subject;
  if (typeof doc.issue !== "string") doc.issue = issue;
  const slots = (doc.slots && typeof doc.slots === "object" ? doc.slots : {}) as Record<string, Record<string, unknown>>;
  const at = slots[slot];
  const decided = !!at && typeof at.module === "string" && at.module !== "" && at.originOnly !== true;
  // 작업대에서 바꾼 적이 없으면 되돌릴 것이 없다 — 파일을 안 건드린다
  const changed = !!at && (at.originOnly === true || typeof at.originWhy === "string");
  if (pick.origin === null && !changed) return { ok: true, file };
  if (pick.origin === null) {
    if (decided) {
      if (typeof at.originWas === "string") at.origin = at.originWas;
      else delete at.origin;
      delete at.originWas;
      delete at.originWhy;
    } else delete slots[slot];
  } else if (decided) {
    // 사람이 파일에 적어 둔 원본은 처음 바꿀 때 한 번 남긴다 — 되돌리면 그리로 간다
    if (typeof at.origin === "string" && typeof at.originWhy !== "string" && at.originWas === undefined) {
      at.originWas = at.origin;
    }
    at.origin = pick.origin;
    at.originWhy = pick.why;
  } else {
    slots[slot] = { originOnly: true, origin: pick.origin, why: pick.why };
  }
  doc.slots = slots;

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2).split("\n").join(nl) + nl, "utf8");
  } catch (e) {
    return { ok: false, file, error: (e as Error).message };
  }
  return { ok: true, file };
}

// **호를 연다** — 빈 배치표 한 장 (2026-09-29, M7). 진행판은 `_layout` 에 파일이 있는 호만 띄운다.
// 작업 폴더에는 m09~m11 까지 더미 호가 있어 「가장 새 호」로는 못 고른다 — 그래서 사람이 한 번 누른다.
// 칸은 하나도 안 적는다. 적지 않은 칸은 여태처럼 기계 판정을 따르고, 갈린 칸만 묻는다.
// 이미 있으면 건드리지 않는다.
/** 화면이 연 배치표의 note — **이 글로 「앱이 연 빈 호」를 가린다**(닫기는 그것만, 앱 `board.ts`) */
export const OPENED_NOTE =
  "화면에서 연 호. 여기 적은 칸만 사람이 정한 것이고, 적지 않은 칸은 기계 판정(앞선 호 내력)을 따릅니다. 갈린 칸은 화면이 묻고, 고르면 까닭과 함께 여기 남습니다.";

export function openLayout(subject: string, issue: string): { ok: boolean; file: string; made: boolean; error?: string } {
  const file = repoPath("_layout", `${subject}${issue}.json`);
  if (!/^(MA|KO|EN)$/.test(subject)) return { ok: false, file, made: false, error: "과목이 이상합니다." };
  if (!/^\d\d$/.test(issue)) return { ok: false, file, made: false, error: "호가 이상합니다." };
  if (fs.existsSync(file)) return { ok: true, file, made: false };
  const doc = {
    subject,
    issue,
    note: OPENED_NOTE,
    slots: {},
  };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
  } catch (e) {
    return { ok: false, file, made: false, error: (e as Error).message };
  }
  return { ok: true, file, made: true };
}

