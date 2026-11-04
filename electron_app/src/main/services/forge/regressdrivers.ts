/**
 * **모듈별 자동 진행** (2026-10-15) — 회귀 검사가 끝 화면까지 몰고 가는 손. 이 표에 없는 모듈은 첫 이닝까지만 본다(`regressone.ts`).
 *
 * 이번 주 세션 scratchpad 에서 손으로 쓴 시험 글(m28auto · m01auto · m05auto · m31auto · autoplay)을 옮겼다. 고친 것 —
 * - **정답만** 낸다(일부러 틀리던 것 · 화면 찍기는 뺐다) — 판정이 흔들리지 않게 늘 같은 길로 간다
 * - **진짜 포인터 이벤트**로 끌고 누른다(`h.drag` · `h.tap`, `regresspage.ts`). M05 건반도 `Director` 를 바로 부르지 않고 누른다
 * - 누를 것이 막(나레이션 동안 터치 막기)에 가려 있으면 기다린다(`h.reach` · `h.press`) — 가려진 채 누른 것은 세지 않는다.
 *   M01 은 화면 전체를 받는 판이 따로 있어 hitTest 로는 늘 「가림」이다 — 모듈의 터치 막힘(`isTouchBlocked`)을 직접 본다.
 *   M01 type2 · type4 단추는 가운데에 스피커가 있어 가운데를 누르면 듣기만 된다 — 스피커를 피한 자리를 누른다(`h.spot`)
 * - 한 대상에 여러 번 해도 안 되면 그 자리를 적고 멈춘다(`h.stuck`) — 상한 시간까지 기다리지 않는다
 * - 이닝 표시를 안 쓰는 모듈(M01)은 넘긴 이닝을 스스로 센다(`R.track`)
 *
 * 글 하나는 시작한 뒤에 도는 비동기 함수의 몸통이다 — `R` 형편(`R.data` 에 GameData 의 이닝 수), `S` SparkApp, `h` 손.
 * 페이지 글이라 TypeScript 가 안 본다. **역따옴표와 `${` 를 쓰지 않는다**(감싸는 글이 템플릿이다).
 *
 * Electron 을 import 하지 않는다(services 규칙).
 */

/** 같은 대상에 이만큼 해도 안 되면 멈춘다 — 나레이션이 도는 동안은 눌러도 안 받으므로 넉넉히 */
const TRIES = 12

const M28 = `
  const m = await h.wait(() => h.find('M28'))
  if (!m) return h.stuck('M28 모듈을 화면에서 찾지 못했습니다.')
  R.data = m.mQuizData && m.mQuizData.inningData ? m.mQuizData.inningData.length : null
  const mgr = m.mQuizItemManager, QM = mgr.constructor, dz = m.mDropZone
  let last = null, tries = 0, covered = 0, set = null, setAt = 0
  while (!R.done) {
    // 이닝마다 선지 자리(GameData itemPos) — 다 놓인 뒤 한 번 적는다
    if (mgr.mQuizItems !== set) { set = mgr.mQuizItems; setAt = performance.now() }
    if (setAt && performance.now() - setAt > 2000 && set && set.length) { setAt = 0; h.log('선지 x ' + set.map((i) => i.mOriginPos ? i.mOriginPos.x : '?').join(', ')) }
    const items = mgr.children.filter((c) => c.visible && c.image)
    const item = !QM.isDragged && items.find((c) => c.isCorrect && !c.complete && c.eventMode === 'static')
    if (item) {
      if (item !== last) { last = item; tries = 0 }
      if (!h.reach(item)) { if (++covered > 600) return h.stuck('정답 그림(' + item.image + ')이 다른 것에 가려 끌 수 없습니다.'); await h.sleep(200); continue }
      covered = 0
      if (++tries > ${TRIES}) return h.stuck('정답 그림(' + item.image + ')을 카트에 놓아도 붙지 않습니다.')
      await h.drag(h.center(item), h.center(dz))
      await h.sleep(800)
    }
    await h.sleep(250)
  }`

