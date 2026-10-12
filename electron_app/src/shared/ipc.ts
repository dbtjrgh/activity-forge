/** 메인 프로세스와 렌더러가 함께 쓰는 IPC 채널 이름. 폴더 화면의 모양은 `folders.ts` — 부르는 쪽이 그대로 여기서 받게 다시 내보낸다 */
export * from './folders'


/**
 * IPC 채널 이름. 메인과 preload 양쪽에서 이 상수만 쓴다.
 * 문자열을 각자 적으면 한쪽만 고쳤을 때 런타임에야 조용히 실패한다.
 */
export const IPC = {
  getVersion: 'app:getVersion',
  listFolders: 'fs:listFolders',
  folderInfo: 'fs:folderInfo',
  folderSize: 'fs:folderSize',
  openPath: 'shell:openPath',
  // 양산기 — 앱이 만든 화면
  forgeBoards: 'forge:boards',
  /** 다음 호 열기 — EN · MA 빈 배치표 (M7) */
  forgeOpenIssue: 'forge:openIssue',
  /** 진행판 닫기 — 사람이 정한 칸이 없는 배치표만 휴지통으로 */
  forgeCloseBoard: 'forge:closeBoard',
  /** 배치표가 갈린 칸 한 장 · 그 칸 고르기 (M7) */
  forgeLayoutAsks: 'forge:layoutAsks',
  forgeLayoutPick: 'forge:layoutPick',
  forgeBoard: 'forge:board',
  /** 학습코드별 기록 표 (`runtable.ts`) */
  forgeRunTable: 'forge:runTable',
  forgeWorkspace: 'forge:workspace',
  forgePickWorkspace: 'forge:pickWorkspace',
  /** 리소스를 놓을 자리를 골라 `.user.json` 에 적는다 */
  forgePickRscRoot: 'forge:pickRscRoot',
  /** 그 자리를 글로 정한다. **빈 글이면 원래대로**(호 저장소 안) */
  forgeSetRscRoot: 'forge:setRscRoot',
  /** 만든 사람 · 팀 — 「끝」이 activityInfo.json 에 적는 이름 */
  forgeSetMe: 'forge:setMe',
  /** 스펙이 없는 모듈 — 스펙 주인의 옆줄 알림 */
  forgeNewModules: 'forge:newModules',
  /** 팀 일정표 갱신 — 완료 목록을 내 컴퓨터에 잠깐 띄우고 일정표를 연다(칠하는 것은 엑셀 스크립트) */
  forgeTeamSheet: 'forge:teamSheet',
  /**
   * **스펙을 읽을 양산기 폴더를 고른다** (2026-09-18).
   *
   * zip 으로 받은 앱은 옆에 저장소가 없어 아무 스펙도 못 읽는다. 이 자리만
   * 앱 쪽(`userData/settings.json`)에 적는다 — 나머지 설정의 정본은 그대로
   * `forge/.user.json` 이다 (`services/forge/home.ts` 에 까닭이 있다).
   */
  forgePickForgeRoot: 'forge:pickForgeRoot',
  forgeSetForgeRoot: 'forge:setForgeRoot',
  /** 그 폴더의 저장소에서 새 스펙을 받는다 (`git pull --ff-only`, 고친 것이 있으면 안 받음) */
  forgeRefreshSpecs: 'forge:refreshSpecs',
  /** 원격에 새 판이 있나 — fetch 한 번 뒤 몇 커밋 뒤처졌나. 받지는 않는다 */
  forgeUpdateCheck: 'forge:updateCheck',
  // 양산기 — 리소스 화면 (앱이 만든 화면)
  /** 그 학습코드의 리소스 폴더를 만들고 탐색기로 연다 — 누를 때만 만든다 */
  forgeResourceDir: 'forge:resourceDir',
  /** 학습코드 하나로 「묻지 않고 알 수 있는 것」을 한 번에 받는다 */
  forgePrepare: 'forge:prepare',
  /**
   * 클립보드의 그림을 그 차시의 figma 화면으로 넣는다 (Ctrl+V).
   * 폴더를 찾아 들어가 파일로 저장하게 하지 않는다.
   */
  forgePasteShot: 'forge:pasteShot',
  /**
   * 그 회차에 붙여넣은 화면 **전부**를 미리보기와 함께 돌려준다.
   * 잘못 붙였는지를 글이 아니라 **그림으로** 보게 하려는 것이다.
   */
  forgeShots: 'forge:shots',
  /** 리소스 폴더 안 그림 몇 장의 **작은 썸네일** — 고르기 후보 · 리소스 목록 (M4) */
  forgeThumbs: 'forge:thumbs',
  /** 원본 바꾸기 — 그 모듈을 쓴 앞 학습코드 전부 · 하나 골라 배치표에(null 이면 처음 추천으로) */
  forgeOriginChoices: 'forge:originChoices',
  forgeOriginPick: 'forge:originPick',
  /** 폴더에 남은 다른 호 원본 파일을 휴지통으로 — 학습코드만 받고 목록은 메인이 다시 센다 */
  forgeLeftoverTrash: 'forge:leftoverTrash',
  /** 그 화면 **한 장**을 지운다 */
  forgeDropShot: 'forge:dropShot',
  forgeMoveShot: 'forge:moveShot',
  /** 그 화면을 **모두** 지운다 */
  forgeClearShot: 'forge:clearShot',
  /** 끌어다 놓은 기획서 파일(PDF 따위)을 그 회차에 넣는다 */
  forgeAddShotFile: 'forge:addShotFile',
  /**
   * 끌어다 놓은 파일·폴더를 그 차시의 리소스 폴더에 넣는다 (4단계).
   * 갈래를 못 가린 것과 이미 있는 것은 **안 넣고** 목록으로 돌려준다.
   */
  forgeInbox: 'forge:inbox',
  /**
   * **차시를 안 정하고** 통째로 놓은 것을 도구가 갈라 넣는다 (2026-09-16).
   * 위와 달리 학습코드를 받지 않는다 — 폴더 이름과 파일 이름에서 가린다.
   * 못 가린 것은 **안 넣고** 목록으로 돌려준다.
   */
  forgeSort: 'forge:sort',
  /** 대화로 만들기 (2026-10-08, `chat.ts`) — 형편 읽기 · 시작 · 사람의 답 · 멈추기 · 기록 지우기 · 메인이 미는 소식 */
  forgeChatGet: 'forge:chat:get',
  forgeChatStart: 'forge:chat:start',
  forgeChatReply: 'forge:chat:reply',
  forgeChatStop: 'forge:chat:stop',
  forgeChatClear: 'forge:chat:clear',
  forgeChatEvent: 'forge:chat:event',
  /** 띄우기 전 점검 — 정션이 걸렸나, 어느 호가 걸려 있나 */
  forgeViewCheck: 'forge:viewCheck',
  forgeLink: 'forge:link',
  /** 호 저장소의 dev 서버를 띄운다 */
  forgeViewStart: 'forge:viewStart',
  /** 그 서버를 내린다 */
  forgeViewStop: 'forge:viewStop',
  /** 「끝」 — 호 저장소의 activityInfo.json 을 개발 끝으로 (M7) */
  forgeDone: 'forge:done',
  /** 「양산 완료 커밋」 — 호 저장소에 그 학습코드만 커밋 · 푸시 · main (`hallcommit.ts`) */
  forgeCommit: 'forge:commit',
  forgePushMain: 'forge:pushMain',
  /** 호 저장소에 있는데 안 쓰는 리소스 — 목록 · 휴지통으로 (`pubextra.ts`) */
  forgePubExtra: 'forge:pubExtra',
  forgePubExtraTrash: 'forge:pubExtraTrash',
  /** 완료 뒤 리소스 폴더 정리 — 무엇을 옮기나 · 옮기기 (`rscclean.ts`) */
  forgeRscCleanPlan: 'forge:rscCleanPlan',
  forgeRscClean: 'forge:rscClean',
  /** 서버가 뱉는 줄을 그때그때 화면으로 */
  forgeViewLog: 'forge:view:log',
  /** 바깥 브라우저로 주소 열기 */
  openUrl: 'shell:openUrl',
  /** 앱 안 창 — dev 서버 주소를 연다 */
  forgePreviewOpen: 'forge:previewOpen',
  /** 미리보기 창 콘솔에 모인 오류 — 빈 화면의 까닭 */
  forgePreviewIssues: 'forge:previewIssues',
  /** 그 모듈 하나에만 재현 검사를 돌린다 */
  forgeRepro: 'forge:repro',
  // 「관리」 화면 (2026-09-30) — 읽기만. 완성본 점검 「다시 재기」만 `_recipe/_gate.json` 을 쓴다
  manageRepos: 'manage:repos',
  manageRsc: 'manage:rsc',
  manageGate: 'manage:gate',
  manageGateRun: 'manage:gateRun',
  manageTeams: 'manage:teams',
  // 받을 리소스 창 (2026-09-30) — 읽기만. 앞 학습코드 리소스를 figma 옆에 그림으로
  guideGet: 'guide:get',
  guideThumbs: 'guide:thumbs',
  guideOpen: 'guide:open',
  guideTop: 'guide:top',
  guideVoice: 'guide:voice',
  guideVoiceSet: 'guide:voiceSet',
  guideVoiceUse: 'guide:voiceUse',
  guideVoiceHear: 'guide:voiceHear',
  guideVoiceKeep: 'guide:voiceKeep',
  // 처음 설정 (2026-10-01) — 양산기 폴더를 못 찾으면 뜨는 창. 작업 폴더를 고르면 저장소를 내려받고 다시 켠다
  setupState: 'setup:state',
  setupPickWork: 'setup:pickWork',
  setupRun: 'setup:run',
  setupOpenInstall: 'setup:openInstall'
} as const
