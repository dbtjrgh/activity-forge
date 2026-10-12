// 레시피 한 장 → 액티비티 폴더 하나.
//
//   yarn forge make <recipe.json>          검증하고 파일을 씁니다
//   yarn forge make <recipe.json> --dry    쓰지 않고 검증 결과와 파일 내용만 보여 줍니다
//   yarn forge make <recipe.json> --force  이미 있는 액티비티를 덮어씁니다

import fs from "fs";
import path from "path";
import type { GenResult, Recipe } from "./types";
import { effectiveAssets, loadSpec, parseStudyCode, resolveModule } from "./spec";
import { genPath, repoPath, workPath } from "./paths";
import { resolveGameData } from "./resolve";
import { checkAssetSizes } from "./rscsize";
import { partNameIssues } from "./parts";
import {
  renderActivity,
  renderActivityInfo,
  renderAssetTable,
  renderGameData,
  renderIndexHtml,
} from "./render";
import { checkAssetFiles } from "./genassets";

const COPY_AS_IS = ["App.vue", "main.ts", "style.css"];
const RSC_DIRS = ["images", "sounds", "animations"];

export type GenOptions = {
  dry?: boolean;
  force?: boolean;
  // 리소스 파일이 정말 있는지 볼 것인가. **끄는 데는 하나뿐입니다** —
  // 재현 검사는 파일 이름을 「별칭 + 확장자」로 지어내서 견줍니다(별칭만 보는
  // 검사입니다). 지어낸 이름은 당연히 폴더에 없으니 여기서 다 걸립니다.
  checkAssets?: boolean;
};

