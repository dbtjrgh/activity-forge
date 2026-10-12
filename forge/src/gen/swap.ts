// 리소스 갈아끼우기 — 원본의 파일을 이번 회차 것으로.
//
// 클론(`clone.ts`)이 떠 온 값은 **남의 회차 것**입니다. 별칭에 원본의 학습코드가
// 박혀 있고(`MAL1M02W4S2_Pmon_idle.json`) 파일도 그 회차 것입니다. 여기서
// **새 회차의 리소스 폴더를 훑어 파일 이름으로 짝을 맞춰** 갈아끼웁니다.
//
//   원본 레시피 ──[이 파일]──▶ 이번 회차 파일을 가리키는 레시피 ──▶ 생성기
//
// **얼마나 맞나 — 재 봤습니다 (2026-09-02).** 리소스가 실제로 들어와 있는
// 액티비티 680개에 대해, 같은 모듈을 쓰는 형제 중 **가장 잘 맞는 것을 원본으로**
// 골랐을 때입니다. (⑤ 숫자마디가 생기기 전의 값입니다.)
//
//   원본 별칭 47,644자리 → 자동으로 갈아끼움 25,509 (54%)
//     그대로 24,944 · 학습코드 336 · 확장자 131 · 꼬리 98
//   손댈 것 — 못 맞은 별칭 22,135 · 새 폴더에 남은 파일 11,502
//   회차별 적중률 — 하위25% 36% · 중앙 56% · 상위25% 79%
//   한 자리도 안 남는 회차 51개
//
// **학습코드·확장자·꼬리 는 다 합쳐 565자리뿐입니다. 그래도 뺄 수 없습니다.** 107개 회차에서만
// 일하는데, 그 자리가 하필 **로티**입니다 — `character_idle`·`effect_correct`
// 처럼 모듈이 이름을 박아 놓고 찾는 것들이라, 여기가 안 맞으면 에러 없이
// **캐릭터만 안 움직입니다.** ① 이 24,944자리를 가져가는 것은 파일 이름을
// 그대로 물려 쓰는 회차가 많아서이지 나머지가 쓸모없어서가 아닙니다.
//
// **나머지는 이름으로는 못 맞춥니다.** 회차가 다르면 낱말도 그림도 다릅니다 —
// `item01~item24`(수박·귤·튜브)가 `item1_01~item4_03` 으로 바뀌는 식이라
// 이름에 짝지을 실마리가 없습니다. **짐작해서 채우면 안 됩니다.** 그래서 못 맞은
// 것은 채우지 않고, **무리로 묶어** 사람에게 보여 줍니다(아래 「무리」).
//
// **규칙은 여섯입니다. 위에서부터 자신 있는 순서입니다.**
//
//   ① 그대로     파일 이름이 새 폴더에 그대로 있습니다        `bg.png`
//   ② 학습코드   학습코드만 다릅니다 (밑줄·대소문자 무시)     `MAL1M02W4S2_correct_ef.json`
//                                                            → `mal1m07w1s3_correct_ef.json`
//   ③ 확장자     이름은 같고 확장자만 다릅니다                `page5.wav` → `page5.mp3`
//   ④ 숫자마디   마디 하나가 숫자만 다른 **작은 무리**입니다  `SL_ma_222_s1_sfx01.mp3`
//                                                            → `SL_ma_226_s1_sfx01.mp3`
//   ⑤ 꼬리       마지막 마디가 같고 그런 파일이 하나뿐입니다  `_Pmon_idle` → `_rmon_idle`
//   ⑥ 하나뿐     영상(`.mp4`)이 원본에도 폴더에도 하나씩입니다 `video.mp4` → `MAL1M07W3S1_ani_v1.1.mp4`
//
// **②를 밑줄·대소문자까지 무시해야 하는 까닭.** 학습코드를 파일 이름에 적는 꼴이
// 제각각입니다 — `MAL1M02W4S2_…` · `mal1m07w1s3_…` · `En_L1_M01_W1_S1_…`. 글자
// 그대로 찾으면 0.2% 밖에 안 맞습니다.
//
// **④를 무리째로만 보는 까닭 — 잰 값입니다 (2026-09-23).** 이름 가운데 숫자
// 마디 하나만 갈리는 일이 잦습니다(`SL_ma_222_s1_…` → `SL_ma_226_s1_…`). 그런데
// **파일 하나씩 견주면 44%가 틀립니다.** 내레이션은 회차마다 번호를 다시 매겨서
// `nar04` 가 `nar01` 이 되는 일이 예사입니다 — 번호가 맞은 것이 뜻까지 맞은 것이
// 아닙니다(아래 `tailOf` 머리말과 같은 함정).
//
// 그래서 **이름 뼈대가 같은 무리를 통째로** 놓고, 아래가 다 맞을 때만 짝짓습니다.
//
//   ㉠ 마디 하나가 **무리 전체에서** 같은 값으로 갈렸다 (그 마디 말고는 그대로)
//   ㉡ 그 숫자가 세 자리 이상이고 **자릿수와 앞자리가 같다** (`222`→`226`)
//   ㉢ 폴더 쪽에 **원본이 안 쓰던 번호가 하나도 없다** — 있으면 번호를 다시 매긴 것
//   ㉣ 폴더 쪽 무리가 **넷 이하다**
//
// 완성본을 정답지로 1~9호 전부를 재 봤습니다 (`src/tool/numswap.ts`) —
// **넷 이하: 맞음 46 · 틀림 0.** 여섯까지 늘리면 맞음 126 · **틀림 18** 입니다.
// 큰 무리는 어느 파일이 어느 자리인지가 **이름이 아니라 내용**의 일이라
// 맞추기가 손댈 것이 아닙니다.
//
// **⑤를 「하나뿐일 때만」으로 묶은 까닭.** 꼬리가 `correct` 인 파일이 둘이면
// (`Pmon_correct` · `correct_ef`) 어느 쪽인지 알 수 없습니다. 원본 쪽에 같은 꼬리가
// 둘 있어도 마찬가지입니다. **둘 중 하나라도 겹치면 규칙을 접습니다.**
//
// **못 맞은 것은 원본의 파일 이름을 그대로 둡니다.** 비우지 않습니다 — 「이 자리에
// 원본은 무엇을 썼나」가 사람이 고를 때 쓰는 단서입니다. 없는 파일을 가리키는
// 것은 생성한 뒤 **리소스 검증 1단계**가 잡습니다.

