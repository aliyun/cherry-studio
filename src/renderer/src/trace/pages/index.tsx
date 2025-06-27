import './Trace.css'

import { SpanEntity } from '@mcp-trace/trace-core'
import { TraceModal } from '@renderer/trace/pages/TraceModel'
import { Divider } from 'antd/lib'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Box, GridItem, SimpleGrid, Text, VStack } from './Component'
import SpanDetail from './SpanDetail'
import TraceTree from './TraceTree'

export interface TracePageProp {
  topicId: string
  traceId: string
}

export const TracePage: React.FC<TracePageProp> = ({ topicId, traceId }) => {
  const [spans, setSpans] = useState<TraceModal[]>([])
  const [selectNode, setSelectNode] = useState<TraceModal | null>(null)
  const [showList, setShowList] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { t } = useTranslation()

  const mergeTraceModals = React.useCallback((oldNodes: TraceModal[], newNodes: TraceModal[]): TraceModal[] => {
    const oldMap = new Map(oldNodes.map((n) => [n.id, n]))
    return newNodes.map((newNode) => {
      const oldNode = oldMap.get(newNode.id)
      if (oldNode) {
        oldNode.children = mergeTraceModals(oldNode.children, newNode.children)
        Object.assign(oldNode, newNode)
        return oldNode
      } else {
        return newNode
      }
    })
  }, [])

  const updatePercentAndStart = React.useCallback((nodes: TraceModal[]) => {
    nodes.forEach((node) => {
      // 计算 usedTime
      const endTime = node.endTime || Date.now()
      const usedTime = endTime - node.startTime
      if (node.children && node.children.length > 0) {
        const allChildrenUsedTime = node.children.reduce(
          (acc, child) => acc + ((child.endTime || Date.now()) - child.startTime),
          0
        )
        const duration = Math.max(allChildrenUsedTime, usedTime)
        let start = node.start
        node.children
          .sort((a, b) => a.startTime - b.startTime)
          .forEach((child) => {
            const childDuration = (child.endTime ? child.endTime : Date.now()) - child.startTime
            const percentage = duration === 0 ? 0 : (childDuration / duration) * node.percent
            child.percent = percentage
            child.start = start
            start += percentage
          })
        // 递归
        updatePercentAndStart(node.children)
      }
    })
  }, [])

  const getTraceData = React.useCallback(async (): Promise<boolean> => {
    const datas = topicId && traceId ? await window.api.trace.getData(topicId, traceId) : []
    const matchedSpans = getRootSpan(datas)
    updatePercentAndStart(matchedSpans)
    setSpans((prev) => mergeTraceModals(prev, matchedSpans))
    return !matchedSpans.find((e) => !e.endTime || e.endTime <= 0)
  }, [topicId, traceId, updatePercentAndStart, mergeTraceModals])

  useEffect(() => {
    const handleShowTrace = async () => {
      // 清理旧的 interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      let ended = await getTraceData()
      setShowList(true)
      setSelectNode(null)

      // 判断是否结束

      if (!ended) {
        intervalRef.current = setInterval(async () => {
          // 注意：这里也要防止多次 setState
          ended = await getTraceData()

          if (ended && intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }, 200)
      }
    }

    handleShowTrace()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [updatePercentAndStart, mergeTraceModals, getTraceData, traceId, topicId])

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

  const handleNodeClick = (node: TraceModal) => {
    setSelectNode(node)
    setShowList(false)
  }

  const handleShowList = () => {
    setShowList(true)
    setSelectNode(null)
  }

  return (
    <div className="trace-window">
      <div className=".tab-container_trace">
        <SimpleGrid columns={1} templateColumns="1fr">
          <Box padding={5} className="scroll-container">
            {showList ? (
              <VStack grap={1} align="start">
                {spans.length === 0 ? (
                  <Text>没有找到Trace信息</Text>
                ) : (
                  <>
                    <SimpleGrid columns={20}>
                      <GridItem colSpan={8} className={'table-header'}>
                        <Text tabIndex={0}>{t('trace.name')}</Text>
                      </GridItem>
                      <GridItem colSpan={3} className={'table-header'}>
                        <Text>{t('trace.tag')}</Text>
                      </GridItem>
                      <GridItem colSpan={4} className={'table-header'}>
                        <Text>{t('trace.tokenUsage')}</Text>&nbsp;
                      </GridItem>
                      <GridItem colSpan={2} className={'table-header'}>
                        <Text>{t('trace.spendTime')}</Text>
                      </GridItem>
                      <GridItem colSpan={3} className={'table-header'}>
                        <Text></Text>
                      </GridItem>
                    </SimpleGrid>
                    <Divider
                      orientation="end"
                      style={{
                        border: '1px solid #ccc',
                        width: '100%',
                        margin: '0px 5px 0px 0px'
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
