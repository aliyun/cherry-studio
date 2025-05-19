import TraceTab from './pages/TraceTab';

export const TraceTabComponent = TraceTab;

export * from './core/webTracer';
export * from './core/tracing';
export * from './utils/classUtil';
export * from './utils/jsonUtils';
export * from './core/traceContextPromise';

const defaultExport = {
  TraceTab: TraceTabComponent,
};

export default defaultExport;
