import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Box,
  Collapse,
  HStack,
  IconButton,
  Text,
  Divider,
  GridItem,
  SimpleGrid,
} from '@chakra-ui/react';
import { IoChevronDown, IoChevronForwardSharp } from 'react-icons/io5';
import { SpanEntity } from '@mcp-trace/trace-core';
import { ProgressBar } from './ProgressBar';

interface TreeNodeProps {
  node: SpanEntity;
  requestDurations: Record<string, number>;
  onClick: (node: SpanEntity) => void;
  treeData: SpanEntity[];
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  requestDurations,
  onClick,
  treeData,
}) => {
  const [endTime, setEndTime] = useState(node.endTime || Date.now());
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const [usedTime, setUsedTime] = useState('0ms');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    setUsedTime(
      (endTime - node.startTime) / 1000 >= 1
        ? `${((endTime - node.startTime) / 1000).toFixed(2)}s`
        : `${(endTime - node.startTime).toFixed(2)}ms`,
    );

    if (!node.endTime) {
      interval = setInterval(() => {
        console.log('执行刷新...');
        const endTime = node.endTime || Date.now();
        setEndTime(endTime);
        setUsedTime(
          (endTime - node.startTime) / 1000 >= 1
            ? `${((endTime - node.startTime) / 1000).toFixed(2)}s`
            : `${(endTime - node.startTime).toFixed(2)}ms`,
        );
      }, 500);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [node]);

  const handlerPercentage = (currentNode: SpanEntity) => {
    const percentage = parseFloat(
      (
        ((endTime - node.startTime) / requestDurations[node.traceId]) *
        100
      ).toFixed(2),
    );
    if (currentNode.parentId) {
      // 查询父节点
      const parentNode = findParentNode(treeData, currentNode.parentId);
      if (parentNode) {
        // 计算和检查时间值
        const currentDuration =
          currentNode.endTime || Date.now() - currentNode.startTime;
        const parentDuration =
          parentNode.endTime || Date.now() - parentNode.startTime;

        if (parentDuration !== 0) {
          return parseFloat(
            ((currentDuration / parentDuration) * 100).toFixed(2),
          );
        } else {
          return percentage;
        }
      } else {
        return percentage;
      }
    }
    return percentage;
  };

  const findParentNode = (
    nodes: SpanEntity[],
    targetId: string,
  ): SpanEntity | null => {
    for (const node of nodes) {
      if (node.children) {
        if (node.children.some((child) => child.id === targetId)) {
          return node;
        }
        const foundParent = findParentNode(node.children, targetId);
        if (foundParent) {
          return foundParent;
        }
      }
    }
    return null;
  };

  const findPreviousSibling = (
    nodes: SpanEntity[],
    currentId: string,
  ): SpanEntity | null => {
    const searchNodes = (nodeList: SpanEntity[]): SpanEntity | null => {
      for (let i = 0; i < nodeList.length; i++) {
        const currentNode = nodeList[i];

        if (currentNode.id === currentId) {
          if (i > 0) {
            return nodeList[i - 1];
          } else {
            return null;
          }
        }

        if (currentNode.children) {
          const result = searchNodes(currentNode.children);
          if (result) return result;
        }
      }
      return null;
    };

    return searchNodes(nodes);
  };

  const handlerLastPercentage = (node: SpanEntity) => {
    const previousNode = findPreviousSibling(treeData, node.id);
    if (previousNode) {
      return parseFloat(
        (
          ((endTime - previousNode.startTime) /
            requestDurations[previousNode.traceId]) *
          100
        ).toFixed(2),
      );
    }
    return 0;
  };
  return (
    <div
      style={{
        width: '100%',
      }}
    >
      <SimpleGrid columns={5} spacing={4}>
        <GridItem p={4} colSpan={2}>
          <HStack spacing={2}>
            <IconButton
              icon={isOpen ? <IoChevronDown /> : <IoChevronForwardSharp />}
              aria-label="Toggle"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              variant="link"
              fontSize="20px"
              style={{
                visibility: hasChildren ? 'visible' : 'hidden',
              }}
            />
            <Text ml={2} cursor={'pointer'} onClick={() => onClick(node)}>
              {node.name}
            </Text>
          </HStack>
        </GridItem>
        <GridItem p={4} colSpan={1}>
          <Text
            ml={2}
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {node.attributes?.tags}
          </Text>
        </GridItem>
        <GridItem p={4} colSpan={1}>
          <Text ml={2}>{usedTime}</Text>
        </GridItem>
        <GridItem p={4} colSpan={1}>
          <ProgressBar
            progress={handlerPercentage(node)}
            start={handlerLastPercentage(node)}
          />
        </GridItem>
      </SimpleGrid>
      <Divider
        orientation="horizontal"
        style={{
          border: '1px solid #ccc',
          width: '100%',
        }}
      />
      {hasChildren && (
        <Collapse in={isOpen}>
          <Box pl={8}>
            {node.children &&
              node.children.map((childNode) => (
                <TreeNode
                  key={childNode.id}
                  treeData={treeData}
                  node={childNode}
                  requestDurations={requestDurations}
                  onClick={onClick}
                />
              ))}
          </Box>
        </Collapse>
      )}
    </div>
  );
};

export default TreeNode;
