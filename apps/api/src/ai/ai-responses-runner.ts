import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import { AiDecisionSchema, buildAiInstructions } from './ai-decision';
import { AI_MAX_OUTPUT_TOKENS } from './ai.constants';
import { AiToolsService } from './ai-tools.service';
import type {
  AiGenerationInput,
  AiGenerationResult,
  AiToolExecution,
} from './ai.types';

const maximumToolRounds = 3;
const maximumToolCalls = 5;
const maximumToolOutputLength = 12_000;

type RunnerOptions = {
  provider: AiGenerationResult['provider'];
  model: string;
  store?: false;
  safetyIdentifier?: string;
  structuredOutput?: boolean;
};

type ParsedDecision = {
  action: 'RESPOND' | 'ESCALATE';
  reply: string;
  reason: string | null;
  sourceKeys: string[];
};

@Injectable()
export class AiResponsesRunner {
  constructor(private readonly toolsService: AiToolsService) {}

  async run(
    client: OpenAI,
    input: AiGenerationInput,
    options: RunnerOptions,
  ): Promise<AiGenerationResult> {
    const responseInput: ResponseInputItem[] = input.turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));
    const toolExecutions: AiToolExecution[] = [];
    let requestedHandoff = false;
    let responseId = '';

    for (let round = 0; round <= maximumToolRounds; round += 1) {
      const request = {
        model: options.model,
        ...(options.store !== undefined ? { store: options.store } : {}),
        ...(options.safetyIdentifier
          ? { safety_identifier: options.safetyIdentifier }
          : {}),
        max_output_tokens: AI_MAX_OUTPUT_TOKENS,
        instructions: buildAiInstructions(
          input.knowledge,
          options.structuredOutput !== false,
        ),
        input: responseInput,
        tools: this.toolsService.definitions,
        tool_choice: 'auto',
        parallel_tool_calls: false,
      } as const;
      const response =
        options.structuredOutput === false
          ? await client.responses.create(request)
          : await client.responses.parse({
              ...request,
              text: {
                format: zodTextFormat(
                  AiDecisionSchema,
                  'dental_assistant_decision',
                ),
              },
            });
      responseId = response.id;

      const calls = response.output.filter(
        (item) => item.type === 'function_call',
      );
      if (calls.length === 0) {
        if (options.structuredOutput === false) {
          const reply = response.output_text.trim();
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
            responseId,
            sourceKeys: [],
            toolExecutions,
            requestedHandoff,
          };
        }
        const parsedResponse = response as unknown as {
          output_parsed: ParsedDecision | null;
        };
        if (!parsedResponse.output_parsed) {
          throw new ServiceUnavailableException(
            'The AI provider did not return a usable response.',
          );
        }
        return {
          ...parsedResponse.output_parsed,
          reply: parsedResponse.output_parsed.reply.trim(),
          reason: parsedResponse.output_parsed.reason?.trim() || null,
          provider: options.provider,
          model: options.model,
          responseId,
          sourceKeys: parsedResponse.output_parsed.sourceKeys,
          toolExecutions,
          requestedHandoff,
        };
      }

      if (
        round === maximumToolRounds ||
        toolExecutions.length + calls.length > maximumToolCalls
      ) {
        throw new ServiceUnavailableException(
          'The AI assistant exceeded the safe tool-call limit.',
        );
      }

      responseInput.push(...(response.output as ResponseInputItem[]));
      for (const call of calls) {
        const result = await this.toolsService.execute(
          call.name,
          call.arguments,
          {
            conversationId: input.conversationId,
            latestPatientMessageId: input.latestPatientMessageId,
            latestPatientMessage: input.latestPatientMessage,
          },
        );
        toolExecutions.push(result.audit);
        requestedHandoff ||= result.requestedHandoff;
        const serializedOutput = JSON.stringify(result.output);
        const output =
          serializedOutput.length <= maximumToolOutputLength
            ? serializedOutput
            : JSON.stringify({ ok: false, code: 'TOOL_OUTPUT_TOO_LARGE' });
        responseInput.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output,
        });
      }
    }

    throw new ServiceUnavailableException(
      'The AI assistant could not complete the tool workflow.',
    );
  }
}
