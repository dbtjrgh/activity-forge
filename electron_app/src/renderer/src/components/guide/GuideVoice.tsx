import { useCallback, useEffect, useState } from 'react'
import type { VoiceGender, VoiceInfo, VoiceSet } from '../../../../shared/forge'
import { decode, play } from '../../lib/voiceplay'
import './guidevoice.css'

/**
 * 받을 리소스 창의 **「대사 성우」** (2026-10-02 사용자 말 — 「기획서 참고해서 여자인지 남자인지 알아오고 해당 사람 음원 나레이션 가져오는 느낌」).
 *
 * 같은 모듈이어도 호마다 대사 성우가 다르다. 이 학습코드 성우의 성별을 정하고, 같은 성별의 완성본 대사를 **한 묶음째** 가져온다.
 * 성별의 정본은 스펙 `voices`(메인 `voice.ts`) — 한 번 정하면 다음 학습코드에서도 그 완성본의 성별이 보인다.
 * ▶ 는 각 완성본의 시작 대사, 이 학습코드는 폴더에 새로 온 소리 하나를 튼다.
 * - **바이트까지 같은 대사 묶음은 한 줄**이다(메인이 묶는다, `twins`) — K33 은 같은 2호 대사가 아홉 줄로 나왔다(2026-10-06)
 * - **목소리 높이(Hz)는 안 보인다** — 아이 목소리는 남자도 220~345Hz 로 잡혀 「높은 목소리」가 남자 성우를 여자처럼 보이게 했다(2026-10-06)
 * - **같은 성별 대사가 어느 호에도 없으면** 그렇다고 말하고 「그대로 쓰기」를 준다 — 없는 것을 고르라고 하던 것(K33 9호 남자 성우)
 */
const GENDERS: VoiceGender[] = ['여', '남']

function Pick({ value, onPick, disabled }: { value: VoiceGender | null; onPick: (g: VoiceGender | null) => void; disabled: boolean }) {
  return (
    <span className="guide-seg voice-pick">
      {GENDERS.map((g) => (
        <button key={g} className={value === g ? 'on' : ''} disabled={disabled} onClick={() => onPick(value === g ? null : g)}>
          {g}
        </button>
      ))}
    </span>
  )
}

const label = (s: VoiceSet): string => (s.twins.length ? `${s.code} 외 ${s.twins.length}개` : s.code)

