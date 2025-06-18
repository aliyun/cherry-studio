import './Trace.css'

import { SpanEntity } from '@mcp-trace/trace-core'
import { spanCache } from '@renderer/services/WebTraceService'
import React, { useEffect, useRef, useState } from 'react'

import { Box, SimpleGrid, Text, VStack } from './Component'
import SpanDetail from './SpanDetail'
import TraceTree from './TraceTree'

export interface TraceModal extends SpanEntity {
  children: TraceModal[]
  percent: number
  start: number
}

export const TracePage: React.FC = () => {
  const [visible, setVisible] = useState(false)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [spans, setSpans] = useState<TraceModal[]>([])
  const [position, setPosition] = useState({ x: window.innerWidth - 650, y: 40 })
  const dragging = useRef(false)
  const offset = useRef({ x: 10, y: 40 })
  const [selectNode, setSelectNode] = useState<TraceModal | null>(null)

  useEffect(() => {
    const handleShowTrace = async (event: Event) => {
      const customEvent = event as CustomEvent
      const id = customEvent.detail.traceId
      const topicId = customEvent.detail.topicId
      setTraceId(id)
      const datas = await spanCache.getSpans(topicId, id)
      const matchedSpans = getRootSpan(datas)
      setSpans(matchedSpans)
      setVisible(true)
    }

    window.addEventListener('show-trace', handleShowTrace)
    return () => {
      window.removeEventListener('show-trace', handleShowTrace)
    }
  }, [])

  const getRootSpan = (spans: SpanEntity[]): TraceModal[] => {
    const map: Map<string, TraceModal> = new Map()
    const root: TraceModal[] = []

    spans.forEach((span) => {
      if (map.has(span.id)) {
        map.get(span.id)?.children.push({ ...span, children: [], percent: 100, start: 0 } as TraceModal)
      } else {
        map.set(span.id, { ...span, children: [], percent: 100, start: 0 } as TraceModal)
      }
      if (!span.parentId) {
        root.push(map.get(span.id) as TraceModal)
      }
    })

    map.keys().forEach((key) => {
      const span = map.get(key)
      if (span && span.parentId && map.has(span.parentId)) {
        map.get(span.parentId)?.children.push(span)
      }
    })

    return root
  }

  // 拖拽事件
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragging.current = true
    offset.current = {
      x: Math.max(e.clientX - position.x, 10),
      y: Math.max(e.clientY - position.y, 40)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging.current) return
    let newX = Math.max(10, e.clientX - offset.current.x)
    let newY = Math.max(40, e.clientY - offset.current.y)
    // 限制窗口不超出视口
    newX = Math.min(window.innerWidth - 650, newX)
    newY = Math.min(window.innerHeight - 100, newY)
    setPosition({ x: newX, y: newY })
  }

  const handleMouseUp = () => {
    dragging.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  if (!visible || !traceId) {
    return null
  }

  const handleNodeClick = (node: TraceModal) => {
    setSelectNode(node)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: 650,
        backgroundColor: 'var(--trace-bg)',
        color: 'var(--trace-text)',
        opacity: 1,
        zIndex: 1000,
        height: '90vh',
        boxShadow: 'var(--trace-shadow)',
        borderRadius: 8,
        userSelect: dragging.current ? 'none' : 'auto',
        transition: dragging.current ? 'none' : 'box-shadow 0.2s'
      }}>
      <div
        style={{
          cursor: 'move',
          height: 36,
          background: 'var(--trace-header-bg)',
          borderBottom: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8
        }}
        onMouseDown={handleMouseDown}>
        <span style={{ flex: 1 }}>Trace 窗口</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
          ×
        </button>
      </div>
      <div style={{ height: 'calc(100vh - 36px)', overflow: 'auto' }}>
        <div className=".tab-container_trace">
          <div className={`right`}>
            <div key="TraceTab" className={`tab-pane active`}>
              <SimpleGrid columns={2} templateColumns="6fr 4fr">
                <Box padding={5} className="scroll-container">
                  <VStack grap={1} align="start">
                    {spans.length === 0 ? (
                      <Text>没有找到Trace信息</Text>
                    ) : (
                      spans.map((node: TraceModal) => (
                        <TraceTree key={node.id} treeData={node.children} node={node} handleClick={handleNodeClick} />
                      ))
                    )}
                  </VStack>
                </Box>
                {selectNode && (
                  <Box padding={5} className="scroll-container">
                    <SpanDetail node={selectNode} clickShowModal={() => console.log('showModal')} />
                  </Box>
                )}
              </SimpleGrid>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
