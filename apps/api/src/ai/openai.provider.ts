import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { AiResponsesRunner } from './ai-responses-runner';
import { AiChatCompletionsRunner } from './ai-chat-completions-runner';
import { AiGenerationInput, AiGenerationResult, AiProvider } from './ai.types';

@Injectable()
export class OpenAiProvider implements AiProvider {
  private client: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly runner: AiResponsesRunner,
    private readonly chatRunner: AiChatCompletionsRunner,
  ) {}

  async generate(input: AiGenerationInput): Promise<AiGenerationResult> {
    const client = this.getClient();
    const baseURL = this.getBaseUrl();
    const usesAgentRouter = this.isAgentRouterUrl(baseURL);
    const agentRouterWireApi =
      this.configService
        .get<string>('AGENTROUTER_WIRE_API')
        ?.trim()
        .toLowerCase() || 'responses';
    if (
      usesAgentRouter &&
      agentRouterWireApi !== 'responses' &&
      agentRouterWireApi !== 'openai-completions'
    ) {
      throw new ServiceUnavailableException(
        'Unsupported AGENTROUTER_WIRE_API. Use "responses" or "openai-completions".',
      );
    }
    const model = this.resolveModel(
      this.configService.get<string>('OPENAI_MODEL')?.trim(),
    );

    if (usesAgentRouter && agentRouterWireApi === 'openai-completions') {
      return this.chatRunner.run(client, input, {
        provider: 'AGENTROUTER',
        model,
      });
    }

    return this.runner.run(client, input, {
      provider: usesAgentRouter ? 'AGENTROUTER' : 'OPENAI',
      model,
      ...(usesAgentRouter
        ? { structuredOutput: false }
        : {
            store: false as const,
            safetyIdentifier: createHash('sha256')
              .update(`dental-conversation:${input.conversationId}`)
              .digest('hex'),
          }),
    });
  }

  private resolveModel(selection?: string) {
    const configured = selection || 'model1';
    const modelSlots: Record<string, string | undefined> = {
      model1: this.configService.get<string>('OPENAI_MODEL1'),
      model2: this.configService.get<string>('OPENAI_MODEL2'),
      model3: this.configService.get<string>('OPENAI_MODEL3'),
      model4: this.configService.get<string>('OPENAI_MODEL4'),
    };

    // Slot names select an environment-defined model; raw model IDs still work.
    return modelSlots[configured.toLowerCase()]?.trim() || configured;
  }

  private getClient() {
    if (this.client) return this.client;

    const baseURL = this.getBaseUrl();
    const usesAgentRouter = this.isAgentRouterUrl(baseURL);
    const apiKey = (
      usesAgentRouter
        ? this.configService.get<string>('AGENTROUTER_API_KEY')
        : this.configService.get<string>('OPENAI_API_KEY')
    )?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        usesAgentRouter
          ? 'The AI assistant is not configured. Add AGENTROUTER_API_KEY to the server environment.'
          : 'The AI assistant is not configured. Add OPENAI_API_KEY to the server environment.',
      );
    }

    this.client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      maxRetries: 0,
      timeout: 20_000,
    });
    return this.client;
  }

  private getBaseUrl() {
    const provider =
      this.configService.get<string>('AI_PROVIDER')?.trim().toLowerCase() ||
      'openai';
    if (provider === 'agentrouter') {
      return (
        this.configService.get<string>('AGENTROUTER_BASE_URL')?.trim() ||
        this.configService.get<string>('OPENAI_BASE_URL')?.trim()
      );
    }
    return this.configService.get<string>('OPENAI_BASE_URL')?.trim();
  }

  private isAgentRouterUrl(baseURL?: string) {
    if (!baseURL) return false;
    try {
      const hostname = new URL(baseURL).hostname.toLowerCase();
      return hostname === 'agentrouter.to' || hostname === 'agentrouter.org';
    } catch {
      return false;
    }
  }
}
