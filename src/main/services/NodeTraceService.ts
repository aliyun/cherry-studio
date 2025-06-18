import { EmitterSpanProcessor, FunctionSpanExporter, TRACE_DATA_EVENT } from '@mcp-trace/trace-core'
import { NodeTracer as MCPNodeTracer } from '@mcp-trace/trace-node'
import { context, SpanContext, trace } from '@opentelemetry/api'
import { ipcMain } from 'electron'
import { EventEmitter } from 'stream'

export class NodeTraceService {
  static emmitter = new EventEmitter()

  init(mainWindow: Electron.CrossProcessExports.BrowserWindow) {
    const exporter = new FunctionSpanExporter(async (spans) => {
      console.log(`Spans length:`, spans.length)
    })

    NodeTraceService.emmitter.on(TRACE_DATA_EVENT, (ctx, obj) => {
      console.log(` node TRACE_DATA_EVENT`, ctx, obj)
      if (obj) {
        mainWindow.webContents.send(TRACE_DATA_EVENT, ctx, obj)
      }
    })

    MCPNodeTracer.init(
      {
        defaultTracerName: 'CherryStudio',
        serviceName: 'CherryStudio'
      },
      new EmitterSpanProcessor(exporter, NodeTraceService.emmitter)
    )
  }
}

const originalHandle = ipcMain.handle
ipcMain.handle = (channel: string, handler: (...args: any[]) => Promise<any>) => {
  return originalHandle.call(ipcMain, channel, async (event, ...args) => {
    const carray = args && args.length > 0 ? args[args.length - 1] : {}
    let ctx = context.active()
    let newArgs = args
    console.log(`Extracted context from args:`, args)
    if (carray && typeof carray === 'object' && 'type' in carray && carray.type === 'trace') {
      const span = trace.wrapSpanContext(carray.context as SpanContext)
      ctx = trace.setSpan(context.active(), span)
      console.log(`Current span:`, trace.getActiveSpan()?.spanContext())
      newArgs = args.slice(0, args.length - 1)
    }
    return context.with(ctx, () => handler(event, ...newArgs))
  })
}

export const nodeTraceService = new NodeTraceService()
