import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/guards/session-auth.guard';
import { ConversationMessagesQueryDto } from '../messages/dto/conversation-messages-query.dto';
import { CreateStaffMessageDto } from '../messages/dto/create-staff-message.dto';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from './conversations.service';
import { ConversationQueryDto } from './dto/conversation-query.dto';

@Controller('conversations/admin')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  @Get()
  findAll(
    @Query() query: ConversationQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversationsService.findAll(query, request.authUser!.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conversationsService.findOne(id);
  }

  @Get(':id/messages')
  findMessages(
    @Param('id') id: string,
    @Query() query: ConversationMessagesQueryDto,
  ) {
    return this.messagesService.findForConversation(id, query);
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.conversationsService.claim(id, request.authUser!.id);
  }

  @Post(':id/release')
  release(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.conversationsService.release(
      id,
      request.authUser!.id,
      request.authUser!.role,
    );
  }

  @Post(':id/close')
  close(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.conversationsService.close(
      id,
      request.authUser!.id,
      request.authUser!.role,
    );
  }

  @Post(':id/messages')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  addStaffMessage(
    @Param('id') id: string,
    @Body() dto: CreateStaffMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messagesService.addStaffMessage(id, request.authUser!.id, dto);
  }
}
