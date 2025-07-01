import { MessageStream } from '@anthropic-ai/sdk/resources/messages/messages'
import { TokenUsage } from '@mcp-trace/trace-core'
import { cleanContext, endContext, getContext, startContext } from '@mcp-trace/trace-web'
import { context, Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { CompletionsResult } from '@renderer/aiCore/middleware/schemas'
import { isAsyncIterable } from '@renderer/aiCore/middleware/utils'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { Topic } from '@renderer/types'
import { SdkRawChunk } from '@renderer/types/sdk'
import { OpenAI } from 'openai'
import { Stream } from 'openai/streaming'

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
      const data = isCompletionsResult(params.outputs) ? params.outputs.getText() : JSON.stringify(params.outputs || {})
      span.setAttributes({ outputs: data })
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
          if (!data || typeof data !== 'object') {
            endSpan({ topicId: params.topicId, outputs: data, span })
            return data
          }

          if (data instanceof Stream) {
            return handleStream(data, span, params.topicId)
          } else if (data instanceof MessageStream) {
            handleMessageStream(data, span, params.topicId)
          } else if (isAsyncIterable<SdkRawChunk>(data)) {
            return handleAsyncIterable(data, span, params.topicId)
          } else {
            const usageData = 'usage' in data || 'usageMetadata' in data ? data : null
            const usage = getUsage(usageData)
            if (usage && span) {
              window.api.trace.tokenUsage(span.spanContext().spanId, usage)
            }
            endSpan({ topicId: params.topicId, outputs: getStreamRespText(data), span })
          }
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

function handleStream(
  stream: Stream<OpenAI.Chat.Completions.ChatCompletionChunk | OpenAI.Responses.ResponseStreamEvent>,
  span?: Span,
  topicId?: string
) {
  if (!span) {
    return
  }
  const [left, right] = stream.tee()

  processStream(right)
    .then((data) => {
      if (data && span) {
        window.api.trace.tokenUsage(span.spanContext().spanId, data.tokens)
      }
      endSpan({ topicId, outputs: getStreamRespText(data.context), span })
    })
    .catch((err) => {
      endSpan({ topicId, error: err, span })
    })
  return left
}

async function processStream(
  stream: Stream<OpenAI.Chat.Completions.ChatCompletionChunk | OpenAI.Responses.ResponseStreamEvent>
) {
  const tokens: TokenUsage = {
    completion_tokens: 0,
    prompt_tokens: 0,
    total_tokens: 0
  }

  const context: any[] = []

  for await (const chunk of stream) {
    if ('response' in chunk) {
      if (chunk.response.usage) {
        tokens.completion_tokens += chunk.response.usage.output_tokens || 0
        tokens.prompt_tokens += chunk.response.usage.input_tokens || 0
        tokens.total_tokens += (chunk.response.usage.input_tokens || 0) + chunk.response.usage.output_tokens
      }
      context.push(chunk.response)
    } else {
      if ('usage' in chunk && chunk.usage) {
        tokens.completion_tokens += (chunk as any).usage.completion_tokens || 0
        tokens.prompt_tokens += (chunk as any).usage.prompt_tokens || 0
        tokens.total_tokens += ((chunk as any).usage.completion_tokens || 0) + (chunk as any).usage.prom
      }
      context.push(chunk)
    }
  }
  return { tokens, context }
}

function handleMessageStream(stream: MessageStream, span?: Span, topicId?: string) {
  if (!span) {
    return
  }
  stream.on('error', (err) => {
    endSpan({ topicId, error: err, span })
  })
  const tokens: TokenUsage = {
    completion_tokens: 0,
    prompt_tokens: 0,
    total_tokens: 0
  }
  const messages: { usage?: { output_tokens: number; input_tokens: number } }[] = []
  stream.on('message', (message) => {
    if (message.usage) {
      tokens.completion_tokens += message.usage.output_tokens
      tokens.prompt_tokens += message.usage.input_tokens
      tokens.total_tokens += message.usage.output_tokens + message.usage.input_tokens
    }
    messages.push(message)
  })
  stream.on('end', () => {
    window.api.trace.tokenUsage(span.spanContext().spanId, tokens)
    endSpan({ topicId, outputs: messages, span })
  })
}

async function handleAsyncIterable<T>(
  iterable: AsyncIterable<T>,
  span?: Span,
  topicId?: string
): Promise<AsyncIterable<T>> {
  if (!span) {
    return iterable
  }
  const buffer: T[] = []
  let sourceDone = false
  let error: unknown = null
  const tokens: TokenUsage = {
    completion_tokens: 0,
    prompt_tokens: 0,
    total_tokens: 0
  }

  // 启动消费线程
  ;(async () => {
    try {
      for await (const item of iterable) {
        buffer.push(item)
        const usage = getUsage(item)
        tokens.completion_tokens += usage?.completion_tokens || 0
        tokens.prompt_tokens += usage?.prompt_tokens || 0
        tokens.total_tokens += usage?.total_tokens || 0
      }
    } catch (e) {
      error = e
      span.recordException(e instanceof Error ? e : new Error(String(e)))
    } finally {
      sourceDone = true
      window.api.trace.tokenUsage(span.spanContext().spanId, tokens)
      endSpan({ topicId, outputs: buffer, span })
    }
  })()

  // 返回新的可复用迭代器
  return {
    async *[Symbol.asyncIterator]() {
      while (!sourceDone || buffer.length > 0) {
        if (error) throw error
        if (buffer.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10))
          continue
        }
        yield buffer.shift()!
      }
    }
  }
}

function isCompletionsResult(data: any): data is CompletionsResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.getText === 'function' &&
    (data.rawOutput === undefined || typeof data.rawOutput === 'object') &&
    (data.stream === undefined || typeof data.stream === 'object') &&
    (data.controller === undefined || data.controller instanceof AbortController)
  )
}

function getStreamRespText(data: any) {
  if (isCompletionsResult(data)) {
    return { ...data, isStream: true, streamText: data.getText() }
  }
  return data
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
