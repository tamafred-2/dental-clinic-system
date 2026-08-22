import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { AI_MAX_OUTPUT_TOKENS } from './ai.constants';
import { buildAiInstructions } from './ai-decision';
import type { AiGenerationInput, AiGenerationResult } from './ai.types';

@Injectable()
export class AiChatCompletionsRunner {
  async run(
    client: OpenAI,
    input: AiGenerationInput,
    options: Pick<AiGenerationResult, 'provider' | 'model'>,
  ): Promise<AiGenerationResult> {
    const response = await client.chat.completions.create({
      model: options.model,
      max_tokens: AI_MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: 'system',
          content: buildAiInstructions(input.knowledge, false),
        },
        ...input.turns.map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
      ],
    });
    const reply = response.choices[0]?.message?.content?.trim();
    if (!reply) {
      throw new ServiceUnavailableException(
        'The AI provider did not return a usable response.',
      );
    }
    return {
      action: 'RESPOND',
      reply,
      reason: null,
      provider: options.provider,
      model: options.model,
      responseId: response.id,
      sourceKeys: [],
      toolExecutions: [],
      requestedHandoff: false,
    };
  }
}
