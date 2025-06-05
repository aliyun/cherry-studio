import { context } from '@opentelemetry/api'

const originalPromise = globalThis.Promise

class TracedPromise<T> extends Promise<T> {
  constructor(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void) {
    if (typeof executor === 'function') {
      super((resolve, reject) => {
        const wrappedResolve = (value: T | PromiseLike<T>) => {
          context.with(context.active(), () => {
            resolve(value)
          })
        }

        const wrappedReject = (reason?: any) => {
          context.with(context.active(), () => {
            reject(reason)
          })
        }

        context.with(context.active(), () => {
          console.log('excutor:', executor.name, executor.toLocaleString())
          executor(wrappedResolve, wrappedReject)
        })
      })
    } else {
      // For Promise.resolve, Promise.reject, etc.
      super((executor) => context.with(context.active(), () => executor as any))
    }
  }

  static withResolvers<T>(): {
    promise: TracedPromise<T>
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: any) => void
  } {
    let resolveFn!: (value: T | PromiseLike<T>) => void
    let rejectFn!: (reason?: any) => void

    const promise = new TracedPromise<T>((resolve, reject) => {
      resolveFn = () => resolve
      rejectFn = reject
    })

    return {
      promise,
      resolve: resolveFn,
      reject: rejectFn
    }
  }
}

export function instrumentPromises() {
  globalThis.Promise = TracedPromise as PromiseConstructor
}

export function uninstrumentPromises() {
  globalThis.Promise = originalPromise
}
