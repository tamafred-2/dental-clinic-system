import { ServiceUnavailableException } from '@nestjs/common';
import type { KnowledgeEmbeddingProvider } from './knowledge.types';
import { KnowledgeService, cosineSimilarity } from './knowledge.service';
import { buildKnowledgeDocuments } from './knowledge-source';
import { createLocalEmbedding } from './local-embedding';

describe('KnowledgeService', () => {
  const prisma = {
    clinic: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
    faq: { findMany: jest.fn() },
    dentist: { findMany: jest.fn() },
    knowledgeDocument: {
      count: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    knowledgeChunk: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const embeddings: jest.Mocked<KnowledgeEmbeddingProvider> = {
    embedMany: jest.fn(),
  };
  let service: KnowledgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.clinic.findMany.mockResolvedValue([]);
    prisma.service.findMany.mockResolvedValue([]);
    prisma.faq.findMany.mockResolvedValue([]);
    prisma.dentist.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof prisma) => unknown) =>
        callback(prisma),
    );
    service = new KnowledgeService(prisma as never, embeddings);
  });

  it('returns only sufficiently similar verified chunks', async () => {
    const faq = {
      id: 'faq-1',
      question: 'When are you open?',
      answer: 'The clinic is open Monday to Friday.',
    };
    prisma.faq.findMany.mockResolvedValue([faq]);
    const [currentDocument] = buildKnowledgeDocuments({
      clinics: [],
      services: [],
      faqs: [faq],
      dentists: [],
    });
    embeddings.embedMany.mockResolvedValue({
      model: 'test-model',
      vectors: [[1, 0]],
    });
    prisma.knowledgeChunk.findMany.mockResolvedValue([
      {
        content: 'Clinic opening hours are Monday to Friday.',
        embedding: [1, 0],
        document: {
          key: currentDocument.key,
          title: currentDocument.title,
          checksum: currentDocument.checksum,
        },
      },
      {
        content: 'Unrelated information.',
        embedding: [1, 0],
        document: { key: 'FAQ:2', title: 'Other', checksum: 'stale' },
      },
    ]);

    await expect(service.search('When are you open?')).resolves.toEqual([
      {
        key: currentDocument.key,
        title: currentDocument.title,
        content: 'Clinic opening hours are Monday to Friday.',
        score: 1,
      },
    ]);
  });

  it('rebuilds structured clinic records as an atomic index', async () => {
    prisma.clinic.findMany.mockResolvedValue([
      {
        id: 'clinic-1',
        name: 'Dental Clinic Website',
        address: 'Calasiao, Pangasinan',
        phone: '+63 75 555 0142',
        email: 'hello@example.test',
        timeZone: 'Asia/Manila',
        openingHours: 'Monday-Friday, 09:00-17:00',
        appointmentPolicy: 'Appointment requests require confirmation.',
        cancellationPolicy: 'Contact the clinic before cancelling.',
        hours: [],
      },
    ]);
    prisma.service.findMany.mockResolvedValue([]);
    prisma.faq.findMany.mockResolvedValue([]);
    prisma.dentist.findMany.mockResolvedValue([]);
    embeddings.embedMany.mockImplementation(async (texts) => ({
      model: 'test-model',
      vectors: texts.map(() => [1, 0]),
    }));

    await expect(service.rebuild()).resolves.toEqual({
      documents: 1,
      chunks: 1,
      embeddingModel: 'test-model',
    });
    expect(prisma.knowledgeDocument.deleteMany).toHaveBeenCalled();
    expect(prisma.knowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'CLINIC:clinic-1',
          chunks: { create: [expect.objectContaining({ embedding: [1, 0] })] },
        }),
      }),
    );
  });

  it('keeps the old index when embedding output is invalid', async () => {
    prisma.clinic.findMany.mockResolvedValue([]);
    prisma.service.findMany.mockResolvedValue([]);
    prisma.faq.findMany.mockResolvedValue([
      { id: 'faq-1', question: 'Question?', answer: 'Answer.' },
    ]);
    prisma.dentist.findMany.mockResolvedValue([]);
    embeddings.embedMany.mockResolvedValue({ model: 'broken', vectors: [] });

    await expect(service.rebuild()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates deterministic normalized local embeddings', () => {
    const first = createLocalEmbedding('clinic opening hours');
    const second = createLocalEmbedding('clinic open hours');

    expect(first).toHaveLength(384);
    expect(cosineSimilarity(first, first)).toBeCloseTo(1);
    expect(cosineSimilarity(first, second)).toBeGreaterThan(0.4);
  });
});
