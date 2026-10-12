// Activity.ts · activityInfo.json · index.html 쓰기.
//
// `render.ts` 에서 떼어 냈습니다 (2026-09-30, 동작 변화 없음). 바깥은 여태처럼 `render.ts` 에서 가져다 씁니다.

import type { Recipe, Spec } from "./types";
import { loadUser, today } from "./user";

// ─── Activity.ts ─────────────────────────────────────────────────────────

// **`renderActivity` 가 어느 액티비티에나 넣어 주는 이름들.**
//
// 스펙이 이것을 또 적으면 import 가 두 번 나가 **컴파일이 안 됩니다.** 그런
// 스펙이 115장 중 88장이었습니다 — 초안이 표본의 import 를 통째로 베끼면서
// 생성기가 이미 써 주는 것까지 적었고, 재현 검사는 import 를 집합으로 견줘서
// 중복이 가려졌습니다 (2026-09-02).
//
// 초안(`draft.ts`)과 형식 검사(`specCheck.ts`)가 이 목록을 봅니다.
// 아래 `imports` 를 고치면 여기도 같이 고치세요.
export const PROVIDED_SYMBOLS = [
  "Ticker",
  "font",
  "image",
  "lottie",
  "sound",
  "AssetManager",
  "AudioManager",
];

export function renderActivity(code: string, spec: Spec): string {
  const h = spec.codegen.hooks;
  const base = spec.codegen.extends ?? {
    symbol: "ActivityBase",
    from: "@_common/sparkLib/ActivityBase",
  };
  const extra = [
    ...(spec.codegen.import ? [spec.codegen.import] : []),
    ...(spec.codegen.imports ?? []),
  ];
  // 빈 줄에는 들여쓰기를 넣지 않습니다 — 안 그러면 공백만 남은 줄이 생깁니다.
  const body = (lines: string[] | undefined, fallback: string): string => {
    if (!lines?.length) return fallback === "" ? "" : `    ${fallback}`;
    return lines.map((l) => (l === "" ? "" : `    ${l}`)).join("\n");
  };

  const imports = [
    `import { type Ticker } from "pixi.js";`,
    `import { ${base.symbol} } from "${base.from}";`,
    `import { font, image, lottie, sound } from "./AssetTable";`,
    `import { AssetManager } from "@_common/sparkLib/AssetManager";`,
    `import { AudioManager } from "@_common/sparkLib/AudioManager";`,
    ...extra.map((i) =>
      i.ns
        ? `import * as ${i.symbol} from "${i.from}";`
        : `import { ${i.symbol} } from "${i.from}";`,
    ),
    // 값이 없는 모듈은 GameData 를 들여와 봐야 안 쓰는 import 만 남습니다.
    ...(spec.gameData.kind === "unused"
      ? []
      : [`import { ${spec.codegen.gameDataExport} } from "./GameData";`]),
  ];

  return `//import { Assets, SCALE_MODES, Sprite, type Ticker } from "pixi.js";
${imports.join("\n")}

export class Activity extends ${base.symbol} {
  protected mStudyCode = "${code}";
${members(spec.codegen.members)}
  async onLoad() {${h.onLoad?.length ? `\n${body(h.onLoad, "")}` : ""}
    for (const v of font as any) {
      AssetManager.addAsset(v.alias, v.src);
    }

    for (const v of image as any) {
      AssetManager.addAsset(v.alias, v.src);
    }

    for (const v of lottie as any) {
      AssetManager.addAsset(v.alias, v.src);
    }
    for (const v of sound as any) {
      AudioManager.add(v.alias, v.src);
    }
  }

  async onInit() {
${body(h.onInit, "// 이곳에 플레이 버튼을 누르기 전에 생성할 코드를 입력하세요")}
  }

  async onStart() {
${body(h.onStart, "// 이곳에 플레이 버튼을 누른 이후의 코드를 입력하세요")}
  }

  async onEnd() {
${body(h.onEnd, "// 이곳에 액티비티 종료시의 코드를 입력하세요")}
  }

  async onUpdate(_ticker: Ticker) {
${body(h.onUpdate, "// 이곳에 액티비티 Loop Step의 코드를 입력하세요.")}
  }
${maybe("async onAffordanceOn()", h.onAffordanceOn)}${maybe(
    "async onAffordanceCanceled()",
    h.onAffordanceCanceled,
  )}${maybe("onResize(): void", h.onResize)}}
`;
}

// 클래스가 들고 있어야 하는 것. `mStudyCode` 아래, 훅 위에 그대로 냅니다.
//
// **들여쓰기만 맞춥니다.** 스펙에 적힌 줄이 곧 코드입니다 — 여기서 손보려
// 들면 스펙에 적은 것과 나온 것이 어긋나 사람이 못 쫓아옵니다.
function members(lines?: string[]): string {
  if (!lines?.length) return "";
  return "\n" + lines.map((l) => (l === "" ? "" : `  ${l}`)).join("\n") + "\n";
}

// 원본이 쓸 때만 냅니다. 안 쓰는데 내면 빈 메서드만 남습니다.
//
// **`onUpdate` 는 여기 없습니다** — 어느 액티비티에나 있는 훅이라 위에서 늘
// 내되, 전에는 스펙의 `h.onUpdate` 를 **읽지도 않고** 주석만 박았습니다.
// 스펙에 적어도 버려지던 자리입니다 (2026-09-02).
function maybe(signature: string, lines?: string[]): string {
  if (!lines?.length) return "";
  return `\n  ${signature} {\n${lines.map((l) => `    ${l}`).join("\n")}\n  }\n`;
}

// ─── activityInfo.json · index.html ──────────────────────────────────────

export function renderActivityInfo(code: string, recipe: Recipe): string {
  const info = recipe.info ?? {};
  const user = loadUser();
  return (
    JSON.stringify(
      {
        code,
        devFinished: info.devFinished ?? false,
        // 만든 날. 레시피가 적어 뒀으면 그것을 지키고, 없으면 오늘로 찍습니다.
        finishedDate: info.finishedDate || today(),
        devTeam: info.devTeam || user.devTeam,
        // 누가 만들었는지. `sparkon_forge/.user.json` 또는 git 이름에서 옵니다.
        developer: info.developer || user.developer,
        description: info.description ?? "",
      },
      null,
      2,
    ) + "\n"
  );
}

export function renderIndexHtml(code: string, template: string): string {
  return template.replaceAll("{액티비티코드}", code);
}
