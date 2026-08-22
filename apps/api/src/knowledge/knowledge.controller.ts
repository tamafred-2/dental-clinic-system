import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { SearchKnowledgeDto } from './dto/search-knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge/admin')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('status')
  status() {
    return this.knowledgeService.status();
  }

  @Post('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  search(@Body() dto: SearchKnowledgeDto) {
    return this.knowledgeService.search(dto.query);
  }

  @Post('reindex')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  rebuild() {
    return this.knowledgeService.rebuild();
  }
}
