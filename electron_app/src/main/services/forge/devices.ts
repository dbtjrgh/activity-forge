/**
 * **학습할 때 카메라 · 마이크를 켜는 학습코드인가** (2026-10-20 사용자 말 — 「학습할때 카메라랑 마이크 쓰는 학습코드들도 따로 표기해줘」).
 *
 * 공용 코드에 학습코드 목록(`sparkLib/Application.ts` `checkDeviceInfo`)이 있지만 **쓰이지 않는 코드다** — 부르는 줄이 주석이다(:471)
 * 그리고 1호(M01)만 적혀 있다. 그래서 목록을 믿지 않고 **장치를 켜는 코드에서 거꾸로 짚었다**(2026-10-20, 공용 모듈 · 1~11호 전부를 읽음).
 * 장치를 켜는 입구는 이것뿐이었다 —
 *   마이크  sparkLib AudioManager.recordStart(:182) · STTButton(:40, 음성 인식이라 getUserMedia 가 없다) · partner_common Com_Recorder(:276 · :200)
 *           · K21 Recoder.prepareMic(:89) · M30 VideoPanel.initAudio(:247) · N04 VideoPanel.initAudio(:243, 누리 — 2026-10-21 에 더함)
 *   카메라  sparkLib CameraSprite.init(:30) · partner_common Com_VideoTape.EnableUserCam(:267) · K06 CameraManager.readyCamera(:36)
 * 모듈마다 그 입구를 쓰나와 조건이 아래 `RULES` 다. 조건이 GameData 에 달린 모듈(E25 · M30 · N04 · CreateSong)은 **개발 완료이고
 * 호 저장소에 GameData 가 있을 때만** 값을 보고, 아니면 「확인 필요」(`maybe`)로 둔다 — 짐작을 확정처럼 보이지 않는다(저장소 규칙 6).
 * 모듈 없이 액티비티 폴더에 따로 짠 코드(ENL3M01W4S1 같은 E25 사본)는 그 폴더를 직접 훑는다.
 *
 * 모듈이 바뀌면(다른 팀도 고친다) 이 표를 다시 맞춘다. 1호 손 목록과 맞춰 보니 14개 중 11개가 같았고, 다른 셋은 CreateSong 이다 —
 * CreateSong 은 녹음을 끈 B2G 모드가 기본(CreateSong.ts:24)이고 지금 GameData 는 그것을 안 바꿔서 카메라 · 마이크를 안 켠다.
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

import fs from 'node:fs'
import path from 'node:path'
import type { DeviceUse, Devices } from '../../../shared/forge'

type Use = { camera?: DeviceUse; mic?: DeviceUse }
/** GameData 글(주석을 뺀 것)을 보고 무엇을 켜나. 글이 없으면(아직 안 만듦) null 을 받는다 */
type Rule = (data: string | null) => Use

/** 조건을 볼 수 없을 때 — 켤 수도 있는 것은 「확인 필요」 */
const maybe = (cond: boolean | undefined, data: string | null): DeviceUse | undefined => (data === null ? 'maybe' : cond ? 'yes' : undefined)

