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
  const [position, setPosition] = useState({ x: window.innerWidth - 600, y: 0 })
  const dragging = useRef(false)
  const offset = useRef({ x: 30, y: 20 })
  const [selectNode, setSelectNode] = useState<TraceModal | null>(null)

  useEffect(() => {
    const handleShowTrace = (event: Event) => {
      const customEvent = event as CustomEvent
      const id = customEvent.detail
      setTraceId(id)
      const datas = spanCache.getSpans(id)
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
      x: e.clientX - position.x,
      y: Math.max(e.clientY - position.y, 20)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging.current) return
    let newX = e.clientX - offset.current.x
    let newY = e.clientY - offset.current.y
    // 限制窗口不超出视口
    newX = Math.max(10, Math.min(window.innerWidth - 600, newX))
    newY = Math.max(40, Math.min(window.innerHeight - 100, newY))
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
        // left: position.x,
        // top: position.y,
        width: 700,
        backgroundColor: 'white',
        opacity: 1,
        zIndex: 1000,
        height: '90vh',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        borderRadius: 8,
        userSelect: dragging.current ? 'none' : 'auto',
        transition: dragging.current ? 'none' : 'box-shadow 0.2s'
      }}>
      <div
        style={{
          cursor: 'move',
          height: 36,
          background: '#f5f5f5',
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
              <SimpleGrid columns={2} templateColumns="2fr 1fr">
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
