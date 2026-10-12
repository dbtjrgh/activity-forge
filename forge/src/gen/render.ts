// 해석된 트리 → 액티비티 파일 텍스트.
//
// 8개 파일 중 5개를 씁니다. 나머지 3개(App.vue · main.ts · style.css)는
// 액티비티마다 다를 것이 없어서 `_default` 에서 그대로 복사합니다.

//
// **본문은 쓰는 파일마다 나눴습니다** (2026-09-30, 393줄이라 — 동작 변화 없음). 바깥은 여태처럼 이 파일에서 가져다 씁니다.
//
//   rendergamedata GameData.ts 쓰기 — 트리를 글로 · 한 줄로 접기 · 주석
//   renderassets   AssetTable.ts 쓰기 — 갈래마다 기본 자리 · 선언 차례
//   renderactivity Activity.ts · activityInfo.json · index.html 쓰기

export { renderGameData } from "./rendergamedata";
export { DEFAULT_BASE, renderAssetTable } from "./renderassets";
export { PROVIDED_SYMBOLS, renderActivity, renderActivityInfo, renderIndexHtml } from "./renderactivity";
