import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import GuideWindow from './components/guide/GuideWindow'
import { SetupGate } from './components/setup/FirstRun'
import './assets/main.css'

// 받을 리소스 창(`main/guidewin.ts`)은 같은 렌더러를 `?guide=<코드>` 로 연다 — 앱 화면(작업 폴더 읽기 · 진행판)은 안 띄운다
const guide = new URLSearchParams(window.location.search).get('guide')

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {guide ? (
      <GuideWindow code={guide} />
    ) : (
      // 양산기 폴더를 못 찾으면 앱 화면 대신 처음 설정 창 (2026-10-01)
      <SetupGate>
        <App />
      </SetupGate>
    )}
  </React.StrictMode>
)
