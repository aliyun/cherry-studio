import './Trace.css'

import { SpanEntity } from '@mcp-trace/trace-core'
import { TraceModal } from '@renderer/trace/pages/TraceModel'
import { Divider } from 'antd/lib'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Box, GridItem, SimpleGrid, Text, VStack } from './Component'
import SpanDetail from './SpanDetail'
import TraceTree from './TraceTree'

export interface TracePageProp {
  topicId: string
  traceId: string
  reload?: boolean
}

export const TracePage: React.FC<TracePageProp> = ({ topicId, traceId, reload = false }) => {
  const [spans, setSpans] = useState<TraceModal[]>([])
  const [selectNode, setSelectNode] = useState<TraceModal | null>(null)
  const [showList, setShowList] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { t } = useTranslation()

  const mergeTraceModals = useCallback((oldNodes: TraceModal[], newNodes: TraceModal[]): TraceModal[] => {
    const oldMap = new Map(oldNodes.map((n) => [n.id, n]))
    return newNodes.map((newNode) => {
      const oldNode = oldMap.get(newNode.id)
      if (oldNode) {
        // 如果旧节点已经结束，则直接返回旧节点
        if (oldNode.endTime) {
          return oldNode
        }
        oldNode.children = mergeTraceModals(oldNode.children, newNode.children)
        Object.assign(oldNode, newNode)
        return oldNode
      } else {
        return newNode
      }
    })
  }, [])

  const updatePercentAndStart = useCallback((nodes: TraceModal[]) => {
    nodes.forEach((node) => {
      const endTime = node.endTime || Date.now()
      const usedTime = endTime - node.startTime
      const duration = node.rootEnd - node.rootStart
      node.start = ((node.startTime - node.rootStart) * 100) / duration
      node.percent = duration === 0 ? 0 : (usedTime * 100) / duration
      if (node.children) {
        updatePercentAndStart(node.children)
      }
    })
  }, [])

  const getRootSpan = (spans: SpanEntity[]): TraceModal[] => {
    const map: Map<string, TraceModal> = new Map()
    const root: TraceModal[] = []

    let minStart = spans && spans.length > 0 ? spans[0].startTime : 0
    let maxEnd = spans && spans.length > 0 ? spans[0].endTime || Date.now() : 0
    spans.forEach((span) => {
      if (map.has(span.id)) {
        map
          .get(span.id)
          ?.children.push({ ...span, children: [], percent: 100, start: 0, rootStart: 0, rootEnd: 0 } as TraceModal)
      } else {
        map.set(span.id, { ...span, children: [], percent: 100, start: 0, rootStart: 0, rootEnd: 0 } as TraceModal)
      }
      if (!span.parentId || !map.has(span.parentId)) {
        minStart = Math.min(span.startTime, minStart)
        maxEnd = Math.max(span.endTime || Date.now(), maxEnd)
        root.push(map.get(span.id) as TraceModal)
      }
    })

    map.forEach((span) => {
      span.rootStart = minStart
      span.rootEnd = maxEnd
      if (span.parentId && map.has(span.parentId)) {
        map.get(span.parentId)?.children.push(span)
      }
    })
    return root
  }

  const findNodeById = useCallback((nodes: TraceModal[], id: string): TraceModal | null => {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) {
        const found = findNodeById(n.children, id)
        if (found) return found
      }
    }
    return null
  }, [])

  const getTraceData = useCallback(async (): Promise<boolean> => {
    const datas = topicId && traceId ? await window.api.trace.getData(topicId, traceId) : []
    const matchedSpans = getRootSpan(datas)
    updatePercentAndStart(matchedSpans)
    setSpans((prev) => mergeTraceModals(prev, matchedSpans))
    const isEnded = !matchedSpans.find((e) => !e.endTime || e.endTime <= 0)
    return isEnded
  }, [topicId, traceId, updatePercentAndStart, mergeTraceModals])

  const handleNodeClick = (nodeId: string) => {
    const latestNode = findNodeById(spans, nodeId)
    if (latestNode) {
      setSelectNode(latestNode)
      setShowList(false)
    }
  }

  const handleShowList = () => {
    setShowList(true)
    setSelectNode(null)
  }

  useEffect(() => {
    const handleShowTrace = async () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      const ended = await getTraceData()
      // 只有未结束时才启动定时刷新
      if (!ended) {
        intervalRef.current = setInterval(async () => {
          const endedInner = await getTraceData()
          if (endedInner && intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }, 300)
      }
    }
    handleShowTrace()
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [getTraceData, traceId, topicId, reload])

  useEffect(() => {
    if (selectNode) {
      const latest = findNodeById(spans, selectNode.id)
      if (!latest) {
        setShowList(true)
        setSelectNode(null)
      } else if (latest !== selectNode) {
        setSelectNode(latest)
      }
    }
  }, [spans, selectNode, findNodeById])

  return (
    <div className="trace-window">
      <div className="tab-container_trace">
        <SimpleGrid columns={1} templateColumns="1fr">
          <Box padding={0} className="scroll-container">
            {showList ? (
              <VStack grap={1} align="start">
                {spans.length === 0 ? (
                  <Text>没有找到Trace信息</Text>
                ) : (
                  <>
                    <SimpleGrid columns={20} style={{ width: '100%' }} className="floating">
                      <GridItem colSpan={8} padding={0} className={'table-header'}>
                        <Text tabIndex={0}>{t('trace.name')}</Text>
                      </GridItem>
                      <GridItem colSpan={5} padding={0} className={'table-header'}>
                        <Text>{t('trace.tokenUsage')}</Text>&nbsp;
                      </GridItem>
                      <GridItem colSpan={3} padding={0} className={'table-header'}>
                        <Text>{t('trace.spendTime')}</Text>
                      </GridItem>
                      <GridItem colSpan={4} padding={0} className={'table-header'}>
                        <Text></Text>
                      </GridItem>
                    </SimpleGrid>
                    <Divider
                      orientation="end"
                      style={{
                        border: '1px solid #ccc',
                        width: '100%',
                        marginTop: '30px',
                        marginBottom: '0px'
                      }}
                    />
                    {spans.map((node: TraceModal) => (
                      <TraceTree key={node.id} treeData={node.children} node={node} handleClick={handleNodeClick} />
                    ))}
                  </>
                )}
              </VStack>
            ) : (
              selectNode && <SpanDetail node={selectNode} clickShowModal={handleShowList} />
            )}
          </Box>
        </SimpleGrid>
      </div>
    </div>
  )
}
