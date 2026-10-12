// GameData.ts 쓰기 — 트리를 글로 · 한 줄로 접기 · 주석.
//
// `render.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `render.ts` 에서 가져다 씁니다.

import type { Spec } from "./types";
import type { Entry, Node } from "./resolve";

const IND = "  ";

// ─── GameData.ts ─────────────────────────────────────────────────────────

export function renderGameData(spec: Spec, node: Node): string {
  if (spec.gameData.kind === "unused") {
    return [
      `// ${spec.module} — ${spec.title}`,
      `// 이 모듈은 GameData 를 쓰지 않습니다. 넣을 값은 AssetTable 쪽에 있습니다.`,
      ``,
      `export const ${spec.gameData.root} = [];`,
      ``,
    ].join("\n");
  }
  const seen = new Set<string>();
  const body = renderNode(node, 0, spec.gameData.root, seen);
  return [
    `// ${spec.module} — ${spec.title}`,
    `// 이 파일은 레시피에서 생성됐습니다. 이후 수정은 이 파일이 정본입니다.`,
    ``,
    `export const ${spec.gameData.root} = ${body};`,
    ``,
  ].join("\n");
}

// 같은 설명을 이닝마다 다섯 번 되풀이하면 읽을 수 없게 됩니다.
// 논리 경로(배열 인덱스를 뺀 경로)마다 처음 한 번만 답니다.
function renderNode(
  node: Node,
  depth: number,
  path: string,
  seen: Set<string>,
): string {
  const pad = IND.repeat(depth + 1);
  const close = IND.repeat(depth);

  if (node.kind === "raw") return node.js;

  if (node.kind === "array") {
    if (node.items.length === 0) return "[]";
    const inline = node.items.every(
      (i) => i.kind === "raw" && i.js.length < 24,
    );
    if (inline) {
      return `[${node.items.map((i) => (i as any).js).join(", ")}]`;
    }
    const lines = node.items.map((item) => {
      const one = inlineObject(item, `${path}[]`, seen);
      return `${pad}${one ?? renderNode(item, depth + 1, `${path}[]`, seen)},`;
    });
    return ["[", ...lines, `${close}]`].join("\n");
  }

  if (node.entries.length === 0) return "{}";

  const lines: string[] = [];
  node.entries.forEach((e, i) => {
    const childPath = `${path}.${e.key}`;
    if (i > 0 && shouldBlankLine(node.entries, i, depth)) lines.push("");
    for (const c of commentsFor(e, childPath, seen)) lines.push(`${pad}${c}`);
    // **속성 값도 작으면 한 줄로.** 완성본이 `wavePos: { x: 855, y: 27, … },`
    // 처럼 씁니다 — 배열 칸만 고치면 이쪽이 그대로 남습니다 (2026-09-17).
    const value =
      inlineObject(e.node, childPath, seen) ??
      renderNode(e.node, depth + 1, childPath, seen);
    const trailing =
      e.node.kind === "raw" && e.node.desc ? ` // ${e.node.desc}` : "";
    lines.push(`${pad}${propKey(e.key)}: ${value},${trailing}`);
  });
  return ["{", ...lines, `${close}}`].join("\n");
}

// 배열 칸의 **작은 객체는 한 줄로** 씁니다 — `{ x: 0, y: 0 },`.
//
// 사람이 쓴 완성본이 그렇게 되어 있습니다. 펴 쓰면 값은 똑같은데 줄이 세 배가
// 되고, 남의 저장소에 낯선 서식이 들어갑니다. 2026-09-17 에 76개를 재 보니
// **완성본에 없는 줄 10,874 가운데 좌표·크기만 2,055 줄**이었고 전부 이것이었습니다
// (`forge/src/tool/gamedata.ts`). `check:repro` 는 GameData 를 **값으로** 견주므로
// 서식이 바뀌어도 걸리지 않습니다.
//
// **설명이 아직 안 나온 칸은 그대로 펴 씁니다** — 설명을 잃지 않으려는 것입니다.
// 배열이면 첫 칸이 설명을 달고 나머지가 한 줄로 갑니다(「설명은 처음 한 번만」과
// 같은 규칙). 경고(`warn`)가 붙은 칸도 펴 씁니다 — 눈에 띄어야 합니다.
const INLINE_MAX = 60;

function inlineObject(node: Node, path: string, seen: Set<string>): string | null {
  if (node.kind !== "object" || node.entries.length === 0) return null;
  for (const e of node.entries) {
    if (e.node.kind !== "raw") return null;
    if (e.warn) return null;
    if (e.node.desc) return null; // 값 옆에 붙는 꼬리 설명도 잃지 않는다
    // 아직 한 번도 안 나온 설명이 있으면 펴서 그 설명을 단다.
    // 열쇠가 아니라 **논리 경로**로 본다 — `commentsFor` 와 같은 열쇠여야 한다.
    // **같은 글이 이미 나왔으면 다시 안 단다** — `commentsFor` 의 `글:` 을 보라.
    if (e.desc && !seen.has(`${path}.${e.key}`) && !seen.has(`글:${e.desc}`)) return null;
  }
  const body = node.entries
    .map((e) => `${propKey(e.key)}: ${(e.node as { js: string }).js}`)
    .join(", ");
  const one = `{ ${body} }`;
  return one.length <= INLINE_MAX ? one : null;
}

function commentsFor(e: Entry, path: string, seen: Set<string>): string[] {
  const out: string[] = [];
  if (e.warn) out.push(`// ⚠ ${e.warn}`);
  if (e.desc && !seen.has(path)) {
    seen.add(path);
    // **글로도 세어 둡니다.** 경로로만 세면 `자리 x.` 같은 짧은 설명이
    // 배열마다(`basePos`·`type1_2_examPos`·…) 되풀이됩니다 — 경로가 다르기
    // 때문입니다. 위 머리말의 「같은 설명을 되풀이하면 읽을 수 없다」가
    // 여기서 새고 있었습니다 (2026-09-17).
    seen.add(`글:${e.desc}`);
    for (const line of wrap(e.desc, 76)) out.push(`// ${line}`);
  }
  return out;
}

// 덩어리(객체·배열)가 시작되는 자리 앞은 한 줄 띄웁니다.
function shouldBlankLine(entries: Entry[], i: number, depth: number): boolean {
  if (depth > 2) return false;
  const cur = entries[i]!;
  const prev = entries[i - 1]!;
  return cur.node.kind !== "raw" || prev.node.kind !== "raw";
}

function propKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
