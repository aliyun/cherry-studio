import { context, propagation } from '@opentelemetry/api';

if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers);
    propagation.inject(context.active(), headers);
    return originalFetch(input, { ...init, headers });
  };
}
