# forge — 액티비티 양산기

학습코드 하나를 넣으면 **호 저장소(`<제품>_mNN`)에 액티비티 폴더 한 벌**을 찍어 냅니다.
`Activity.ts` · `AssetTable.ts` · `GameData.ts` · `App.vue` · `main.ts` · `index.html` · `style.css`.

> 이 공개본에는 회사 자료(모듈 스펙 `_spec/`, 호별 배치표 `_layout/`, 측정 도구 `src/tool/`, 설계 문서 `_document/`)가 빠져 있습니다.
> 코드는 그대로이고, 자료가 없으므로 명령을 돌리면 빈 결과가 나옵니다. 스펙 꼴은 저장소 맨 위 README 의 「스펙」 절에 있습니다.

## 어디서 도나

데스크톱 앱(`electron_app`) 저장소 안(`app/forge`)에 있고, 호 저장소들과 나란히 있지 않습니다.
그래서 **`.user.json` 의 `workRoot` 가 호 저장소를 찾는 유일한 단서입니다.**

```
D:\Work\
├── app\forge\              ← 여기
└── <작업 폴더>\            ← workRoot 가 가리키는 자리
    ├── <공용 모듈>\  <공용 리소스>\
    └── <제품>_m01 ~ m11\
```

## 쓰는 법

```bash
yarn install          # 처음 한 번
forge-ui.bat          # 더블클릭하면 브라우저로 양산 화면이 뜹니다
```

| 명령 | 하는 일 |
|---|---|
| `yarn forge ui [포트]` | 양산 화면 (기본 5300) |
| `yarn forge make <레시피>` | 레시피로 액티비티 폴더를 만듭니다 |
| `yarn forge clone <새코드>` | 배치표가 고른 원본에서 값을 가져옵니다 |
| `yarn forge swap <새코드>` | 거기에 리소스까지 새 회차 것으로 바꿉니다 |
| `yarn forge layout EN 07` | 진행판 — 그 호의 학습코드마다 어디까지 왔나 |
| `yarn forge survey [과목/모듈]` | 모듈별 사용 현황 · 표본 비교 |
| `yarn forge draft <과목/모듈>` | 완성본 표본을 비교해 스펙 초안을 만듭니다 |

## 폴더

```
src/main.ts        명령 진입점
src/gen/           양산기 본체 (스펙 검사 · 생성 · figma 화면 그림 찾기 · 화면 ui)
src/util/          activityModules.ts — Activity.ts 의 import 에서 모듈을 읽는 파서
_spec/             모듈 스펙 (공개본에는 없음)
_layout/           과목 · 호별 모듈 배치표 (공개본에는 없음)
_recipe/           화면에서 채운 값. 커밋하지 않습니다
```

**바깥에서 끌어 쓰는 것은 `typescript` 하나뿐입니다.** 로그인도 DB 도 안 씁니다 —
그대로 실행 파일로 묶을 수 있게 그렇게 뒀고, 실제로 데스크톱 앱이 이 코드를 그대로 불러 씁니다.
