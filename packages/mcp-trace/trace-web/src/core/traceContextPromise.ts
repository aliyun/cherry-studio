import { Context, context, propagation, ROOT_CONTEXT } from '@opentelemetry/api'

import { setRootContext } from './WebStackContextManager'

const originalPromise = globalThis.Promise

class TraceContextPromise<T> extends Promise<T> {
  _context: Context

  constructor(
    executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void,
    ctx?: Context
  ) {
    const capturedContext = ctx || context.active()
    super((resolve, reject) => {
      context.with(capturedContext, () => {
        executor(
          (value) => context.with(capturedContext, () => resolve(value)),
          (reason) => context.with(capturedContext, () => reject(reason))
        )
      })
    })
    this._context = capturedContext
  }

  // 兼容 Promise.resolve/reject
  static resolve(): Promise<void>
  static resolve<T>(value: T | PromiseLike<T>): Promise<T>
  static resolve<T>(value: T | PromiseLike<T>, ctx?: Context): Promise<T>
  static resolve<T>(value?: T | PromiseLike<T>, ctx?: Context): Promise<T | void> {
    return new TraceContextPromise<T | void>((resolve) => resolve(value as T), ctx)
  }

  static reject<T = never>(reason?: any): Promise<T>
  static reject<T = never>(reason?: any, ctx?: Context): Promise<T> {
    return new TraceContextPromise<T>((_, reject) => reject(reason), ctx)
  }

  static all<T>(values: (T | PromiseLike<T>)[]): Promise<T[]> {
    // 尝试从缓存获取 context
    let capturedContext = context.active()
    if (Array.isArray(values) && values.length > 0 && values[0] instanceof TraceContextPromise) {
      capturedContext = (values[0] as TraceContextPromise<any>)._context
    }

    // 包装所有原生 Promise
    const wrappedValues = values.map((v) =>
      v instanceof TraceContextPromise
        ? v
        : v instanceof Promise
          ? new TraceContextPromise((resolve, reject) => v.then(resolve, reject), capturedContext)
          : v
    )

    return new TraceContextPromise<T[]>((resolve, reject) => {
      let remaining = wrappedValues.length
      const results: T[] = new Array(remaining)
      if (remaining === 0) {
        context.with(capturedContext, () => resolve(results))
        return
      }
      values.forEach((value, i) => {
        TraceContextPromise.resolve(value, capturedContext).then(
          (val) => {
            results[i] = val
            remaining--
            if (remaining === 0) {
              context.with(capturedContext, () => resolve(results))
            }
          },
          (err) => {
            context.with(capturedContext, () => reject(err))
          }
        )
      })
    }, capturedContext)
  }

  static race<T>(values: (T | PromiseLike<T>)[]): Promise<T> {
    const capturedContext = context.active()
    return new TraceContextPromise<T>((resolve, reject) => {
      originalPromise.race(values).then(
        (result) => context.with(capturedContext, () => resolve(result)),
        (err) => context.with(capturedContext, () => reject(err))
      )
    }, capturedContext)
  }

  static allSettled<T>(values: (T | PromiseLike<T>)[]): Promise<PromiseSettledResult<T>[]> {
    const capturedContext = context.active()
    return new TraceContextPromise<PromiseSettledResult<T>[]>((resolve, reject) => {
      originalPromise.allSettled(values).then(
        (result) => context.with(capturedContext, () => resolve(result)),
        (err) => context.with(capturedContext, () => reject(err))
      )
    }, capturedContext)
  }

  static any<T>(values: (T | PromiseLike<T>)[]): Promise<T> {
    const capturedContext = context.active()
    return new TraceContextPromise<T>((resolve, reject) => {
      originalPromise.any(values).then(
        (result) => context.with(capturedContext, () => resolve(result)),
        (err) => context.with(capturedContext, () => reject(err))
      )
    }, capturedContext)
  }
}

export function setParentContext(ctx: Context) {
  // setRootContext(ctx)
  const values = {}
  propagation.inject(ctx, values)
  console.log(JSON.stringify(values))
  setRootContext(ctx)
}

export function resetParentContext() {
  setRootContext(ROOT_CONTEXT)
}

/**
 * 用 TraceContextPromise 替换全局 Promise
 */
export function instrumentPromises() {
  globalThis.Promise = TraceContextPromise as unknown as PromiseConstructor
}

/**
 * 恢复原生 Promise
 */
export function uninstrumentPromises() {
  globalThis.Promise = originalPromise
}
