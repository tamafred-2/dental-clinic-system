import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  KNOWLEDGE_EMBEDDING_PROVIDER,
  KNOWLEDGE_RESULT_LIMIT,
} from './knowledge.constants';
import {
  buildKnowledgeDocuments,
  chunkKnowledgeContent,
} from './knowledge-source';
import { lexicalKnowledgeSimilarity } from './local-embedding';
import type {
  KnowledgeEmbeddingProvider,
  RetrievedKnowledge,
} from './knowledge.types';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KNOWLEDGE_EMBEDDING_PROVIDER)
    private readonly embeddings: KnowledgeEmbeddingProvider,
  ) {}

  async rebuild() {
    const documents = await this.loadSourceDocuments();
    const pendingChunks = documents.flatMap((item) =>
      chunkKnowledgeContent(item.content).map((content, chunkIndex) => ({
        key: item.key,
        chunkIndex,
        content,
      })),
    );
    const embedded = await this.embeddings.embedMany(
      pendingChunks.map((chunk) => chunk.content),
    );

    if (
      embedded.vectors.length !== pendingChunks.length ||
      embedded.vectors.some(
        (vector) =>
          vector.length === 0 ||
          vector.some((value) => !Number.isFinite(value)),
      )
    ) {
      throw new ServiceUnavailableException(
        'The embedding provider returned an invalid knowledge index.',
      );
    }

    const chunksByKey = new Map<
      string,
      Array<{ chunkIndex: number; content: string; vector: number[] }>
    >();
    pendingChunks.forEach((chunk, index) => {
      const existing = chunksByKey.get(chunk.key) ?? [];
      existing.push({ ...chunk, vector: embedded.vectors[index] });
      chunksByKey.set(chunk.key, existing);
    });

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.knowledgeDocument.deleteMany();
        for (const item of documents) {
          const chunks = chunksByKey.get(item.key) ?? [];
          await transaction.knowledgeDocument.create({
            data: {
              ...item,
              chunks: {
                create: chunks.map((chunk) => ({
                  chunkIndex: chunk.chunkIndex,
                  content: chunk.content,
                  embedding: chunk.vector,
                  embeddingModel: embedded.model,
                })),
              },
            },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      documents: documents.length,
      chunks: pendingChunks.length,
      embeddingModel: embedded.model,
    };
  }

  private async loadSourceDocuments() {
    const [clinics, services, faqs, dentists] = await Promise.all([
      this.prisma.clinic.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          timeZone: true,
          openingHours: true,
          appointmentPolicy: true,
          cancellationPolicy: true,
          hours: {
            orderBy: { day: 'asc' },
            select: { day: true, startTime: true, endTime: true },
          },
        },
      }),
      this.prisma.service.findMany({
        where: { active: true },
        orderBy: { displayOrder: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
        },
      }),
      this.prisma.faq.findMany({
        where: { published: true },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, question: true, answer: true },
      }),
      this.prisma.dentist.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          title: true,
          bio: true,
          specializations: true,
        },
      }),
    ]);
    return buildKnowledgeDocuments({
      clinics,
      services,
      faqs,
      dentists,
    });
  }

  async status() {
    const [documents, chunks, latest] = await Promise.all([
      this.prisma.knowledgeDocument.count({ where: { published: true } }),
      this.prisma.knowledgeChunk.count(),
      this.prisma.knowledgeChunk.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { embeddingModel: true, updatedAt: true },
      }),
    ]);
    return {
      ready: documents > 0 && chunks > 0,
      documents,
      chunks,
      embeddingModel: latest?.embeddingModel ?? null,
      indexedAt: latest?.updatedAt ?? null,
    };
  }

  async search(query: string): Promise<RetrievedKnowledge[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return [];

    const embedded = await this.embeddings.embedMany([normalizedQuery]);
    const queryVector = embedded.vectors[0];
    if (!queryVector?.length) return [];

    const candidates = await this.prisma.knowledgeChunk.findMany({
      where: {
        embeddingModel: embedded.model,
        document: { published: true },
      },
      select: {
        content: true,
        embedding: true,
        document: { select: { key: true, title: true, checksum: true } },
      },
    });
    const currentDocuments = await this.loadSourceDocuments();
    const currentChecksums = new Map(
      currentDocuments.map((document) => [document.key, document.checksum]),
    );
    const minimumScore = embedded.model.startsWith('local-') ? 0.12 : 0.25;

    return candidates
      .filter(
        (candidate) =>
          currentChecksums.get(candidate.document.key) ===
          candidate.document.checksum,
      )
      .map((candidate) => ({
        key: candidate.document.key,
        title: candidate.document.title,
        content: candidate.content,
        score: embedded.model.startsWith('local-')
          ? 0.35 * cosineSimilarity(queryVector, candidate.embedding) +
            0.65 *
              lexicalKnowledgeSimilarity(
                normalizedQuery,
                `${candidate.document.title}\n${candidate.content}`,
              )
          : cosineSimilarity(queryVector, candidate.embedding),
      }))
      .filter((candidate) => candidate.score >= minimumScore)
      .sort((left, right) => right.score - left.score)
      .slice(0, KNOWLEDGE_RESULT_LIMIT)
      .map((candidate) => ({
        ...candidate,
        score: Number(candidate.score.toFixed(4)),
      }));
  }
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}
