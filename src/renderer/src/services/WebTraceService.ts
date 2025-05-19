import {
  convertSpanToSpanEntity,
  ON_END,
  ON_START,
  SpanEntity,
  TRACE_DATA_EVENT,
  TraceCache
} from '@mcp-trace/trace-core'
import { WebTracer } from '@mcp-trace/trace-web'
import { SpanStatusCode } from '@opentelemetry/api'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'

class WebTraceCache implements TraceCache {
  private cache: Map<string, SpanEntity> = new Map<string, SpanEntity>()
  createSpan: (span: ReadableSpan) => void = (span: ReadableSpan) => {
    const spanEntity = convertSpanToSpanEntity(span)
    this.cache.set(span.spanContext().spanId, spanEntity)
    if (spanEntity.parentId && this.cache.has(spanEntity.parentId)) {
      const parentSpan = this.cache.get(spanEntity.parentId)
      if (parentSpan && parentSpan.children) {
        parentSpan.children.push(spanEntity)
      } else if (parentSpan) {
        parentSpan.children = [spanEntity]
      }
    }
  }

  endSpan: (span: ReadableSpan) => void = (span: ReadableSpan) => {
    const spanId = span.spanContext().spanId
    if (this.cache.has(spanId)) {
      const spanEntity = this.cache.get(spanId)
      if (spanEntity) {
        spanEntity.endTime = span.endTime ? span.endTime[0] * 1e3 + Math.floor(span.endTime[1] / 1e6) : null
        spanEntity.status = SpanStatusCode[span.status.code]
        spanEntity.attributes = span.attributes
        spanEntity.duration = span.duration ? span.duration[0] * 1e3 + Math.floor(span.duration[1] / 1e6) : 0
        spanEntity.events = span.events
        spanEntity.links = span.links
      }
    }
  }

  clear: () => void = () => {
    this.cache.clear()
  }

  getSpans: () => SpanEntity[] = () => {
    const spans: SpanEntity[] = []
    this.cache.forEach((span) => {
      spans.push(span)
    })
    return spans
  }
}

const ipcRenderer = window.electron.ipcRenderer

// readonly method cannot be changed
// const originalHandle = ipcRenderer.invoke
// ipcRenderer.invoke = (channel: string, handler: (...args: any[]) => Promise<any>) => {
//   return originalHandle.call(ipcRenderer, channel, async (event, ...args) => {
//     console.log(`[渲染进程拦截] 通道: ${channel}`, args)
//     const carray = { type: 'trace' }
//     propagation.inject(context.active(), carray)
//     return handler(event, ...args, carray)
//   })
// }

class WebTraceService {
  init() {
    //    instrumentPromises()
    WebTracer.init(
      {
        defaultTracerName: 'CherryStudio',
        serviceName: 'CherryStudio'
      },
      spanCache,
      // Provide a SaveFunction that returns a Promise<void>
      (spans: ReadableSpan[]): Promise<void> => {
        // Implement your save logic here if needed
        // For now, just resolve immediately
        console.log('Saving spans:', spans)
        return Promise.resolve()
      }
    )

    ipcRenderer.on(TRACE_DATA_EVENT, (event: any, type: string, data: ReadableSpan) => {
      console.log('TRACE_DATA_EVENT message', type, data)
      if (ON_START === type) {
        spanCache.createSpan(data)
      } else if (ON_END === type) {
        spanCache.endSpan(data)
      }
    })
  }
}

export const spanCache = new WebTraceCache()
export const webTraceService = new WebTraceService()
