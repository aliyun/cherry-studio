import { TokenUsage } from '@mcp-trace/trace-core'
import { cleanContext, endContext, getContext, startContext } from '@mcp-trace/trace-web'
import { context, Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { Topic } from '@renderer/types'

export interface StartSpanParams {
  topicId?: string
  name?: string
  inputs?: any | any[]
  tag?: string
  parentSpanId?: string
}

export interface EndSpanParams {
  topicId?: string
  outputs?: any | any[]
  error?: Error
  span?: Span
}

class SpanManagerService {
  private spanMap: Map<string, Span[]> = new Map()

  startTrace(topicId: string, name?: string, inputs?: any) {
    const span = webTracer.startSpan(name || 'root', {
      root: true,
      attributes: {
        inputs: JSON.stringify(inputs || {})
      }
    })

    const ctx = trace.setSpan(context.active(), span)
    startContext(topicId, ctx)
    this.spanMap.set(topicId, [span])
    const traceId = span.spanContext().traceId
    window.api.trace.bindTopic(topicId, traceId)
    return span
  }

  endTrace(params: EndSpanParams) {
    if (!params.topicId) {
      throw new Error('cannot get topicId from params')
    }
    const span = this.spanMap.get(params.topicId)?.pop()
    if (span) {
      span.setAttributes({ outputs: JSON.stringify(params.outputs || {}) })
      if (params.error) {
        span.recordException(params.error)
      }
      span.end()
      window.api.trace.saveData(span.spanContext().traceId)
    } else {
      console.error('No active span found to end.')
    }
    cleanContext(params.topicId)
  }

  addSpan(params: StartSpanParams) {
    if (!params.topicId) {
      return
    }
    let parentSpan: Span | undefined = undefined
    if (params.parentSpanId) {
      parentSpan = this.spanMap
        .get(params.topicId)
        ?.values()
        .find((sp) => sp.spanContext().spanId === params.parentSpanId)
    }
    const parentCtx = parentSpan ? trace.setSpan(context.active(), parentSpan) : getContext(params.topicId)
    const span = webTracer.startSpan(
      params.name || 'root',
      {
        attributes: {
          inputs: JSON.stringify(params.inputs || {}),
          tags: params.tag || ''
        }
      },
      parentCtx
    )
    const ctx = trace.setSpan(getContext(params.topicId), span)
    this.spanMap.get(params.topicId)?.push(span)
    startContext(params.topicId, ctx)
    return span
  }

  endSpan(params: EndSpanParams) {
    if (!params.topicId) {
      return
    }
    const span = params.span || this.getCurrentSpan(params.topicId)
    if (!span) {
      console.error(`No active span found for topicId: ${params.topicId}.`)
      return
    } else if (this.spanMap.get(params.topicId)?.length === 1) {
      console.warn(`No more spans left for topicId: ${params.topicId}.`)
    }

    // remove span
    const spans = this.spanMap.get(params.topicId)
    if (spans) {
      const idx = spans.indexOf(span)
      if (idx !== -1) {
        spans.splice(idx, 1)
      }
    }

    console.log('endSpan', span['name'], JSON.stringify(span.spanContext()))
    if (params.error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: params.error.message
      })
    } else if (params.outputs) {
      span.setAttributes({ outputs: JSON.stringify(params.outputs || {}) })
    }
    span.end()
    endContext(params.topicId)
  }

  getCurrentSpan(topicId?: string): Span | undefined {
    const spans = this.spanMap.get(topicId || '')
    return spans && spans.length > 0 ? spans[spans.length - 1] : undefined
  }

  async addTokenUsage(topicId: string, prompt: number, completion: number) {
    const span = this.getCurrentSpan(topicId)
    const usage: TokenUsage = {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion
    }
    if (span) {
      window.api.trace.tokenUsage(span.spanContext().spanId, usage)
    }
  }
}
/**
 * Wraps a function and executes it within a span, returning the function's result instead of the wrapped function.
 * @param fn The function to execute.
 * @param name The span name.
 * @param tags The span tags.
 * @param getTopicId Function to get topicId from arguments.
 * @returns The result of the executed function.
 */
