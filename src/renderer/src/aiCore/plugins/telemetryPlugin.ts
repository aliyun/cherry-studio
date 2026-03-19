/**
 * Telemetry Plugin for AI SDK Integration
 *
 * 在 transformParams 钩子中注入 experimental_telemetry 参数，
 * 实现 AI SDK trace 与现有手动 trace 系统的统一
 * 集成 AiSdkSpanAdapter 将 AI SDK trace 数据转换为现有格式
 */

import type { AiPlugin } from '@cherrystudio/ai-core'
import { definePlugin, type StreamTextParams, type StreamTextResult } from '@cherrystudio/ai-core'
import { loggerService } from '@logger'
import type { Span, SpanContext, Tracer } from '@opentelemetry/api'
import { context as otelContext, trace } from '@opentelemetry/api'
import { currentEntity, currentSpan } from '@renderer/services/SpanManagerService'
import { webTraceService } from '@renderer/services/WebTraceService'
import type { ModelSpanEntity } from '@renderer/trace/types/ModelSpanEntity'
import type { Assistant } from '@renderer/types'
import type { WebTraceContext } from '@renderer/types/trace'
import type { TelemetrySettings } from 'ai'

import { AiSdkSpanAdapter } from '../trace/AiSdkSpanAdapter'

const logger = loggerService.withContext('TelemetryPlugin')

export interface TelemetryPluginConfig {
  enabled?: boolean
  recordInputs?: boolean
  recordOutputs?: boolean
  assistant: Assistant
  traceContext?: WebTraceContext
}

/**
 * 自定义 Tracer，集成适配器转换逻辑
 */
class AdapterTracer {
  private originalTracer: Tracer
  private traceContext?: WebTraceContext
  // ai-sdk生成的根节点，其他节点都作为根节点的
  private parentSpanContext?: SpanContext
  // 使用ai-sdk的根节点，来自外部
  private rootSpanContext?: SpanContext
  private spanEntity: ModelSpanEntity | undefined

  constructor(originalTracer: Tracer, traceContext?: WebTraceContext, parentSpanContext?: SpanContext) {
    this.originalTracer = originalTracer
    this.traceContext = traceContext
    this.rootSpanContext = parentSpanContext
    if (traceContext) {
      this.spanEntity = currentEntity(traceContext.topicId, traceContext.modelName, traceContext.assistantMsgId)
    }

    logger.debug('AdapterTracer created with parent context info', {
      ...traceContext,
      parentTraceId: this.rootSpanContext?.traceId,
      parentSpanId: this.rootSpanContext?.spanId,
      hasOriginalTracer: !!originalTracer
    })
  }

