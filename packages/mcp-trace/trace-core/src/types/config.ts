import { Attributes, Link } from '@opentelemetry/api'
import { TimedEvent } from '@opentelemetry/sdk-trace-base'

export interface TelemetryConfig {
  serviceName: string
  endpoint?: string
  headers?: Record<string, string>
  defaultTracerName?: string
}

export interface TraceConfig extends TelemetryConfig {
  maxAttributesPerSpan?: number
}

export interface TraceEntity {
  id: string
  name: string
}

export interface SpanEntity {
  id: string
  name: string
  parentId: string
  traceId: string
  status: string
  kind: string
  attributes: Attributes | undefined
  isEnd: boolean
  events: TimedEvent[] | undefined
  startTime: number
  endTime: number | null
  links: Link[] | undefined
  topicId?: string
}

export const defaultConfig: TelemetryConfig = {
  serviceName: 'default',
  headers: {},
  defaultTracerName: 'default'
}
