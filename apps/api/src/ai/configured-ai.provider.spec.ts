import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfiguredAiProvider } from './configured-ai.provider';
import type { AiGenerationInput, AiProvider } from './ai.types';

describe('ConfiguredAiProvider', () => {
  const input: AiGenerationInput = {
    conversationId: 'conversation-1',
    latestPatientMessageId: 'message-1',
    latestPatientMessage: 'Hello',
    turns: [{ role: 'user', content: 'Hello' }],
    knowledge: [],
  };
  const result = {
    action: 'RESPOND' as const,
    reply: 'Hello!',
    reason: null,
    provider: 'OPENAI' as const,
    model: 'test-model',
    responseId: 'response-1',
    sourceKeys: [],
    toolExecutions: [],
    requestedHandoff: false,
  };

  function createProvider(configuredProvider?: string) {
    const configService = {
      get: jest.fn().mockReturnValue(configuredProvider),
    } as unknown as ConfigService;
    const openAiProvider: jest.Mocked<AiProvider> = {
      generate: jest.fn().mockResolvedValue(result),
    };
    const groqProvider: jest.Mocked<AiProvider> = {
      generate: jest.fn().mockResolvedValue({
        ...result,
        provider: 'GROQ',
      }),
    };

    return {
      provider: new ConfiguredAiProvider(
        configService,
        openAiProvider as never,
        groqProvider as never,
      ),
      openAiProvider,
      groqProvider,
    };
  }

  it('uses OpenAI by default', async () => {
    const { provider, openAiProvider, groqProvider } = createProvider();

    await expect(provider.generate(input)).resolves.toEqual(result);
    expect(openAiProvider.generate).toHaveBeenCalledWith(input);
    expect(groqProvider.generate).not.toHaveBeenCalled();
  });

  it('uses Groq only when explicitly selected', async () => {
    const { provider, openAiProvider, groqProvider } = createProvider('groq');

    await expect(provider.generate(input)).resolves.toEqual({
      ...result,
      provider: 'GROQ',
    });
    expect(groqProvider.generate).toHaveBeenCalledWith(input);
    expect(openAiProvider.generate).not.toHaveBeenCalled();
  });

  it('uses the OpenAI-compatible provider when AgentRouter is explicitly selected', async () => {
    const { provider, openAiProvider, groqProvider } = createProvider(
      'agentrouter',
    );

    await expect(provider.generate(input)).resolves.toEqual(result);
    expect(openAiProvider.generate).toHaveBeenCalledWith(input);
    expect(groqProvider.generate).not.toHaveBeenCalled();
  });

  it('rejects unsupported providers instead of silently falling back', async () => {
    const { provider, openAiProvider, groqProvider } =
      createProvider('unknown');

    await expect(provider.generate(input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(openAiProvider.generate).not.toHaveBeenCalled();
    expect(groqProvider.generate).not.toHaveBeenCalled();
  });
});
