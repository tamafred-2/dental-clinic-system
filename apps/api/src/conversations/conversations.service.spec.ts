import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConversationStatus, UserRole } from '@prisma/client';
import { ConversationsService } from './conversations.service';
import { ConversationAssignmentFilter } from './dto/conversation-query.dto';

describe('ConversationsService', () => {
  const transaction = {
    conversation: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const prisma = {
    conversation: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: ConversationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationsService(prisma as never);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
  });

  it('lists only minimal patient identity and supports my-assignment filtering', async () => {
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.conversation.count.mockResolvedValue(0);

    await service.findAll(
      {
        assignment: ConversationAssignmentFilter.MINE,
        page: 2,
        limit: 10,
      },
      'staff-1',
    );

    const query = prisma.conversation.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ assignedStaffId: 'staff-1' });
    expect(query.skip).toBe(10);
    expect(query.take).toBe(10);
    expect(query.select.patient.select).toEqual({
      id: true,
      firstName: true,
      lastName: true,
    });
    expect(query.select.patient.select.email).toBeUndefined();
    expect(query.select.patient.select.phone).toBeUndefined();
  });

  it('returns not found for an unknown conversation detail', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('claims an unassigned conversation with an optimistic update', async () => {
    transaction.conversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.HUMAN_REQUIRED,
      assignedStaffId: null,
    });
    transaction.conversation.updateMany.mockResolvedValue({ count: 1 });
    transaction.conversation.findUniqueOrThrow.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.HUMAN_ACTIVE,
      assignedStaff: { id: 'staff-1', name: 'Staff Member' },
    });

    const result = await service.claim('conversation-1', 'staff-1');

    expect(transaction.conversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'conversation-1',
        status: ConversationStatus.HUMAN_REQUIRED,
        assignedStaffId: null,
      },
      data: {
        assignedStaffId: 'staff-1',
        status: ConversationStatus.HUMAN_ACTIVE,
      },
    });
    expect(result.status).toBe(ConversationStatus.HUMAN_ACTIVE);
  });

  it('does not allow staff to take another staff member assignment', async () => {
    transaction.conversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.HUMAN_ACTIVE,
      assignedStaffId: 'staff-2',
    });

    await expect(
      service.claim('conversation-1', 'staff-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.conversation.updateMany).not.toHaveBeenCalled();
  });

  it('prevents non-admin staff from releasing another assignment', async () => {
    transaction.conversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.HUMAN_ACTIVE,
      assignedStaffId: 'staff-2',
    });

    await expect(
      service.release('conversation-1', 'staff-1', UserRole.STAFF),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('detects a concurrent close instead of overwriting it', async () => {
    transaction.conversation.findUnique.mockResolvedValue({
      id: 'conversation-1',
      status: ConversationStatus.HUMAN_REQUIRED,
      assignedStaffId: null,
    });
    transaction.conversation.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.close('conversation-1', 'staff-1', UserRole.STAFF),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
