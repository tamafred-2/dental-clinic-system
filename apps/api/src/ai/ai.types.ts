import type { RetrievedKnowledge } from '../knowledge/knowledge.types';

export type AiConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiGenerationInput = {
  conversationId: string;
  latestPatientMessageId: string;
  latestPatientMessage: string;
  turns: AiConversationTurn[];
  knowledge: RetrievedKnowledge[];
};

export type AiToolExecution = {
  name: string;
  success: boolean;
  code: string;
  resourceId?: string;
};

export type AiGenerationResult = {
  action: 'RESPOND' | 'ESCALATE';
  reply: string;
  reason: string | null;
  provider: 'OPENAI' | 'AGENTROUTER' | 'GROQ' | 'SAFETY';
  model: string;
  responseId: string;
  sourceKeys: string[];
  toolExecutions: AiToolExecution[];
  requestedHandoff: boolean;
};

export interface AiProvider {
  generate(input: AiGenerationInput): Promise<AiGenerationResult>;
}
