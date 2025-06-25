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

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_tokens_details?: {
    [key: string]: number
  }
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
  usage?: TokenUsage
}

export const defaultConfig: TelemetryConfig = {
  serviceName: 'default',
  headers: {},
  defaultTracerName: 'default'
}
