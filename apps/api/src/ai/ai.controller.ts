import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AiService } from './ai.service';

@Controller('conversations/admin')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post(':id/ai-response')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  respond(@Param('id') id: string) {
    return this.aiService.respondToConversation(id);
  }
}
