import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { TraceConfig, defaultConfig } from '@mcp-trace/trace-core';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { trace, Tracer } from '@opentelemetry/api';

export class NodeTracer {
  private static provider: NodeTracerProvider;
  private static defaultTracer: Tracer;

  static init(
    config?: TraceConfig,
    spanProcessor?: SpanProcessor,
  ) {
    if (config) {
      defaultConfig.serviceName = config.serviceName || defaultConfig.serviceName;
      defaultConfig.endpoint = config.endpoint || defaultConfig.endpoint;
      defaultConfig.headers = config.headers || defaultConfig.headers;
      defaultConfig.defaultTracerName =
        config.defaultTracerName || defaultConfig.defaultTracerName;
    }
    const processor = spanProcessor || new BatchSpanProcessor(this.getExporter());
    this.provider = new NodeTracerProvider({
      spanProcessors: [processor],
    });
    this.provider.register({
      propagator: new W3CTraceContextPropagator(),
      contextManager: new AsyncLocalStorageContextManager(),
    });
    this.defaultTracer = trace.getTracer(
      config?.defaultTracerName || 'default'
    );
  }

  private static getExporter(config?: TraceConfig) {
    if (defaultConfig.endpoint) {
      return new OTLPTraceExporter({
        url: `${defaultConfig.endpoint}/v1/traces`,
        headers: defaultConfig.headers,
      });
    }
    return new ConsoleSpanExporter();
  }

  public static getTracer() {
    return this.defaultTracer;
  }
}
