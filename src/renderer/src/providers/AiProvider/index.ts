import { GenerateImagesParameters } from '@google/genai'
import { TraceMethod } from '@mcp-trace/trace-core'
import BaseProvider from '@renderer/providers/AiProvider/BaseProvider'
import ProviderFactory from '@renderer/providers/AiProvider/ProviderFactory'
import type { Assistant, GenerateImageParams, MCPTool, Model, Provider, Suggestion } from '@renderer/types'
import { Chunk } from '@renderer/types/chunk'
import type { Message } from '@renderer/types/newMessage'
import OpenAI from 'openai'

export interface CompletionsParams {
  messages: Message[]
  assistant: Assistant
  onChunk: (chunk: Chunk) => void
  onFilterMessages: (messages: Message[]) => void
  mcpTools?: MCPTool[]
}

export default class AiProvider {
  private sdk: BaseProvider

  constructor(provider: Provider) {
    this.sdk = ProviderFactory.create(provider)
  }

  @TraceMethod({ spanName: 'fakeCompletions', tag: 'LLM' })
  public async fakeCompletions(params: CompletionsParams): Promise<void> {
    return this.sdk.fakeCompletions(params)
  }

  @TraceMethod({ spanName: 'completions', tag: 'LLM' })
  public async completions({
    messages,
    assistant,
    mcpTools,
    onChunk,
    onFilterMessages
  }: CompletionsParams): Promise<void> {
    return this.sdk.completions({ messages, assistant, mcpTools, onChunk, onFilterMessages })
  }

  @TraceMethod({ spanName: 'translate', tag: 'LLM' })
  public async translate(
    content: string,
    assistant: Assistant,
    onResponse?: (text: string, isComplete: boolean) => void
  ): Promise<string> {
    return this.sdk.translate(content, assistant, onResponse)
  }

  @TraceMethod({ spanName: 'summaries', tag: 'LLM' })
  public async summaries(messages: Message[], assistant: Assistant): Promise<string> {
    return this.sdk.summaries(messages, assistant)
  }

  @TraceMethod({ spanName: 'summaryForSearch', tag: 'LLM' })
  public async summaryForSearch(messages: Message[], assistant: Assistant): Promise<string | null> {
    return this.sdk.summaryForSearch(messages, assistant)
  }

  @TraceMethod({ spanName: 'suggestions', tag: 'LLM' })
  public async suggestions(messages: Message[], assistant: Assistant): Promise<Suggestion[]> {
    return this.sdk.suggestions(messages, assistant)
  }

  @TraceMethod({ spanName: 'generateText', tag: 'LLM' })
  public async generateText({ prompt, content }: { prompt: string; content: string }): Promise<string> {
    return this.sdk.generateText({ prompt, content })
  }

  @TraceMethod({ spanName: 'check', tag: 'LLM' })
  public async check(model: Model, stream: boolean = false): Promise<{ valid: boolean; error: Error | null }> {
    return this.sdk.check(model, stream)
  }

  public async models(): Promise<OpenAI.Models.Model[]> {
    return this.sdk.models()
  }

  public getApiKey(): string {
    return this.sdk.getApiKey()
  }

  @TraceMethod({ spanName: 'generateImage', tag: 'LLM' })
  public async generateImage(params: GenerateImageParams | GenerateImagesParameters): Promise<string[]> {
    return this.sdk.generateImage(params as GenerateImageParams)
  }

  @TraceMethod({ spanName: 'generateImageByChat', tag: 'LLM' })
  public async generateImageByChat({
    messages,
    assistant,
    onChunk,
    onFilterMessages
  }: CompletionsParams): Promise<void> {
    return this.sdk.generateImageByChat({ messages, assistant, onChunk, onFilterMessages })
  }

  @TraceMethod({ spanName: 'getEmbeddingDimensions', tag: 'LLM' })
  public async getEmbeddingDimensions(model: Model): Promise<number> {
    return this.sdk.getEmbeddingDimensions(model)
  }

  public getBaseURL(): string {
    return this.sdk.getBaseURL()
  }
}