const M01 = `
  const act = await h.wait(() => S.mCurrentScene && S.mCurrentScene.inningManager && S.mCurrentScene)
  if (!act) return h.stuck('이닝 관리 객체(inningManager)를 찾지 못했습니다.')
  const im = act.inningManager
  R.data = im.quizData && im.quizData.settings ? im.quizData.settings.maxInning : null
  R.track = { done: 0, total: R.data }
  // 나레이션 동안은 터치를 막는다(CommonUse onBlocker). 화면 전체를 받는 판이 따로 있어 hitTest 로는 못 가린다 — 막힘을 직접 본다
  const cu = await h.mod('/partner_common/CommonUse.ts')
  const C = cu && cu.CommonUse ? cu.CommonUse.getInstance() : null
  if (!C) h.log('CommonUse 모듈을 찾지 못해 터치 막힘을 알 수 없습니다.')
  let last = 0
  while (!R.done) {
    const n = act.inningCount, d = im.currentInningData[n - 1]
    if (n !== last && d && d.type !== 'Ending' && n <= im.quizData.settings.maxInning) {
      const inst = im.inning[d.index]
      if (inst && inst.btnList && inst.btnList.length && !inst.isClear) {
        last = n
        h.log(n + '이닝 ' + d.type + ' 정답 ' + d.correctNum)
        let tries = 0, blocked = 0
        while (!inst.isClear && !R.done) {
          if (C && C.isTouchBlocked()) { if (++blocked > 600) return h.stuck(n + '이닝 터치 막힘이 풀리지 않습니다.'); await h.sleep(200); continue }
          if (++tries > ${TRIES}) return h.stuck(n + '이닝 정답 ' + d.correctNum + '번을 눌러도 넘어가지 않습니다.')
          await h.tap(h.spot(inst.btnList[d.correctNum - 1]))
          for (let k = 0; k < 15 && !inst.isClear; k++) await h.sleep(200)
        }
        if (inst.isClear) R.track.done += 1
      }
    }
    await h.sleep(200)
  }`

const M05 = `
  const m = await h.wait(() => S.mCurrentScene && S.mCurrentScene.mM05)
  if (!m) return h.stuck('M05 모듈을 찾지 못했습니다.')
  const ans = m.mM05_Answer, btn = m.mM05_Button, dim = m.mCom_Dimmed.mDimmed
  R.data = ans.mAnswer.length
  let at = '', tries = 0
  while (!R.done) {
    const key = ans.mPage + ':' + ans.mCount
    if (!dim.visible && ans.mPage < ans.mAnswer.length) {
      if (key !== at) { at = key; tries = 0; h.log((ans.mPage + 1) + '이닝 ' + (ans.mCount + 1) + '행') }
      if (++tries > ${TRIES}) return h.stuck((ans.mPage + 1) + '이닝 ' + (ans.mCount + 1) + '행 건반을 눌러도 넘어가지 않습니다.')
      if (!(await h.press(btn.mState.idle[ans.mAnswer[ans.mPage][ans.mCount]]))) return h.stuck((ans.mPage + 1) + '이닝 ' + (ans.mCount + 1) + '행 건반이 가려져 누를 수 없습니다.')
      await h.sleep(600)
    }
    await h.sleep(200)
  }`

const M31 = `
  const m = await h.wait(() => h.find('M31'))
  if (!m) return h.stuck('M31 모듈을 화면에서 찾지 못했습니다.')
  R.data = m.mQuizData && m.mQuizData.inningData ? m.mQuizData.inningData.length : null
  let last = null, tries = 0, covered = 0
  while (!R.done) {
    // 남은 것 가운데 정답 줄이 있는 것만 — 줄이 없는(target 이 빈) 것은 끌지 않는 오답 물건이다(QuizPanel.ts mAnswerArr)
    const qp = m.mQuizPanel
    const item = m.eventMode === 'static' && qp.mRemainArr && qp.mRemainArr.find((i) => i.target != null && m.dragzones.some((z) => z.index === i.target))
    const zone = item && m.dragzones.find((z) => z.index === item.target)
    if (zone) {
      if (item !== last) { last = item; tries = 0 }
      if (!h.reach(item)) { if (++covered > 600) return h.stuck((item.target + 1) + '번 줄로 끌 물건이 다른 것에 가려 있습니다.'); await h.sleep(200); continue }
      covered = 0
      if (++tries > ${TRIES}) return h.stuck((item.target + 1) + '번 줄에 놓아도 붙지 않습니다.')
      await h.drag(h.center(item), h.center(zone))
      await h.sleep(600)
    }
    await h.sleep(200)
  }`

