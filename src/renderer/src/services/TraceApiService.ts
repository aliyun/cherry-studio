import { trace } from '@opentelemetry/api'

export function withTraceContext<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    // 获取当前 activeSpan
    const span = trace.getActiveSpan()
    const spanContext = span?.spanContext()
    console.log(`withTraceContext`, spanContext)
    // 查找最后一个参数是否已经是 spanContext
    if (!spanContext) {
      return fn(...args)
    }
    const traceData = {
      type: 'trace',
      traceparent: `00-${spanContext?.traceId}-${spanContext?.spanId}-01`
    }
    // 自动追加 spanContext
    return fn(...args, traceData)
  }
}

// 只为需要 trace 的方法做代理
export const tracedApi = new Proxy(window.api, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver)
    // 只代理 mcp、file、knowledgeBase 等需要 trace 的子对象
    if (['mcp', 'file', 'knowledgeBase'].includes(String(prop)) && typeof value === 'object') {
      return new Proxy(value, {
        get(subTarget, subProp, subReceiver) {
          const subValue = Reflect.get(subTarget, subProp, subReceiver)
          if (typeof subValue === 'function') {
            return withTraceContext(subValue)
          }
          return subValue
        }
      })
    }
    return value
  }
})
