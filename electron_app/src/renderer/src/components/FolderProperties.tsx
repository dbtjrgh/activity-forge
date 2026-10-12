import { useCallback, useEffect, useState } from 'react'
import type { FolderInfo, FolderPermissions, FolderSize } from '../../../shared/ipc'
import { describeRights, formatBytes, formatDate, shortPrincipal } from '../lib/format'

interface Props {
  path: string
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function AccessList({ permissions }: { permissions: FolderPermissions }) {
  if (permissions.error) {
    return <span className="sub error">{permissions.error}</span>
  }
  if (permissions.entries.length === 0) {
    return <span className="sub">등록된 권한 항목이 없습니다.</span>
  }

  return (
    <ul className="acl">
      {permissions.entries.map((entry, index) => (
        <li
          key={`${entry.principal}-${entry.deny}-${entry.inherited}-${index}`}
          className={`acl-row${entry.appliesToMe ? ' mine' : ''}`}
        >
          <span className="acl-principal" title={entry.principal}>
            {shortPrincipal(entry.principal)}
          </span>
          <span className="acl-rights">{describeRights(entry.rights)}</span>
          <span className="acl-tags">
            {entry.deny && <span className="tag deny">거부</span>}
            {entry.appliesToMe && <span className="tag mine">나에게 적용</span>}
            <span className="tag">{entry.inherited ? '상속' : '직접 지정'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
function FolderProperties({ path }: Props) {
  const [info, setInfo] = useState<FolderInfo | null>(null)
  const [size, setSize] = useState<FolderSize | null>(null)
  const [sizeLoading, setSizeLoading] = useState(false)
  const [openError, setOpenError] = useState('')

  useEffect(() => {
    let cancelled = false
    setInfo(null)
    setSize(null)
    setOpenError('')
    window.api.folderInfo(path).then((result) => {
      // 속성을 읽는 동안 다른 폴더를 선택했으면 이전 결과는 버린다.
      if (!cancelled) setInfo(result)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  const calculateSize = useCallback(async () => {
    setSizeLoading(true)
    try {
      setSize(await window.api.folderSize(path))
    } finally {
      setSizeLoading(false)
    }
  }, [path])

  const open = useCallback(async () => {
    const message = await window.api.openPath(path)
    setOpenError(message ? `열 수 없습니다: ${message}` : '')
  }, [path])

  if (!info) {
    return <p className="state">속성을 읽는 중…</p>
  }

  // 내용 조회에 실패해도(접근 거부 등) 권한 정보는 알 수 있으므로 함께 보여준다.
  const { permissions } = info
  const accessLabel =
    permissions.writable === null ? '알 수 없음' : permissions.writable ? '읽기 및 쓰기 가능' : '읽기 전용'

  const permissionRows = (
    <>
      <Row label="소유자">{permissions.owner ?? '알 수 없음'}</Row>
      <Row label="내 접근 권한">
        {accessLabel}
        <span className="sub">{permissions.currentUser ?? '현재 앱을 실행한 사용자'} 기준</span>
      </Row>
      <Row label="사용자별 권한">
        <AccessList permissions={permissions} />
      </Row>
    </>
  )
  return (
    <div className="properties">
      <div className="prop-head">
        <span className="prop-icon" aria-hidden="true">
          📁
        </span>
        <div>
          <h2>{info.name}</h2>
          <p className="path">{info.path}</p>
        </div>
      </div>

      {info.error && <p className="state error">{info.error}</p>}

      <dl className="prop-list">
        <Row label="종류">폴더</Row>
        {info.error ? (
          permissionRows
        ) : (
          <>
            <Row label="만든 날짜">{formatDate(info.createdAt)}</Row>
            <Row label="수정한 날짜">{formatDate(info.modifiedAt)}</Row>
            <Row label="포함 항목">
              폴더 {info.folderCount.toLocaleString('ko-KR')}개, 파일{' '}
              {info.fileCount.toLocaleString('ko-KR')}개
            </Row>
            <Row label="직접 포함 파일 용량">{formatBytes(info.directFileBytes)}</Row>
            <Row label="전체 용량">
              {size ? (
                <>
                  {formatBytes(size.bytes)}
                  <span className="sub">
                    하위 폴더 {size.folders.toLocaleString('ko-KR')}개, 파일{' '}
                    {size.files.toLocaleString('ko-KR')}개
                    {size.truncated && ' (항목이 많아 일부만 계산한 최솟값)'}
                  </span>
                  {size.error && <span className="sub error">{size.error}</span>}
                </>
              ) : (
                <button onClick={calculateSize} disabled={sizeLoading}>
                  {sizeLoading ? '계산 중…' : '하위 폴더까지 계산'}
                </button>
              )}
            </Row>
            {permissionRows}
          </>
        )}
      </dl>

      <div className="prop-actions">
        <button onClick={open}>탐색기에서 열기</button>
      </div>
      {openError && <p className="state error">{openError}</p>}
    </div>
  )
}

export default FolderProperties
