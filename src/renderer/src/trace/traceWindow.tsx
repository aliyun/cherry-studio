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
  const [reload, setReload] = useState(false)
  const [title, setTitle] = useState('Call Chain Window')
  const [lang, setLang] = useState('zh')

  useEffect(() => {
    // 支持首次通过URL参数打开
    const { traceId, topicId } = getParams()
    if (traceId && topicId) {
      setTraceId(traceId)
      setTopicId(topicId)
    }

    const setTraceHandler = (_, data) => {
      if (data?.traceId && data?.topicId) {
        setTraceId(data.traceId)
        setTopicId(data.topicId)
        if (data.reload) {
          setReload(!reload)
        }
      }
    }

    const setLangHandler = (_, data) => {
      i18n.changeLanguage(data.lang)
      setLang(data.lang)
      const newTitle = i18n.t('trace.traceWindow')
      if (newTitle !== title) {
        window.api.trace.setTraceWindowTitle(i18n.t('trace.traceWindow'))
        setTitle(newTitle)
      }
    }

    const removeTraceHandler = window.electron.ipcRenderer.on('set-trace', setTraceHandler)
    const removeLanguageHandler = window.electron.ipcRenderer.on('set-language', setLangHandler)

    return () => {
      removeTraceHandler()
      removeLanguageHandler()
    }
  }, [title, reload])

  const handleFooterClick = () => {
    console.log('handleFooterClick current lang', lang)
    window.api.shell.openExternal('https://www.aliyun.com/product/edas')
  }

  return (
    <>
      <TracePage traceId={traceId} topicId={topicId} reload={reload} />
      <footer>
        <p onClick={handleFooterClick} className="footer-link">
          {i18n.t('trace.edasSupport')}
        </p>
      </footer>
    </>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
