import { convertSpanToSpanEntity, SpanEntity, TokenUsage, TraceCache } from '@mcp-trace/trace-core'
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
        spanEntity.attributes = span.attributes
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
        if (value !== undefined && value !== null) {
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
export const bindTopic = spanCacheService.setTopicId.bind(spanCacheService)
