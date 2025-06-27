import i18n from '@renderer/i18n'
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
  const [title, setTitle] = useState('Call Chain Window')

  useEffect(() => {
    // 支持首次通过URL参数打开
    const { traceId, topicId } = getParams()
    if (traceId && topicId) {
      setTraceId(traceId)
      setTopicId(topicId)
    }
    window.electron.ipcRenderer.on('set-trace', (_event, data) => {
      if (data?.traceId && data?.topicId) {
        setTraceId(data.traceId)
        setTopicId(data.topicId)
      }
    })

    window.electron.ipcRenderer.on('set-language', (_event, data) => {
      i18n.changeLanguage(data.lang)
      const newTitle = i18n.t('trace.traceWindow')
      if (newTitle !== title) {
        window.api.trace.setTraceWindowTitle(i18n.t('trace.traceWindow'))
        setTitle(newTitle)
      }
    })
  }, [title])

  const handleFooterClick = () => {
    window.api.shell.openExternal('https://www.aliyun.com/product/edas')
  }

  return (
    <>
      <TracePage traceId={traceId} topicId={topicId} />
      <footer>
        <p
          onClick={handleFooterClick}
          style={{ color: '#1677ff', cursor: 'pointer', textDecoration: 'underline', display: 'contents' }}>
          由阿里云 EDAS 提供技术支持
        </p>
      </footer>
    </>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
