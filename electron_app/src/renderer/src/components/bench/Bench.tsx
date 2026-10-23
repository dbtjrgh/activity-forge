import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Prepare } from '../../../../shared/forge'
import Splitter, { useWidth } from '../Splitter'
import ViewPanel from '../ViewPanel'
import DoneCard from './DoneCard'
import BenchHead from './BenchHead'
import BenchLeft from './BenchLeft'
import ChatFlow from './ChatFlow'
import ChatSide from './ChatSide'
import OwnerLock from './OwnerLock'
import PlanModuleNotice from './PlanModuleNotice'
import { orderOf, TARGET } from '../../lib/benchorder'
import { useChat } from './useChat'
import './bench.css'

/**
 * **작업대** — 진행판에서 칸을 누르면 열린다 (2026-09-29, M4). 옛 `Resource.tsx` + `RunPanel.tsx` 를 옮겼다.
 *
 *   머리줄   학습코드 · 모듈 · 원본 — 어느 칸을 보든 늘 같은 자리
 *   왼쪽     사람이 줄 것(리소스 · figma 화면 · 기획서)과 모자란 것 · 폴더 · 권한 (`BenchLeft`)
 *   가운데   대화로 만들기 — 그 아래 띄워 보기 · 검수
 *   오른쪽   Claude 와의 대화
 *
 * **대화로 만들기 하나뿐이다** (2026-10-08 사용자 결정 — 「M07 했듯이」). 이전 방식(걸음 네 무리 · 물음 카드 · 비교 캔버스)은
 * 같은 날 걷었다 — 되살리려면 fb5c0d4 를 본다.
 * 1440×960 에서 **스크롤 없이** 보이게 칸마다 따로 스크롤한다. **묻지 않고 알 수 있는 것을 먼저 보여 주고, 모르는 것은 모른다고 적는다.**
 */
function Bench({ code, onBack }: { code: string; onBack: () => void }) {
  const [data, setData] = useState<Prepare | null>(null)
  const [busy, setBusy] = useState(false)
  // 왼쪽 · 오른쪽 칸 너비 — 끌어서 바꾸고 이 PC 에 기억한다. 가운데가 나머지를 갖는다
  const [leftW, setLeftW, resetLeft] = useWidth('benchLeftW', 280, 200, 640)
  const [rightW, setRightW, resetRight] = useWidth('benchRightW', 400, 280, 820)
  // 남이 끝낸 학습코드를 「그래도 고치기」로 풀었나 — 이 학습코드에서만, 다른 학습코드로 가면 다시 잠근다(`OwnerLock`)
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [code])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setData(await window.api.forgePrepare(code))
    } finally {
      setBusy(false)
    }
  }, [code])

  useEffect(() => {
    setData(null)
    void load()
  }, [load])

  // 폴더가 없으면 forge 가 만들고 탐색기로 연다. **열어 보기만 해서는 폴더가 생기지 않는다** — 누를 때만 만든다.
  const openRsc = useCallback(async () => {
    if (!data) return
    if (data.rsc.exists) await window.api.openPath(data.rsc.dir)
    else await window.api.forgeResourceDir(code)
    await load()
  }, [data, code, load])

  // 대화로 만들기는 **모듈을 정한 뒤에만** 돈다
  const canRun = Boolean(data?.layout.ok)
  // 「갈림」이어도 받는 칸은 연다 — 리소스 · 기획서를 먼저 넣고 모듈은 진행판에서 고른다 (5단계)
  const canDrop = Boolean(data && (data.layout.ok || data.layout.verdict === '갈림'))
  const chat = useChat(data?.code ?? code, load)

  if (!data) {
    return (
      <div className="bench">
        <p className="state">{code} 불러오는 중…</p>
      </div>
    )
  }

  const { layout, write } = data
  // 미리보기 · 검수 완료를 여나 — 모듈을 정했거나, 새 모듈의 첫 학습코드(원본은 없음), 배치표는 못 정했지만 이미 개발 완료인 것
  const shown = layout.ok || Boolean(layout.first) || Boolean(layout.made)
  // 대화로 만들었거나, 이미 호 저장소에 쓴 것(이전 방식 · 손으로)이 있으면 반영된 것으로 본다
  const wrote = chat.info?.state === 'done' || data.written
  // 지금 할 일 하나 — 순서 막대가 보인다(`lib/benchorder.ts`). 못 돌리는 까닭도 거기만 적는다
  const order = orderOf({ data, canRun, busy: chat.busy, chat: chat.info })
  // 남이 끝낸 학습코드 — 풀기 전에는 고치는 단추를 막고(`lock` 은 그 까닭), 푼 뒤에는 메인에 `force` 로 부른다. 메인이 같은 판단으로 다시 막는다
  const theirs = Boolean(data.owner?.theirs)
  const force = theirs && open
  const lock = theirs && !open ? (data.owner?.line ?? '') : ''

  return (
    <div className="bench">
      <BenchHead data={data} busy={busy} order={order} onBack={onBack} onReload={() => void load()} onOpenRsc={() => void openRsc()} />
      {/* 지난 호에서 모듈이 달라 보기만 하는 칸(`made`)은 풀 단추 없이 경고만 */}
      <OwnerLock code={data.code} line={data.owner?.line ?? ''} open={open} canOpen={!layout.made} onOpen={() => setOpen(true)} />
      <PlanModuleNotice code={data.code} seen={data} onChanged={() => void load()} />

      <div className="bench-cols" style={{ '--bench-left': `${leftW}px`, '--bench-right': `${rightW}px` } as CSSProperties}>
        <BenchLeft
          data={data}
          canRun={canDrop}
          busy={busy}
          running={chat.busy}
          lock={lock}
          force={force}
          onChanged={() => void load()}
          onPasted={load}
          onOpen={() => void openRsc()}
        />
        <Splitter width={leftW} onWidth={setLeftW} onReset={resetLeft} label="왼쪽 영역 너비" />

        <main className="bench-col bench-mid">
          {/* 못 돌리는 까닭은 바로 위 순서 막대가 말한다 — 여기 다시 적지 않는다 */}
          {canRun && <ChatFlow chat={chat} canRun={canRun} lock={lock} force={force} noShot={data.needsShot && data.shots === 0} />}
          {/* 아직 모듈을 모르면 띄울 것도 없다. 새 모듈의 첫 학습코드는 원본이 없어도 모듈은 안다 — 세션에서 만든 것을 보고 검수한다 */}
          <div id={TARGET.done}>
            {shown && <ViewPanel code={data.code} moduleName={layout.module} />}
            {/* 앱 안 창에서 보고 누른다 — 호 저장소의 activityInfo.json 이 개발 끝이 된다 (M7) */}
            {/* 지난 호 완성본(`made`)은 보기만 — 검수 완료가 완료 날짜 · 만든 사람을 오늘 · 나로 덮고, 양산 완료 커밋이 옛 호 저장소에 커밋한다 */}
            {shown && !layout.made && (
              <DoneCard
                code={data.code}
                wrote={wrote}
                dummy={Boolean(write.dummy) && !wrote}
                wait={chat.wait}
                lock={lock}
                force={force}
                committed={Boolean(data.owner?.committed)}
                look={chat.look}
                onSeen={() => void chat.lookSeen()}
                onDone={load}
              />
            )}
          </div>
        </main>
        <Splitter width={rightW} onWidth={setRightW} onReset={resetRight} grow={-1} label="오른쪽 영역 너비" />

        <section className="bench-col bench-right">{canRun && <ChatSide chat={chat} />}</section>
      </div>
    </div>
  )
}

export default Bench
