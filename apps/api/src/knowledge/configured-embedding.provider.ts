import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalEmbeddingProvider } from './local-embedding';
import type {
  KnowledgeEmbeddingBatch,
  KnowledgeEmbeddingProvider,
} from './knowledge.types';
import { OpenAiEmbeddingProvider } from './openai-embedding.provider';

@Injectable()
export class ConfiguredEmbeddingProvider implements KnowledgeEmbeddingProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly localProvider: LocalEmbeddingProvider,
    private readonly openAiProvider: OpenAiEmbeddingProvider,
  ) {}

  async embedMany(texts: string[]): Promise<KnowledgeEmbeddingBatch> {
    const provider =
      this.configService
        .get<string>('KNOWLEDGE_EMBEDDING_PROVIDER')
        ?.trim()
        .toLowerCase() || 'local';

    if (provider === 'local') return this.localProvider.embedMany(texts);
    if (provider === 'openai') return this.openAiProvider.embedMany(texts);

    throw new ServiceUnavailableException(
      'Unsupported KNOWLEDGE_EMBEDDING_PROVIDER. Use "local" or "openai".',
    );
  }
}
