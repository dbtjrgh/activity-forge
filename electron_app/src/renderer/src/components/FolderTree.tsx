import { Fragment, useCallback, useEffect, useState } from 'react'
import type { FolderEntry } from '../../../shared/ipc'

interface NodeState {
  children?: FolderEntry[]
  loading: boolean
  expanded: boolean
  error?: string
}

interface Props {
  /** 트리의 최상위 경로 */
  rootPath: string
  selectedPath: string
  onSelect: (path: string) => void
  /** 값이 바뀌면 트리를 처음부터 다시 읽는다 */
  reloadKey: number
}

const INDENT = 16

function FolderTree({ rootPath, selectedPath, onSelect, reloadKey }: Props) {
  const [nodes, setNodes] = useState<Record<string, NodeState>>({})

  const loadChildren = useCallback(async (path: string) => {
    setNodes((prev) => ({
      ...prev,
      [path]: { ...prev[path], loading: true, expanded: true }
    }))
    const result = await window.api.listFolders(path)
    setNodes((prev) => ({
      ...prev,
      [path]: {
        ...prev[path],
        loading: false,
        expanded: true,
        children: result.folders,
        error: result.error
      }
    }))
  }, [])

  // 최상위는 자동으로 펼친다.
  useEffect(() => {
    setNodes({})
    loadChildren(rootPath)
  }, [rootPath, reloadKey, loadChildren])

  const toggle = useCallback(
    (path: string) => {
      const node = nodes[path]
      if (node?.expanded) {
        setNodes((prev) => ({ ...prev, [path]: { ...prev[path], expanded: false } }))
        return
      }
      // 한 번 읽은 폴더는 다시 읽지 않고 펼치기만 한다.
      if (node?.children) {
        setNodes((prev) => ({ ...prev, [path]: { ...prev[path], expanded: true } }))
        return
      }
      loadChildren(path)
    },
    [nodes, loadChildren]
  )

  const select = useCallback(
    (path: string) => {
      onSelect(path)
      // 선택 시에는 펼치기만 한다. 접히면 클릭할 때마다 트리가 흔들린다.
      const node = nodes[path]
      if (!node?.expanded) toggle(path)
    },
    [nodes, onSelect, toggle]
  )

  const renderRow = (entry: FolderEntry, depth: number) => {
    const node = nodes[entry.path]
    const expanded = Boolean(node?.expanded)
    return (
      <li
        key={entry.path}
        role="treeitem"
        aria-level={depth + 1}
        aria-expanded={expanded}
        aria-selected={selectedPath === entry.path}
      >
        <div
          className={`tree-row${selectedPath === entry.path ? ' selected' : ''}`}
          style={{ paddingLeft: depth * INDENT }}
        >
          <button
            className="twisty"
            onClick={() => toggle(entry.path)}
            aria-label={expanded ? `${entry.name} 접기` : `${entry.name} 펼치기`}
          >
            {node?.loading ? '⋯' : expanded ? '▾' : '▸'}
          </button>
          <button className="tree-label" onClick={() => select(entry.path)} title={entry.path}>
            <span className="icon" aria-hidden="true">
              {expanded ? '📂' : '📁'}
            </span>
            <span className="name">{entry.name}</span>
          </button>
        </div>
      </li>
    )
  }

  const renderChildren = (path: string, depth: number): React.ReactNode => {
    const node = nodes[path]
    if (!node?.expanded) return null

    if (node.loading && !node.children) {
      return (
        <li className="tree-hint" style={{ paddingLeft: depth * INDENT + 28 }}>
          읽는 중…
        </li>
      )
    }
    if (node.error) {
      return (
        <li className="tree-hint error" style={{ paddingLeft: depth * INDENT + 28 }}>
          접근할 수 없습니다
        </li>
      )
    }
    if (node.children?.length === 0) {
      return (
        <li className="tree-hint" style={{ paddingLeft: depth * INDENT + 28 }}>
          하위 폴더 없음
        </li>
      )
    }
    return node.children?.map((child) => (
      <Fragment key={child.path}>
        {renderRow(child, depth)}
        {renderChildren(child.path, depth + 1)}
      </Fragment>
    ))
  }

  return (
    <ul className="tree" role="tree" aria-label="폴더 트리">
      {renderRow({ name: rootPath, path: rootPath }, 0)}
      {renderChildren(rootPath, 1)}
    </ul>
  )
}

export default FolderTree
