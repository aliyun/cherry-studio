import { context, trace } from "@opentelemetry/api";

const originalPromise = globalThis.Promise;

class TracedPromise<T> extends Promise<T> {
  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void
    ) => void
  ) {
    const activeContext = context.active();
    const span = trace.getActiveSpan();

    if (typeof executor === "function") {
      super((resolve, reject) => {
        const wrappedResolve = (value: T | PromiseLike<T>) => {
          context.with(activeContext, () => {
            span?.addEvent("promise_resolved");
            resolve(value);
          });
        };

        const wrappedReject = (reason?: any) => {
          context.with(activeContext, () => {
            span?.addEvent("promise_rejected", { error: reason });
            reject(reason);
          });
        };

        context.with(activeContext, () => {
          span?.addEvent("promise_created");
          executor(wrappedResolve, wrappedReject);
        });
      });
    } else {
      // For Promise.resolve, Promise.reject, etc.
      super(executor as any);
    }
  }

  static withResolvers<T>(): {
    promise: TracedPromise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  } {
    const activeContext = context.active();
    let resolveFn!: (value: T | PromiseLike<T>) => void;
    let rejectFn!: (reason?: any) => void;

    const promise = new TracedPromise<T>((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });

    return {
      promise,
      resolve: (value) => context.with(activeContext, () => resolveFn(value)),
      reject: (reason) => context.with(activeContext, () => rejectFn(reason)),
    };
  }
}

export function instrumentPromises() {
  globalThis.Promise = TracedPromise as unknown as PromiseConstructor;
}

export function uninstrumentPromises() {
  globalThis.Promise = originalPromise;
}
