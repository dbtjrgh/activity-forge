// 이슈 적기와 값 꼴 보기 — err · warn · 겹친 이슈 거르기 · 타입 이름 · 좌표 글자.
//
// 2026-09-30 에 `resolve.ts` 에서 옮김 — 960줄이라. **동작 변화 없음.** 입구(`resolveGameData`)와 전체 그림은 `resolve.ts`.

import type { Issue } from "./types";
import type { Ctx } from "./resolve";

export function atPath(root: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (cur, key) => (cur && typeof cur === "object" ? (cur as Record<string, unknown>)[key] : undefined),
    root,
  );
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function err(ctx: Ctx, rule: string, path: string, message: string, why?: string): void {
  ctx.issues.push({ level: "error", rule, path, message, ...(why ? { why } : {}) });
}

export function warn(ctx: Ctx, rule: string, path: string, message: string, why?: string): void {
  ctx.issues.push({ level: "warn", rule, path, message, ...(why ? { why } : {}) });
}

// 같은 자리에 같은 등급의 문제가 두 번 잡히는 일이 있습니다 —
// 예를 들어 빈 `ani.idle` 은 「필수인데 비었다」와 「ani 방식인데 비었다」에
// 모두 걸립니다. 사람에게는 한 줄이면 됩니다. 나중 것(더 구체적인 쪽)을 남깁니다.
// **규칙 이름까지 열쇠에 넣습니다** (2026-09-21). 전에는 `level|path` 만 봤는데,
// 「자동 검사가 없는 규칙」 경고는 **전부 path 가 `(규칙)`** 이라 한 칸에 차례로
// 덮어써져 **마지막 하나만 남았습니다.** M05 는 규칙이 아홉인데 화면에 하나만
// 떴고, 그중에는 `answer-table-shape`(이닝 수와 정답표 칸 수가 어긋나면 뒤쪽
// 이닝이 무조건 오답) 도 있었습니다. 사람이 봐야 할 것을 도구가 삼킨 셈입니다.
// 손으로 완성본과 견주지 않았으면 못 찾았습니다.
export function dedupe(issues: Issue[]): Issue[] {
  const byKey = new Map<string, Issue>();
  for (const i of issues) byKey.set(`${i.level}|${i.rule}|${i.path}`, i);
  return [...byKey.values()];
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function typeName(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "없음";
  if (Array.isArray(v)) return "배열";
  return typeof v;
}


// 좌표 한 짝을 글자로. **식이 오면 그대로 씁니다.**
//
// M26 의 `pos: { x: -1920/2, y: 1080/2 }` 처럼 좌표를 계산식으로 적어 둔 것이
// 있습니다. `toCanvasPoint` 는 figma 값이 아니면 손대지 않고 넘기므로 여기까지
// `{ __expr: "-1920/2" }` 인 채로 옵니다. 예전에는 이것을 `\undefined` 에 그냥 넣어
// **`{ x: [object Object] }` 를 뱉었습니다** — 타입이 어긋난 정도가 아니라
// 깨진 JS 입니다 (2026-09-02).
export function coord(v: unknown): string {
  return isExpr(v) ? v.__expr : String(v);
}

// `survey.ts` 가 값 대신 코드를 만났을 때 남기는 표시.
export function isExpr(v: unknown): v is { __expr: string } {
  return typeof v === "object" && v !== null && typeof (v as { __expr?: unknown }).__expr === "string";
}
