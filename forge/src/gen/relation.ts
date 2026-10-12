// 값의 **관계**. 스펙에 글이 아니라 **자료로** 적고, 여기서 그대로 검사합니다.
//
// **왜 필요한가.** 지금 스펙은 자리의 **모양**만 적습니다 — `popup: number`.
// 8호 ①은 그 모양을 다 지켰습니다. `popup` 이 전부 `0` 이었을 뿐입니다.
// 타입이 맞으니 `check:spec` 도 `check:repro` 도 초록이었고, 이닝이 넘어가도
// 같은 팝업이 떴습니다. **모양으로는 못 잡는 갈래입니다.**
//
// `rules` 와 무엇이 다른가 — `rules` 는 이름만 스펙에 적고 **몸통은
// `resolve.ts` 에 손으로 씁니다**(`RULES` 표). 모듈마다 TypeScript 를 한 벌씩
// 더하는 셈이라 119장으로 늘릴 수가 없습니다. 관계는 **스펙 JSON 안에서
// 끝납니다.** 새 모듈에 관계를 붙이는 데 코드를 고칠 일이 없습니다.
//
// **경고가 아니라 막습니다** (기본 level: error). `popup: 0` 은 타입이 맞아서
// 경고로 두면 또 지나갑니다 — 8호에서 실제로 지나갔습니다.
//
// ─── 갈래를 둘만 둔 까닭 ─────────────────────────────────────────────────
//
// M28 표본 15개에 후보 다섯을 실제로 재 봤습니다 (2026-09-14).
//
//   ① 이닝마다 번호가 올라간다      15개 다 지킴 · 8호 버그 잡음   ← ascends
//   ② 목록에 안 쓰이는 칸이 없다    15개 다 지킴 · 8호 버그 잡음   ← covers
//   ③ 번호가 정답마다 하나씩         MAL2M06W1S2 가 어김
//   ④ 칸 수 = 정답 총 개수           MAL2M06W1S2 가 어김
//   ⑤ 한 이닝 안에서 오름차순        MAL1M02W4S2 가 어김
//
// **③④⑤ 는 안 넣습니다.** 지금 잘 도는 액티비티를 막습니다 — `MAL2M06W1S2`
// 는 한 이닝의 정답 둘이 같은 팝업을 가리키고(정상), `MAL1M02W4S2` 는 한 이닝
// 안의 차례가 `0,2,1` 입니다(정상). **막는 검사는 표본 전부를 통과해야만
// 넣습니다** — 하나라도 걸리면 그것은 규칙이 아니라 우연입니다.
//
// 계획서가 적어 둔 나머지 두 갈래(「짝이 있다」·「개수를 따라간다」)는 M28 에
// 해당하는 자리가 없어 **아직 안 만들었습니다.** 재 보지 않은 관계를 미리
// 설계하면 실제와 어긋납니다 — 「개수를 따라간다」는 `tool/_inning.ts` 가
// 2026-09-02 에 재 보고 **226자리 중 믿을 만한 것이 4자리뿐**이라고 답했습니다.

import type { AssetKind, Issue, SpecRelation } from "./types";
import { idle, IDLE_HEAD, scopesOf, select } from "./relpath";
import { runValueKind, VALUE_KINDS } from "./relkinds";

export function runRelations(
  relations: SpecRelation[] | undefined,
  root: unknown,
  rootName: string,
  // 이 액티비티가 쓸 수 있는 alias. `isAlias` 만 봅니다 — 안 주면 그 갈래는
  // 「검사가 안 돌았다」고 알립니다(조용히 초록이 되지 않게).
  aliases?: Map<string, Set<AssetKind>>,
): Issue[] {
  const issues: Issue[] = [];
  for (const rel of relations ?? []) {
    const level = rel.level ?? "error";
    const add = (path: string, message: string): void => {
      issues.push({ level, rule: rel.id, path, message, ...(rel.why ? { why: rel.why } : {}) });
    };
    // 검사가 안 돌았다는 말은 관계를 어겼다는 말과 다릅니다. 늘 warn 입니다.
    const note = (message: string): void => {
      issues.push({ level: "warn", rule: rel.id, path: "(관계)", message });
    };
    if (rel.kind === "ascends") ascends(rel, root, rootName, add, note);
    else if (rel.kind === "covers") covers(rel, root, rootName, add, note);
    else if (VALUE_KINDS.has(rel.kind)) {
      // 값 갈래는 `each`·`when` 으로 **볼 자리를 먼저 좁힌다** (`relpath.ts`).
      const units = scopesOf(rel, root, rootName);
      if (!units) {
        idle(rel.id, rel.each ?? "", note);
        continue;
      }
      // 칸마다 돌면 「안 돌았다」가 칸 수만큼 쌓인다. **모든 칸이 안 돌았을 때만** 한 번 낸다.
      let idled = 0;
      let firstIdle = "";
      for (const u of units) {
        let mine = false;
        runValueKind(rel, u.value, u.path, aliases, add, (m) => {
          if (m.startsWith(IDLE_HEAD)) {
            mine = true;
            firstIdle ||= m;
          } else note(m);
        });
        if (mine) idled += 1;
      }
      if (units.length && idled === units.length) note(firstIdle);
    } else {
      // 모르는 갈래를 조용히 넘기지 않습니다. 스펙에 적힌 검사가 안 돌았다는
      // 것은 **사람이 알아야 하는 일**입니다 (`rules` 의 미구현 처리와 같습니다).
      issues.push({
        level: "warn",
        rule: (rel as SpecRelation).id,
        path: "(관계)",
        message: `모르는 관계 갈래입니다: ${(rel as { kind?: string }).kind}`,
      });
    }
  }
  return issues;
}

