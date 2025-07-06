import { Context, ContextManager, propagation, ROOT_CONTEXT } from '@opentelemetry/api'
import { configureStore, Store } from '@reduxjs/toolkit'

// 只存储 traceparent/tracestate 等可序列化追踪信息
type TraceSaveData = Record<string, unknown>
const ROOT: TraceSaveData = {}

const contextReducer = (
  state: TraceSaveData = ROOT,
  action: { type: string; context?: TraceSaveData }
): TraceSaveData => {
  switch (action.type) {
    case 'SET_CONTEXT':
      return action.context ?? ROOT
    default:
      return state
  }
}

export class ReduxContextManager implements ContextManager {
  private _store: Store<TraceSaveData>

  constructor() {
    this._store = configureStore({
      reducer: contextReducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false
        })
    })
  }

  // 获取当前 context
  active(): Context {
    const data = this._store.getState()
    return Object.keys(data).length > 0 ? propagation.extract(ROOT_CONTEXT, data) : ROOT_CONTEXT
  }

  // 在 context 下执行 fn
  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    // 只注入可序列化 trace 信息
    const newData: TraceSaveData = {}
    propagation.inject(context, newData)
    const previous = this._store.getState()
    this._store.dispatch({ type: 'SET_CONTEXT', context: newData })
    console.log('startfn context:', newData.traceparent, fn.toLocaleString())
    try {
      return fn.apply(thisArg, args)
    } finally {
      console.log('end context:', newData.traceparent, fn.toLocaleString())
      this._store.dispatch({ type: 'SET_CONTEXT', context: previous })
    }
  }

  // 绑定 context 到函数
  bind<T>(context: Context, target: T): T {
    if (typeof target === 'function') {
      return ((...args: unknown[]) => {
        return this.with(context, target as any, this, ...args)
      }) as any as T
    }
    return target
  }

  enable(): this {
    return this
  }

  disable(): this {
    this._store.dispatch({ type: 'SET_CONTEXT', context: ROOT })
    return this
  }
}