/** 카메라는 늘 켜고, 둘째 장이 videoPanel 이면 마이크도 — 수학 M30 과 누리 N04 가 같은 구조다(CameraPanel 다음 VideoPanel) */
const cameraThenVideo: Rule = (d) => ({ camera: 'yes', mic: maybe(d !== null && /panel\s*:\s*['"]videoPanel['"]/.test(d), d) })

const RULES: Record<string, Rule> = {
  // EN — E11 CameraPanel.ts:70, ShowcaseSpeak RecordBoard.ts:48 · CameraTakePictureScreen.ts:77, ShowcaseSpeakLv2 Record.ts:35 · Panel.ts:57
  E11: () => ({ camera: 'yes' }),
  ShowcaseSpeak: () => ({ camera: 'yes', mic: 'yes' }),
  ShowcaseSpeakLv2: () => ({ camera: 'yes', mic: 'yes' }),
  // E25 UserInput.ts:98 — chatList 의 selectImg 마다 한 번 녹음한다
  E25: (d) => ({ mic: maybe(d !== null && /type\s*:\s*['"]selectImg['"]/.test(d), d) }),
  // CreateSong — B2G 모드(녹음 안 함)가 기본이고 GameData `useB2G_Mode: false` 일 때만 켠다. selfie 장은 카메라와 마이크, concert · bubbleGame 장은 마이크.
  // 기본이 끈 것이라 GameData 를 못 봤으면 「확인 필요」가 아니라 안 켜는 것으로 본다(켜려면 GameData 에 따로 적어야 한다)
  CreateSong: (d) => {
    const on = d !== null && /useB2G_Mode\s*:\s*false/.test(d)
    return {
      ...(on && /type\s*:\s*['"]selfie['"]/.test(d ?? '') ? { camera: 'yes' as const } : {}),
      ...(on && /type\s*:\s*['"](selfie|concert|bubbleGame)['"]/.test(d ?? '') ? { mic: 'yes' as const } : {})
    }
  },
  // KR — K06 CameraManager.ts:36(이닝마다), K21 Recoder.ts:89(불러올 때), K22 Com_Recorder, K23 Com_VideoTape 캠 · 마이크, K32 · K32Type2 · K33 · K36 STTButton
  K06: () => ({ camera: 'yes' }),
  K21: () => ({ mic: 'yes' }),
  K22: () => ({ mic: 'yes' }),
  K23: () => ({ camera: 'yes', mic: 'yes' }),
  K32: () => ({ mic: 'yes' }),
  K32Type2: () => ({ mic: 'yes' }),
  K33: () => ({ mic: 'yes' }),
  K36: () => ({ mic: 'yes' }),
  // MA — M30 은 카메라를 늘 켜고(CameraPanel), 둘째 판이 videoPanel 이면 마이크도(M30.ts:85 · VideoPanel.ts:247). M30_3 은 안 켠다
  M30: cameraThenVideo,
  // NU(2026-10-21) — N04 가 M30 과 같다. 카메라는 늘(N04.ts:135 CameraPanel.init → CameraSprite), quizData[1].panel 이 videoPanel 일 때만
  // VideoPanel.init(N04.ts:140)이 마이크를 연다(VideoPanel.ts:243). 누리 모듈 아홉 가운데 장치를 켜는 입구를 쓰는 것은 N04 하나다
  N04: cameraThenVideo
}

/** 액티비티 폴더에 따로 짠 코드 — 입구를 직접 부르나. `addAsset(` 줄은 그림 · 소리 등록이라 뺀다 */
const LOCAL_MIC = /\.recordStart\s*\(|extends\s+STTButton|new\s+STTButton|SpeechRecognition|getUserMedia\s*\(\s*\{[^}]*audio|new\s+Com_Recorder|prepareMic\s*\(/
const LOCAL_CAMERA = /new\s+CameraSprite|EnableUserCam\s*\(\s*true|readyCamera\s*\(|getUserMedia\s*\(\s*\{[^}]*video/
const DATA_FILES = new Set(['GameData.ts', 'AssetTable.ts'])

/** `//` · `/* *\/` 주석을 지운다 — CreateSong GameData 아홉 개가 `useB2G_Mode:false` 를 주석으로만 적어 두었다 */
const noComments = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1')

function readText(file: string): string | null {
  try {
    return noComments(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** 폴더 안 코드 파일(하위 폴더까지, 데이터 파일 빼고) — 액티비티 폴더는 작다 */
function codeFiles(dir: string, out: string[] = []): string[] {
  let ents: fs.Dirent[] = []
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of ents) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) codeFiles(p, out)
    else if (/\.(ts|vue)$/.test(e.name) && !DATA_FILES.has(e.name)) out.push(p)
  }
  return out
}

const stronger = (a?: DeviceUse, b?: DeviceUse): DeviceUse | undefined => (a === 'yes' || b === 'yes' ? 'yes' : (a ?? b))

/**
 * 한 학습코드가 켜는 장치 — 모듈 표와 액티비티 폴더의 코드를 합친다. 아무것도 안 켜면 null.
 * `modules` 는 `+` 로 이은 모듈 이름(개발 완료면 호 저장소가 쓰는 모듈, 아니면 배치표 판정). `finished` 가 아니면 GameData 를 안 본다
 */
export function devicesOf(actDir: string, modules: string, finished: boolean): Devices | null {
  const names = [...new Set(modules.split('+').filter(Boolean))]
  const data = finished && actDir ? readText(path.join(actDir, 'GameData.ts')) : null
  let use: Use = {}
  const why: string[] = []
  for (const m of names) {
    const r = RULES[m]?.(data)
    if (!r || (!r.camera && !r.mic)) continue
    use = { camera: stronger(use.camera, r.camera), mic: stronger(use.mic, r.mic) }
    why.push(`${m} 모듈`)
  }
  // 따로 짠 코드 — 모듈 표가 「확인 필요」라도 직접 부르면 켠다
  let local: Use = {}
  for (const f of codeFiles(actDir)) {
    const text = (readText(f) ?? '').replace(/^.*\.addAsset\s*\(.*$/gm, '')
    if (LOCAL_MIC.test(text)) local = { ...local, mic: 'yes' }
    if (LOCAL_CAMERA.test(text)) local = { ...local, camera: 'yes' }
  }
  if (local.camera || local.mic) {
    use = { camera: stronger(use.camera, local.camera), mic: stronger(use.mic, local.mic) }
    why.push('액티비티 폴더의 코드')
  }
  if (!use.camera && !use.mic) return null
  return { ...(use.camera ? { camera: use.camera } : {}), ...(use.mic ? { mic: use.mic } : {}), why: why.join(', ') }
}
