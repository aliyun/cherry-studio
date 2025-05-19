import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { defaultConfig, TraceCache } from "@mcp-trace/trace-core";
import { CacheBatchSpanProcessor } from "@mcp-trace/trace-core";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { TraceConfig } from "@mcp-trace/trace-core";
import { ZoneContextManager } from "@opentelemetry/context-zone";

export class WebTracer {
  private static provider: WebTracerProvider;
  private static exporter: SpanExporter;

  static init(
    config?: TraceConfig,
    traceCache?: TraceCache,
    exporter?: SpanExporter
  ) {
    if (config) {
      defaultConfig.serviceName =
        config.serviceName || defaultConfig.serviceName;
      defaultConfig.endpoint = config.endpoint || defaultConfig.endpoint;
      defaultConfig.headers = config.headers || defaultConfig.headers;
      defaultConfig.defaultTracerName =
        config.defaultTracerName || defaultConfig.defaultTracerName;
    }
    this.exporter = exporter || this.getExporter();
    if (traceCache) {
      this.provider = new WebTracerProvider({
        spanProcessors: [
          new CacheBatchSpanProcessor(this.exporter, traceCache),
        ],
      });
    } else {
      this.provider = new WebTracerProvider({
        spanProcessors: [new BatchSpanProcessor(this.exporter)],
      });
    }
    this.provider.register({
      propagator: new W3CTraceContextPropagator(),
      contextManager: new ZoneContextManager(),
    });
  }

  private static getExporter() {
    if (defaultConfig.endpoint) {
      return new OTLPTraceExporter({
        url: `${defaultConfig.endpoint}/v1/traces`,
        headers: defaultConfig.headers,
      });
    }
    return new ConsoleSpanExporter();
  }
}
