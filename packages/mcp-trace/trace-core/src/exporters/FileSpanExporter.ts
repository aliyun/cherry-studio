import { ExportResult, ExportResultCode } from '@opentelemetry/core'
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export class FileSpanExporter implements SpanExporter {
  private filePath: string

  constructor(filePath?: string) {
    this.filePath = path.join(os.homedir(), '.cherrystudio', filePath || 'trace')
    this.createFilePath(this.filePath)
  }

  shutdown(): Promise<void> {
    return Promise.resolve()
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    spans.forEach((span) => {
      const traceFile = path.join(this.filePath, `${span.spanContext().traceId}.json`)
      this.createFilePath(traceFile)
      fs.appendFile(traceFile, JSON.stringify(span) + '\n', (err) => {
        if (err) {
          console.error(`Failed to write span to file ${traceFile}:`, err)
          resultCallback?.({ code: ExportResultCode.FAILED })
        } else {
          console.log(`Span written to file ${traceFile}`)
          resultCallback?.({ code: ExportResultCode.SUCCESS })
        }
      })
    })
  }

  private createFilePath(filePath: string) {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, { recursive: true })
    }
  }
}
