// 스펙 로드 + 학습코드 파싱 + figma 좌표 변환.

import fs from "fs";
import path from "path";
import { repoPath } from "./paths";
import type {
  AssetKind,
  FigmaPoint,
  Point,
  PointInput,
  Recipe,
  RecipeAsset,
  Spec,
} from "./types";

// 캔버스는 1920x1080, pivot 이 가운데(960,540) 입니다.
export const CANVAS = { w: 1920, h: 1080 };
export const ORIGIN = { x: CANVAS.w / 2, y: CANVAS.h / 2 };

export const SPEC_ROOT = repoPath("_spec");

export type StudyCode = {
  code: string;
  subject: "MA" | "KO" | "EN";
  level: number;
  month: number; // 코드상의 호 번호. 표시용 호와 다릅니다(85_양산.md 참고)
  week: number;
  session: number;
};

const CODE_RE = /^(MA|KO|EN)L([1-3])M(\d{2})W([1-4])S([1-3])$/;

// 사람은 `KO-L1-M06-W3-S1` 처럼 끊어서 적습니다. WBS 표에도 그렇게 적혀 있고
// 그대로 복사해 붙이게 됩니다. 글자와 숫자만 남기고 사이에 낀 것은 다 버립니다
// — 붙임표·밑줄·빈칸·마침표·빗금 (2026-09-01).
export function normalizeStudyCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function parseStudyCode(input: string): StudyCode | null {
  const code = normalizeStudyCode(input);
  const m = CODE_RE.exec(code);
  if (!m) return null;
  return {
    code,
    subject: m[1] as StudyCode["subject"],
    level: Number(m[2]),
    month: Number(m[3]),
    week: Number(m[4]),
    session: Number(m[5]),
  };
}

// 과목 폴더에 없으면 `_common` 을 봅니다.
// 애니메이션처럼 수학·영어가 같이 쓰는 것을 과목마다 복사하지 않으려는 것입니다.
export function specPath(subject: string, module: string): string {
  const own = path.join(SPEC_ROOT, subject, `${module}.json`);
  if (fs.existsSync(own)) return own;
  const shared = path.join(SPEC_ROOT, "_common", `${module}.json`);
  if (fs.existsSync(shared)) return shared;
  return own;
}

export function loadSpec(subject: string, module: string): Spec {
  const file = specPath(subject, module);
  if (!fs.existsSync(file)) {
    throw new Error(
      `스펙이 없습니다: ${file}\n` +
        `  ${module} 모듈의 스펙을 먼저 써야 합니다. 이미 있는 스펙: ${listSpecs(subject).join(", ") || "(없음)"}`,
    );
  }
  let spec: Spec;
  try {
    spec = JSON.parse(fs.readFileSync(file, "utf8")) as Spec;
  } catch (e) {
    throw new Error(`스펙 JSON 을 읽지 못했습니다: ${file}\n  ${(e as Error).message}`);
  }
  if (spec.module !== module) {
    throw new Error(`스펙의 module 이 파일명과 다릅니다: ${file} 안에는 ${spec.module}`);
  }
  return spec;
}

export function listSpecs(subject: string): string[] {
  const found = new Set<string>();
  for (const dir of [path.join(SPEC_ROOT, subject), path.join(SPEC_ROOT, "_common")]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".json")) found.add(f.slice(0, -5));
    }
  }
  return [...found].sort();
}

// 스펙의 defaults 와 레시피가 적은 것을 합칩니다.
// 같은 alias 면 레시피가 이깁니다 — 기본값은 어디까지나 기본값입니다.
export function effectiveAssets(
  spec: Spec,
  recipe: Recipe,
): Partial<Record<AssetKind, RecipeAsset[]>> {
  const kinds: AssetKind[] = ["font", "image", "sound", "lottie"];
  const out: Partial<Record<AssetKind, RecipeAsset[]>> = {};
  for (const kind of kinds) {
    const defaults = spec.assets.defaults?.[kind] ?? [];
    const given = recipe.assets?.[kind] ?? [];
    const byAlias = new Map<string, RecipeAsset>();
    for (const a of defaults) byAlias.set(a.alias, a);
    for (const a of given) byAlias.set(a.alias, a);
    if (byAlias.size > 0) out[kind] = [...byAlias.values()];
  }
  return out;
}

// WBS 가 M27_2 처럼 적어 둔 데이터 변형은 스펙이 따로 없습니다.
// 스펙의 aliases 를 뒤져 본체 모듈로 돌려줍니다.
export function resolveModule(subject: string, name: string): string {
  const direct = specPath(subject, name);
  if (fs.existsSync(direct)) return name;
  for (const candidate of listSpecs(subject)) {
    try {
      const spec = JSON.parse(
        fs.readFileSync(specPath(subject, candidate), "utf8"),
      ) as Spec;
      if (spec.aliases?.includes(name)) return candidate;
    } catch {
      // 깨진 스펙은 건너뜁니다. loadSpec 이 제대로 된 메시지를 냅니다.
    }
  }
  return name;
}

// ─── figma 좌표 ──────────────────────────────────────────────────────────

export function isFigmaPoint(v: unknown): v is FigmaPoint {
  return (
    typeof v === "object" &&
    v !== null &&
    "fx" in v &&
    "fy" in v &&
    "w" in v &&
    "h" in v
  );
}

export function isPoint(v: unknown): v is Point {
  return typeof v === "object" && v !== null && "x" in v && "y" in v;
}

// figma 는 좌상단 기준, 캔버스는 가운데 기준입니다.
//   x = fx + w * anchorX - 960
//   y = fy + h * anchorY - 540
// anchor 기본값은 0.5 — 스프라이트가 대부분 anchor.set(0.5) 입니다.
export function toCanvasPoint(v: PointInput, defaultAnchor?: Point): Point {
  if (!isFigmaPoint(v)) return { x: v.x, y: v.y };
  const ax = v.anchorX ?? defaultAnchor?.x ?? 0.5;
  const ay = v.anchorY ?? defaultAnchor?.y ?? 0.5;
  return {
    x: round(v.fx + v.w * ax - ORIGIN.x),
    y: round(v.fy + v.h * ay - ORIGIN.y),
  };
}

function round(n: number): number {
  // 소수점이 남으면 GameData 가 지저분해집니다. 반올림해서 정수로 둡니다.
  return Math.round(n * 100) / 100;
}
