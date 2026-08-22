import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiResponsesRunner } from './ai-responses-runner';
import { AiGenerationInput, AiGenerationResult, AiProvider } from './ai.types';

@Injectable()
export class GroqProvider implements AiProvider {
  private client: OpenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly runner: AiResponsesRunner,
  ) {}

  async generate(input: AiGenerationInput): Promise<AiGenerationResult> {
    const client = this.getClient();
    const model =
      this.configService.get<string>('GROQ_MODEL')?.trim() ||
      'openai/gpt-oss-20b';

    return this.runner.run(client, input, {
      provider: 'GROQ',
      model,
      // Groq does not support tool use and strict structured output together.
      // The shared runner still validates every tool server-side.
      structuredOutput: false,
    });
  }

  private getClient() {
    if (this.client) return this.client;

    const apiKey = this.configService.get<string>('GROQ_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'The Groq test provider is not configured. Add GROQ_API_KEY to the server environment.',
      );
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      maxRetries: 0,
      timeout: 20_000,
    });
    return this.client;
  }
}