export function withSpanResult<F extends (...args: any) => any>(
  fn: F,
  params: StartSpanParams,
  ...args: Parameters<F>
): ReturnType<F> {
  if (!params.topicId) {
    return fn(...args)
  }
  const span = addSpan({
    topicId: params.topicId,
    name: params.name,
    tag: params.tag,
    inputs: args,
    parentSpanId: params.parentSpanId
  })
  try {
    const result = fn(...args)
    if (result instanceof Promise) {
      return result
        .then((data) => {
          const usageData = typeof data !== 'object' ? null : 'usage' in data || 'usageMetadata' in data ? data : null
          const usage = getUsage(usageData)
          if (usage && span) {
            window.api.trace.tokenUsage(span.spanContext().spanId, usage)
          }
          endSpan({ topicId: params.topicId, outputs: data, span })
          return data
        })
        .catch((err) => {
          endSpan({ topicId: params.topicId, error: err, span })
          throw err
        }) as ReturnType<F>
    } else {
      endSpan({ topicId: params.topicId, outputs: result, span })
      return result
    }
  } catch (err) {
    endSpan({ topicId: params.topicId, error: err as Error, span })
    throw err
  }
}

function getUsage(result?: any): TokenUsage | undefined {
  // Replace this with an appropriate property check for CompletionsResult
  if (!result || typeof result !== 'object' || !('usage' in result || 'usageMetadata' in result)) {
    return undefined
  }
  const tokens: TokenUsage = {
    completion_tokens: 0,
    prompt_tokens: 0,
    total_tokens: 0
  }
  if ('usage' in result) {
    const usage = result.usage
    tokens.completion_tokens = usage['completion_tokens'] || 0
    tokens.prompt_tokens = usage['prompt_tokens'] || 0
    tokens.total_tokens = usage['total_tokens'] || 0
    // Do something with usage
  } else {
    const usage = result.usageMetadata
    tokens.completion_tokens = usage['thoughtsTokenCount'] || 0
    tokens.prompt_tokens = usage['promptTokenCount'] || 0
    tokens.total_tokens = usage['totalTokenCount'] || 0
  }
  return tokens
}

export function withSpanFunc<F extends (...args: any | any[]) => ReturnType<F>>(
  fn: F,
  name: string,
  tags: string,
  getTopicId: (...args: Parameters<F>) => string | undefined
): F {
  return function (...args: Parameters<F>) {
    const topicId = getTopicId(...args)
    if (!topicId) {
      return fn(...args)
    }
    const span = addSpan({ topicId, name, tag: tags, inputs: args })
    try {
      const result = fn(...args)
      if (result instanceof Promise) {
        return result
          .then((data) => {
            endSpan({ topicId, outputs: data, span })
            return data
          })
          .catch((err) => {
            endSpan({ topicId, error: err, span })
            throw err
          })
      } else {
        endSpan({ topicId, outputs: result, span })
        return result
      }
    } catch (err) {
      endSpan({
        topicId,
        error: err as Error,
        span
      })
      throw err
    }
  } as F
}

export const spanManagerService = new SpanManagerService()
export const webTracer = trace.getTracer('CherryStudio', '1.0.0')
export const addSpan = spanManagerService.addSpan.bind(spanManagerService)
export const startTrace = spanManagerService.startTrace.bind(spanManagerService)
export const endTrace = spanManagerService.endTrace.bind(spanManagerService)
export const endSpan = spanManagerService.endSpan.bind(spanManagerService)
export const currentSpan = spanManagerService.getCurrentSpan.bind(spanManagerService)
export const addTokenUsage = spanManagerService.addTokenUsage.bind(spanManagerService)

EventEmitter.on(EVENT_NAMES.SEND_MESSAGE, ({ topicId, traceId }) => {
  window.api.trace.openWindow(topicId, traceId, false)
})
EventEmitter.on(EVENT_NAMES.CLEAR_MESSAGES, (topic: Topic) => {
  window.api.trace.cleanTopic(topic.id)
})

// finished before LLM.Chat
// EventEmitter.on(
//   EVENT_NAMES.MESSAGE_COMPLETE,
//   ({
//     id,
//     topicId,
//     status, // 'pause' : 'error',
//     error
//   }) => {
//     const err = error ? new Error(error) : undefined
//     console.log('recieved message complete messages', id, status, error)
//     endTrace({ topicId, error: err })
//   }
// )
