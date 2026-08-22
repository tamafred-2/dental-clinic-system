import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { AiService } from './ai.service';
import type { AiProvider } from './ai.types';

describe('AiService', () => {
  const prisma = {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const provider: jest.Mocked<AiProvider> = {
    generate: jest.fn(),
  };
  const knowledgeService = {
    search: jest.fn(),
  };
  let service: AiService;

  beforeEach(() => {
    jest.clearAllMocks();
    knowledgeService.search.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof prisma) => unknown) =>
        callback(prisma),
    );
    service = new AiService(
      prisma as never,
      provider,
      knowledgeService as never,
    );
  });

  function arrangeConversation() {
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conversation-1',
        status: ConversationStatus.AI_ACTIVE,
        messages: [
          {
            id: 'patient-message-1',
            senderType: MessageSenderType.PATIENT,
            content: 'Hello, can someone help me?',
          },
        ],
      })
      .mockResolvedValueOnce({ status: ConversationStatus.AI_ACTIVE });
    prisma.message.findFirst.mockResolvedValue({ id: 'patient-message-1' });
    prisma.message.create.mockResolvedValue({
      id: 'ai-message-1',
      senderType: MessageSenderType.AI,
      content: 'Hello! How may I help?',
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
      senderUser: null,
    });
    prisma.conversation.update.mockResolvedValue({ id: 'conversation-1' });
  }

  it('stores a structured AI response without patient contact data', async () => {
    arrangeConversation();
    provider.generate.mockResolvedValue({
      action: 'RESPOND',
      reply: 'Hello! How may I help?',
      reason: null,
      provider: 'OPENAI',
      model: 'test-model',
      responseId: 'response-1',
      sourceKeys: [],
      toolExecutions: [],
      requestedHandoff: false,
    });

    const result = await service.respondToConversation('conversation-1');

    expect(provider.generate).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      latestPatientMessageId: 'patient-message-1',
      latestPatientMessage: 'Hello, can someone help me?',
      turns: [{ role: 'user', content: 'Hello, can someone help me?' }],
      knowledge: [],
    });
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: 'conversation-1',
          senderType: MessageSenderType.AI,
          content: 'Hello! How may I help?',
        }),
      }),
    );
    expect(result.outcome).toBe('RESPONDED');
  });

  it('hands the conversation to staff when the provider escalates', async () => {
    arrangeConversation();
    provider.generate.mockResolvedValue({
      action: 'ESCALATE',
      reply: 'I’ll ask a staff member to help with that.',
      reason: 'Requires clinic availability.',
      provider: 'OPENAI',
      model: 'test-model',
      responseId: 'response-2',
      sourceKeys: [],
      toolExecutions: [],
      requestedHandoff: false,
    });

    const result = await service.respondToConversation('conversation-1');

    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderType: MessageSenderType.SYSTEM,
        }),
      }),
    );
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ConversationStatus.HUMAN_REQUIRED,
          assignedStaffId: null,
        }),
      }),
    );
    expect(result.outcome).toBe('ESCALATED');
  });

  it('retrieves clinic knowledge and records only retrieved source keys', async () => {
    arrangeConversation();
    knowledgeService.search.mockResolvedValue([
      {
        key: 'FAQ:faq-1',
        title: 'Do you accept walk-ins?',
        content: 'Walk-ins are assisted when capacity allows.',
        score: 0.8,
      },
    ]);
    provider.generate.mockResolvedValue({
      action: 'RESPOND',
      reply: 'Walk-ins are assisted when capacity allows.',
      reason: null,
      provider: 'OPENAI',
      model: 'test-model',
      responseId: 'response-grounded',
      sourceKeys: ['FAQ:faq-1', 'FAQ:not-retrieved'],
      toolExecutions: [],
      requestedHandoff: false,
    });

    await service.respondToConversation('conversation-1');

    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledge: [expect.objectContaining({ key: 'FAQ:faq-1' })],
      }),
    );
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            knowledgeSourceKeys: ['FAQ:faq-1'],
          }),
        }),
      }),
    );
  });

  it('hands off a purported grounded answer that cites no retrieved source', async () => {
    arrangeConversation();
    knowledgeService.search.mockResolvedValue([
      {
        key: 'CLINIC:clinic-1',
        title: 'Clinic',
        content: 'Address: Calasiao, Pangasinan',
        score: 0.9,
      },
    ]);
    provider.generate.mockResolvedValue({
      action: 'RESPOND',
      reply: 'The clinic is in Calasiao.',
      reason: null,
      provider: 'OPENAI',
      model: 'test-model',
      responseId: 'response-without-source',
      sourceKeys: [],
      toolExecutions: [],
      requestedHandoff: false,
    });

    const result = await service.respondToConversation('conversation-1');

    expect(result.outcome).toBe('ESCALATED');
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderType: MessageSenderType.SYSTEM,
        }),
      }),
    );
  });

  it('accepts a Groq plain-text answer when relevant knowledge was supplied', async () => {
    arrangeConversation();
    knowledgeService.search.mockResolvedValue([
      {
        key: 'CLINIC:clinic-1',
        title: 'Clinic hours',
        content: 'Monday to Friday: 09:00 to 18:00',
        score: 0.9,
      },
    ]);
    provider.generate.mockResolvedValue({
      action: 'RESPOND',
      reply: 'We are open **Monday to Friday**, from **9:00 AM to 6:00 PM**.',
      reason: null,
      provider: 'GROQ',
      model: 'openai/gpt-oss-20b',
      responseId: 'groq-response',
      sourceKeys: [],
      toolExecutions: [],
      requestedHandoff: false,
    });

    const result = await service.respondToConversation('conversation-1');

    expect(result.outcome).toBe('RESPONDED');
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderType: MessageSenderType.AI,
          content:
            'We are open **Monday to Friday**, from **9:00 AM to 6:00 PM**.',
        }),
      }),
    );
  });

  it('accepts an AgentRouter plain-text answer when relevant knowledge was supplied', async () => {
    arrangeConversation();
    knowledgeService.search.mockResolvedValue([
      {
        key: 'CLINIC:clinic-1',
        title: 'Clinic hours',
        content: 'Monday to Friday: 09:00 to 18:00',
        score: 0.9,
      },
    ]);
    provider.generate.mockResolvedValue({
      action: 'RESPOND',
      reply: 'We are open **Monday to Friday**, from **9:00 AM to 6:00 PM**.',
      reason: null,
      provider: 'AGENTROUTER',
      model: 'gpt-5.6-sol',
      responseId: 'agentrouter-response',
      sourceKeys: [],
      toolExecutions: [],
      requestedHandoff: false,
    });

    const result = await service.respondToConversation('conversation-1');

    expect(result.outcome).toBe('RESPONDED');
  });

  it('does not call the provider outside AI active status', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.HUMAN_ACTIVE,
      messages: [],
    });

    await expect(
      service.respondToConversation('conversation-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('escalates clinical advice before calling the AI provider', async () => {
    arrangeConversation();
    prisma.conversation.findUnique.mockReset();
    prisma.conversation.findUnique
      .mockResolvedValueOnce({
        id: 'conversation-1',
        status: ConversationStatus.AI_ACTIVE,
        messages: [
          {
            id: 'patient-message-1',
            senderType: MessageSenderType.PATIENT,
            content: 'What medicine should I take for this tooth infection?',
          },
        ],
      })
      .mockResolvedValueOnce({ status: ConversationStatus.AI_ACTIVE });

    const result = await service.respondToConversation('conversation-1');

    expect(provider.generate).not.toHaveBeenCalled();
    expect(result.outcome).toBe('ESCALATED');
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderType: MessageSenderType.SYSTEM,
          metadata: expect.objectContaining({
            source: 'DETERMINISTIC_AI_GUARDRAIL',
            escalationReason:
              'Clinical diagnosis, treatment, or medication request.',
          }),
        }),
      }),
    );
  });

  it('requires the latest conversational message to come from the patient', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.AI_ACTIVE,
      messages: [
        {
          id: 'ai-message-1',
          senderType: MessageSenderType.AI,
          content: 'How can I help?',
        },
      ],
    });

    await expect(
      service.respondToConversation('conversation-1'),
    ).rejects.toThrow('There is no unanswered patient message');
  });

  it('stores nothing when the provider is unavailable', async () => {
    arrangeConversation();
    provider.generate.mockRejectedValue(new Error('provider failure'));

    await expect(
      service.respondToConversation('conversation-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});
