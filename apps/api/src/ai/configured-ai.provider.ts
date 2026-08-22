import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqProvider } from './groq.provider';
import { AiGenerationInput, AiGenerationResult, AiProvider } from './ai.types';
import { OpenAiProvider } from './openai.provider';

@Injectable()
export class ConfiguredAiProvider implements AiProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly groqProvider: GroqProvider,
  ) {}

  async generate(input: AiGenerationInput): Promise<AiGenerationResult> {
    const provider =
      this.configService.get<string>('AI_PROVIDER')?.trim().toLowerCase() ||
      'openai';

    if (provider === 'openai' || provider === 'agentrouter') {
      return await this.openAiProvider.generate(input);
    }
    if (provider === 'groq') return await this.groqProvider.generate(input);

    throw new ServiceUnavailableException(
      'Unsupported AI_PROVIDER. Use "openai", "agentrouter", or "groq".',
    );
  }
}
