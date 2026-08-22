import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConversationAssignmentFilter,
  ConversationQueryDto,
} from './dto/conversation-query.dto';

const conversationListSelect = {
  id: true,
  channel: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: { id: true, firstName: true, lastName: true },
  },
  assignedStaff: {
    select: { id: true, name: true },
  },
  _count: { select: { messages: true } },
} satisfies Prisma.ConversationSelect;

const conversationDetailSelect = {
  id: true,
  channel: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
  assignedStaff: {
    select: { id: true, name: true, email: true },
  },
  _count: { select: { messages: true } },
} satisfies Prisma.ConversationSelect;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ConversationQueryDto, currentUserId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const assignment = query.assignment ?? ConversationAssignmentFilter.ALL;
    const where: Prisma.ConversationWhereInput = {
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(assignment === ConversationAssignmentFilter.MINE
        ? { assignedStaffId: currentUserId }
        : assignment === ConversationAssignmentFilter.UNASSIGNED
          ? { assignedStaffId: null }
          : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: conversationListSelect,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: conversationDetailSelect,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    return conversation;
  }

  async claim(id: string, currentUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const conversation = await this.findForMutation(transaction, id);
      if (conversation.status === ConversationStatus.CLOSED) {
        throw new ConflictException('Closed conversations cannot be claimed.');
      }
      if (
        conversation.assignedStaffId &&
        conversation.assignedStaffId !== currentUserId
      ) {
        throw new ConflictException(
          'This conversation is already assigned to another staff member.',
        );
      }

      const result = await transaction.conversation.updateMany({
        where: {
          id,
          status: conversation.status,
          assignedStaffId: conversation.assignedStaffId,
        },
        data: {
          assignedStaffId: currentUserId,
          status: ConversationStatus.HUMAN_ACTIVE,
        },
      });
      this.ensureSingleUpdate(result.count);
      return transaction.conversation.findUniqueOrThrow({
        where: { id },
        select: conversationDetailSelect,
      });
    });
  }

  async release(id: string, currentUserId: string, currentUserRole: string) {
    return this.prisma.$transaction(async (transaction) => {
      const conversation = await this.findForMutation(transaction, id);
      if (conversation.status === ConversationStatus.CLOSED) {
        throw new ConflictException('Closed conversations cannot be released.');
      }
      if (!conversation.assignedStaffId) {
        throw new ConflictException('This conversation is not assigned.');
      }
      this.ensureCanManageAssignment(
        conversation.assignedStaffId,
        currentUserId,
        currentUserRole,
      );

      const result = await transaction.conversation.updateMany({
        where: {
          id,
          status: conversation.status,
          assignedStaffId: conversation.assignedStaffId,
        },
        data: {
          assignedStaffId: null,
          status: ConversationStatus.HUMAN_REQUIRED,
        },
      });
      this.ensureSingleUpdate(result.count);
      return transaction.conversation.findUniqueOrThrow({
        where: { id },
        select: conversationDetailSelect,
      });
    });
  }

  async close(id: string, currentUserId: string, currentUserRole: string) {
    return this.prisma.$transaction(async (transaction) => {
      const conversation = await this.findForMutation(transaction, id);
      if (conversation.status === ConversationStatus.CLOSED) {
        throw new ConflictException('Conversation is already closed.');
      }
      if (conversation.assignedStaffId) {
        this.ensureCanManageAssignment(
          conversation.assignedStaffId,
          currentUserId,
          currentUserRole,
        );
      }

      const result = await transaction.conversation.updateMany({
        where: { id, status: conversation.status },
        data: { status: ConversationStatus.CLOSED },
      });
      this.ensureSingleUpdate(result.count);
      return transaction.conversation.findUniqueOrThrow({
        where: { id },
        select: conversationDetailSelect,
      });
    });
  }

  private async findForMutation(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const conversation = await transaction.conversation.findUnique({
      where: { id },
      select: { id: true, status: true, assignedStaffId: true },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    return conversation;
  }

  private ensureCanManageAssignment(
    assignedStaffId: string,
    currentUserId: string,
    currentUserRole: string,
  ) {
    if (
      assignedStaffId !== currentUserId &&
      currentUserRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'This conversation is assigned to another staff member.',
      );
    }
  }

  private ensureSingleUpdate(count: number) {
    if (count !== 1) {
      throw new ConflictException(
        'Conversation changed while this request was being processed. Refresh and try again.',
      );
    }
  }
}