//
// **본문은 조각으로 나눴습니다** (2026-09-30, 477줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   swaprules    맞추기 규칙 ①~⑥ (`pairSlots`)
//   swapnames    이름 견주기 — 줄기 · 뼈대 · 숫자 마디 · 꼬리
//   swapfolder   리소스 폴더 훑기 · 이름 무리
//   swapcli      명령줄 `forge swap`

import { cloneFrom } from "./clone";
import { parseStudyCode } from "./spec";
import type { AssetKind, Recipe } from "./types";
import { pairSlots } from "./swaprules";
import { norm } from "./swapnames";
import { readFolder } from "./swapfolder";

export * from "./swapfolder";
export * from "./swapcli";

export type SwapRule = "same" | "code" | "ext" | "num" | "tail" | "only";

export const RULE_LABEL: Record<SwapRule, string> = {
  same: "그대로",
  code: "학습코드",
  ext: "확장자",
  num: "숫자마디",
  tail: "꼬리",
  only: "하나뿐",
};

export type SwapHit = {
  kind: AssetKind;
  alias: string;
  from: string; // 원본이 쓰던 파일 (`images/bg.png`)
  to: string; // 이번 회차 파일
  rule: SwapRule;
};

export type SwapMiss = { kind: AssetKind; alias: string; file: string };

export type Swap = {
  recipe: Recipe; // 맞은 자리는 갈아끼운 채로
  from: string; // 원본 학습코드
  dir: string; // 새 회차의 리소스 폴더
  hits: SwapHit[];
  misses: SwapMiss[];
  spare: string[]; // 새 폴더에 있는데 아무 별칭도 안 가져간 파일
  notes: string[];
};

export function swapResources(originCode: string, newCode: string): Swap {
  // 새 학습코드는 **반드시 읽혀야 합니다.** 리소스 폴더가 어느 호에 있는지를
  // 여기서 뽑습니다(`sparkon_m07/public/sparklab/…`). 못 읽으면 엉뚱한 빈 폴더를
  // 보고 「갈아끼울 것이 없다」고 말하게 됩니다.
  if (!parseStudyCode(newCode)) throw new Error(`새 학습코드를 인식할 수 없습니다: ${newCode}`);

  const origin = cloneFrom(originCode, newCode);
  const recipe = origin.recipe;
  const notes = [...origin.notes];

  const { dir, files, exists } = readFolder(recipe.code);
  if (!exists) notes.push(`리소스 폴더가 없습니다 — ${dir}`);
  else if (files.length === 0) notes.push("리소스 폴더가 비어 있습니다 — 아직 파일이 안 들어왔습니다.");

  const originNorm = norm(parseStudyCode(originCode)?.code ?? originCode);
  const newNorm = norm(recipe.code);

  // ①~⑥ 규칙을 위에서부터 — 차례와 빗장은 `swaprules.ts`
  const { free, hits, left } = pairSlots(recipe, files, originNorm, newNorm);
  const misses: SwapMiss[] = [];
  for (const s of left) misses.push({ kind: s.kind, alias: s.asset.alias, file: s.rel });

  return {
    recipe,
    from: parseStudyCode(originCode)?.code ?? originCode,
    dir,
    hits,
    misses,
    spare: files.filter((f) => free.has(f)),
    notes,
  };
}

