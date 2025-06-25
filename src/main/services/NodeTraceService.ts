import { isDev } from '@main/constant'
import { CacheBatchSpanProcessor, FunctionSpanExporter } from '@mcp-trace/trace-core'
import { NodeTracer as MCPNodeTracer } from '@mcp-trace/trace-node'
import { context, SpanContext, trace } from '@opentelemetry/api'
import { BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'

import { spanCacheService } from './SpanCacheService'

export const TRACER_NAME = 'CherryStudio'

export class NodeTraceService {
  init() {
    const exporter = new FunctionSpanExporter(async (spans) => {
      console.log(`Spans length:`, spans.length)
    })

    MCPNodeTracer.init(
      {
        defaultTracerName: TRACER_NAME,
        serviceName: TRACER_NAME
      },
      new CacheBatchSpanProcessor(exporter, spanCacheService)
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

let traceWin: BrowserWindow | null = null

export function openTraceWindow(topicId: string, traceId: string, autoOpen = true) {
  if (traceWin && !traceWin.isDestroyed()) {
    traceWin.focus()
    traceWin.webContents.send('set-trace', { traceId, topicId })
    return
  }

  if (!autoOpen) {
    return
  }

  traceWin = new BrowserWindow({
    width: 600,
    minWidth: 500,
    minHeight: 600,
    height: 800,
    autoHideMenuBar: false,
    closable: true,
    focusable: true,
    transparent: true,
    resizable: true,
    movable: true,
    hasShadow: true,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev ? true : false
    }
  })
  traceWin.setMenuBarVisibility(false)
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    traceWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + `/traceWindow.html`)
  } else {
    traceWin.loadFile(path.join(__dirname, '../renderer/traceWindow.html'))
  }
  traceWin.on('closed', () => {
    traceWin = null
  })

  traceWin.webContents.on('did-finish-load', () => {
    traceWin!.webContents.send('set-trace', { traceId, topicId })
  })
}
