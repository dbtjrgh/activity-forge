// 초안 입구 — 표본을 모아 자리 목록을 짓는다 (`draftSpec`).
//
// `draft.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `draft.ts` 에서 가져다 씁니다.

import path from "path";
import type { Spec, SpecField } from "./types";
import { findUsers, moduleDir, type Sample } from "./survey";
import { arrayShape, withDesc } from "./draftshape";
import { type AssetIndex, assetIndex, scalarType, shapeOf, isExpr, isPlainObject, isPoint, isEmptyish } from "./drafttype";
import { codegenOf } from "./draftcodegen";

export type Draft = { spec: Spec; samples: Sample[]; arrayRoot: boolean };

export function draftSpec(subject: string, module: string): Draft {
  const samples = findUsers(subject, module).filter((s) => !s.note);
  if (!samples.length)
    throw new Error(`${subject}/${module} 을 쓰는 액티비티가 없습니다.`);

  const assets = assetIndex(samples);
  const roots = samples.map((s) => s.data);
  const rootName = samples[0]?.root ?? "quizData";

  // 뿌리가 객체가 아니라 배열인 모듈이 여덟 종 있습니다(M30·InterBook 등).
  // 그중 늘 빈 배열인 것은 애니메이션처럼 넣을 값이 없다는 뜻이라 kind:"unused"
  // 로 적으면 그만입니다. 값이 든 배열은 생성기가 아직 못 다룹니다 — 초안을
  // 내주되 파일로는 못 남기게 막습니다. 못 쓰는 스펙을 spec/ 에 두면 나중에
  // 화면에 칸이 안 나오는 까닭을 찾느라 헤매게 됩니다 (2026-09-01).
  const rootIsArray = roots.every((r) => Array.isArray(r));
  const items = rootIsArray ? (roots as unknown[][]).flat() : [];
  const arrayRoot = rootIsArray && items.length > 0;

  const spec: Spec = {
    specVersion: 1,
    module,
    subject,
    title: "",
    summary: "",
    reference: {
      module: relFromWork(moduleDir(subject, module)),
      activities: samples.slice(0, 5).map((s) => s.code),
    },
    codegen: codegenOf(samples),
    assets: { required: [] },
    gameData:
      rootIsArray && !arrayRoot
        ? { root: rootName, kind: "unused", fields: [] }
        : {
            root: rootName,
            fields: arrayRoot
              ? fieldsOf(items, items.length, "[]", assets)
              : fieldsOf(roots, roots.length, "", assets),
          },
  };
  return { spec, samples, arrayRoot };
}

// ─── 자리 만들기 ─────────────────────────────────────────────────────────

// 표본마다 그 자리에 있던 값들을 모아 놓고 스펙 한 줄을 짓습니다.
//
// `_total` 은 **아직 안 쓰는 자리**입니다. 표본 수를 받아 두면
// 「values 가 total 과 다르면 그 자리는 선택(optional)」을 여기서 판정할 수
// 있습니다 — 지금은 그 판정을 하지 않습니다. 넘기는 쪽은 이미 세고 있으니
// 매개변수를 지우지 않고 `_` 를 붙여 둡니다.
export function fieldsOf(
  objects: unknown[],
  _total: number,
  at: string,
  assets: AssetIndex,
): SpecField[] {
  const rows = objects.filter(isPlainObject);
  const keys: string[] = [];
  for (const o of rows)
    for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k);

  return keys.map((k) => {
    const has = rows.filter((o) => k in o);
    return describe(
      k,
      has.map((o) => o[k]),
      has.length,
      rows.length,
      join(at, k),
      assets,
    );
  });
}

