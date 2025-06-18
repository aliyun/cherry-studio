import 'reflect-metadata'

import { Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { context as traceContext } from '@opentelemetry/api'

import { defaultConfig } from '../types/config'

export interface SpanDecoratorOptions {
  spanName?: string
  traceName?: string
  tag?: string
}

// typescrit 5.0+
export function Traced<This, Args extends any[], Return>(options?: SpanDecoratorOptions) {
  return (originalMethod: (this: This, ...args: Args) => Return, context: ClassMethodDecoratorContext<This>) => {
    const methodName = String(context.name)
    const spanName = options?.spanName || `method:${methodName}`
    const traceName = options?.traceName || defaultConfig.defaultTracerName || 'default'
    const tag = options?.tag || ''

    return function (this: This, ...args: Args): Return {
      const tracer = trace.getTracer(traceName)

      return traceContext.with(traceContext.active(), () =>
        tracer.startActiveSpan(spanName, (span: Span) => {
          try {
            span.setAttributes({
              'class.name': this?.constructor?.name || 'unknown',
              inputs: JSON.stringify(args),
              tags: tag
            })

            const result = originalMethod.apply(this, args)
            span.setStatus({ code: 1 })
            span.setAttribute('outputs', convertToString(result))
            span.end()
            return result
          } catch (error) {
            span.setStatus({ code: 2, message: error.message })
            span.recordException(error)
            span.end()
            throw error
          }
        })
      )
    }
  }
}

// typescrit 5.0+
export function TracedAsync<This, Args extends any[], Return>(options?: SpanDecoratorOptions) {
  return (
    originalMethod: (this: This, ...args: Args) => Promise<Return>,
    context: ClassMethodDecoratorContext<This>
  ) => {
    const methodName = String(context.name)
    const spanName = options?.spanName || `method:${methodName}`
    const traceName = options?.traceName || defaultConfig.defaultTracerName || 'default'
    const tag = options?.tag || ''

    return function async(this: This, ...args: Args): Promise<Return> {
      const tracer = trace.getTracer(traceName)

      return traceContext.with(traceContext.active(), () =>
        tracer.startActiveSpan(spanName, (span: Span) => {
          span.setAttributes({
            'class.name': this?.constructor?.name || 'unknown',
            inputs: JSON.stringify(args),
            tags: tag
          })

          return originalMethod
            .apply(this, args)
            .then((res) => {
              span.setStatus({ code: 1 })
              span.setAttribute('outputs', convertToString(res))
              return res
            })
            .catch((err) => {
              span.setStatus({ code: 2, message: err.message })
              span.recordException(err)
              throw err
            })
            .finally(() => span.end())
        })
      )
    }
  }
}

// typescrit 5.0-
export function TraceMethod(traced: SpanDecoratorOptions) {
  return function (target: any, propertyKey?: any, descriptor?: PropertyDescriptor | undefined) {
    // 兼容静态方法装饰器只传2个参数的情况
    if (!descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(target, propertyKey)
    }
    if (!descriptor || typeof descriptor.value !== 'function') {
      throw new Error('TraceMethod can only be applied to methods.')
    }
    const originalMethod = descriptor.value
    const traceName = traced.traceName || defaultConfig.defaultTracerName || 'default'
    const tracer = trace.getTracer(traceName)
    const name = traced.spanName || propertyKey

    descriptor.value = async function (...args: any[]) {
      return tracer.startActiveSpan(name, async (span) => {
        try {
          span.setAttribute('inputs', convertToString(args))
          span.setAttribute('tags', traced.tag || '')
          const result = await originalMethod.apply(this, args)
          span.setAttribute('outputs', convertToString(result))
          span.setStatus({ code: SpanStatusCode.OK })
          return result
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error)
          })
          span.recordException(error instanceof Error ? error : new Error(String(error)))
          throw error
        } finally {
          span.end()
        }
      })
    }
    return descriptor
  }
}

export function TraceProperty(traced: SpanDecoratorOptions) {
  return (target: any, propertyKey: string, descriptor?: PropertyDescriptor) => {
    // 处理箭头函数类属性
    const traceName = traced.traceName || defaultConfig.defaultTracerName || 'default'
    const tracer = trace.getTracer(traceName)
    const name = traced.spanName || propertyKey

    if (!descriptor) {
      const originalValue = target[propertyKey]

      Object.defineProperty(target, propertyKey, {
        value: async function (...args: any[]) {
          const span = tracer.startSpan(name)
          try {
            span.setAttribute('inputs', convertToString(args))
            span.setAttribute('tags', traced.tag || '')
            const result = await originalValue.apply(this, args)
            span.setAttribute('outputs', convertToString(result))
            return result
          } catch (error) {
            span.recordException(error)
            span.setStatus({ code: 1, message: error.message })
            throw error
          } finally {
            span.end()
          }
        },
        configurable: true,
        writable: true
      })
      return
    }

    // 标准方法装饰器逻辑
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const span = tracer.startSpan(name)
      try {
        span.setAttribute('inputs', convertToString(args))
        span.setAttribute('tags', traced.tag || '')
        const result = await originalMethod.apply(this, args)
        span.setAttribute('outputs', convertToString(result))
        return result
      } catch (error) {
        span.recordException(error)
        span.setStatus({ code: 1, message: error.message })
        throw error
      } finally {
        span.end()
      }
    }
  }
}

export function withSpanFunc<F extends (...args: any[]) => any>(fn: F): F {
  const traceName = defaultConfig.defaultTracerName || 'default'
  const tracer = trace.getTracer(traceName)
  const name = fn.name || 'anonymousFunction'
  return function (...args: Parameters<F>) {
    return traceContext.with(traceContext.active(), () =>
      tracer.startActiveSpan(name, {}, (span) => {
        // 在这里调用原始函数
        const result = fn(...args)
        if (result instanceof Promise) {
          return result
            .then((res) => {
              span.setStatus({ code: SpanStatusCode.OK })
              span.setAttribute('outputs', convertToString(res))
              return res
            })
            .catch((err) => {
              span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
              span.recordException(err)
              throw err
            })
            .finally(() => span.end())
        } else {
          span.setStatus({ code: SpanStatusCode.OK })
          span.setAttribute('outputs', convertToString(result))
          span.end()
        }
        return result
      })
    )
  } as F
}

function convertToString(args: any | any[]): string | boolean | number {
  if (typeof args === 'string' || typeof args === 'boolean' || typeof args === 'number') {
    return args
  }
  return JSON.stringify(args)
}
