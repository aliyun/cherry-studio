import { SpanEntity } from '@mcp-trace/trace-core'

export interface TraceModal extends SpanEntity {
  children: TraceModal[]
  rootEnd: number
  rootStart: number
  start: number
  percent: number
}
