import { EmitterSpanProcessor, FunctionSpanExporter } from '@mcp-trace/trace-core'
import { NodeTracer as MCPNodeTracer } from '@mcp-trace/trace-node'
import { context, propagation } from '@opentelemetry/api'
import { ipcMain, ipcRenderer } from 'electron'

export class NodeTraceService {
  init() {
    const exporter = new FunctionSpanExporter(async (spans) => {
      console.log(`Spans:`, spans)
    })

    MCPNodeTracer.init(
      {
        defaultTracerName: 'CherryStudio',
        serviceName: 'CherryStudio'
      },
      new EmitterSpanProcessor(exporter, ipcRenderer)
    )
  }
}

const originalHandle = ipcMain.handle
ipcMain.handle = (channel: string, handler: (...args: any[]) => Promise<any>) => {
  return originalHandle.call(ipcMain, channel, async (event, ...args) => {
    console.log(`[主进程拦截] 通道: ${channel}`, args)
    const carray = args && args.length > 0 ? args[args.length - 1] : {}
    let ctx = context.active()
    let newArgs = args
    if (carray && typeof carray === 'object' && 'type' in carray && carray.type === 'trace') {
      ctx = propagation.extract(context.active(), carray)
      newArgs = args.slice(0, args.length - 1)
    }
    return context.with(ctx, () => handler(event, ...newArgs))
  })
}

export const nodeTraceService = new NodeTraceService()
