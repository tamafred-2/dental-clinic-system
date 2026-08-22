import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationMessagesQueryDto } from './dto/conversation-messages-query.dto';
import { CreateStaffMessageDto } from './dto/create-staff-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findForConversation(
    conversationId: string,
    query: ConversationMessagesQueryDto,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = { conversationId };
    const [newestFirstItems, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          senderType: true,
          content: true,
          createdAt: true,
          senderUser: { select: { id: true, name: true } },
        },
      }),
      this.prisma.message.count({ where }),
    ]);
    const items = newestFirstItems.reverse();

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

  async addStaffMessage(
    conversationId: string,
    currentUserId: string,
    dto: CreateStaffMessageDto,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, status: true, assignedStaffId: true },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found.');
      }
      if (conversation.status === ConversationStatus.CLOSED) {
        throw new ConflictException(
          'Messages cannot be added to a closed conversation.',
        );
      }
      if (
        conversation.status !== ConversationStatus.HUMAN_ACTIVE ||
        conversation.assignedStaffId !== currentUserId
      ) {
        throw new ForbiddenException(
          'Claim this conversation before adding a staff message.',
        );
      }

      const message = await transaction.message.create({
        data: {
          conversationId,
          senderUserId: currentUserId,
          senderType: MessageSenderType.STAFF,
          content: dto.content,
        },
        select: {
          id: true,
          senderType: true,
          content: true,
          createdAt: true,
          senderUser: { select: { id: true, name: true } },
        },
      });
      await transaction.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: message.createdAt },
      });
      return message;
    });
  }
}
