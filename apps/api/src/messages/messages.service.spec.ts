import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  const transaction = {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: { create: jest.fn() },
  };
  const prisma = {
    conversation: { findUnique: jest.fn() },
    message: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: MessagesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MessagesService(prisma as never);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
  });

  it('returns a bounded message page without metadata', async () => {
    prisma.conversation.findUnique.mockResolvedValue({ id: 'conversation-1' });
    prisma.message.findMany.mockResolvedValue([]);
    prisma.message.count.mockResolvedValue(0);

    await service.findForConversation('conversation-1', {
      page: 2,
      limit: 20,
    });

    const query = prisma.message.findMany.mock.calls[0][0];
    expect(query.skip).toBe(20);
    expect(query.take).toBe(20);
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(query.select).toEqual({
      id: true,
      senderType: true,
      content: true,
      createdAt: true,
      senderUser: { select: { id: true, name: true } },
    });
    expect(query.select.metadata).toBeUndefined();
  });

  it('returns each newest-first database page in chat order', async () => {
    prisma.conversation.findUnique.mockResolvedValue({ id: 'conversation-1' });
    prisma.message.findMany.mockResolvedValue([
      { id: 'newer-message' },
      { id: 'older-message' },
    ]);
    prisma.message.count.mockResolvedValue(2);

    const result = await service.findForConversation('conversation-1', {});

    expect(result.items.map((message) => message.id)).toEqual([
      'older-message',
      'newer-message',
    ]);
  });

  it('returns not found before querying messages', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);

    await expect(
      service.findForConversation('missing', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('requires staff to claim a conversation before replying', async () => {
    transaction.conversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.HUMAN_REQUIRED,
      assignedStaffId: null,
    });

    await expect(
      service.addStaffMessage('conversation-1', 'staff-1', {
        content: 'A safe reply.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects messages after a conversation is closed', async () => {
    transaction.conversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.CLOSED,
      assignedStaffId: 'staff-1',
    });

    await expect(
      service.addStaffMessage('conversation-1', 'staff-1', {
        content: 'A late reply.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores a staff reply and advances conversation activity atomically', async () => {
    const createdAt = new Date('2026-08-16T01:00:00.000Z');
    transaction.conversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.HUMAN_ACTIVE,
      assignedStaffId: 'staff-1',
    });
    transaction.message.create.mockResolvedValue({
      id: 'message-1',
      senderType: MessageSenderType.STAFF,
      content: 'The clinic can help with that request.',
      createdAt,
      senderUser: { id: 'staff-1', name: 'Staff Member' },
    });
    transaction.conversation.update.mockResolvedValue({ id: 'conversation-1' });

    const result = await service.addStaffMessage('conversation-1', 'staff-1', {
      content: 'The clinic can help with that request.',
    });

    expect(transaction.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conversation-1',
        senderUserId: 'staff-1',
        senderType: MessageSenderType.STAFF,
        content: 'The clinic can help with that request.',
      },
      select: {
        id: true,
        senderType: true,
        content: true,
        createdAt: true,
        senderUser: { select: { id: true, name: true } },
      },
    });
    expect(transaction.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conversation-1' },
      data: { updatedAt: createdAt },
    });
    expect(result.id).toBe('message-1');
  });
});
