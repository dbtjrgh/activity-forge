import type { ReactNode } from 'react'
import { HO_OF, type RegressResult } from '../../../../shared/forge'
import GateSection from './GateSection'
import RegressSection, { regressTally, regressTrouble } from './RegressSection'
import RepoSection, { repoTrouble } from './RepoSection'
import RscSection, { fileCount } from './RscSection'
import TeamSection from './TeamSection'
import { useManage, type ManageData } from './useManage'
import { useRegress } from './useRegress'
import './manage.css'

/**
 * 「관리」 화면 (2026-09-30) — 양산 말고 **스파크온 전체의 형편**. 호 저장소 · 받을 리소스 · 완성본 점검 · 팀별 · 모듈 회귀 검사(2026-10-15).
 * **읽기만 한다** — 완성본 점검 「다시 재기」가 `_recipe/_gate.json` 을, 회귀 검사 「돌려 보기」가 `_recipe/_regress.json` 을 쓰는 것뿐이다.
 * 남의 저장소는 안 건드린다. 맨 위 다섯 장은 칸마다 한 줄 요약이고, 누르면 그 칸으로 내려간다.
 */
type Tile = {
  id: string
  title: string
  value: string
  note: string
  tone: 'ok' | 'warn' | 'fail' | 'wait'
}

function tiles(d: ManageData): Tile[] {
  const repos = d.repos?.repos ?? []
  const bad = repos.filter(repoTrouble)
  const rscRows = d.rsc?.rows ?? []
  const part = rscRows.filter((r) => !r.empty)
  const files = part.reduce((a, r) => a + fileCount(r), 0)
  const gate = d.gate
  const done = (d.teams?.teams ?? []).reduce((a, t) => a + t.total, 0)
  const folders = Object.values(d.teams?.folders ?? {}).reduce((a, n) => a + n, 0)
  return [
    {
      id: 'repos',
      title: '호 저장소',
      value: d.repos ? (bad.length ? `${bad.length}곳 확인 필요` : '정상') : '…',
      note: d.repos ? `전체 ${repos.length}개 중` : '불러오는 중',
      tone: !d.repos ? 'wait' : bad.some((r) => repoTrouble(r) === 'fail') ? 'fail' : bad.length ? 'warn' : 'ok'
    },
    {
      id: 'rsc',
      title: '받을 리소스',
      value: d.rsc ? (rscRows.length ? `학습코드 ${rscRows.length}개` : '없음') : '…',
      // 없는 소리는 덜 온 칸 것만 — 기획서에 적혔는데 없는 이름이라 확실하다(2026-10-14, `rsccount.ts`)
      note: d.rsc
        ? `${d.rsc.month ? `${HO_OF[d.rsc.month]?.name ?? `M${d.rsc.month}`}: ` : ''}${rscRows.length ? `일부 수신 ${part.length}개${files ? `(없는 소리 ${files}개)` : ''}, 미수신 ${rscRows.length - part.length}개` : '대기 중인 학습코드 없음'}`
        : '불러오는 중',
      tone: !d.rsc ? 'wait' : rscRows.length ? 'warn' : 'ok'
    },
    {
      id: 'gate',
      title: '완성본 점검',
      value: !gate ? '…' : !gate.at ? '점검 전' : gate.failed.length ? `${gate.failed.length}개 실패` : '모두 통과',
      note: gate?.at ? `점검 ${gate.passed + gate.failed.length}개 중` : '',
      tone: !gate || !gate.at ? 'wait' : gate.failed.length ? 'fail' : 'ok'
    },
    {
      id: 'teams',
      title: '완료한 학습코드',
      value: d.teams ? `${done}` : '…',
      note: d.teams ? `폴더 ${folders}개 중` : '불러오는 중',
      tone: d.teams ? 'ok' : 'wait'
    }
  ]
}

/** 회귀 검사 요약 칸 — 지난 결과 기준. 「모두 통과」는 끝 화면까지 다 간 때만, 첫 이닝까지만 본 것이 있으면 「오류 없음」과 그 수 */
function regressTile(last: RegressResult | null, running: boolean): Tile {
  const { bad, firstOnly } = regressTally(last?.rows ?? [])
  return {
    id: 'regress',
    title: '모듈 회귀 검사',
    value: running ? '실행 중' : !last ? '…' : !last.at ? '실행 전' : bad ? `${bad}개 확인 필요` : firstOnly ? '오류 없음' : '모두 통과',
    note: last?.at ? `${last.modules.join(', ')} 완성본 ${last.rows.length}개${!bad && firstOnly ? `, ${firstOnly}개는 첫 이닝까지만` : ''}` : '',
    tone: running || !last || !last.at ? 'wait' : last.rows.some((r) => regressTrouble(r) === 'fail') ? 'fail' : bad ? 'warn' : 'ok'
  }
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`manage-${id}`} className="manage-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Manage() {
  const { data, reload, measuring, measure, pickMonth } = useManage()
  const reg = useRegress()
  const go = (id: string): void => document.getElementById(`manage-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="board manage">
      <div className="board-head">
        <h2>관리</h2>
        <span className="manage-grow" />
        <button
          className="ghost"
          onClick={() => {
            reload()
            reg.reload()
          }}
        >
          새로고침
        </button>
      </div>
      <div className="manage-tiles">
        {[...tiles(data), regressTile(reg.last, reg.progress.running)].map((t) => (
          <div
            key={t.id}
            className={`manage-tile ${t.tone}`}
            role="link"
            tabIndex={0}
            onClick={() => go(t.id)}
            onKeyDown={(e) => e.key === 'Enter' && go(t.id)}
          >
            <span className="manage-tile-title">{t.title}</span>
            <b className="manage-tile-value">{t.value}</b>
            {t.note && <span className="sub">{t.note}</span>}
          </div>
        ))}
      </div>
      <Section id="repos" title="호 저장소">
        <RepoSection status={data.repos} />
      </Section>
      <Section id="rsc" title="받을 리소스">
        <RscSection wait={data.rsc} onMonth={pickMonth} />
      </Section>
      <Section id="gate" title="완성본 점검">
        <GateSection gate={data.gate} measuring={measuring} onMeasure={measure} />
      </Section>
      <Section id="regress" title="모듈 회귀 검사">
        <RegressSection changed={reg.changed} last={reg.last} progress={reg.progress} runError={reg.runError} onRun={reg.run} />
      </Section>
      <Section id="teams" title="팀별 완료 현황">
        <TeamSection tally={data.teams} />
      </Section>
    </div>
  )
}

export default Manage