export function generate(recipeFile: string, opts: GenOptions = {}): GenResult {
  const result: GenResult = { ok: false, issues: [], files: [], dirs: [] };

  const recipe = readRecipe(recipeFile);
  const study = parseStudyCode(recipe.code);
  if (!study) {
    throw new Error(
      `학습코드를 인식할 수 없습니다: ${recipe.code}\n  형식: {MA|KO|EN}L{1-3}M{01-12}W{1-4}S{1-3} ex) MAL1M07W3S2`,
    );
  }

  const repo = workPath("sparkon_m" + String(study.month).padStart(2, "0"));
  if (!fs.existsSync(repo)) {
    throw new Error(
      `호 폴더가 없습니다: ${repo}\n  먼저 clone 하세요 — sparkon clone M${String(study.month).padStart(2, "0")}`,
    );
  }

  const module = resolveModule(study.subject, recipe.module);
  const spec = loadSpec(study.subject, module);
  if (module !== recipe.module) {
    result.issues.push({
      level: "warn",
      rule: "module-alias",
      path: "module",
      message: `${recipe.module} 은 ${module} 의 데이터 변형입니다. ${module} 스펙으로 만듭니다.`,
      ...(spec.aliasNote ? { why: spec.aliasNote } : {}),
    });
  }

  const { node, issues } = resolveGameData(spec, recipe);
  result.issues.push(...issues);

  // 몸·팔 파일은 몸·팔 이름으로 — 폴더를 안 봐도 되는 검사라 `checkAssets` 밖이다 (`parts.ts`)
  result.issues.push(...partNameIssues(effectiveAssets(spec, recipe).image ?? []));

  const activityDir = path.join(repo, "src", "activity", study.code);
  const publicDir = path.join(repo, "public", "sparklab", study.code);
  if (opts.checkAssets !== false) {
    result.issues.push(...checkAssetFiles(effectiveAssets(spec, recipe), study.code));
    // 크기가 정해진 그림(영상 모듈의 썸네일) — 어긋나면 확대가 안 된다 (`rscsize.ts`)
    result.issues.push(...checkAssetSizes(spec, effectiveAssets(spec, recipe), study.code));
  }
  const defaultDir = findTemplate(repo);
  if (fs.existsSync(activityDir) && !opts.force && !opts.dry) {
    throw new Error(
      `이미 있는 액티비티입니다: ${activityDir}\n  덮어쓰려면 --force. 다만 만든 뒤의 정본은 소스입니다 — 되도록 손으로 고치세요.`,
    );
  }

  // 렌더는 검증 결과와 상관없이 다 해 둡니다. --dry 로 봐야 하니까요.
  const files: Record<string, string> = {
    "Activity.ts": renderActivity(study.code, spec),
    "AssetTable.ts": renderAssetTable(study.code, recipe, spec),
    "GameData.ts": renderGameData(spec, node),
    "activityInfo.json": renderActivityInfo(study.code, recipe),
    "index.html": renderIndexHtml(
      study.code,
      fs.readFileSync(path.join(defaultDir, "index.html"), "utf8"),
    ),
  };
  for (const name of COPY_AS_IS) {
    files[name] = fs.readFileSync(path.join(defaultDir, name), "utf8");
  }

  const errors = result.issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    result.ok = false;
    // 안 쓸 글이지만 버리지 않습니다 — 안 될 때 무엇을 만들려 했는지 봐야
    // 고칠 수 있습니다. `preview` 가 아닌 `draft` 인 까닭은 types.ts 에.
    if (opts.dry) result.draft = files;
    return result;
  }
  if (opts.dry) {
    result.ok = true;
    result.files = Object.entries(files).map(([name, text]) => ({
      path: path.join(activityDir, name),
      bytes: Buffer.byteLength(text),
    }));
    result.preview = files;
    return result;
  }

  for (const dir of [activityDir, publicDir, ...RSC_DIRS.map((d) => path.join(publicDir, d))]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      result.dirs.push(dir);
    }
  }
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(activityDir, name);
    fs.writeFileSync(file, text, "utf8");
    result.files.push({ path: file, bytes: Buffer.byteLength(text) });
  }

  result.ok = true;
  return result;
}
// 액티비티마다 다를 것이 없는 3+1개 파일이 나오는 곳.
// 호 저장소에 `_default` 가 있으면 그쪽을 먼저 씁니다(호가 갈라질 여지를 둡니다).
// 없으면 양산이 들고 있는 것을 씁니다 — m05·m06 말고는 `_default` 가 없습니다.
function findTemplate(repo: string): string {
  const inRepo = path.join(repo, "src", "activity", "_default");
  if (fs.existsSync(inRepo)) return inRepo;
  const inGen = genPath("template", "_default");
  if (fs.existsSync(inGen)) return inGen;
  throw new Error(`템플릿을 찾지 못했습니다. 찾아본 곳:\n  ${inRepo}\n  ${inGen}`);
}

function readRecipe(file: string): Recipe {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`레시피가 없습니다: ${abs}`);
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8")) as Recipe;
  } catch (e) {
    throw new Error(`레시피 JSON 을 읽지 못했습니다: ${abs}\n  ${(e as Error).message}`);
  }
}
// 파일이 아니라 값으로 받은 레시피를 돌립니다.
//
// `generate()` 는 파일 경로를 받습니다 — 명령으로 쓰는 것이 먼저였으니까요.
// 그런데 화면도 검사기도 손에 든 것은 **객체**입니다. 각자 임시 파일을
// 떨어뜨리고 있었는데, 지우는 것을 한쪽이 빠뜨리면 `_recipe` 에 쓰레기가
// 남습니다. 한 자리로 모읍니다 (2026-09-01).
//
// 임시 파일 이름에 프로세스 번호를 넣습니다. 화면을 띄운 채로 검사를 돌리면
// 둘이 같은 파일을 쓰고 지웁니다.
export function generateRecipe(recipe: Recipe, opts: GenOptions = {}): GenResult {
  const tmp = repoPath("_recipe", `_tmp_${process.pid}.json`);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(recipe, null, 2), "utf8");
  try {
    return generate(tmp, opts);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

//
// **파일 검사와 출력은 떼어 냈습니다** (2026-09-30, 289줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   genassets      AssetTable 이 가리키는 파일이 리소스 폴더에 정말 있나
//   genprint       명령줄 출력 — 이슈 · 결과

export { printIssues, printResult } from "./genprint";
