import { EmitterSpanProcessor, FunctionSpanExporter, TRACE_DATA_EVENT } from '@mcp-trace/trace-core'
import { SpanEntity } from '@mcp-trace/trace-core'
import { NodeTracer as MCPNodeTracer } from '@mcp-trace/trace-node'
import { context, SpanContext, trace } from '@opentelemetry/api'
import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { EventEmitter } from 'stream'

export class NodeTraceService {
  static emmitter = new EventEmitter()

  init(mainWindow: Electron.CrossProcessExports.BrowserWindow) {
    const exporter = new FunctionSpanExporter(async (spans) => {
      console.log(`Spans length:`, spans.length)
    })

    NodeTraceService.emmitter.on(TRACE_DATA_EVENT, (ctx, obj) => {
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

export class TraceDataService {
  private fileDir: string

  constructor() {
    this.fileDir = path.join(os.homedir(), '.cherrystudio')
  }

  async savedata(spans: SpanEntity[]) {
    console.log(`Saving spans:`, spans.length)
    spans.map((span) => {
      let filePath = path.join(this.fileDir, span.topicId || 'unkown')
      this.checkFolder(filePath)
      filePath = path.join(filePath, `${span.traceId}.json`)
      fs.appendFileSync(filePath, JSON.stringify(span) + '\n')
    })
  }

  async getData(topicId: string, traceId: string) {
    const filePath = path.join(this.fileDir, topicId, `${traceId}.json`)
    if (!fs.existsSync(filePath)) {
      return []
    }
    const buffer = fs.readFileSync(filePath)
    const lines = buffer
      .toString()
      .split('\n')
      .filter((line) => line.trim() !== '')
    return lines.map((line) => JSON.parse(line) as SpanEntity)
  }

  checkFolder(filePath: string) {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath)
    }
  }
}
export const traceDataService = new TraceDataService()

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
