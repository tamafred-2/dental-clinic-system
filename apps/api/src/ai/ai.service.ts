import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConversationStatus, MessageSenderType, Prisma } from '@prisma/client';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AI_HISTORY_CONTENT_LIMIT,
  AI_HISTORY_MESSAGE_LIMIT,
  AI_PROVIDER,
} from './ai.constants';
import type { AiConversationTurn, AiProvider } from './ai.types';
import { assessAiSafety } from './ai-safety';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly processing = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async respondToConversation(conversationId: string) {
    if (this.processing.has(conversationId)) {
      throw new ConflictException(
        'An AI response is already being prepared for this conversation.',
      );
    }
    this.processing.add(conversationId);

    try {
      const context = await this.loadContext(conversationId);
      const safety = assessAiSafety(context.latestPatientMessage);
      if (safety) {
        return await this.persistDecision(
          conversationId,
          context.latestPatientMessageId,
          context.knowledge.map((item) => item.key),
          {
            action: 'ESCALATE',
            reply:
              'A qualified clinic staff member should help with this request. I will pass it to the staff queue.',
            reason: safety.reason,
            provider: 'SAFETY',
            model: 'deterministic-guardrail',
            responseId: '',
            sourceKeys: [],
            toolExecutions: [],
            requestedHandoff: true,
          },
        );
      }
      let generated;
      try {
        generated = await this.aiProvider.generate({
          conversationId,
          latestPatientMessageId: context.latestPatientMessageId,
          latestPatientMessage: context.latestPatientMessage,
          turns: context.turns,
          knowledge: context.knowledge,
        });
      } catch (error) {
        this.logger.warn(
          `AI response failed for conversation ${conversationId}: ${this.errorCode(error)}`,
        );
        if (error instanceof ServiceUnavailableException) throw error;
        throw new ServiceUnavailableException(
          'The AI assistant is temporarily unavailable. No response was stored.',
        );
      }

      return await this.persistDecision(
        conversationId,
        context.latestPatientMessageId,
        context.knowledge.map((item) => item.key),
        generated,
      );
    } finally {
      this.processing.delete(conversationId);
    }
  }

  private async loadContext(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        status: true,
        messages: {
          where: {
            senderType: {
              in: [
                MessageSenderType.PATIENT,
                MessageSenderType.AI,
                MessageSenderType.STAFF,
              ],
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: AI_HISTORY_MESSAGE_LIMIT,
          select: { id: true, senderType: true, content: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }
    if (conversation.status !== ConversationStatus.AI_ACTIVE) {
      throw new ConflictException(
        'AI can respond only while the conversation is in AI active status.',
      );
    }

    const chronological = [...conversation.messages].reverse();
    const latest = chronological.at(-1);
    if (!latest || latest.senderType !== MessageSenderType.PATIENT) {
      throw new ConflictException(
        'There is no unanswered patient message for the AI assistant.',
      );
    }

    let knowledge: Awaited<ReturnType<KnowledgeService['search']>> = [];
    try {
      knowledge = await this.knowledgeService.search(latest.content);
    } catch (error) {
      this.logger.warn(
        `Knowledge retrieval failed for conversation ${conversationId}: ${this.errorCode(error)}`,
      );
    }

    return {
      latestPatientMessageId: latest.id,
      latestPatientMessage: latest.content,
      knowledge,
      turns: chronological.map((message): AiConversationTurn => ({
        role:
          message.senderType === MessageSenderType.PATIENT
            ? 'user'
            : 'assistant',
        content: message.content.slice(0, AI_HISTORY_CONTENT_LIMIT),
      })),
    };
  }

  private async persistDecision(
    conversationId: string,
    expectedLatestMessageId: string,
    allowedSourceKeys: string[],
    generated: Awaited<ReturnType<AiProvider['generate']>>,
  ) {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const conversation = await transaction.conversation.findUnique({
            where: { id: conversationId },
            select: { status: true },
          });
          const latestMessage = await transaction.message.findFirst({
            where: { conversationId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: { id: true },
          });

          if (
            conversation?.status !== ConversationStatus.AI_ACTIVE ||
            latestMessage?.id !== expectedLatestMessageId
          ) {
            throw new ConflictException(
              'The conversation changed while the AI response was being prepared. Refresh and try again.',
            );
          }

          const sourceKeys = generated.sourceKeys.filter((key) =>
            allowedSourceKeys.includes(key),
          );
          const toolExecutions = generated.toolExecutions ?? [];
          const reply = this.sanitizePatientReply(generated.reply);
          const groundingFailed =
            generated.provider === 'OPENAI' &&
            allowedSourceKeys.length > 0 &&
            sourceKeys.length === 0 &&
            !toolExecutions.some((execution) => execution.success);
          const shouldEscalate =
            generated.action === 'ESCALATE' ||
            generated.requestedHandoff ||
            !reply ||
            groundingFailed;
          const message = await transaction.message.create({
            data: {
              conversationId,
              senderType: shouldEscalate
                ? MessageSenderType.SYSTEM
                : MessageSenderType.AI,
              content: shouldEscalate
                ? groundingFailed
                  ? 'I could not verify that information from the clinic knowledge base. A staff member will help you.'
                  : generated.reply.trim() ||
                    'A staff member is needed to continue this conversation.'
                : reply,
              metadata: {
                source:
                  generated.provider === 'AGENTROUTER'
                    ? 'AGENTROUTER_CHAT_COMPLETIONS_API'
                    : generated.provider === 'SAFETY'
                      ? 'DETERMINISTIC_AI_GUARDRAIL'
                      : `${generated.provider}_RESPONSES_API`,
                provider: generated.provider,
                model: generated.model,
                responseId: generated.responseId,
                knowledgeSourceKeys: sourceKeys,
                toolExecutions,
                ...(shouldEscalate && generated.reason
                  ? { escalationReason: generated.reason }
                  : {}),
                ...(groundingFailed
                  ? { escalationReason: 'Knowledge grounding failed.' }
                  : {}),
              },
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
            data: {
              updatedAt: message.createdAt,
              ...(shouldEscalate
                ? {
                    status: ConversationStatus.HUMAN_REQUIRED,
                    assignedStaffId: null,
                  }
                : {}),
            },
          });

          return {
            outcome: shouldEscalate ? 'ESCALATED' : 'RESPONDED',
            conversationStatus: shouldEscalate
              ? ConversationStatus.HUMAN_REQUIRED
              : ConversationStatus.AI_ACTIVE,
            message,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof ConflictException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034')
      ) {
        throw new ConflictException(
          'The conversation changed while the AI response was being prepared. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  private errorCode(error: unknown) {
    if (error instanceof ServiceUnavailableException) return 'unavailable';
    if (error instanceof Error) {
      const providerError = error as Error & {
        status?: number;
        code?: string;
        type?: string;
        requestID?: string;
        error?: unknown;
        body?: unknown;
      };
      const detail = providerError.error ?? providerError.body;
      let detailText = '';
      if (detail) {
        try {
          detailText = JSON.stringify(detail)
            .replace(/sk-[A-Za-z0-9_-]+/g, '<redacted-key>')
            .slice(0, 800);
        } catch {
          detailText = '[unserializable provider error]';
        }
      }
      return [
        error.name,
        providerError.status ? `status=${providerError.status}` : null,
        providerError.code ? `code=${providerError.code}` : null,
        providerError.type ? `type=${providerError.type}` : null,
        providerError.requestID
          ? `request_id=${providerError.requestID}`
          : null,
        error.message ? `message=${error.message.slice(0, 500)}` : null,
        detailText ? `detail=${detailText}` : null,
      ]
        .filter(Boolean)
        .join(' ');
    }
    return 'unknown';
  }

  private sanitizePatientReply(reply: string) {
    return reply
      .replace(
        /^\s*(?:[-*]\s*)?(?:\*{1,2})?sources?(?:\*{1,2})?\s*:\s*.*$/gim,
        '',
      )
      .replace(/^\s*(?:CLINIC|FAQ|SERVICE|DENTIST):[A-Za-z0-9_-]+\s*$/gim, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
