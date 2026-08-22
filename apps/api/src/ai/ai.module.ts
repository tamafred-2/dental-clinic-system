import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AvailabilityModule } from '../availability/availability.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AiChatCompletionsRunner } from './ai-chat-completions-runner';
import { AiResponsesRunner } from './ai-responses-runner';
import { AiToolsService } from './ai-tools.service';
import { AiController } from './ai.controller';
import { AI_PROVIDER } from './ai.constants';
import { AiService } from './ai.service';
import { ConfiguredAiProvider } from './configured-ai.provider';
import { GroqProvider } from './groq.provider';
import { OpenAiProvider } from './openai.provider';

@Module({
  imports: [KnowledgeModule, AvailabilityModule, AppointmentsModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiToolsService,
    AiResponsesRunner,
    AiChatCompletionsRunner,
    OpenAiProvider,
    GroqProvider,
    ConfiguredAiProvider,
    {
      provide: AI_PROVIDER,
      useExisting: ConfiguredAiProvider,
    },
  ],
  exports: [AiService],
})
export class AiModule {}
