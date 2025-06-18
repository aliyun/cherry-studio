import {
  convertSpanToSpanEntity,
  FunctionSpanExporter,
  ON_END,
  ON_START,
  SpanEntity,
  TRACE_DATA_EVENT,
  TraceCache
} from '@mcp-trace/trace-core'
import { instrumentPromises, setParentContext, WebTracer } from '@mcp-trace/trace-web'
import { context, Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'

const TRACER_NAME = 'CherryStudio'

class WebTraceCache implements TraceCache {
  private topicMap: Map<string, string> = new Map<string, string>()

  private cache: Map<string, SpanEntity> = new Map<string, SpanEntity>()
  createSpan: (span: ReadableSpan) => void = (span: ReadableSpan) => {
    const spanEntity = convertSpanToSpanEntity(span)
    spanEntity.topicId = this.topicMap.get(spanEntity.traceId)
    this.cache.set(span.spanContext().spanId, spanEntity)
  }

  endSpan: (span: ReadableSpan) => void = (span: ReadableSpan) => {
    const spanId = span.spanContext().spanId
    if (this.cache.has(spanId)) {
      const spanEntity = this.cache.get(spanId)
      if (spanEntity) {
        spanEntity.topicId = this.topicMap.get(spanEntity.traceId)
        spanEntity.endTime = span.endTime ? span.endTime[0] * 1e3 + Math.floor(span.endTime[1] / 1e6) : null
        spanEntity.status = SpanStatusCode[span.status.code]
        spanEntity.attributes = span.attributes
        spanEntity.events = span.events
        spanEntity.links = span.links
      }

      //TODO save span to store && remove from cache
    }
  }

  clear: () => void = () => {
    this.cache.clear()
  }

  cleanTopic: (topicId: string) => void = (topicId: string) => {
    const spans = Array.from(this.cache.values().filter((e) => e.topicId === topicId))
    spans.map((e) => e.id).forEach((id) => this.cache.delete(id))
  }

  saveSpans: (traceId: string) => void = (traceId: string) => {
    const spans = Array.from(this.cache.values().filter((e) => e.traceId === traceId))
    window.api.trace.saveData(spans || ([] as SpanEntity[]))
  }

  getSpans: (topicId: string, traceId: string) => Promise<SpanEntity[]> = async (topicId: string, traceId: string) => {
    if (this.topicMap.has(traceId)) {
      return Array.from(this.cache.values()).filter((spanEntity) => {
        return spanEntity.traceId === traceId
      })
    } else {
      return (await window.api.trace.getData(topicId, traceId)) as SpanEntity[]
    }
  }

  addEntity(entity: SpanEntity): void {
    entity.topicId = this.topicMap.get(entity.traceId)
    this.cache.set(entity.id, entity)
  }

  updateEntity(entity: SpanEntity): void {
    entity.topicId = this.topicMap.get(entity.traceId)
    this.cache.set(entity.id, entity)
  }

  setTopicId(traceId: string, topicId: string): void {
    this.topicMap.set(traceId, topicId)
  }
}

const ipcRenderer = window.electron.ipcRenderer

class WebTraceService {
  static parentSpans: Map<string, Span> = new Map<string, Span>()
  init() {
    instrumentPromises()
    WebTracer.init(
      {
        defaultTracerName: TRACER_NAME,
        serviceName: TRACER_NAME
      },
      spanCache,
      // Provide a SaveFunction that returns a Promise<void>
      new FunctionSpanExporter((spans: ReadableSpan[]): Promise<void> => {
        // Implement your save logic here if needed
        // For now, just resolve immediately
        console.log('Saving spans:', spans)
        return Promise.resolve()
      })
    )

    ipcRenderer.on(TRACE_DATA_EVENT, (event: any, type: string, data: SpanEntity) => {
      console.log('TRACE_DATA_EVENT message', event, type, data)
      if (ON_START === type) {
        spanCache.addEntity(data)
      } else if (ON_END === type) {
        spanCache.updateEntity(data)
      }
    })
  }

  startTrace(topicId: string, name?: string, inputs?: any) {
    const span = webTracer.startSpan(name || 'root', {
      root: true,
      attributes: {
        inputs: JSON.stringify(inputs || {})
      }
    })
    const ctx = trace.setSpan(context.active(), span)
    spanCache.cleanTopic(topicId)
    setParentContext(ctx)
    WebTraceService.parentSpans.set(topicId, span)
    spanCache.setTopicId(span.spanContext().traceId, topicId)
    return span
  }

  endTrace(topicId: string, outputs?: any) {
    // const span = trace.getActiveSpan()
    const span = WebTraceService.parentSpans.get(topicId)
    console.log('endTrace', JSON.stringify(span?.spanContext()))
    if (span) {
      span.setAttributes({ outputs: JSON.stringify(outputs || {}) })
      span.end()
      spanCache.saveSpans(span.spanContext().traceId)
    } else {
      console.error('No active span found to end.')
    }
  }
}

export const spanCache = new WebTraceCache()
export const webTraceService = new WebTraceService()
export const webTracer = trace.getTracer(TRACER_NAME)
