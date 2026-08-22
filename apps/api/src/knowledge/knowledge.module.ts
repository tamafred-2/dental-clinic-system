import { Module } from '@nestjs/common';
import { ConfiguredEmbeddingProvider } from './configured-embedding.provider';
import { KNOWLEDGE_EMBEDDING_PROVIDER } from './knowledge.constants';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { LocalEmbeddingProvider } from './local-embedding';
import { OpenAiEmbeddingProvider } from './openai-embedding.provider';

@Module({
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    LocalEmbeddingProvider,
    OpenAiEmbeddingProvider,
    ConfiguredEmbeddingProvider,
    {
      provide: KNOWLEDGE_EMBEDDING_PROVIDER,
      useExisting: ConfiguredEmbeddingProvider,
    },
  ],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
