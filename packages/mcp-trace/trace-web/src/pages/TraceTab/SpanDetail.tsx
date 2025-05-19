import { format } from 'date-fns';
import { Text, Box, Button } from '@chakra-ui/react';
import { IoExpand } from 'react-icons/io5';
import { SpanEntity } from '@mcp-trace/trace-core';
import { useState, FC } from 'react';
import JsonView from './JsonView';

interface SpanDetailProps {
  node: SpanEntity;
  clickShowModal: (input: boolean) => void;
}

const SpanDetail: FC<SpanDetailProps> = ({ node, clickShowModal }) => {
  const [showInput, setShowInput] = useState(true);

  const endTime = node.endTime || Date.now();

  const formatDate = (timestamp: number | null) => {
    if (timestamp == null) {
      return 'invalid timestamp';
    }
    const date = new Date(timestamp);
    return format(date, 'yyyy-MM-dd HH:mm:ss');
  };
  const usedTime =
    (endTime - node.startTime) / 1000 >= 1
      ? `${((endTime - node.startTime) / 1000).toFixed(2)}s`
      : `${(endTime - node.startTime).toFixed(2)}ms`;

  return (
    <Box p={10}>
      <Text fontWeight="bold" fontSize="lg">
        Span详情
      </Text>
      <Box p={4}>
        <Text>Span ID: {node?.id}</Text>
        <Text>名称: {node?.name}</Text>
        <Text>标签: {node?.attributes?.tags}</Text>
        <Text>开始时间: {formatDate(node?.startTime)}</Text>
        <Text>结束时间: {formatDate(node?.endTime)}</Text>
        <Text>耗时: {usedTime}</Text>
        <Text>ParentSpanId: {node?.parentId}</Text>
        <Box
          style={{
            position: 'relative',
          }}
        >
          <Button
            className={`content-button ${showInput ? 'active' : ''}`}
            onClick={() => setShowInput(true)}
          >
            输入
          </Button>
          <Button
            className={`content-button ${showInput ? '' : 'active'}`}
            onClick={() => setShowInput(false)}
          >
            输出
          </Button>
          <Button
            onClick={() => clickShowModal(showInput)}
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
            }}
          >
            <IoExpand size={18} />
          </Button>
        </Box>
        <Box border="1px" className="code-container">
          <JsonView
            data={
              (showInput
                ? node.attributes?.inputs
                : node.attributes?.outputs) || 'no content'
            }
          />
        </Box>
      </Box>
    </Box>
  );
};
export default SpanDetail;