  startSpan(name: string, options?: any, context?: any): Span {
    logger.debug('AdapterTracer.startSpan called', {
      spanName: name,
      topicId: this.traceContext?.topicId,
      modelName: this.traceContext?.modelName
    })

    // 创建包含父 SpanContext 的上下文（如果有的话）
    const createContextWithParent = () => {
      if (this.rootSpanContext) {
        return this.rootSpanContext
      }
      if (this.parentSpanContext) {
        try {
          const ctx = trace.setSpanContext(otelContext.active(), this.parentSpanContext)
          logger.debug('Created active context with parent SpanContext for startSpan', {
            spanName: name,
            parentTraceId: this.parentSpanContext.traceId,
            parentSpanId: this.parentSpanContext.spanId,
            topicId: this.traceContext?.topicId
          })
          return ctx
        } catch (error) {
          logger.warn('Failed to create context with parent SpanContext in startSpan', error as Error)
        }
      }
      return otelContext.active()
    }

    const ctx = context ?? createContextWithParent()
    const span = this.originalTracer.startSpan(name, options, ctx)

    // 注入父子关系属性（兜底重建层级用）
    try {
      if (this.parentSpanContext) {
        span.setAttribute('trace.parentSpanId', this.parentSpanContext.spanId)
        span.setAttribute('trace.parentTraceId', this.parentSpanContext.traceId)
      }
      if (this.traceContext?.topicId) {
        span.setAttribute('trace.topicId', this.traceContext.topicId)
      }
    } catch (e) {
      logger.debug('Failed to set trace parent attributes in startSpan', e as Error)
    }

    // 包装span的end方法
    const originalEnd = span.end.bind(span)
    span.end = (endTime?: any) => {
      logger.debug('AI SDK span.end() called in startSpan - about to convert span', {
        spanName: name,
        spanId: span.spanContext().spanId,
        traceId: span.spanContext().traceId,
        topicId: this.traceContext?.topicId,
        modelName: this.traceContext?.modelName
      })

      // 调用原始 end 方法
      originalEnd(endTime)

      // 转换并保存 span 数据
      try {
        logger.debug('Converting AI SDK span to SpanEntity (from startSpan)', {
          spanName: name,
          spanId: span.spanContext().spanId,
          traceId: span.spanContext().traceId,
          topicId: this.traceContext?.topicId,
          modelName: this.traceContext?.modelName
        })
        logger.silly('span', span)
        const spanEntity = AiSdkSpanAdapter.convertToSpanEntity({
          span,
          topicId: this.traceContext?.topicId,
          modelName: this.traceContext?.modelName
        })

        // 保存转换后的数据
        window.api.trace.saveEntity(spanEntity)

        logger.debug('AI SDK span converted and saved successfully (from startSpan)', {
          spanName: name,
          spanId: span.spanContext().spanId,
          traceId: span.spanContext().traceId,
          topicId: this.traceContext?.topicId,
          modelName: this.traceContext?.modelName,
          hasUsage: !!spanEntity.usage,
          usage: spanEntity.usage
        })
      } catch (error) {
        logger.error('Failed to convert AI SDK span (from startSpan)', error as Error, {
          spanName: name,
          spanId: span.spanContext().spanId,
          traceId: span.spanContext().traceId,
          topicId: this.traceContext?.topicId,
          modelName: this.traceContext?.modelName
        })
      }
    }

    return span
  }

