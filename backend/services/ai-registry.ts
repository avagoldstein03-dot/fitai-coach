import type { AIProvider } from "./ai-provider";
import { OpenAIProvider } from "./openai-provider";
import { AnthropicProvider } from "./anthropic-provider";

export class AIProviderRegistry {
  private static providers: Map<string, AIProvider> = new Map();

  static {
    this.register("openai", new OpenAIProvider());
    this.register("anthropic", new AnthropicProvider());
  }

  static register(name: string, provider: AIProvider) {
    this.providers.set(name.toLowerCase(), provider);
  }

  static getProvider(name: string): AIProvider {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new Error(`Unknown AI provider: ${name}`);
    }
    return provider;
  }

  static getDefaultProvider(): AIProvider {
    // Default to OpenAI
    return this.getProvider("openai");
  }

  static getProviderForTask(taskType: string): AIProvider {
    // Route tasks to appropriate providers
    switch (taskType) {
      case "food_recognition":
      case "meal_analysis":
      case "workout_generation":
      case "nutrition_planning":
      case "chat":
      case "form_check":
      case "body_analysis":
        return this.getProvider("openai");
      case "assessment_report":
      case "progress_review":
      case "weekly_summary":
      case "behavioral_coaching":
      case "goal_adjustment":
      case "cross_domain_insights":
        return this.getProvider("anthropic");
      default:
        return this.getDefaultProvider();
    }
  }
}

export default AIProviderRegistry;
