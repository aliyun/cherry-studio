import { convertSpanToSpanEntity, FunctionSpanExporter, FunctionSpanProcessor } from '@mcp-trace/trace-core'
import { WebTracer } from '@mcp-trace/trace-web'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'

const TRACER_NAME = 'CherryStudio'

class WebTraceService {
  init() {
    const exporter = new FunctionSpanExporter((spans: ReadableSpan[]): Promise<void> => {
      // Implement your save logic here if needed
      // For now, just resolve immediately
      console.log('Saving spans:', spans)
      return Promise.resolve()
    })
    const processor = new FunctionSpanProcessor(
      exporter,
      (span: ReadableSpan) => {
        window.api.trace.saveEntity(convertSpanToSpanEntity(span))
      },
      (span: ReadableSpan) => {
        window.api.trace.saveEntity(convertSpanToSpanEntity(span))
      }
    )
    WebTracer.init(
      {
        defaultTracerName: TRACER_NAME,
        serviceName: TRACER_NAME
      },
      processor
    )
  }
}

let traceWin: Window | null = null

export function openTraceWindow(traceId: string, topicId: string, autoOpen = true) {
  if (!traceWin && !autoOpen) {
    return
  }
  const url = `index.html?traceId=${encodeURIComponent(traceId)}&topicId=${encodeURIComponent(topicId)}`
  // 如果窗口已存在且未关闭，则聚焦并发送数据
  if (traceWin && !traceWin.closed) {
    traceWin.focus()
    traceWin.postMessage({ traceId, topicId }, '*')
  } else {
    traceWin = window.open(url, 'traceWindow', 'width=600,height=700')
    // 可选：首次打开后，等待子窗口加载完毕再发送数据
    const timer = setInterval(() => {
      if (traceWin && traceWin.document && traceWin.document.readyState === 'complete') {
        traceWin!.postMessage({ traceId, topicId }, '*')
        clearInterval(timer)
      }
    }, 100)
  }
}

export const webTraceService = new WebTraceService()
