// 클론 — 이미 있는 액티비티에서 레시피를 떠 옵니다.
//
// **왜 필요한가.** 화면에서 빈 폼을 처음부터 채우는 것은 자리가 800개쯤 되는
// 모듈에서는 못 할 짓입니다. 같은 모듈로 이미 만든 회차가 스무 개씩 있으니,
// **그 중 하나를 베껴 놓고 달라진 데만 고치는** 것이 실제로 사람이 하는 일입니다.
//
//   기존 액티비티 ──읽기──▶ 레시피 ──(리소스 갈아끼우기)──▶ 생성기 ──▶ 새 액티비티
//
// 읽는 코드는 새로 쓰지 않았습니다. `survey.ts` 가 이미 GameData 와 AssetTable 을
// 읽고 있고, 재현 검사가 그것으로 레시피를 만들어 113개를 돌려 봤습니다.
// 여기는 그 조각을 한자리에 모아 **검사 말고 사람도 쓸 수 있게** 한 것입니다.
//
// **베낀 값은 남의 회차 것입니다.** 별칭·문구·좌표가 원본의 것이라, 리소스를
// 갈아끼우는 단계가 뒤에 붙어야 「리소스만 넣으면 된다」가 됩니다.

import fs from "fs";
import { modulesOf, readGameData } from "./survey";
import { parseStudyCode } from "./spec";
import { workPath } from "./paths";
import type { Recipe } from "./types";
import { readAssets } from "./cloneassets";
export type Clone = {
  recipe: Recipe;
  from: string; // 원본 액티비티 폴더
  notes: string[]; // 사람이 봐야 할 것
};

export function cloneFrom(originCode: string, newCode?: string): Clone {
  const study = parseStudyCode(originCode);
  if (!study) throw new Error(`학습코드를 인식할 수 없습니다: ${originCode}`);

  const repo = "sparkon_m" + String(study.month).padStart(2, "0");
  const dir = workPath(repo, "src", "activity", study.code);
  if (!fs.existsSync(dir)) throw new Error(`원본 액티비티가 없습니다: ${dir}`);

  const refs = modulesOf(dir);
  const ref = refs[0];
  if (!ref) throw new Error(`${study.code} 이 어느 모듈을 쓰는지 못 읽었습니다.`);

  const notes: string[] = [];
  if (refs.length > 1) {
    notes.push(`모듈을 ${refs.length}개 들여옵니다 — 맨 앞엣것(${ref.module})으로 봅니다.`);
  }

  const gd = readGameData(dir);
  if (!gd) notes.push("GameData 를 못 읽었습니다 — 값 없이 뜹니다.");

  const { assets, notes: assetNotes } = readAssets(dir);
  notes.push(...assetNotes);

  // 만드는 사람과 날짜는 베끼지 않습니다. 새 회차의 것입니다.
  const recipe: Recipe = {
    recipeVersion: 1,
    code: newCode ? (parseStudyCode(newCode)?.code ?? newCode) : study.code,
    module: ref.module,
    subject: ref.subject,
    assets,
    // **뿌리가 배열인 회차도 있습니다** (WordSparkLv1·E06·E28). 객체로 눌러
    // 담으면 그 자리에서 값이 통째로 사라지므로 읽은 모양 그대로 둡니다.
    gameData: (gd?.data ?? {}) as Record<string, unknown> | unknown[],
  };

  return { recipe, from: dir, notes };
}

//
// **AssetTable 읽기와 명령은 떼어 냈습니다** (2026-09-30, 261줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   cloneassets    AssetTable.ts 읽기 — 별칭 · 파일 이름 · 놓이는 곳
//   clonecli       명령줄 `forge clone`

export { runClone } from "./clonecli";
