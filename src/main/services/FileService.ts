import fs from 'node:fs'

import { TraceMethod } from '@mcp-trace/trace-core'

export default class FileService {
  @TraceMethod({ spanName: 'readFile', tag: 'FileService' })
  public static async readFile(_: Electron.IpcMainInvokeEvent, path: string) {
    return fs.readFileSync(path, 'utf8')
  }
}