  startActiveSpan<F extends (span: Span) => any>(name: string, fn: F): ReturnType<F>
  startActiveSpan<F extends (span: Span) => any>(name: string, options: any, fn: F): ReturnType<F>
  startActiveSpan<F extends (span: Span) => any>(name: string, options: any, context: any, fn: F): ReturnType<F>
  startActiveSpan<F extends (span: Span) => any>(name: string, arg2?: any, arg3?: any, arg4?: any): ReturnType<F> {
    logger.debug('AdapterTracer.startActiveSpan called', {
      ...this.traceContext,
      spanName: name,
      // oxlint-disable-next-line no-undef False alarm. see https://github.com/oxc-project/oxc/issues/4232
      argCount: arguments.length
    })

    // 包装函数来添加span转换逻辑
    const wrapFunction = (originalFn: F, span: Span): F => {
      const wrappedFn = ((passedSpan: Span) => {
        // 注入父子关系属性（兜底重建层级用）
        if (this.parentSpanContext) {
          passedSpan.setAttribute('trace.parentSpanId', this.parentSpanContext.spanId)
          passedSpan.setAttribute('trace.parentTraceId', this.parentSpanContext.traceId)
        } else if (this.rootSpanContext) {
          passedSpan.setAttribute('trace.parentSpanId', this.rootSpanContext.spanId)
          passedSpan.setAttribute('trace.parentTraceId', this.rootSpanContext.traceId)
          this.parentSpanContext = passedSpan.spanContext()
        }
        if (this.traceContext?.topicId) {
          passedSpan.setAttribute('trace.topicId', this.traceContext.topicId)
        }

        this.spanEntity?.addSpan(passedSpan)
        // 包装span的end方法
        const originalEnd = span.end.bind(span)
        span.end = (endTime?: any) => {
          this.spanEntity?.removeSpan(span)
          logger.debug('AI SDK span.end() called in startActiveSpan - about to convert span', {
            spanName: name,
            spanId: span.spanContext().spanId,
            traceId: span.spanContext().traceId,
            ...this.traceContext
          })

          if (this.parentSpanContext && this.parentSpanContext.spanId === span.spanContext().spanId) {
            this.parentSpanContext = undefined
          }

          // 调用原始 end 方法
          originalEnd(endTime)

          // 转换并保存 span 数据
          try {
            logger.debug('Converting AI SDK span to SpanEntity (from startActiveSpan)', {
              spanName: name,
              spanId: span.spanContext().spanId,
              traceId: span.spanContext().traceId,
              ...this.traceContext
            })
            logger.silly('span', span)
            const spanEntity = AiSdkSpanAdapter.convertToSpanEntity({
              span,
              topicId: this.traceContext?.topicId,
              modelName: this.traceContext?.modelName,
              assistantMsgId: this.traceContext?.assistantMsgId
            })

            // 保存转换后的数据
            window.api.trace.saveEntity(spanEntity)

            logger.debug('AI SDK span converted and saved successfully (from startActiveSpan)', {
              spanName: name,
              spanId: span.spanContext().spanId,
              traceId: span.spanContext().traceId,
              hasUsage: !!spanEntity.usage,
              usage: spanEntity.usage,
              ...this.traceContext
            })
          } catch (error) {
            logger.error('Failed to convert AI SDK span (from startActiveSpan)', error as Error, {
              spanName: name,
              spanId: span.spanContext().spanId,
              traceId: span.spanContext().traceId,
              ...this.traceContext
            })
          }
        }

        return originalFn(passedSpan)
      }) as F
      return wrappedFn
    }

    // 创建包含父 SpanContext 的上下文（如果有的话）
    const createContextWithParent = () => {
      const parentContext = this.parentSpanContext || this.rootSpanContext
      if (parentContext) {
        try {
          const ctx = trace.setSpanContext(otelContext.active(), parentContext)
          logger.debug('Created active context with parent SpanContext for startActiveSpan', {
            spanName: name,
            parentTraceId: parentContext?.traceId,
            parentSpanId: parentContext?.spanId,
            topicId: this.traceContext?.topicId
          })
          return ctx
        } catch (error) {
          logger.warn('Failed to create context with parent SpanContext in startActiveSpan', error as Error)
        }
      }
      return otelContext.active()
    }

    // 根据参数数量确定调用方式，注入包含mainTraceId的上下文
    if (typeof arg2 === 'function') {
      return this.originalTracer.startActiveSpan(name, {}, createContextWithParent(), (span: Span) => {
        return wrapFunction(arg2, span)(span)
      })
    } else if (typeof arg3 === 'function') {
      return this.originalTracer.startActiveSpan(name, arg2, createContextWithParent(), (span: Span) => {
        return wrapFunction(arg3, span)(span)
      })
    } else if (typeof arg4 === 'function') {
      // 如果调用方提供了 context，则保留以维护嵌套关系；否则回退到父上下文
      const ctx = arg3 ?? createContextWithParent()
      return this.originalTracer.startActiveSpan(name, arg2, ctx, (span: Span) => {
        return wrapFunction(arg4, span)(span)
      })
    } else {
      throw new Error('Invalid arguments for startActiveSpan')
    }
  }
}

