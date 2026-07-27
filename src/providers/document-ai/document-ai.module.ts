import { Global, Module, Logger } from '@nestjs/common';
import { DOCUMENT_AI_PROVIDER } from './document-ai.interface';
import { HeuristicDocumentAiProvider } from './heuristic.provider';
import { AnthropicDocumentAiProvider } from './anthropic.provider';

/**
 * Binds the active DocumentAiProvider from DOCUMENT_AI_PROVIDER env. Falls back
 * to the heuristic stub when the LLM provider isn't configured, so dev/CI need
 * no API key.
 */
@Global()
@Module({
  providers: [
    HeuristicDocumentAiProvider,
    AnthropicDocumentAiProvider,
    {
      provide: DOCUMENT_AI_PROVIDER,
      inject: [HeuristicDocumentAiProvider, AnthropicDocumentAiProvider],
      useFactory: (stub: HeuristicDocumentAiProvider, anthropic: AnthropicDocumentAiProvider) => {
        const useLlm = process.env.DOCUMENT_AI_PROVIDER === 'anthropic' && !!process.env.ANTHROPIC_API_KEY;
        const provider = useLlm ? anthropic : stub;
        new Logger('DocumentAI').log(`extractor: ${provider.name}`);
        return provider;
      },
    },
  ],
  exports: [DOCUMENT_AI_PROVIDER],
})
export class DocumentAiModule {}