const M38_2 = `
  const m = await h.wait(() => h.find('M38_2'))
  if (!m) return h.stuck('M38_2 모듈을 화면에서 찾지 못했습니다.')
  const field = m.mField
  R.data = m.mQuizData && m.mQuizData.inningData ? m.mQuizData.inningData.length : null
  while (!R.done) {
    if (field.mIsPlaying && !field.mIsJudging && field.mKind >= 0) {
      const item = field.mItems.find((v) => v.kindIndex === field.mKind && !v.isCorrected)
      if (item && h.reach(item)) await h.tap(h.center(h.hit(item)))
    }
    // 그래프 뒤 정답 고르기(inningData.pick) — 정답 칸을 누른다
    const ch = m.mGraph && m.mGraph.choices
    if (ch && ch.mIsPlaying && !ch.mIsJudging && ch.mAnswer >= 0) {
      const pick = ch.items.find((c) => c.index === ch.mAnswer)
      if (pick && h.reach(pick)) { h.log('정답 고르기 ' + (ch.mAnswer + 1) + '번'); await h.tap(h.center(h.hit(pick))) }
    }
    await h.sleep(250)
  }`

// M39 — 모듈이 힌트에 쓰는 길 찾기(`_recommend`)를 그대로 따라 방향 단추를 채우고 출발을 누른다.
// 입력은 지시 대사가 끝나 판이 풀리고(mLocked false) 출발을 기다릴 때(mWaitGo)만 받는다. 길과 어긋난 화살표가 있으면 휴지통으로 비운다
const M39 = `
  const m = await h.wait(() => h.find('M39'))
  if (!m) return h.stuck('M39 모듈을 화면에서 찾지 못했습니다.')
  const cmd = m.mCommand
  R.data = m.mQuizData && m.mQuizData.inningData ? m.mQuizData.inningData.length : null
  let at = '', tries = 0
  while (!R.done) {
    if (m.mWaitGo && !cmd.mLocked) {
      const key = m.mInning ? m.mInning.startCoord + '>' + m.mInning.goalCoord + ':' + cmd.inputs.length : ''
      if (key !== at) { at = key; tries = 0 }
      const where = '이닝(' + key + ')'
      if (++tries > ${TRIES}) return h.stuck(where + ' 단추를 눌러도 넘어가지 않습니다.')
      const dir = cmd.isFull ? null : m._recommend()
      const btn = cmd.mButtons.find((b) => b.dir === dir)
      const target = cmd.isFull ? cmd.mGo : btn ? btn.sprite : cmd.inputs.length ? cmd.mTrash : null
      if (!target) return h.stuck(where + ' 우체통까지 가는 길을 찾지 못했습니다.')
      if (cmd.isFull) h.log(where + ' 출발 ' + cmd.inputs.join(','))
      if (!(await h.press(target))) return h.stuck(where + ' 단추가 가려져 누를 수 없습니다.')
      await h.sleep(300)
    }
    await h.sleep(200)
  }`

const DRIVERS: Record<string, string> = { M01, M05, M28, M31, M38_2, M39 }

/** 끝까지 몰고 갈 수 있는 모듈 — 칸의 모듈이 여럿이면(「+」) 그 가운데 하나 */
export function driverOf(module: string): { name: string; body: string } | null {
  for (const name of module.split('+')) if (DRIVERS[name]) return { name, body: DRIVERS[name] as string }
  return null
}

/** 자동 진행이 있는 모듈 이름 — 화면 안내용 */
export const DRIVEN = Object.keys(DRIVERS)

/** 페이지에 넣을 글 — 끝에 값 하나를 둔다(함정: 비동기 함수를 그대로 평가하면 끝날 때까지 안 돌아온다) */
export const driverScript = (body: string): string =>
  `;(async (R, h) => {
  while (R.phase === 'load') await h.sleep(200)
  if (R.done) return
  const S = window.__PIXI_APP__${body}
})(window.__regress, window.__regress.h).catch((e) => window.__regress.h.stuck('자동 진행 오류: ' + (e && e.message)))
;'started'`
