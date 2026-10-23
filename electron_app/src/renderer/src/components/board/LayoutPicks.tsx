import { useCallback, useEffect, useState } from 'react'
import { oneModule, type BoardRow, type LayoutAsk, type LayoutAsks, type ModuleFolders } from '../../../../shared/forge'

/**
 * **배치표가 갈린 칸 한 장** (2026-09-29, M7) — 진행판 위에서 칸마다 모듈을 고른다. 칸마다 작업대를 열지 않는다.
 *
 * - 후보는 앞선 호가 실제로 쓴 것뿐이다(작업대 모듈 카드와 같은 셈). **까닭을 적어야** 배치표에 남는다
 * - EN 은 앞선 호 같은 칸 기획서의 「호별 사용 유형」 쪽을 붙인다. 못 찾으면 그렇다고 적는다 — 짐작으로 고르지 않는다
 * - 메뉴 이름표(`ActivityData.ts`)를 한 줄로 보인다. 이름표를 고치는 것은 사람 몫이다
 * - **앞선 호 기록이 없어 후보가 0개인 칸**(2026-10-21, 1호 누리 L2 · L3)은 공용 모듈 폴더 목록에서 고른다(`modulefolders.ts`).
 *   목록은 열 때마다 폴더를 읽는다 — 다른 팀이 모듈 폴더를 더하면 코드를 안 고쳐도 나온다.
 *   까닭은 기본 글을 미리 채워 둔다 — 고를 근거(앞선 호)가 없다는 것 자체가 까닭이고, 누가 언제 정했는지는 `carry.ts` 가 붙인다. 고쳐 써도 된다
 */
export default function LayoutPicks({ subject, issue, rows, onChanged }: { subject: string; issue: string; rows: BoardRow[]; onChanged: () => void }) {
  // 이미 끝난 칸은 빼고 센다 — 판정만 갈림으로 남은 완성본(EN07 ENL2M07W3S3)이 섰다
  const split = rows.filter((r) => r.stage === '모듈 못 정함' && !r.work?.finished).length
  const [got, setGot] = useState<LayoutAsks | null>(null)
  const [folders, setFolders] = useState<ModuleFolders | null>(null)

  const load = useCallback(async () => {
    const [asks, dirs] = await Promise.all([window.api.forgeLayoutAsks({ subject, issue }), window.api.forgeModuleFolders(subject)])
    setGot(asks)
    setFolders(dirs)
  }, [subject, issue])
  useEffect(() => {
    if (split) void load()
    else setGot(null)
  }, [split, load])

  if (!split) return null
  const list = got?.rows ?? []
  const free = list.some((r) => !r.ask.options.length)
  // 칸마다 까닭이 같으면(9호 기획서가 아직 없음) 위에 한 번만 — 여덟 줄에 같은 글이 서면 안 읽힌다
  const whys = [...new Set(list.filter((r) => !r.plan).map((r) => r.planWhy))]
  const once = whys.length === 1 && list.every((r) => !r.plan) ? (whys[0] ?? '') : ''
  // 읽은 뒤에는 목록 수를 쓴다 — 제목 수와 아래 줄 수가 늘 같게
  const count = got && !got.error ? list.length : split
  // 고르면(`onPicked`) 진행판만 다시 읽는다(2026-10-21) — 고른 칸이 「모듈 못 정함」에서 빠져 `split` 이 줄면 위 effect 가 한 번 읽는다.
  // 고른 자리에서도 읽었더니 고를 때마다 메인이 호 저장소를 두 번 훑었다
  return (
    <details className="layout-picks card" open={count <= 8}>
      <summary>
        모듈 선택이 필요한 학습코드 <strong>{count}</strong>개
      </summary>
      {!got && <p className="sub">불러오는 중…</p>}
      {got?.error && <p className="state error">{got.error}</p>}
      {once && <p className="sub">{once}</p>}
      {free && folders && <FolderNote folders={folders} />}
      {list.map((r) => (
        <PickRow
          key={r.code}
          row={r}
          quiet={Boolean(once)}
          folders={folders}
          used={oneModule(rows.find((b) => b.code === r.code)?.usedModule ?? '')}
          onPicked={onChanged}
        />
      ))}
    </details>
  )
}

/**
 * 앞선 호 기록이 없을 때 남기는 까닭 — 배치표에 이 글 뒤로 날짜와 이름이 붙는다.
 * 고른 모듈이 어디서 왔나로 둘이다(2026-10-21) — 목록 맨 앞의 「호 저장소가 이미 부르는 모듈」은 공용 모듈 폴더에 없는 것(sparkLib 모듈)이라
 * 「폴더에서 골랐다」로 남기면 틀린 기록이 된다
 */
