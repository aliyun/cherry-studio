import { Attributes, Link, TraceState } from '@opentelemetry/api'
import { InstrumentationScope } from '@opentelemetry/core'
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
  traceState: TraceState | undefined
  isEnd: boolean
  resourceAttribute: Attributes | undefined
  instrumentationScope: InstrumentationScope
  events: TimedEvent[] | undefined
  startTime: number
  endTime: number | null
  duration: number | null
  links: Link[] | undefined
}

export const defaultConfig: TelemetryConfig = {
  serviceName: 'default',
  headers: {},
  defaultTracerName: 'default'
}
