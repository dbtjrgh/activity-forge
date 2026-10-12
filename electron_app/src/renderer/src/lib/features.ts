/**
 * **기능 목록 — 이 프로그램이 무엇을 하나** (2026-09-30). 앱 안 「기능」 화면(`components/Features.tsx`)이 그린다.
 *
 * 개발자가 「이런 기능이 이미 있나」를 한 곳에서 찾는 자리다. 전에는 `_document/기능.md` 였는데 사용자 결정으로
 * 프로그램 안으로 옮겼다 — **정본은 이 파일 하나**다. **기능을 더하거나 걷으면 여기 한 줄을 같이 고친다**(저장소 CLAUDE.md 8번).
 * 각 줄의 `where` 가 정본이고 까닭은 그 파일 머리말에 있다 — 여기는 「무엇을 · 어디에」만.
 * 경로 머리 — 앱은 `electron_app/src/`(렌더러 `renderer/src/`, 메인 `main/`), 양산기는 `forge/src/`.
 */

export type Feature = { name: string; what: string; where: string }
export type FeatureGroup = { title: string; note?: string; rows: Feature[] }

export const FEATURES: FeatureGroup[] = [
  {
    title: '왼쪽 사이드바',
    rows: [
      { name: '업데이트', what: '양산기 자료나 앱 새 버전이 있으면 표시되고 단추가 켜집니다. 누르면 자료는 git pull --ff-only로 받고(로컬에서 수정한 파일이 있으면 받지 않음), 앱 새 버전은 받아 둔 뒤 앱을 다시 시작합니다. 앱을 켤 때, 1분마다, 창으로 돌아올 때 확인합니다. 지금 판 번호는 옆줄 「스파크온」 옆과 창 제목에 나오고, 새 버전의 번호는 이 막대에 나옵니다.', where: 'components/UpdateBar.tsx · services/forge/refresh.ts · appupdate.ts · update.ts · main/boot.ts' },
      { name: '초기 설정', what: '양산기 폴더를 찾지 못하면 앱 화면 대신 뜹니다. 작업 폴더 하나만 고르면 그 안에 SparkOn-양산기(저장소를 내려받음)와 SparkOn-리소스를 만들고, 이름과 팀을 저장합니다. git, Claude Code, poppler가 있는지도 확인하고, git이나 Claude Code가 없으면 설치 페이지를 엽니다. poppler는 실행 파일에 들어 있습니다.', where: 'components/setup/FirstRun.tsx · ipc/setup.ts · services/forge/setup.ts' },
      { name: '설정', what: '작업 폴더(workRoot), 리소스 폴더(rscRoot), 개발자와 팀을 설정하고 폴더 권한 화면을 엽니다. 양산기 폴더는 보여 주기만 합니다(초기 설정이 정합니다).', where: 'components/SettingsDrawer.tsx · MeRow.tsx · services/forge/workspace.ts · home.ts' },
      { name: '새 모듈 n', what: '배치표에는 있지만 스펙이 없는 모듈을 보여 줍니다. 모듈마다 Claude에게 보낼 요청문을 복사할 수 있습니다.', where: 'components/board/NewModules.tsx · services/forge/newmodules.ts' },
      { name: '학습코드 열기', what: '학습코드를 입력하고 「열기」를 누르면 작업대가 열립니다.', where: 'App.tsx' },
      { name: '호별 진행 막대', what: '1~11호의 영어, 수학, 국어 진행률을 막대로 보여 줍니다. 모두 완료되면 초록색으로 바뀝니다. 새 호를 열거나, 앱에서 연 빈 호를 닫을 수 있습니다.', where: 'components/board/BoardList.tsx · services/forge/board.ts' },
      { name: '패널 너비 조절', what: '사이드바와 작업대 왼쪽, 오른쪽 패널의 너비를 끌어서 조절합니다. 이 PC에 저장되며, 두 번 누르면 처음 너비로 돌아갑니다.', where: 'components/Splitter.tsx' },
      { name: '기능', what: '지금 보고 있는 화면입니다. 기능 목록과 검색을 제공합니다.', where: 'components/Features.tsx · lib/features.ts' },
      { name: '관리', what: '스파크온 전체 현황을 한 화면에서 봅니다. 맨 위 요약 카드 네 개를 누르면 해당 항목으로 이동합니다. 확인이 필요한 호 저장소 수를 버튼에 표시합니다(10분마다 갱신).', where: 'components/SidebarHead.tsx · components/manage/Manage.tsx · useManageAlert.ts · ipc/manage.ts' }
    ]
  },
  {
    title: '관리 (스파크온 전체)',
    note: '조회만 합니다. 완성본 점검을 다시 실행할 때 _recipe/_gate.json 파일을 저장하는 것만 예외입니다. 다른 사람의 저장소는 수정하지 않습니다.',
    rows: [
      { name: '호 저장소', what: 'sparkon_mNN 저장소마다 커밋하지 않은 파일, 원격보다 뒤처지거나 아직 올리지 않은 커밋, 마지막 커밋, 마지막으로 받은 시각을 보여 줍니다. fetch는 하지 않으며, 확인이 필요한 저장소가 위에 표시됩니다.', where: 'components/manage/RepoSection.tsx · services/forge/hallstatus.ts · hallwalk.ts' },
      { name: '받을 리소스', what: '완료되지 않은 호마다 리소스가 부족한 학습코드(종류별 현재/원본 개수, 원본 파일 이름)와 리소스가 하나도 없는 학습코드, 호 전체의 종류별 합계를 보여 줍니다. 디자인팀에 보낼 요청문을 복사할 수 있습니다.', where: 'components/manage/RscSection.tsx · services/forge/rscwait.ts' },
      { name: '받을 리소스 창', what: 'figma 옆에 띄워 두는 작은 창입니다. 앞 학습코드가 사용한 그림(크기)과 소리를 보여 주고, 파일이 들어오면 이름과 크기가 맞는지 체크합니다. 이름과 크기가 달라도 「대사 성우」로 정했거나 이전 방식에서 AI나 사람이 그 파일로 정한 기록이 있으면 「정함」으로 바꾸고 들어온 그림을 보여 줍니다. 대화로 만들기에서 Claude가 고른 파일은 「정함」으로 바뀌지 않습니다. 앱이 자동으로 가져올 파일은 접어 둡니다. 크게 보기와 항상 위 기능이 있습니다. 작업대 「부족한 리소스」 맨 위의 「받을 리소스 보기」 버튼이나 관리 화면 받을 리소스의 「리소스 보기」 버튼으로 엽니다.', where: 'components/guide/ · main/guidewin.ts · ipc/guide.ts · services/forge/rscguide.ts' },
      { name: '대사 성우', what: '받을 리소스 창에서 이 학습코드 성우의 성별(여, 남)을 고르고, 같은 모듈 완성본마다 시작 대사를 ▶로 들어 본 뒤 같은 성별인 학습코드의 대사를 한 번에 가져옵니다. 같은 대사 파일을 쓰는 학습코드는 한 줄로 묶어 보이고, 성별을 고르면 그 학습코드들에 같이 저장합니다. 같은 성별의 대사가 어느 학습코드에도 없으면 그렇다고 알리고 지금 대사를 그대로 쓰게 합니다. 성별은 모듈 스펙의 voices에 저장되어 다른 사람에게도 보입니다. 성별이 둘 다 저장되어 있고 같을 때만 앱이 앞 호 대사를 자동으로 가져옵니다. 새로 온 소리는 이닝 낱말부터 채워 셉니다.', where: 'components/guide/GuideVoice.tsx · lib/voiceplay.ts · services/forge/voice.ts · voiceset.ts · carryrsc.ts · commonrsc.ts' },
      { name: '완성본 점검', what: '개발 완료된 학습코드 전체를 스펙 검사에 넣어 봅니다. 검사에 걸린 것과 검사하지 못한 것, 지난 결과와 검사 시각을 보여 줍니다(하루가 지나면 열 때 다시 검사). forge donegate와 같은 방식으로 계산합니다.', where: 'components/manage/GateSection.tsx · services/forge/gatecheck.ts' },
      { name: '팀별 완료 현황', what: '호마다 팀별 완료 수, 완료되지 않은 폴더, 전체 폴더 수를 보여 줍니다. 팀 이름은 기록된 그대로 표시합니다.', where: 'components/manage/TeamSection.tsx · services/forge/teamtally.ts' }
    ]
  },
  {
    title: '진행판 (호별)',
    rows: [
      { name: '작업 순서 막대', what: '작업대 맨 위에 리소스, figma 화면, 생성, 질문 답변, 검수 완료 순서를 보여 주고 지금 할 단계 하나를 강조합니다. 해당 칸에도 테두리가 생기고, 단계나 「진행할 수 없습니다」 줄을 누르면 그 칸으로 이동해 첫 입력 칸에 커서를 둡니다.', where: 'components/bench/OrderBar.tsx · lib/benchorder.ts · lib/spot.ts' },
      { name: '지금 바로 할 수 있는 학습코드', what: '진행판 위에 질문 답변(Claude가 묻고 있거나 대화가 멈춘 것), 미리보기와 검수, 생성, figma 화면 붙이기를 할 수 있는 학습코드를 완료에 가까운 순서로 모아 보여 줍니다. 누르면 작업대가 열립니다.', where: 'components/board/NowList.tsx' },
      { name: '상태 타일', what: '학습코드마다 모듈 없음, 입력 필요, 생성 대기, 생성 중, 답변 필요, 검수 대기, 개발 완료 중 현재 상태와 다음에 할 일을 보여 줍니다. 생성 중, 답변 필요, 검수 대기는 대화로 만들기의 상태(_recipe/<코드>.chat.json)를 따릅니다. 상태마다 색이 다르고, 칸 맨 아래에 모듈 이름이 있습니다. 칸에 마우스를 올리면 대화에 든 금액도 보입니다.', where: 'components/board/Tiles.tsx · shared/forge/status.ts(이름표 정본) · services/forge/boardwork.ts · chatstore.ts' },
      { name: '끌어다 놓기', what: '기획서, figma 화면, 학습코드 폴더를 끌어다 놓으면 학습코드별로 나눠 넣습니다. 복사한 뒤 원본과 비교하고, 분류할 수 없는 파일은 사용자에게 묻습니다.', where: 'services/forge/sort.ts · sortwalk.ts · sortpaper.ts · inbox.ts' },
      { name: '화면 연속 붙여넣기', what: 'figma 화면이 부족한 학습코드를 차례로 선택해 Ctrl+V로 붙여넣습니다.', where: 'components/board/ShotRound.tsx' },
      { name: '배치표 모듈 선택', what: '앞선 호마다 모듈이 달랐던 학습코드의 모듈을 선택하고 이유를 입력하면 배치표에 저장합니다. 모듈이 갈린 학습코드를 작업대에서 열면 여기서 고르라고 안내합니다. MA는 기획서를 진행판에 놓거나, 기획서를 넣은 학습코드를 작업대에서 열면 기획서 1쪽의 모듈넘버로 채웁니다.', where: 'components/board/LayoutPicks.tsx · services/forge/layoutasks.ts · layoutfill.ts · sortpaper.ts · prepare.ts' },
      { name: '학습코드별 기록', what: '사람이 수정한 횟수, 처음과 마지막 작업 시각, 작업 내용을 보여 줍니다. AI 호출, 비용, 캐시 읽기, 반영 칸은 이전 방식의 기록이라 대화로 만든 학습코드는 「—」로 비어 있습니다. 채팅 방식(8호)의 중앙값과 함께 비교합니다.', where: 'components/board/RunTable.tsx · services/forge/runtable.ts' }
    ]
  },
  {
    title: '작업대 (학습코드별)',
    rows: [
      { name: '대화로 만들기', what: '작업대에서 학습코드를 만드는 유일한 방식입니다. 모듈이 정해진 학습코드에서만 시작합니다. 「대화로 생성」을 누르면 앱이 원본 후보, 같은 모듈 완성본, 공용 파일을 준비하고 Claude가 호 저장소에 GameData.ts, AssetTable.ts, Activity.ts를 직접 씁니다. 모르는 것은 오른쪽 대화 칸에 질문으로 띄우고, 글이나 붙인 화면으로 답하면 같은 대화로 이어서 진행합니다. 다 만들면 앱이 리소스를 호 저장소로 복사하고 타입 검사를 합니다. 통과하지 못하면 결과를 주고 세 번까지 다시 맡깁니다. 스펙 검사는 참고로만 보여 줍니다. 「멈추기」는 검사 중에 눌러도 검사가 끝나는 대로 멈춥니다. 대화를 버리고 앱 밖에서 마쳤으면 「대화 기록 지우기」로 검수 완료를 다시 켭니다(기록은 휴지통으로, 호 저장소 파일은 그대로).', where: 'components/bench/ChatFlow.tsx · ChatSide.tsx · useChat.ts · services/forge/chat.ts · chatturns.ts · chatprep.ts · chatbrief.ts · chatfinish.ts · aisession.ts' },
      { name: '리소스, figma 화면, 기획서', what: '리소스 폴더와 권한, 원격 대비 뒤처짐을 확인합니다. figma 화면은 붙여넣을 때 1x 크기인지 판정하고, 같은 화면을 두 번 붙이면 받지 않습니다. 붙인 순서가 이닝 순서라 화면마다 「n이닝」을 붙이고 ← → 로 순서를 바꿉니다. 기획서는 PDF 파일을 놓거나 캡처해 넣습니다.', where: 'components/bench/FolderCard.tsx · services/forge/shot.ts · frame.ts · poppler.ts' },
      { name: '원본 변경', what: '기계가 고른 원본이 틀리면 그 모듈을 사용한 학습코드 전체에서 골라 배치표에 저장합니다. 모듈 판정은 바꾸지 않으며, 작업대에서 바꾼 원본만 원래대로 되돌릴 수 있습니다. 저장된 장면 비교 결과가 있으면 후보마다 「장면 n/m」으로 보입니다.', where: 'components/bench/OriginPicker.tsx · services/forge/originpick.ts · forge gen/layoutwrite.ts writeLayoutOrigin' },
      { name: '원본 장면 비교', what: 'figma 화면(1920×1080)에서 원본 후보마다 장면 그림(인물, 테두리, 소품처럼 GameData가 이름을 부르지 않는 그림)을 찾아, 지금 원본이 틀렸으면 생성 전에 묻던 기능입니다. 이전 방식의 생성에서만 돌았으므로 2026-10-08부터는 생성할 때 돌지 않습니다. 원본 변경 목록은 저장된 결과가 있을 때만 「장면 n/m」을 보여 줍니다.', where: 'services/forge/scene.ts · forge gen/scenefind.ts · tool/scenegate.ts' },
      { name: '다른 호 원본 파일 정리', what: '리소스 폴더에 같은 모듈의 다른 학습코드 파일과 바이트까지 같은데 지금 원본은 쓰지 않는 파일이 있으면 원본 변경에서 알립니다. 누르면 휴지통으로 옮기며, 답이 가리키는 파일은 옮기지 않습니다.', where: 'services/forge/leftover.ts · components/bench/OriginPicker.tsx' },
      { name: '공용 파일 가져오기', what: '「대화로 생성」을 누르면 모듈 완성본이 모두 같은 파일을 쓰거나 앞 호들이 계속 재사용한 파일을 원본에서 리소스 폴더로 가져옵니다. 새 버전이 다른 이름으로 들어와 있으면 가져오지 않습니다.', where: 'services/forge/chatprep.ts · commonrsc.ts · carryrsc.ts · forge gen/commonfresh.ts' },
      { name: '그림 크기 맞추기', what: '스펙에 정해진 크기로 그림을 줄이고, 원본의 정확히 두 배 크기로 온 그림을 원본 크기로 줄이는 기능입니다. 이전 방식의 생성에서만 돌았으므로 대화로 만들기에서는 돌지 않습니다.', where: 'services/forge/imgsize.ts' },
      { name: '연결과 미리보기', what: '「N호로 연결」(sparkon link), 앱 안의 미리보기 창(처음에는 16:9로 열고, 크기와 비율은 끌어서 마음대로 바꿉니다), 콘솔 오류(없는 리소스 이름) 표시를 제공합니다.', where: 'components/ViewPanel.tsx · PreviewIssues.tsx · main/preview.ts · services/forge/link.ts · view.ts' },
      { name: '검수 완료와 양산 완료 커밋', what: 'activityInfo.json을 개발 완료로 바꾼 뒤, 해당 학습코드만 「<코드> 양산 완료」로 커밋하고 지금 브랜치를 푸시합니다. 받아 오기(pull)는 하지 않습니다. main에는 그 뒤에 켜지는 「main에 올리기」로 따로 올리고, fast-forward가 가능할 때만 올립니다. main에 갈 커밋을 커밋 결과 줄에 먼저 보여 줍니다. 「<학습코드> 양산 완료」가 아니거나 그 학습코드 폴더 밖을 바꾼 커밋은 목록으로 보여 주고, 버튼이 「다른 커밋 n개 포함해 main에 올리기」로 바뀌어 확인하고 눌러야 올라갑니다. 합친 커밋은 따로 따지지 않습니다. 다른 팀의 학습코드나 빈 뼈대는 처리하지 않습니다. 그 학습코드 폴더에 커밋하지 않은 변경이 있어도 검수 완료는 진행하고, 그 변경은 양산 완료 커밋에 함께 올라갑니다.', where: 'components/bench/DoneCard.tsx · services/forge/done.ts · hallcommit.ts' },
      { name: '이전 방식(제거함)', what: '2026-10-08에 작업대에서 제거했습니다. 「이전 방식」 탭의 생성 버튼과 진행 단계, 질문 카드, AI 전체 생성, AI 에게 맡기기, AI 가 한 일, 저장소에 반영, 좌표 AI로 맞추기, 비교 캔버스, 진행판의 생성 대기열이 함께 사라졌습니다. 그 생성에서만 돌던 변형 판 모듈 확인, 대사 성우 질문 카드, 정답이 원본 그대로인지 확인, 파일 이름을 원본 이름으로 바꾸기, 생성 뒤 미리보기 자동 열기도 지금은 돌지 않습니다. 되살리려면 커밋 fb5c0d4를 봅니다.', where: '저장소 CLAUDE.md 「이전 방식 — 앱에서 걷었다」' }
    ]
  },
  {
    title: '스펙과 검사 (forge)',
    rows: [
      { name: '스펙 120개', what: '모듈마다 항목, 반드시 있어야 할 이름, 관계를 정의합니다.', where: 'forge/_spec/<과목>/<모듈>.json · _spec/_common/' },
      { name: '배치표', what: '호마다 학습코드별 모듈과 원본(사람이 입력한 값)을 정합니다.', where: 'forge/_layout/<과목><M>.json' },
      { name: '스펙 초안', what: '완성본 표본을 비교해 스펙 초안을 만듭니다.', where: 'yarn forge draft <과목/모듈>' },
      { name: '스펙 검사', what: '형식과 왕복 검사, 완성본 값을 스펙이 담는지(⑤), 다시 생성해 비교, 특이값 검사를 합니다.', where: 'yarn check:spec · check:repro · check:odd' },
      { name: '완성본 전체 검사', what: '스펙 검사, fixedAlias, 관계, 항목 제외 규칙, 모듈이 이름으로 부르는 파일을 완성본 전체에 넣어 확인합니다.', where: 'forge tool/donegate.ts · fixedgate.ts · relgate.ts · onlygate.ts · litgate.ts' },
      { name: '관계 추가', what: '규칙 설명을 관계 정의로 옮깁니다.', where: 'forge tool/specrel.ts' }
    ]
  },
  {
    title: '측정과 테스트',
    note: '비용이 0이면 AI를 호출하지 않는다는 뜻입니다.',
    rows: [
      { name: '조립만', what: '저장된 답으로 AI 없이 조립만 합니다. 비용은 0입니다.', where: 'forge tool/asmnow.ts' },
      { name: '파일 목록 검사', what: '저장소 CLAUDE.md의 파일 목록이 실제 파일과 맞는지 확인합니다. 빠지거나 없는 파일이 있으면 실패합니다. 비용은 0입니다.', where: 'electron_app scripts/check-docs.mjs · yarn check:docs' },
      { name: '두 번 생성', what: '이전 방식의 생성(앱에서는 2026-10-08에 제거)을 같은 입력으로 두 번 실행해 두 번째가 0초인지 확인합니다. 비용은 0입니다.', where: 'forge tool/maketwice.ts' },
      { name: 'AI 전체 생성 테스트', what: '이전 방식의 「AI 전체 생성」(앱에서는 2026-10-08에 제거)을 한 번 실행하고 전후의 에러와 카드를 보여 줍니다. AI를 한 번 호출합니다.', where: 'forge tool/wholenow.ts' },
      { name: '맡기기 테스트', what: '이전 방식의 「AI 에게 맡기기」(앱에서는 2026-10-08에 제거)가 사람 답을 빼 둔 항목을 다시 찾아내는지 확인합니다. AI를 한 번 호출합니다.', where: 'forge tool/agentnow.ts' },
      { name: '좌표 찾기 측정', what: 'figma 좌표 찾기 결과가 완성본과 얼마나 가까운지 측정합니다. 비용은 0입니다.', where: 'forge tool/placefind.ts' },
      { name: '토큰 측정', what: '호출 한 번의 토큰과 채팅 방식의 토큰을 측정합니다.', where: 'forge tool/tokens.ts · runs.cjs' }
    ]
  },
  {
    // 2026-10-02 사용자 말 — 「이런 거 때문에 개발하기 힘들었다고 기능 칸 어디다 저장해 놓으면 좋겠다, 남들이 보게」
    title: '자동화하기 어려운 것',
    note: '학습코드마다 사정이 달라 앱이 혼자 정하지 못하는 것입니다. 앱이 어디까지 하고 무엇을 사람에게 묻는지 적었습니다. 새로 겪은 것은 여기에 한 줄 더합니다.',
    rows: [
      { name: '대사 성우의 성별', what: '같은 모듈이어도 호마다 성우가 남자, 여자로 갈립니다(K36은 1호 남, 2, 5, 6, 7, 9호 여). 앞 호 대사를 바이트까지 같은 파일이라고 돌려 쓰면 목소리가 섞입니다. 소리 파일만으로는 성별을 알 수 없고 기획서가 말합니다. figma의 인물 그림도 모든 호가 같아서 단서가 되지 않습니다. 그래서 사람이 받을 리소스 창에서 한 번 고르고 모듈 스펙에 저장합니다.', where: '받을 리소스 창 「대사 성우」 · services/forge/voice.ts' },
      { name: '파일 수와 자리 수가 다름', what: '모듈이 쓰는 소리 자리는 호마다 같은데(K36은 14개) 받는 파일 수는 다릅니다. 새로 녹음한 것만 오고 나머지는 앞 호 것을 돌려 쓰기 때문입니다(7호는 7개, 9호는 5개). 이닝 수가 같아도 그렇습니다. 앱은 새로 온 소리를 이닝 낱말부터 채워 세고, 대사는 성우가 같은 학습코드에서 한 묶음째 고르게 합니다.', where: 'services/forge/rscguide.ts · voiceset.ts' },
      { name: '시작 이미지와 완료 이미지', what: 'K36은 이닝마다 사진 한 장을 크게 확대해서 시작하고(startAnchor) 줄여 가며 완료 화면이 됩니다(endScale). 그림 시트의 「활동 시작 이미지」는 따로 넣는 파일이 아니라 확대된 모습입니다. 확대가 보이려면 완료 사진이 커야 하고(7호는 936×576이라 확대가 거의 없음), 이닝마다 두 값을 시작 이미지가 완료 사진의 어디인지로 정합니다.', where: 'sparkon_common/_common/module/KR/K36/component/QuizImage.ts' },
      { name: 'GameData의 export가 둘', what: 'K36 완성본은 GameData.ts에 빈 activityData를 먼저 두고 실제 값을 quizData에 담았습니다. 도구가 첫 export만 읽어 스펙이 「자리 0개」로 만들어졌고, 9호를 만들면 quizData가 통째로 빠졌습니다. 이제 비어 있는 export는 건너뜁니다(완성본 1586개 중 이 꼴은 K36 다섯 개뿐). check:spec ⑤가 완성본에 값이 있는데 스펙이 비었거나 액티비티가 부르는 export를 스펙이 안 담으면 실패하고, 초안도 자리가 0개면 경고합니다.', where: 'forge gen/surveyread.ts · tool/checkSpecFill.ts · gen/draftrun.ts · _spec/KO/K36.json' },
      { name: '원본 장면이 다른 회차', what: '같은 모듈이어도 호마다 장면이 다릅니다(K36은 박사 판과 탐험가 판). 원본은 AI보다 먼저 정해지고 AI와 도구는 그 원본의 자리에 파일을 짝짓기만 해서, 원본이 틀려도 아무도 다시 묻지 않았습니다(9호가 7호 박사 장면으로 만들어짐). 그래서 figma 화면에서 후보마다 장면 그림을 찾아 원본을 묻게 했지만, 이 확인은 이전 방식의 생성에서만 돌았으므로 2026-10-08부터는 돌지 않고 원본 변경 목록에 저장된 결과만 보입니다. 장면을 새로 그린 회차는 어느 후보와도 맞지 않아 묻지 않았습니다.', where: 'services/forge/scene.ts · forge gen/scenefind.ts' },
      { name: '그림 크기에 따라 정한 값', what: 'K36 endScale처럼 그림 크기를 따라 정한 배율이 있습니다(완성본 7개에서 값은 0.17~1인데 값 × 사진 너비는 830~1250). 원본 값을 그대로 쓰면 사진 크기가 다른 회차에서 화면이 틀어집니다. 이전 방식의 생성은 스펙 필드에 scalesWith를 적으면 원본과 같은 크기로 보이게 다시 계산했습니다(대화로 만들기에서는 돌지 않음). 어느 값이 그런지는 tool/scalegate.ts로 잽니다(K30의 0.5는 판 차이라 적지 않음).', where: 'forge gen/rescale.ts · tool/scalegate.ts' },
      { name: '이닝 낱말 소리의 차례', what: '이닝 낱말 소리가 원본과 다른 이름으로 오면 어느 파일이 몇 번째 이닝인지 파일만으로는 모릅니다(앱은 듣지 못합니다). 완성본은 모두 파일 번호 오름차순이 이닝 차례였습니다. 그 차례로 이었으면 미리보기에서 이닝마다 사진과 소리가 맞는지 들어 보고 확인합니다.', where: 'services/forge/askasset.ts · askorder.ts' }
    ]
  }
]
