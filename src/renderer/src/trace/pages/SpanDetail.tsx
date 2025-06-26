import './Trace.css'

import { DoubleLeftOutlined } from '@ant-design/icons'
// import TraceModal from '@renderer/trace/TraceModal'
import { TraceModal } from '@renderer/trace/pages/TraceModel'
import { FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactJson from 'react-json-view'

import { Box, Button, Text } from './Component'
import { convertTime } from './TraceTree'

interface SpanDetailProps {
  node: TraceModal
  clickShowModal: (input: boolean) => void
}

const SpanDetail: FC<SpanDetailProps> = ({ node, clickShowModal }) => {
  const [showInput, setShowInput] = useState(true)
  const [jsonData, setJsonData] = useState<object>({})
  const [isJson, setIsJson] = useState(false)
  const [usedTime, setUsedTime] = useState<string>('')
  const { t } = useTranslation()

  const changeJsonData = useCallback(() => {
    const data = showInput ? node.attributes?.inputs : node.attributes?.outputs
    if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
      try {
        setJsonData(JSON.parse(data))
        setIsJson(true)
        return
      } catch {
        console.error('failed to parse json data:', data)
      }
    }
    setIsJson(false)
    setJsonData(data as unknown as object)
  }, [node, showInput])

  const endTime = node.endTime || Date.now()

  useEffect(() => {
    setUsedTime(convertTime(endTime - node.startTime))
    changeJsonData()
  }, [node, showInput, changeJsonData, endTime])

  const formatDate = (timestamp: number | null) => {
    if (timestamp == null) {
      return 'invalid timestamp'
    }
    const date = new Date(timestamp)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  return (
    <Box padding={5}>
      <Box padding={0} style={{ marginBottom: 10 }}>
        <a
          onClick={(e) => {
            e.preventDefault()
            clickShowModal(true)
          }}
          href={'#'}
          style={{ marginRight: 8, fontSize: '14px' }}>
          <DoubleLeftOutlined style={{ fontSize: '12px' }} />
          &nbsp;{t('trace.backList')}
        </a>
      </Box>
      <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{t('trace.spanDetail')}</Text>
      <Box padding={0}>
        <Text style={{ fontWeight: 'bold' }}>ID: </Text>
        <Text>{node?.id}</Text>
      </Box>
      <Box padding={0}>
        <Text style={{ fontWeight: 'bold' }}>{t('trace.name')}: </Text>
        <Text>{node?.name}</Text>
      </Box>
      <Box padding={0}>
        <Text style={{ fontWeight: 'bold' }}>{t('trace.tag')}: </Text>
        <Text>{node?.attributes?.tags}</Text>
      </Box>
      <Box padding={0}>
        <Text style={{ fontWeight: 'bold' }}>{t('trace.startTime')}: </Text>
        <Text>{formatDate(node?.startTime)}</Text>
      </Box>
      <Box padding={0}>
        <Text style={{ fontWeight: 'bold' }}>{t('trace.endTime')}: </Text>
        <Text>{formatDate(node?.endTime)}</Text>
      </Box>
      {node.usage && (
        <Box padding={0}>
          <Text style={{ fontWeight: 'bold' }}>{t('trace.tokenUsage')}: </Text>
          <Text style={{ color: 'red' }}>{`↑${node.usage.prompt_tokens}`}</Text>&nbsp;
          <Text style={{ color: 'green' }}>{`↓${node.usage.completion_tokens}`}</Text>
        </Box>
      )}
      <Box padding={0}>
        <Text style={{ fontWeight: 'bold' }}>{t('trace.spendTime')}: </Text>
        <Text>{usedTime}</Text>
      </Box>
      <Box padding={0}>
        <Text style={{ fontWeight: 'bold' }}>{t('trace.parentId')}: </Text>
        <Text>{node?.parentId}</Text>
      </Box>
      <Box style={{ position: 'relative', margin: '5px 0 0' }}>
        <Button className={`content-button ${showInput ? 'active' : ''}`} onClick={() => setShowInput(true)}>
          {t('trace.inputs')}
        </Button>
        <Button className={`content-button ${showInput ? '' : 'active'}`} onClick={() => setShowInput(false)}>
          {t('trace.outputs')}
        </Button>
      </Box>
      <Box className="code-container">
        {isJson ? (
          <ReactJson
            src={jsonData}
            displayDataTypes={false}
            displayObjectSize={false}
            indentWidth={2}
            collapseStringsAfterLength={100}
            name={false}
            theme={'colors'}
            style={{ fontSize: '12px' }}
          />
        ) : (
          <pre
            style={{
              color: 'white',
              background: '#181c20',
              padding: '12px',
              borderRadius: 0,
              fontSize: 12,
              overflowX: 'auto',
              marginTop: '2px'
            }}>
            <code>{`${typeof jsonData === 'object' ? JSON.stringify(jsonData, null, 2) : String(jsonData)}`}</code>
          </pre>
        )}
      </Box>
    </Box>
  )
}
export default SpanDetail
