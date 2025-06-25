import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { TracePage } from './pages/index'

function getParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    traceId: params.get('traceId'),
    topicId: params.get('topicId')
  }
}

const App = () => {
  const [traceId, setTraceId] = useState('')
  const [topicId, setTopicId] = useState('')

  useEffect(() => {
    // 支持首次通过URL参数打开
    const { traceId, topicId } = getParams()
    if (traceId && topicId) {
      setTraceId(traceId)
      setTopicId(topicId)
    }
    window.electron.ipcRenderer.on('set-trace', (_event, data) => {
      // data 就是 { traceId, topicId }
      if (data && data.traceId && data.topicId) {
        setTraceId(data.traceId)
        setTopicId(data.topicId)
      }
    })
  }, [])

  const handleFooterClick = () => {
    window.api.shell.openExternal('https://www.aliyun.com/product/edas')
  }

  return (
    <>
      <TracePage traceId={traceId} topicId={topicId} />
      <footer>
        <span onClick={handleFooterClick}>该功能由Alibaba Edas团队提供支持。&emsp;&copy; 2009-2025 aliyun.com</span>
      </footer>
    </>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
