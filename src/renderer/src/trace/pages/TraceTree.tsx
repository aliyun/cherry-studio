import { TraceModal } from '@renderer/trace/pages/TraceModel'
import { Divider } from 'antd/lib'
import * as React from 'react'
import { useEffect, useState } from 'react'

import { Box, GridItem, HStack, IconButton, SimpleGrid, Text } from './Component'
import { ProgressBar } from './ProgressBar'

interface TreeNodeProps {
  node: TraceModal
  handleClick: (node: TraceModal) => void
  treeData?: TraceModal[]
  paddingLeft?: number
}

export const convertTime = (time: number | null): string => {
  if (time == null) {
    return ''
  }
  if (time > 100000) {
    return `${(time / 1000).toFixed(0)}s`
  }
  if (time > 10000) {
    return `${(time / 1000).toFixed(1)}s`
  }
  if (time > 1000) {
    return `${(time / 1000).toFixed(2)}s`
  }
  if (time > 100) {
    return `${(time / 1000).toFixed(0)}s`
  }
  if (time > 10) {
    return `${(time / 1000).toFixed(1)}s`
  }
  return time.toFixed(2) + 'ms'
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, handleClick, treeData, paddingLeft = 4 }) => {
  const [isOpen, setIsOpen] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const [endTime, setEndTime] = useState(node.endTime || Date.now())
  const [usedTime, setUsedTime] = useState(convertTime((node.endTime || Date.now()) - node.startTime))

  // 定时刷新未结束的 span
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined
    if (!node.endTime) {
      timer = setInterval(() => {
        setEndTime(Date.now())
      }, 200)
    } else {
      setEndTime(node.endTime)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [node.endTime, node.startTime])

  // 只在 endTime 或 node 变化时更新 usedTime
  useEffect(() => {
    setUsedTime(convertTime(endTime - node.startTime))
  }, [endTime, node])

  return (
    <div
      style={{
        width: '100%'
      }}>
      <SimpleGrid columns={20}>
        <GridItem colSpan={8} style={{ padding: `4px 4px 4px ${paddingLeft}px` }}>
          <HStack grap={2}>
            <IconButton
              aria-label="Toggle"
              aria-expanded={isOpen ? true : false}
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              fontSize="10px"
              style={{
                margin: '0px',
                visibility: hasChildren ? 'visible' : 'hidden'
              }}
            />
            <Text
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={(e) => {
                e.preventDefault()
                handleClick(node)
              }}>
              {node.name}
            </Text>
          </HStack>
        </GridItem>
        <GridItem padding={4} colSpan={3}>
          <Text
            // ml={2}
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
            {node.attributes?.tags}
          </Text>
        </GridItem>
        <GridItem padding={4} colSpan={4}>
          <Text style={{ color: 'red' }}>{node.usage ? '↑' + node.usage.prompt_tokens : ''}</Text>&nbsp;
          <Text style={{ color: 'green' }}>{node.usage ? '↓' + node.usage.completion_tokens : ''}</Text>
        </GridItem>
        <GridItem padding={4} colSpan={2}>
          <Text /** ml={2} */>{usedTime}</Text>
        </GridItem>
        <GridItem padding={4} colSpan={3}>
          <ProgressBar progress={node.percent} start={node.start} />
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
      {hasChildren && isOpen && (
        <Box>
          {node.children &&
            node.children.map((childNode) => (
              <TreeNode
                key={childNode.id}
                treeData={treeData}
                node={childNode}
                handleClick={handleClick}
                paddingLeft={paddingLeft + 4}
              />
            ))}
        </Box>
      )}
    </div>
  )
}

export default TreeNode