export function createTelemetryPlugin(config: TelemetryPluginConfig): AiPlugin<StreamTextParams, StreamTextResult> {
  const { enabled = true, recordInputs = true, recordOutputs = true, traceContext } = config

  // 获取共享的 tracer
  const originalTracer = webTraceService.getTracer()

  return definePlugin<StreamTextParams, StreamTextResult>({
    name: 'telemetryPlugin',
    enforce: 'pre', // 在其他插件之前执行，确保 telemetry 配置被正确注入

    transformParams: (params, context) => {
      if (!enabled) {
        return params
      }

      if (!originalTracer) {
        logger.warn('No tracer available from WebTraceService')
        return params
      }

      // 获取当前活跃的 span，确保 AI SDK spans 与手动 spans 在同一个 trace 中
      let parentSpan: Span | undefined = undefined
      let parentSpanContext: SpanContext | undefined = undefined

      // 只有在有topicId时才尝试查找父span
      if (traceContext && traceContext.topicId) {
        try {
          // 从 SpanManagerService 获取当前的 span
          logger.debug('Attempting to find parent span', {
            topicId: traceContext.topicId,
            requestId: context.requestId,
            modelName: traceContext.modelName,
            contextModelId: context.modelId,
            providerId: context.providerId
          })

          parentSpan = currentSpan(traceContext.topicId, traceContext.modelName, traceContext.assistantMsgId)
          if (parentSpan) {
            // 直接使用父 span 的 SpanContext，避免手动拼装字段遗漏
            parentSpanContext = parentSpan.spanContext()
            logger.debug('Found active parent span for AI SDK', {
              parentSpanId: parentSpanContext.spanId,
              parentTraceId: parentSpanContext.traceId,
              topicId: traceContext.topicId,
              requestId: context.requestId,
              modelName: traceContext.modelName
            })
          } else {
            logger.warn('No active parent span found in SpanManagerService', {
              topicId: traceContext.topicId,
              requestId: context.requestId,
              modelId: context.modelId,
              modelName: traceContext.modelName,
              providerId: context.providerId,
              // 更详细的调试信息
              searchedModelName: traceContext.modelName,
              contextModelId: context.modelId,
              isAnalyzing: context.isAnalyzing
            })
          }
        } catch (error) {
          logger.error('Error getting current span from SpanManagerService', error as Error, {
            ...traceContext,
            requestId: context.requestId
          })
        }
      } else {
        logger.debug('No topicId provided, skipping parent span lookup', {
          requestId: context.requestId,
          contextTopicId: context.topicId,
          configTopicId: traceContext?.topicId,
          modelName: traceContext?.modelName
        })
      }

      // 创建适配器包装的 tracer，传入获取到的父 SpanContext
      const adapterTracer = new AdapterTracer(originalTracer, traceContext, parentSpanContext)

      // 注入 AI SDK telemetry 配置
      const telemetryConfig = {
        isEnabled: true,
        recordInputs,
        recordOutputs,
        tracer: adapterTracer,
        functionId: `ai-request-${context.requestId}`,
        metadata: {
          providerId: context.providerId,
          modelId: context.modelId,
          topicId: traceContext?.topicId || '',
          requestId: context.requestId,
          modelName: traceContext?.modelName || '',
          // 确保topicId也作为标准属性传递
          'trace.topicId': traceContext?.topicId || '',
          'trace.modelName': traceContext?.modelName || '',
          // 添加父span信息用于调试（只在有值时添加）
          ...(parentSpanContext?.spanId && { parentSpanId: parentSpanContext.spanId }),
          ...(parentSpanContext?.traceId && { parentTraceId: parentSpanContext.traceId })
        }
      } satisfies TelemetrySettings

      // 如果有父span，尝试在telemetry配置中设置父上下文
      if (parentSpan) {
        try {
          // 设置活跃上下文，确保 AI SDK spans 在正确的 trace 上下文中创建
          const activeContext = trace.setSpan(otelContext.active(), parentSpan)

          // 更新全局上下文
          otelContext.with(activeContext, () => {
            logger.debug('Updated active context with parent span')
          })

          logger.debug('Set parent context for AI SDK spans', {
            parentSpanId: parentSpanContext?.spanId,
            parentTraceId: parentSpanContext?.traceId,
            hasActiveContext: !!activeContext,
            hasParentSpan: !!parentSpan
          })
        } catch (error) {
          logger.warn('Failed to set parent context in telemetry config', error as Error)
        }
      }

      logger.debug('Injecting AI SDK telemetry config with adapter', {
        requestId: context.requestId,
        topicId: traceContext?.topicId,
        modelId: context.modelId,
        modelName: traceContext?.modelName,
        hasParentSpan: !!parentSpanContext,
        parentSpanId: parentSpanContext?.spanId,
        parentTraceId: parentSpanContext?.traceId,
        functionId: telemetryConfig.functionId,
        hasTracer: !!telemetryConfig.tracer,
        tracerType: telemetryConfig.tracer?.constructor?.name || 'unknown'
      })

      return {
        ...params,
        experimental_telemetry: telemetryConfig
      }
    }
  })
}

// 默认导出便于使用
export default createTelemetryPlugin
