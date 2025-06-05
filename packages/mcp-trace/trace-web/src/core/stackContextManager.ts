import { Context, ContextManager, propagation, ROOT_CONTEXT } from '@opentelemetry/api'

export class StackContextManager implements ContextManager {
  private static contextStack: Context[] = []

  active(): Context {
    if (StackContextManager.contextStack.length === 0) {
      console.warn('No active context found, returning ROOT_CONTEXT')
      return ROOT_CONTEXT
    }
    return StackContextManager.contextStack[StackContextManager.contextStack.length - 1]
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    const traceData: Record<string, any> = {}
    propagation.inject(context, traceData)

    let pushed = false

    if ('traceparent' in traceData && traceData.traceparent) {
      StackContextManager.contextStack.push(context)
      pushed = true
    } else if (StackContextManager.contextStack.length > 0) {
      context = StackContextManager.contextStack[0]
      StackContextManager.contextStack.push(context)
      pushed = true
    } else {
      context = ROOT_CONTEXT
      StackContextManager.contextStack.push(context)
      pushed = true
    }
    console.log('startfn context:', traceData.traceparent)
    try {
      return fn.apply(thisArg, args)
    } finally {
      console.log('endfn context:', traceData.traceparent)
      if (pushed) {
        StackContextManager.contextStack.pop()
      }
    }
  }

  bind<T>(context: Context, target: T): T {
    // No-op for simplicity, or you can implement binding logic if needed
    return target
  }

  enable(): this {
    return this
  }

  disable(): this {
    StackContextManager.contextStack = []
    return this
  }
}
