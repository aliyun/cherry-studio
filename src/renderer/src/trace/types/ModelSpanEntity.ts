import { Span } from '@opentelemetry/api'

export interface StartSpanParams {
  topicId: string
  name?: string
  inputs?: any | any[]
  tag?: string
  parentSpanId?: string
  modelName?: string
}

export interface EndSpanParams {
  topicId: string
  modelName?: string
  outputs?: any | any[]
  error?: Error
  span?: Span
}

export class ModelSpanEntity {
  private modelName?: string
  private spans: Span[] = []
  private endMessage: string[] = []

  constructor(modelName?: string) {
    this.modelName = modelName
  }

  getCurrentSpan(modelName?: string): Span | undefined {
    if (modelName !== this.modelName) return undefined
    return this.spans.length > 0 ? this.spans[this.spans.length - 1] : undefined
  }

  addSpan(span: Span) {
    this.spans.push(span)
  }

  removeSpan(span: Span) {
    const index = this.spans.indexOf(span)
    if (index !== -1) {
      this.spans.splice(index, 1)
      return true
    }
    return false
  }

  pauseSpan() {
    this.spans.forEach((span) => {
      span.setAttribute('outputs', 'you paused')
      span.end()
    })
    this.spans = []
  }

  getModelName() {
    return this.modelName
  }

  getSpanById(spanId?: string) {
    return spanId ? this.spans.find((span) => span.spanContext().spanId === spanId) : undefined
  }

  addEndMessage(message: string) {
    this.endMessage.push(message)
  }

  getEndMessage() {
    return this.endMessage.join('\n')
  }
}
