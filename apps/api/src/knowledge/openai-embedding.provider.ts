import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  KnowledgeEmbeddingBatch,
  KnowledgeEmbeddingProvider,
} from './knowledge.types';

@Injectable()
export class OpenAiEmbeddingProvider implements KnowledgeEmbeddingProvider {
  private client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  async embedMany(texts: string[]): Promise<KnowledgeEmbeddingBatch> {
    if (texts.length === 0) {
      return { model: this.model, vectors: [] };
    }

    const response = await this.getClient().embeddings.create({
      model: this.model,
      input: texts,
      encoding_format: 'float',
    });

    return {
      model: this.model,
      vectors: response.data.map((item) => item.embedding),
    };
  }

  private get model() {
    return (
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL')?.trim() ||
      'text-embedding-3-small'
    );
  }

  private getClient() {
    if (this.client) return this.client;

    const apiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OpenAI knowledge embeddings are not configured. Add OPENAI_API_KEY or use the local embedding provider.',
      );
    }

    this.client = new OpenAI({
      apiKey,
      maxRetries: 1,
      timeout: 20_000,
    });
    return this.client;
  }
}