function describe(
  key: string,
  values: unknown[],
  seen: number,
  total: number,
  at: string,
  assets: AssetIndex,
): SpecField {
  const f: SpecField = { key, type: "string" };
  // 「모든 표본에 있다」와 「모든 표본이 값을 채웠다」는 다릅니다. `bg: ""` 처럼
  // 자리만 잡아 둔 것이 흔한데, 이걸 필수로 적으면 원본 액티비티조차 검사를
  // 통과 못 합니다. 빈 값이 하나라도 있으면 선택으로 둡니다 (2026-09-01).
  if (seen < total || values.some(isEmptyish)) f.optional = true;
  else f.required = true;

  // **식과 `null` 은 타입 투표에서 뺍니다.**
  //
  // 표본 20개 중 하나가 `y: 187.91 +20` 이면 그 자리는 숫자가 아니게 됩니다.
  // 스펙에 `string` 으로 적히고, 식을 안 쓴 나머지 19개까지 따옴표를
  // 뒤집어씁니다. 식은 **값이 아니라 코드**라, 그 자리가 무엇을 담는
  // 자리인지는 옆의 진짜 값들이 말해 줍니다 (2026-09-02).
  //
  // `null` 은 「이 칸은 비었다」는 뜻이지 다른 갈래가 아닙니다. ExploreMakeLv2 의
  // `filmIcon` 이 스무 자리 중 한 자리만 `null` 인데, 그것 때문에 나머지가
  // 그림 별칭 자리로 안 잡혔습니다. 빼고 세면 제대로 잡히고, `resolve.ts` 가
  // 그 한 자리를 `null` 로 그대로 씁니다.
  //
  // 다 식이거나 다 `null` 이면 뺄 것이 없습니다. 그때는 예전대로 둡니다 — 어차피
  // `resolve.ts` 가 검사하지 않고 그대로 내보냅니다.
  const literal = values.filter((v) => !isExpr(v) && v !== null);
  const vote = literal.length > 0 ? literal : values;

  // **모양이 하나가 아니면 짐작을 그만둡니다.**
  //
  // ShowcaseQuiz 의 `lottie` 가 표본에 따라 `'별칭'` 이기도
  // `{ alias, scale, x, y }` 이기도 합니다. 모듈이 둘 다 받는 자리인데, 스펙은
  // 갈래를 하나만 적을 수 있습니다. 억지로 하나를 고르면 **다른 쪽을 쓴
  // 액티비티가 통째로 망가집니다** — 예전에는 `string` 을 골라 객체를 글자로
  // 만들었습니다 (2026-09-02).
  //
  // 배열도 같은 표시를 씁니다. 거기서는 `of` 를 안 적는 것이 「칸마다 그대로」
  // 라는 뜻이고, 여기서는 통째로 그대로라는 뜻입니다.
  if (new Set(vote.map(shapeOf)).size > 1) {
    f.mixed = true;
    return withDesc(f, at, values, seen, total);
  }

  // 배열. 칸 수가 표본마다 다르면 최소 칸 수를 적어 둡니다.
  if (vote.every(Array.isArray)) {
    Object.assign(f, arrayShape(vote as unknown[][], at, assets));
    return withDesc(f, at, values, seen, total);
  }

  // 좌표. {x, y} 두 칸짜리 객체는 쪼개지 않습니다.
  if (vote.every(isPoint)) {
    f.type = "point";
    f.figma = true;
    return withDesc(f, at, values, seen, total);
  }

  // 객체. 「몇 개일 때 어디」 표인지부터 봅니다(M27 의 answerData.pos).
  if (vote.every((v) => isPlainObject(v) && !("__expr" in v))) {
    const objs = vote as Record<string, unknown>[];
    const allKeys = [...new Set(objs.flatMap((o) => Object.keys(o)))];
    // 키가 숫자인 것만으로는 모자랍니다. M01 의 animation.endingAni 도 키가
    // 1·2·3 이지만 값이 {x,y,width,height} 라 좌표표가 아닙니다 — 그걸 posTable
    // 로 적었더니 「좌표 배열이어야 합니다」로 검사에서 걸렸습니다. 값까지 봅니다:
    // 좌표를 담은 **배열**이어야 좌표표입니다 (2026-09-01).
    // 게다가 **키 숫자와 좌표 개수가 맞아야** 합니다. 「선지가 2개일 때 놓을 자리 2군데」
    // 라는 뜻이니까요. M15 의 dotPos 는 {1:[좌표 3개]} 라 이 뜻이 아닙니다.
    const numeric = allKeys.length > 0 && allKeys.every((k) => /^\d+$/.test(k));
    const posLists = objs.every((o) =>
      Object.entries(o).every(
        ([k, v]) =>
          Array.isArray(v) && v.length === Number(k) && v.every(isPoint),
      ),
    );
    if (numeric && posLists) {
      f.type = "posTable";
      return withDesc(f, at, values, seen, total);
    }
    f.type = "object";
    f.fields = fieldsOf(objs, objs.length, at, assets);
    return withDesc(f, at, values, seen, total);
  }

  f.type = scalarType(vote, at, assets);
  if (f.type === "enum") {
    f.type = "enum";
    f.values = [...new Set(vote.map(String))].sort();
  }
  return withDesc(f, at, values, seen, total);
}

function join(at: string, key: string): string {
  return at ? at + "." + key : key;
}

function relFromWork(p: string): string {
  return p.split(path.sep).slice(-5).join("/");
}