// ─── ① 차례를 따라간다 ───────────────────────────────────────────────────
//
// `group` 이 가리키는 배열을 차례대로 걸으면서, 칸마다 `pick` 으로 모은 수가
// **앞 칸까지의 최댓값보다 커야** 합니다.
//
// 8호 ①이 이것입니다 — 이닝 셋의 `popup` 이 전부 0이라 두 번째 이닝에서 걸립니다.
function ascends(
  rel: Extract<SpecRelation, { kind: "ascends" }>,
  root: unknown,
  rootName: string,
  add: (path: string, message: string) => void,
  note: (message: string) => void,
): void {
  const label = rel.label ?? "칸";
  let prev: number | null = null; // 앞 칸까지 쓴 제일 큰 수
  let prevAt = 0;
  let looked = 0; // 정말 견줘 본 값이 있었나

  const groups = select(root, rel.group, rootName);
  if (!groups.length) return idle(rel.id, rel.group, note);

  groups.forEach((group, i) => {
    const hits = select(group.value, rel.pick, group.path).filter((h) => {
      if (typeof h.value === "number") return true;
      // 수가 아니면 견줄 수가 없습니다. 모양 검사가 따로 잡으므로 여기서는
      // 건너뛰되, 못 봤다는 것을 숨기지 않습니다.
      add(h.path, `수가 아니라 견주지 못했습니다: ${JSON.stringify(h.value)}`);
      return false;
    });
    if (!hits.length) return; // 그 칸에 해당하는 값이 없으면 차례를 건너뜁니다.
    looked += hits.length;

    const low = hits.reduce((a, b) => ((a.value as number) <= (b.value as number) ? a : b));
    if (prev !== null && (low.value as number) <= prev) {
      add(
        low.path,
        `${label} ${i} 의 값이 ${low.value} 입니다. ` +
          `${label} ${prevAt} 까지 ${prev} 을 썼으므로 ${prev + 1} 이상이어야 합니다.`,
      );
    }
    const high = hits.reduce((a, b) => ((a.value as number) >= (b.value as number) ? a : b))
      .value as number;
    if (prev === null || high > prev) {
      prev = high;
      prevAt = i;
    }
  });

  if (!looked) idle(rel.id, rel.pick, note);
}

// ─── ② 목록을 남김없이 쓴다 ──────────────────────────────────────────────
//
// `list` 배열의 칸을 `pick` 이 모은 번호가 다 가리켜야 합니다. 안 쓰이는 칸이
// 있다는 것은 대개 **가리키는 쪽이 틀렸다**는 뜻입니다 — 8호 MAL1M07W1S3 은
// 팝업 넉 장을 만들어 두고 전부 0번만 가리키고 있었습니다.
function covers(
  rel: Extract<SpecRelation, { kind: "covers" }>,
  root: unknown,
  rootName: string,
  add: (path: string, message: string) => void,
  note: (message: string) => void,
): void {
  const lists = select(root, rel.list, rootName);
  const list = lists[0];
  if (!list || !Array.isArray(list.value)) return idle(rel.id, rel.list, note);
  const n = list.value.length;
  if (!n) return;

  const used = new Set<number>();
  for (const h of select(root, rel.pick, rootName)) {
    if (typeof h.value === "number") used.add(h.value);
  }
  if (!used.size) return; // 가리키는 쪽이 통째로 비었으면 모양 검사의 몫입니다.

  const spare: number[] = [];
  for (let i = 0; i < n; i += 1) if (!used.has(i)) spare.push(i);
  if (!spare.length) return;

  add(
    list.path,
    `${n}칸 가운데 ${spare.length}칸을 아무도 가리키지 않습니다 — ${spare.join("·")}번. ` +
      `가리키는 값은 ${[...used].sort((a, b) => a - b).join("·")} 뿐입니다.`,
  );
}
