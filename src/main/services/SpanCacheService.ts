import { Attributes, convertSpanToSpanEntity, SpanEntity, TokenUsage, TraceCache } from '@mcp-trace/trace-core'
import { SpanStatusCode } from '@opentelemetry/api'
import { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

class SpanCacheService implements TraceCache {
  private topicMap: Map<string, string> = new Map<string, string>()
  private fileDir: string
  private cache: Map<string, SpanEntity> = new Map<string, SpanEntity>()

  constructor() {
    this.fileDir = path.join(os.homedir(), '.cherrystudio')
  }

  createSpan: (span: ReadableSpan) => void = (span: ReadableSpan) => {
    const spanEntity = convertSpanToSpanEntity(span)
    spanEntity.topicId = this.topicMap.get(spanEntity.traceId)
    this.cache.set(span.spanContext().spanId, spanEntity)
  }

  endSpan: (span: ReadableSpan) => void = (span: ReadableSpan) => {
    const spanId = span.spanContext().spanId
    if (this.cache.has(spanId)) {
      const spanEntity = this.cache.get(spanId)
      if (spanEntity) {
        spanEntity.topicId = this.topicMap.get(spanEntity.traceId)
        spanEntity.endTime = span.endTime ? span.endTime[0] * 1e3 + Math.floor(span.endTime[1] / 1e6) : null
        spanEntity.status = SpanStatusCode[span.status.code]
        spanEntity.attributes = span.attributes ? ({ ...span.attributes } as Attributes) : {}
        spanEntity.events = span.events
        spanEntity.links = span.links
      }
    }
  }

  clear: () => void = () => {
    this.cache.clear()
  }

  cleanTopic(topicId: string, traceId?: string) {
    const spans = Array.from(this.cache.values().filter((e) => e.topicId === topicId))
    spans.map((e) => e.id).forEach((id) => this.cache.delete(id))
    if (fs.existsSync(path.join(this.fileDir, topicId))) {
      if (traceId) {
        fs.rmSync(path.join(this.fileDir, topicId, traceId))
      } else {
        fs.readdirSync(path.join(this.fileDir, topicId)).forEach((file) => {
          fs.rmSync(path.join(this.fileDir, topicId, file))
        })
      }
    }
  }

  async saveSpans(traceId: string) {
    const spans = Array.from(this.cache.values().filter((e) => e.traceId === traceId))
    await this._saveToFile(spans)
  }

  getSpans: (topicId: string, traceId: string) => Promise<SpanEntity[]> = async (topicId: string, traceId: string) => {
    if (this.topicMap.has(traceId)) {
      const spans: SpanEntity[] = []
      this.cache
        .values()
        .filter((spanEntity) => {
          return spanEntity.traceId === traceId
        })
        .forEach((sp) => spans.push(sp))
      return spans
    } else {
      return this._getHisData(topicId, traceId)
    }
  }

  private _addEntity(entity: SpanEntity): void {
    entity.topicId = this.topicMap.get(entity.traceId)
    this.cache.set(entity.id, entity)
  }

  private _updateEntity(entity: SpanEntity): void {
    entity.topicId = this.topicMap.get(entity.traceId)
    const savedEntity = this.cache.get(entity.id)
    if (savedEntity) {
      Object.keys(entity).forEach((key) => {
        const value = entity[key]
        if (value === undefined) {
          savedEntity[key] = value
          return
        }
        if (key === 'attributes') {
          const savedAttrs = savedEntity.attributes || {}
          Object.keys(value).forEach((attrKey) => {
            const jsonData =
              typeof value[attrKey] === 'string' && value[attrKey].startsWith('{')
                ? JSON.parse(value[attrKey])
                : value[attrKey]
            if (
              savedAttrs[attrKey] !== undefined &&
              typeof jsonData === 'object' &&
              typeof savedAttrs[attrKey] === 'object'
            ) {
              savedAttrs[attrKey] = { ...savedAttrs[attrKey], ...jsonData }
            } else {
              savedAttrs[attrKey] = value[attrKey]
            }
          })
          savedEntity.attributes = savedAttrs
        } else if (typeof value === 'object') {
          savedEntity[key] = savedEntity[key] ? { ...savedEntity[key], ...value } : value
        } else if (Array.isArray(value)) {
          savedEntity[key] = savedEntity[key] ? [...savedEntity[key], ...value] : value
        } else {
          savedEntity[key] = value
        }
      })
      this.cache.set(entity.id, savedEntity)
    }
  }

  setTopicId(traceId: string, topicId: string): void {
    //TODO clean oldData
    this.topicMap.set(traceId, topicId)
  }

  getEntity(spanId: string): SpanEntity | undefined {
    return this.cache.get(spanId)
  }

  saveEntity(entity: SpanEntity) {
    if (this.cache.has(entity.id)) {
      this._updateEntity(entity)
    } else {
      this._addEntity(entity)
    }
  }

  updateTokenUsage(spanId: string, usage: TokenUsage) {
    const entity = this.cache.get(spanId)
    if (entity) {
      entity.usage = { ...usage }
    }
    if (entity?.parentId) {
      this._updateParentUsage(entity.parentId, usage)
    }
  }

  addStreamMessage(spanId: string, modelName: string, context: string, message: any) {
    const span = this.cache.get(spanId)
    if (!span) {
      return
    }
    const attributes = span.attributes
    let msgArray: any[] = []
    if (attributes && attributes['outputs'] && Array.isArray(attributes['outputs'])) {
      msgArray = attributes['outputs'] || []
      msgArray.push(message)
      attributes['outputs'] = msgArray
    } else {
      msgArray = [message]
      span.attributes = { ...attributes, outputs: msgArray } as Attributes
    }
    this._updateParentOutputs(span.parentId, modelName, context)
  }

  setEndMessage(spanId: string, modelName: string, message: string) {
    const span = this.cache.get(spanId)
    if (span && span.attributes) {
      let outputs = span.attributes['outputs']
      if (!outputs || typeof outputs !== 'object') {
        outputs = {}
      }
      if (!(`${modelName}` in outputs) || !outputs[`${modelName}`]) {
        outputs[`${modelName}`] = message
        span.attributes[`outputs`] = outputs
        this.cache.set(spanId, span)
      }
    }
  }

  // cleanHistoryTrace(topicId: string, traceId: string) {

  // }

  private _updateParentOutputs(spanId: string, modelName: string, context: string) {
    const span = this.cache.get(spanId)
    if (!span || !context) {
      return
    }
    const attributes = span.attributes
    // 如果含有modelName属性，是具体的某个modalName输出，拼接到streamText下面
    if (attributes && 'modelName' in attributes) {
      const currentValue = attributes['outputs']
      if (currentValue && typeof currentValue === 'object') {
        const allContext = (currentValue['streamText'] || '') + context
        attributes['outputs'] = { ...currentValue, streamText: allContext }
      } else {
        attributes['outputs'] = { streamText: context }
      }
      span.attributes = attributes
    } else if (attributes) {
      // 兼容多模型，使用模型名为key, 对value拼接操作
      const currentValue = attributes['outputs']
      if (currentValue && typeof currentValue === 'object') {
        const allContext = (currentValue[`${modelName}`] || '') + context
        attributes['outputs'] = { ...currentValue, [`${modelName}`]: allContext }
      } else {
        attributes['outputs'] = { [`${modelName}`]: context }
      }
      span.attributes = attributes
    } else {
      span.attributes = { outputs: { [`${modelName}`]: context } } as Attributes
    }
    this.cache.set(span.id, span)
    this._updateParentOutputs(span.parentId, modelName, context)
  }

  private _updateParentUsage(spanId: string, usage: TokenUsage) {
    const entity = this.cache.get(spanId)
    if (!entity) {
      return
    }
    if (!entity.usage) {
      entity.usage = { ...usage }
    } else {
      entity.usage.prompt_tokens = entity.usage.prompt_tokens + usage.prompt_tokens
      entity.usage.completion_tokens = entity.usage.completion_tokens + usage.completion_tokens
      entity.usage.total_tokens = entity.usage.total_tokens + usage.total_tokens
    }
    this.cache.set(entity.id, entity)
    if (entity?.parentId) {
      this._updateParentUsage(entity.parentId, usage)
    }
  }

  private async _saveToFile(spans: SpanEntity[]) {
    spans.map((span) => {
      if (!span.topicId) {
        return
      }
      let filePath = path.join(this.fileDir, span.topicId)
      this._checkFolder(filePath)
      filePath = path.join(filePath, span.traceId)
      fs.appendFileSync(filePath, JSON.stringify(span) + '\n')
    })
  }

  private async _getHisData(topicId: string, traceId: string) {
    const filePath = path.join(this.fileDir, topicId, traceId)
    if (!fs.existsSync(filePath)) {
      return []
    }
    const buffer = fs.readFileSync(filePath)
    const lines = buffer
      .toString()
      .split('\n')
      .filter((line) => line.trim() !== '')
    return lines.map((line) => JSON.parse(line) as SpanEntity)
  }

  private _checkFolder(filePath: string) {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath)
    }
  }
}

export const spanCacheService = new SpanCacheService()
export const cleanTopic = spanCacheService.cleanTopic.bind(spanCacheService)
export const saveEntity = spanCacheService.saveEntity.bind(spanCacheService)
export const tokenUsage = spanCacheService.updateTokenUsage.bind(spanCacheService)
export const saveSpans = spanCacheService.saveSpans.bind(spanCacheService)
export const getSpans = spanCacheService.getSpans.bind(spanCacheService)
export const addEndMessage = spanCacheService.setEndMessage.bind(spanCacheService)
export const bindTopic = spanCacheService.setTopicId.bind(spanCacheService)
export const addStreamMessage = spanCacheService.addStreamMessage.bind(spanCacheService)
