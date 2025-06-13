import { Context, ContextManager, propagation, ROOT_CONTEXT } from '@opentelemetry/api'

export class WebStackContextManager implements ContextManager {
  static contextList: Context[] = []
  static globalContext: Context = ROOT_CONTEXT
  private _currentContext: Context = WebStackContextManager.globalContext

  active(): Context {
    if (this._currentContext === ROOT_CONTEXT) {
      const length = WebStackContextManager.contextList.length
      if (length === 0) {
        return WebStackContextManager.globalContext
      }
      return WebStackContextManager.contextList[length - 1]
    }
    return this._currentContext
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: Context | null,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    const carry = {}
    let pushed = false
    if (context) {
      propagation.inject(context, carry)
      if (Object.keys(carry).length > 0) {
        WebStackContextManager.contextList.push(this._currentContext)
        this._currentContext = context
        pushed = true
      }
    }
    try {
      return fn.call(thisArg, ...args)
    } finally {
      if (pushed) {
        this._currentContext = WebStackContextManager.contextList.pop() || WebStackContextManager.globalContext
      }
    }
  }

  private _bindFunction<T extends (...args: any[]) => ReturnType<T>>(context = ROOT_CONTEXT, target: T): T {
    const contextWrapper = (...args: Parameters<T>): ReturnType<T> => {
      return this.with(context, () => target.apply(this, args))
    }
    Object.defineProperty(contextWrapper, 'length', {
      enumerable: false,
      configurable: true,
      writable: false,
      value: target.length
    })
    return contextWrapper as unknown as T
  }

  bind<T extends (...args: any[]) => any>(context: Context, target: T): T
  bind<T>(context: Context, target: T): T
  bind<T>(context: Context, target: T): T {
    if (context === undefined) {
      context = this.active()
    }
    if (typeof target === 'function') {
      // TypeScript type assertion is safe here due to overloads
      return this._bindFunction(context, target as (...args: any[]) => any) as T
    }
    return target
  }

  disable(): this {
    WebStackContextManager.contextList.slice(0, WebStackContextManager.contextList.length - 1)
    return this
  }

  enable(): this {
    return this
  }
}

export function setRootContext(ctx: Context) {
  WebStackContextManager.globalContext = ctx
}
