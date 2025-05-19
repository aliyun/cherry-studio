import { context, trace } from '@opentelemetry/api';
import { useCallback } from 'react';

export async function tracedPromise<T>(
  fn: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<T> {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) {
    console.warn('No active span found');
    return fn(...args);
  }

  return context.with(trace.setSpan(context.active(), activeSpan), async () => {
    try {
      return await fn(...args);
    } catch (error) {
      activeSpan.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  });
}

export function useTracedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: any[],
) {
  const activeSpan = trace.getActiveSpan();

  if (activeSpan) {
    return useCallback(
      (...args: any[]) => {
        return context.with(trace.setSpan(context.active(), activeSpan), () =>
          callback(...args),
        );
      },
      [activeSpan, ...deps],
    );
  } else {
    return useCallback(
      (...args: any[]) => {
        return callback(...args);
      },
      [...deps],
    );
  }
}
