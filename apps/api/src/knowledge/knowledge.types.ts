import type { KnowledgeSourceType } from '@prisma/client';

export type KnowledgeEmbeddingBatch = {
  model: string;
  vectors: number[][];
};

export interface KnowledgeEmbeddingProvider {
  embedMany(texts: string[]): Promise<KnowledgeEmbeddingBatch>;
}

export type KnowledgeSourceDocument = {
  key: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string;
  content: string;
  published: boolean;
  checksum: string;
};

export type RetrievedKnowledge = {
  key: string;
  title: string;
  content: string;
  score: number;
};
