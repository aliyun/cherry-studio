import { Divider } from 'antd/lib'
import * as React from 'react'
import { useEffect, useState } from 'react'

import { TraceModal } from '.'
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
  const [endTime, setEndTime] = useState(node.endTime || Date.now())
  const [isOpen, setIsOpen] = useState(true)
  const hasChildren = node.children && node.children.length > 0
  const [usedTime, setUsedTime] = useState('0ms')

  const handlerPercentage = React.useCallback(
    (currentNode: TraceModal) => {
      const usedTime = endTime - node.startTime
      if (!currentNode.children) {
        return
      }
      const allChildredUserTime = node.children.reduce(
        (acc, child) => acc + ((child.endTime || Date.now()) - child.startTime),
        0
      )
      const duration = Math.max(allChildredUserTime, usedTime)
      const newArr = node.children.sort((a, b) => a.startTime - b.startTime)
      let start = 0
      newArr.forEach((child) => {
        const childDuration = child.endTime ? child.endTime - child.startTime : Date.now() - child.startTime
        const percentage = (childDuration / duration) * 100
        child.percent = percentage
        child.start = start
        start += percentage
      })
    },
    [endTime, node]
  )

  useEffect(() => {
    let interval: NodeJS.Timeout
    setUsedTime(convertTime(endTime - node.startTime))

    if (!node.endTime) {
      interval = setInterval(() => {
        console.log('执行刷新...')
        const endTime = node.endTime || Date.now()
        setEndTime(endTime)
        setUsedTime(convertTime(endTime - node.startTime))
      }, 500)
    }

    handlerPercentage(node)

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [node, endTime, handlerPercentage])

  return (
    <div
      style={{
        width: '100%'
      }}>
      <SimpleGrid columns={10}>
        <GridItem colSpan={4} style={{ padding: `4px 4px 4px ${paddingLeft}px` }}>
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
        <GridItem padding={4} colSpan={1}>
          <Text /** ml={2} */>{usedTime}</Text>
        </GridItem>
        <GridItem padding={4} colSpan={2}>
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
