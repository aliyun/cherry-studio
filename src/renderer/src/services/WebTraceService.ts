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
  private cache: Map<string, SpanEntity> = new Map<string, SpanEntity>()
  createSpan: (span: ReadableSpan) => void = (span: ReadableSpan) => {
    const spanEntity = convertSpanToSpanEntity(span)
    this.cache.set(span.spanContext().spanId, spanEntity)
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

      //TODO save span to store && remove from cache
    }
  }

  clear: () => void = () => {
    this.cache.clear()
  }

  getSpans: (traceId: string) => SpanEntity[] = (traceId: string) => {
    return this.cache
      .values()
      .filter((spanEntity) => {
        return spanEntity.traceId === traceId
      })
      .toArray()
  }

  addEntity(entity: SpanEntity): void {
    this.cache.set(entity.id, entity)
  }

  updateEntity(entity: SpanEntity): void {
    this.cache.set(entity.id, entity)
  }
}

const ipcRenderer = window.electron.ipcRenderer

class WebTraceService {
  static span: Span | null = null
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

  startTrace(name?: string, inputs?: any) {
    const span = webTracer.startSpan(name || 'root', {
      root: true,
      attributes: {
        inputs: JSON.stringify(inputs || {})
      }
    })
    const ctx = trace.setSpan(context.active(), span)
    setParentContext(ctx)
    WebTraceService.span = span
    return span
  }

  endTrace(outputs?: any) {
    // const span = trace.getActiveSpan()
    const span = WebTraceService.span
    console.log('endTrace', JSON.stringify(span?.spanContext()))
    if (span) {
      span.setAttributes({ outputs: JSON.stringify(outputs || {}) })
      span.end()
    } else {
      console.error('No active span found to end.')
    }
  }
}

export const spanCache = new WebTraceCache()
export const webTraceService = new WebTraceService()
export const webTracer = trace.getTracer(TRACER_NAME)