const NO_HISTORY_WHY = {
  folder: '앞선 호에 이 위치의 학습코드가 없어 공용 모듈 폴더에서 골랐습니다.',
  used: '앞선 호에 이 위치의 학습코드가 없어 호 저장소의 Activity.ts 파일이 불러오는 모듈을 골랐습니다.'
}
const DEFAULT_WHYS: string[] = Object.values(NO_HISTORY_WHY)

/** 모듈 폴더 목록을 못 읽었거나 뺀 폴더가 있으면 한 번만 */
function FolderNote({ folders }: { folders: ModuleFolders }) {
  if (folders.error) return <p className="state error">{folders.error}</p>
  if (!folders.modules.length) return <p className="state error">공용 모듈 폴더에 모듈이 없습니다: {folders.dir}</p>
  if (!folders.skipped.length) return null
  return <p className="sub">모듈 이름으로 쓸 수 없는 폴더는 목록에서 뺐습니다: {folders.skipped.join(', ')}</p>
}

function PickRow({
  row,
  quiet,
  folders,
  used,
  onPicked
}: {
  row: LayoutAsk
  quiet: boolean
  folders: ModuleFolders | null
  /** 호 저장소의 그 액티비티가 이미 부르는 모듈 — 빈 뼈대면 빈 글 */
  used: string
  onPicked: () => void
}) {
  const free = !row.ask.options.length
  const [pick, setPick] = useState('')
  const [why, setWhy] = useState(free ? NO_HISTORY_WHY.folder : '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  // 저장소가 부르는 모듈이 폴더에 없으면(sparkLib 모듈 · 모듈 둘) 목록 앞에 둔다
  const outside = Boolean(used) && !folders?.modules.includes(used)
  const choices = free ? [...(outside ? [used] : []), ...(folders?.modules ?? [])] : []
  // 까닭이 아직 기본 글이면 고른 모듈에 맞는 기본 글로 바꾼다 — 사람이 고쳐 쓴 글은 그대로 둔다
  const choose = (m: string): void => {
    setPick(m)
    if (DEFAULT_WHYS.includes(why)) setWhy(outside && m === used ? NO_HISTORY_WHY.used : NO_HISTORY_WHY.folder)
  }

  const send = async (): Promise<void> => {
    setBusy(true)
    try {
      const r = await window.api.forgeLayoutPick(row.code, pick, why)
      setNote(r.note)
      if (r.ok) onPicked()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pick-row">
      <div className="pick-head">
        <span className="mono">{row.code}</span>
        {row.label && <span className="tag">{row.label}</span>}
        <span className="sub">{row.ask.desc}</span>
      </div>
      <div className="pick-body">
        <div className="pick-choose">
          {free ? (
            <>
              <select className="pick-select" value={pick} onChange={(e) => choose(e.target.value)} disabled={!choices.length}>
                <option value="">모듈 선택</option>
                {choices.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {used && <p className="sub">호 저장소의 Activity.ts 파일이 {used} 모듈을 불러옵니다.</p>}
            </>
          ) : (
            row.ask.options.map((o) => (
              <label key={o.value} className={pick === o.value ? 'on' : ''}>
                <input type="radio" name={row.code} checked={pick === o.value} onChange={() => setPick(o.value)} />
                <span className="mono">{o.value}</span> <span className="sub">{o.why}</span>
              </label>
            ))
          )}
          <input className="pick-why" placeholder="선택 이유" value={why} onChange={(e) => setWhy(e.target.value)} />
          <p className="row-actions">
            <button className="go" onClick={() => void send()} disabled={busy || !pick || !why.trim()}>
              배치표에 저장
            </button>
            {row.plan && (
              <button className="ghost" onClick={() => void window.api.openPath(row.plan?.file ?? '')}>
                기획서 열기
              </button>
            )}
            {note && <span className="sub">{note}</span>}
          </p>
        </div>
        {row.plan?.image ? (
          <figure className="pick-plan">
            <img src={row.plan.image} alt="" />
            <figcaption className="sub">기획서 {row.plan.page}쪽, 호별 사용 유형</figcaption>
          </figure>
        ) : quiet ? null : (
          <p className="sub pick-plan">{row.planWhy}</p>
        )}
      </div>
    </div>
  )
}
