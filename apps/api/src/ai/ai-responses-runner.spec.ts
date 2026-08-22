import { AiResponsesRunner } from './ai-responses-runner';

describe('AiResponsesRunner', () => {
  it('executes an allow-listed call and returns its output to the model', async () => {
    const tools = {
      definitions: [{ type: 'function', name: 'getServices' }],
      execute: jest.fn().mockResolvedValue({
        audit: {
          name: 'getServices',
          success: true,
          code: 'SERVICES_FOUND',
        },
        output: { ok: true, code: 'SERVICES_FOUND', services: [] },
        requestedHandoff: false,
      }),
    };
    const parse = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'response-1',
        output: [
          {
            type: 'function_call',
            call_id: 'call-1',
            name: 'getServices',
            arguments: '{}',
          },
        ],
        output_parsed: null,
      })
      .mockResolvedValueOnce({
        id: 'response-2',
        output: [],
        output_parsed: {
          action: 'RESPOND',
          reply: 'Here are our current services.',
          reason: null,
          sourceKeys: [],
        },
      });
    const client = { responses: { parse } };
    const runner = new AiResponsesRunner(tools as never);

    const result = await runner.run(
      client as never,
      {
        conversationId: 'conversation-1',
        latestPatientMessageId: 'message-1',
        latestPatientMessage: 'What services do you offer?',
        turns: [{ role: 'user', content: 'What services do you offer?' }],
        knowledge: [],
      },
      { provider: 'OPENAI', model: 'test-model', store: false },
    );

    expect(tools.execute).toHaveBeenCalledWith('getServices', '{}', {
      conversationId: 'conversation-1',
      latestPatientMessageId: 'message-1',
      latestPatientMessage: 'What services do you offer?',
    });
    expect(parse.mock.calls[1][0].input).toContainEqual({
      type: 'function_call_output',
      call_id: 'call-1',
      output: JSON.stringify({
        ok: true,
        code: 'SERVICES_FOUND',
        services: [],
      }),
    });
    expect(result.toolExecutions).toHaveLength(1);
    expect(result.reply).toBe('Here are our current services.');
  });
});
