// GameData 읽기 — `export const` 를 값으로.
//
// `survey.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `survey.ts` 에서 가져다 씁니다.

import fs from "fs";
import path from "path";
import ts from "typescript";
import type { AssetKind } from "./types";

// ─── GameData 읽기 ───────────────────────────────────────────────────────

// `export const quizData = { … }` 를 값으로 바꿔 옵니다.
//
// JSON.parse 로는 안 됩니다. 주석·홑따옴표·뒤따르는 쉼표가 섞여 있고
// `rotation: Math.PI / 180` 처럼 계산식으로 적힌 자리도 있습니다. 그래서
// TypeScript 파서에 그대로 맡깁니다. 식으로 적힌 자리는 계산하지 않고
// { __expr: "Math.PI / 180" } 로 남깁니다 — 나중에 사람이 봐야 할 자리입니다.
export function readGameData(activityDir: string): { root: string; data: unknown } | null {
  const ex = readExports(path.join(activityDir, "GameData.ts"));
  if (!ex) return null; // 애니메이션처럼 GameData 가 아예 없는 것이 있습니다.
  // 맨 앞엣것 하나면 됩니다 — **단 비어 있으면 다음 것** (2026-10-02). K36 완성본 5개가 `export const activityData = {};` 를
  // 먼저 두고 실제 값을 `quizData` 에 담았다. 앞엣것을 집어 스펙이 「자리 0개」로 떴고, 9호를 만들면 quizData 가 통째로 빠졌다.
  // 완성본 1586개 가운데 export 가 둘 이상인 15개를 재 보니 앞엣것이 빈 것은 그 5개뿐이다(`quizData, quizData2` · `baseAnyBlock, quizData` 는 그대로)
  const all = [...ex];
  const full = all.find(([, v]) => !isEmptyValue(v)) ?? all[0];
  return full ? { root: full[0], data: full[1] } : null;
}

const isEmptyValue = (v: unknown): boolean =>
  Array.isArray(v) ? v.length === 0 : !!v && typeof v === "object" && Object.keys(v).length === 0;

// 파일이 `export const …` 로 내놓는 것을 이름 → 값 으로 다 읽어 옵니다.
// GameData.ts 는 하나뿐이지만 AssetTable.ts 는 font·image·sound·lottie 넷입니다.
export function readExports(file: string): Map<string, unknown> | null {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const out = new Map<string, unknown>();
  for (const st of src.statements) {
    if (!ts.isVariableStatement(st)) continue;
    if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) {
      if (!d.initializer || !ts.isIdentifier(d.name)) continue;
      out.set(d.name.text, toValue(d.initializer, src));
    }
  }
  return out;
}

// 액티비티 하나가 쓰는 별칭이 어느 갈래인지. `{alias, src}` 목록에서 이름만 뽑습니다.
// 문자열 자리가 그냥 글자인지 리소스 별칭인지 가리는 데 씁니다.
// **한 이름이 여러 갈래일 수 있습니다.** AssetManager(그림)와 AudioManager
// (소리)가 서로 다른 목록이라, `hands` 를 이미지로도 소리로도 등록해 둔 회차가
// 많습니다 — ENL1M01W1S3 의 낱말 여섯이 다 그렇습니다. 갈래를 하나만 담아 두면
// 나중에 등록한 쪽이 앞을 덮어 「image 자리인데 sound 로 등록돼 있다」는 헛말이
// 납니다 (2026-09-03).
export function assetAliases(activityDir: string): Map<string, Set<AssetKind>> {
  const out = new Map<string, Set<AssetKind>>();
  const ex = readExports(path.join(activityDir, "AssetTable.ts"));
  if (!ex) return out;
  for (const kind of ["image", "sound", "lottie", "font"] as AssetKind[]) {
    const list = ex.get(kind);
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (isPlainObject(item) && typeof item["alias"] === "string") {
        const alias = item["alias"] as string;
        const set = out.get(alias) ?? new Set<AssetKind>();
        set.add(kind);
        out.set(alias, set);
      }
    }
  }
  return out;
}

function toValue(node: ts.Node, src: ts.SourceFile): unknown {
  if (ts.isObjectLiteralExpression(node)) {
    const obj: Record<string, unknown> = {};
    for (const p of node.properties) {
      if (!ts.isPropertyAssignment(p)) continue; // 단축·펼침 표기는 건너뜁니다
      const key =
        ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : p.name.getText(src);
      obj[key] = toValue(p.initializer, src);
    }
    return obj;
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((e) => toValue(e, src));
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  // -70 은 리터럴이 아니라 「빼기 + 70」 입니다. 좌표에 흔해서 따로 봅니다.
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) {
    if (node.operator === ts.SyntaxKind.MinusToken) return -Number(node.operand.text);
    if (node.operator === ts.SyntaxKind.PlusToken) return Number(node.operand.text);
  }
  if (ts.isParenthesizedExpression(node)) return toValue(node.expression, src);
  return { __expr: node.getText(src).replace(/\s+/g, " ").trim() };
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
