import { SpanEntity } from '@mcp-trace/trace-core'
import { atom } from 'jotai'

class TraceManager {
  traceList = atom<SpanEntity[]>([])
  showTrace = atom(false)
}

export const traceManager = new TraceManager()
export const traceListAtom = traceManager.traceList
export const showTraceAtom = traceManager.showTrace