export default function GuideVoice({ code, onChanged }: { code: string; onChanged: () => void }) {
  const [info, setInfo] = useState<VoiceInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [heard, setHeard] = useState<Record<string, string>>({})

  useEffect(() => {
    void window.api.guideVoice(code).then(setInfo)
  }, [code])

  const hear = useCallback(
    async (from: string) => {
      const got = await window.api.guideVoiceHear(code, from)
      if (!got) return setHeard((p) => ({ ...p, [from]: '들어 볼 소리가 없습니다.' }))
      try {
        play(await decode(got.bytes))
        setHeard((p) => ({ ...p, [from]: '' }))
      } catch {
        setHeard((p) => ({ ...p, [from]: `${got.file} 파일을 재생하지 못했습니다.` }))
      }
    },
    [code]
  )

  /**
   * **같은 성별 대사를 알아서 고른다** (2026-10-02 사용자 말 — 「알아서 … 사용자가 귀찮아할텐데」). 성별이 같다고 저장됐고,
   * 대사가 다 있는 완성본 가운데 앞선 것(원본 고르는 차례). 없으면 null
   */
  const bestFor = (v: VoiceInfo, g: VoiceGender): VoiceSet | null =>
    v.sets.find((s) => s.gender === g && s.files === v.talk.length) ?? null

  const act = async (run: () => Promise<{ ok: boolean; note: string; error?: string; info: VoiceInfo }>): Promise<VoiceInfo | null> => {
    setBusy(true)
    try {
      const r = await run()
      setInfo(r.info)
      setMsg({ ok: r.ok, text: r.error || r.note })
      onChanged()
      return r.ok ? r.info : null
    } finally {
      setBusy(false)
    }
  }

  /** 이 학습코드의 성별을 고르면 같은 성별 대사로 바로 채운다 — 이미 그 성별 대사 한 묶음이 다 들어 있으면 안 바꾼다 */
  const pickMine = async (g: VoiceGender | null): Promise<void> => {
    const v = await act(() => window.api.guideVoiceSet(code, code, g))
    if (!v || !g) return
    if (v.sets.some((s) => s.gender === g && s.same === v.talk.length)) return
    const best = bestFor(v, g)
    if (best) await act(() => window.api.guideVoiceUse(code, best.code))
  }

  if (!info) return <p className="sub">대사 성우를 불러오는 중…</p>
  if (info.error) return <p className="state error">{info.error}</p>
  // 같은 성별을 위로, 그다음 모르는 것 — 다른 성별은 맨 아래
  const rank = (s: VoiceSet): number => (!info.gender || !s.gender ? 1 : s.gender === info.gender ? 0 : 2)
  const sets = [...info.sets].sort((a, b) => rank(a) - rank(b))
  const now = info.sets.filter((s) => s.same > 0).sort((a, b) => b.same - a.same)[0]
  const wrong = Boolean(now && info.gender && now.gender && now.gender !== info.gender)
  const filled = Boolean(info.gender && info.sets.some((s) => s.gender === info.gender && s.same === info.talk.length))
  const best = info.gender && !filled ? bestFor(info, info.gender) : null
  // 같은 성별 대사가 어디에도 없다 — 성별을 모르는 줄이 남아 있으면 아직 모른다
  const none = Boolean(info.gender && !best && !filled && sets.every((s) => s.gender && s.gender !== info.gender))
  const unknownLeft = Boolean(info.gender && !best && !filled && !none)

  return (
    <section className="guide-sec guide-voice">
      <h2>
        대사 성우 <span className="guide-ref">대사 {info.talk.length}개</span>
      </h2>
      <p className="guide-sec-tip">
        같은 모듈이어도 호마다 성우가 다릅니다. 이 학습코드 성우의 성별을 고르고, 같은 성별인 학습코드의 대사를 한 번에 가져오세요. 성별은 스펙에 저장되어 다른 사람에게도 보입니다.
      </p>
      <div className="voice-row voice-mine">
        <b className="mono">{code}</b>
        <Pick value={info.gender} disabled={busy} onPick={(g) => void pickMine(g)} />
        <button className="ghost" onClick={() => void hear(code)} title="이 폴더에 새로 온 소리 하나를 틉니다.">
          ▶ 새로 온 소리
        </button>
        {heard[code] ? <span className="sub">{heard[code]}</span> : null}
      </div>
      {now && (
        <p className={wrong && !info.kept ? 'state warn' : 'sub'}>
          지금 폴더의 대사 {now.same}개는 {label(now)}({now.gender ?? '성별 모름'}) 학습코드 것과 같습니다.
          {wrong && info.kept ? ' 성우 성별이 다르지만 그대로 쓰기로 했습니다.' : ''}
        </p>
      )}
      {none && !info.kept && (
        <div className="state warn">
          <p className="voice-none">
            {info.gender}자 성우 대사는 어느 학습코드에도 없습니다. 지금 대사를 그대로 쓰거나, 담당자에게 이 학습코드용 녹음을 요청하세요.
          </p>
          {wrong && (
            <button className="ghost" disabled={busy} onClick={() => void act(() => window.api.guideVoiceKeep(code))}>
              지금 대사 그대로 쓰기
            </button>
          )}
        </div>
      )}
      {unknownLeft && (
        <p className="state warn">성우가 {info.gender}자로 저장된 학습코드가 없습니다. 아래에서 ▶로 들어 보고 성별을 고르세요.</p>
      )}
      {best && (
        <p className="row-actions">
          <button className="go" disabled={busy} onClick={() => void act(() => window.api.guideVoiceUse(code, best.code))}>
            {info.gender}자 성우 대사로 채우기 ({best.code})
          </button>
        </p>
      )}
      <ul className="voice-sets">
        {sets.map((s) => (
          <li key={s.code} className={`voice-row${info.gender && s.gender && s.gender !== info.gender ? ' other' : ''}`}>
            <span title={s.twins.length ? `같은 대사 파일을 쓰는 학습코드: ${[s.code, ...s.twins].join(', ')}` : undefined}>
              <span className="mono">{s.code}</span>
              {s.twins.length ? <span className="sub"> 외 {s.twins.length}개</span> : null}
            </span>
            <Pick value={s.gender} disabled={busy} onPick={(g) => void act(() => window.api.guideVoiceSet(code, s.code, g))} />
            <button className="ghost" onClick={() => void hear(s.code)} title="이 학습코드의 시작 대사를 틉니다.">
              ▶
            </button>
            {heard[s.code] ? <span className="sub">{heard[s.code]}</span> : null}
            {s.same === info.talk.length && <span className="guide-mark name">지금 쓰는 대사</span>}
            <button className="ghost" disabled={busy || s.same === info.talk.length} onClick={() => void act(() => window.api.guideVoiceUse(code, s.code))} title={`${s.code} 학습코드의 대사 ${s.files}개를 이 폴더로 가져와 대사 항목에 지정합니다.`}>
              이 대사 쓰기
            </button>
          </li>
        ))}
      </ul>
      {msg && <p className={msg.ok ? 'state done' : 'state error'}>{msg.text}</p>}
    </section>
  )
}
