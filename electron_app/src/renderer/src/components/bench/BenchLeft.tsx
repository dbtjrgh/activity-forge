import type { Prepare } from '../../../../shared/forge'
import DropAll from '../DropAll'
import LayoutCard from '../LayoutCard'
import NeedCard from '../NeedCard'
import PlanDrop from '../PlanDrop'
import RscDrop from '../RscDrop'
import ShotPaste from '../ShotPaste'
import { TARGET } from '../../lib/benchorder'
import { FolderCard, WriteCard } from './FolderCard'

/**
 * 작업대 **왼쪽 칸** — 사람이 줄 것(리소스 · figma 화면 · 기획서)과 모자란 것 · 모듈과 원본 · 폴더 · 권한.
 * `Bench.tsx` 에서 뗐다(2026-10-08, 200줄을 넘어서 — 동작 변화 없음).
 * `canRun` — 받는 칸을 여나(모듈을 정했거나 「갈림」). `onChanged` — 리소스 · 원본이 바뀌었다(다시 읽는다). `onPasted` — figma 화면을 붙였다
 */
export default function BenchLeft({
  data,
  canRun,
  busy,
  running,
  onChanged,
  onPasted,
  onOpen
}: {
  data: Prepare
  canRun: boolean
  busy: boolean
  running: boolean
  onChanged: () => void
  onPasted: () => Promise<void>
  onOpen: () => void
}) {
  const { layout, rsc, need, write } = data
  return (
    <aside className="bench-col bench-left">
      {/* **화면 어디에 놓아도 받는다** — 끌고 들어오면 전체가 켜지고, 확장자로 나눠 칸에 넘긴다 (`DropAll.tsx`) */}
      {canRun && <DropAll busy={running} />}
      {canRun && (
        <div className="bays bays-stack">
          <RscDrop code={data.code} busy={busy} files={rsc.files.length} onDone={onChanged} />
          <div id={TARGET.shot}>
            {/* 붙이면 화면 장수가 바뀐다 — 순서 막대가 보도록 다시 읽는다 */}
            <ShotPaste code={data.code} busy={running} onPasted={onPasted} />
          </div>
          {/* 넣으면 다시 읽는다 — 갈린 MA 칸은 그때 기획서의 모듈넘버로 채워진다 */}
          <PlanDrop code={data.code} busy={running} reader={data.planReader} onChanged={onChanged} />
        </div>
      )}
      <div id={TARGET.need}>
        <NeedCard code={data.code} need={need} needError={data.needError} />
      </div>
      <div id={TARGET.layout}>
        {/* 원본을 바꾸면 새 원본으로 다시 읽는다 */}
        <LayoutCard code={data.code} layout={layout} hasSpec={data.hasSpec} onChanged={onChanged} />
      </div>
      <FolderCard code={data.code} rsc={rsc} onOpen={onOpen} />
      <WriteCard write={write} />
    </aside>
  )
}
