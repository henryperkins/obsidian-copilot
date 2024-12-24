import { CustomModel, getModelKey, setModelKey } from "src/aiParams";
import { BUILTIN_CHAT_MODELS, ChatModelProviders } from "src/constants";
import { ModelConfig, asFetch } from "../types";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { ChatCohere } from "@langchain/cohere";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { Notice } from "obsidian";
import { safeFetch } from "../utils";
import { CustomFetch } from "../types";
import { ChatAnthropic } from "@langchain/anthropic";
import { getDecryptedKey } from "../encryptionService";
import { getSettings, subscribeToSettingsChange } from "../settings/model";
import { CopilotSettings } from "../settings/model";
import { AzureDeployment } from "../types";

type ChatConstructorType = new (config: any) => BaseChatModel;

// Add a mapping of supported parameters for o1-preview (update as needed)
const o1PreviewSupportedParameters: string[] = [
  "modelName",
  "temperature",
  "maxCompletionTokens", // Note: It's maxCompletionTokens, not maxTokens
  "stop",
  "presencePenalty",
  "frequencyPenalty",
  "logitBias",
  "user",
  "azureOpenAIApiKey",
  "azureOpenAIApiInstanceName",
  "azureOpenAIApiDeploymentName",
  "azureOpenAIApiVersion",
];

const CHAT_PROVIDER_CONSTRUCTORS = {
  [ChatModelProviders.OPENAI]: ChatOpenAI,
  [ChatModelProviders.AZURE_OPENAI]: ChatOpenAI,
  [ChatModelProviders.ANTHROPIC]: ChatAnthropic,
  [ChatModelProviders.COHEREAI]: ChatCohere,
  [ChatModelProviders.GOOGLE]: ChatGoogleGenerativeAI,
  [ChatModelProviders.OPENROUTERAI]: ChatOpenAI,
  [ChatModelProviders.OLLAMA]: ChatOllama,
  [ChatModelProviders.LM_STUDIO]: ChatOpenAI,
  [ChatModelProviders.GROQ]: ChatGroq,
  [ChatModelProviders.OPENAI_FORMAT]: ChatOpenAI,
} as const;

type ChatProviderConstructMap = typeof CHAT_PROVIDER_CONSTRUCTORS;

export default class ChatModelManager {
  private static instance: ChatModelManager;
  private static chatModel: BaseChatModel | null = null;
  private static modelMap: Record<
    string,
    {
      hasApiKey: boolean;
      AIConstructor: ChatConstructorType;
      vendor: string;
    }
  > = {};

  private readonly providerApiKeyMap: Record<ChatModelProviders, () => string> = {
    [ChatModelProviders.OPENAI]: () => getSettings().openAIApiKey,
    [ChatModelProviders.GOOGLE]: () => getSettings().googleApiKey,
    [ChatModelProviders.AZURE_OPENAI]: () => getSettings().azureOpenAIApiKey,
    [ChatModelProviders.ANTHROPIC]: () => getSettings().anthropicApiKey,
    [ChatModelProviders.COHEREAI]: () => getSettings().cohereApiKey,
    [ChatModelProviders.OPENROUTERAI]: () => getSettings().openRouterAiApiKey,
    [ChatModelProviders.GROQ]: () => getSettings().groqApiKey,
    [ChatModelProviders.OLLAMA]: () => "default-key",
    [ChatModelProviders.LM_STUDIO]: () => "default-key",
    [ChatModelProviders.OPENAI_FORMAT]: () => "default-key",
  } as const;

  private constructor() {
    this.buildModelMap();
    subscribeToSettingsChange(() => {
      this.buildModelMap();
      this.validateCurrentModel();
    });
  }

  static getInstance(): ChatModelManager {
    if (!ChatModelManager.instance) {
      ChatModelManager.instance = new ChatModelManager();
    }
    return ChatModelManager.instance;
  }

  private getModelConfig(customModel: CustomModel): ModelConfig {
    const settings: CopilotSettings = getSettings();
    const modelKey: string = getModelKey();
    const isAzureOpenAI: boolean = customModel.provider === ChatModelProviders.AZURE_OPENAI;
    const modelName: string = customModel.name;
    const isO1PreviewModel: boolean = modelName === "o1-preview";

    const baseConfig: ModelConfig = {
      modelName: modelName,
      temperature: settings.temperature,
      streaming: true, // Default to true for non-o1-preview models
      maxRetries: 3,
      maxConcurrency: 3,
      enableCors: customModel.enableCors,
      azureOpenAIApiDeploymentName:
        settings.modelConfigs[modelKey]?.azureOpenAIApiDeploymentName || "",
      azureOpenAIApiInstanceName: settings.modelConfigs[modelKey]?.azureOpenAIApiInstanceName || "",
      azureOpenAIApiVersion: settings.modelConfigs[modelKey]?.azureOpenAIApiVersion || "",
    };

    const { maxTokens, temperature }: { maxTokens: number; temperature: number } = settings;

    if (typeof maxTokens !== "number" || maxTokens <= 0 || !Number.isInteger(maxTokens)) {
      new Notice("Invalid maxTokens value in settings. Please use a positive integer.");
      throw new Error("Invalid maxTokens value in settings. Please use a positive integer.");
    }

    if (typeof temperature !== "number" || temperature < 0 || temperature > 2) {
      new Notice("Invalid temperature value in settings. Please use a number between 0 and 2.");
      throw new Error(
        "Invalid temperature value in settings. Please use a number between 0 and 2."
      );
    }

    const providerConfig: {
      [K in keyof ChatProviderConstructMap]: ConstructorParameters<ChatProviderConstructMap[K]>[0];
    } = {
      [ChatModelProviders.OPENAI]: {
        modelName: modelName,
        openAIApiKey: getDecryptedKey(customModel.apiKey || settings.openAIApiKey),
        configuration: {
          baseURL: customModel.baseUrl,
          fetch: customModel.enableCors ? (asFetch(safeFetch) as unknown as typeof fetch) : undefined,
        },
        ...this.handleAzureOpenAIExtraArgs(isO1PreviewModel, maxTokens, temperature),
      },
      [ChatModelProviders.ANTHROPIC]: {
        anthropicApiKey: getDecryptedKey(customModel.apiKey || settings.anthropicApiKey),
        modelName: modelName,
        anthropicApiUrl: customModel.baseUrl,
        clientOptions: {
          // Required to bypass CORS restrictions
          defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" },
          fetch: customModel.enableCors ? (asFetch(safeFetch) as typeof fetch) : undefined,
        },
      },
      [ChatModelProviders.AZURE_OPENAI]: {
        azureOpenAIApiKey: getDecryptedKey(customModel.apiKey || settings.azureOpenAIApiKey),
        azureOpenAIApiInstanceName: customModel.azureOpenAIApiInstanceName || "",
        azureOpenAIApiDeploymentName: isAzureOpenAI
          ? settings.modelConfigs[modelKey]?.azureOpenAIApiDeploymentName || ""
          : "",
        azureOpenAIApiVersion: settings.azureOpenAIApiVersion,
        ...this.handleAzureOpenAIExtraArgs(isO1PreviewModel, maxTokens, temperature),
        configuration: {
          baseURL: customModel.baseUrl,
          fetch: customModel.enableCors ? (asFetch(safeFetch) as typeof fetch) : undefined,
        },
        // Validate parameters for o1-preview
        ...(isO1PreviewModel && {
          callbacks: [
            {
              handleLLMStart: async (llm: any, prompts: string[]) => {
                if (typeof llm.toJSON === "function") {
                  const config = llm?.toJSON();
                  const serialized = config?.kwargs;
                  // Remove unsupported parameters
                  Object.keys(serialized).forEach((key: string) => {
                    if (!o1PreviewSupportedParameters.includes(key)) {
                      console.warn(`Removing unsupported parameter for o1-preview: ${key}`);
                      delete serialized[key];
                    }
                  });
                }
              },
            },
          ],
        }),
      },
      [ChatModelProviders.COHEREAI]: {
        apiKey: getDecryptedKey(customModel.apiKey || settings.cohereApiKey),
        model: modelName,
      },
      [ChatModelProviders.GOOGLE]: {
        apiKey: getDecryptedKey(customModel.apiKey || settings.googleApiKey),
        modelName: modelName,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
        baseUrl: customModel.baseUrl,
      },
      [ChatModelProviders.OPENROUTERAI]: {
        modelName: modelName,
        openAIApiKey: getDecryptedKey(customModel.apiKey || settings.openRouterAiApiKey),
        configuration: {
          baseURL: customModel.baseUrl || "https://openrouter.ai/api/v1",
          fetch: customModel.enableCors ? asFetch(safeFetch) : undefined,
        },
      },
      [ChatModelProviders.GROQ]: {
        apiKey: getDecryptedKey(customModel.apiKey || settings.groqApiKey),
        modelName: modelName,
      },
      [ChatModelProviders.OLLAMA]: {
        // ChatOllama has `model` instead of `modelName`!!
        model: modelName,
        // @ts-ignore
        apiKey: customModel.apiKey || "default-key",
        // MUST NOT use /v1 in the baseUrl for Ollama
        baseUrl: customModel.baseUrl || "http://localhost:11434",
      },
      [ChatModelProviders.LM_STUDIO]: {
        modelName: modelName,
        openAIApiKey: customModel.apiKey || "default-key",
        configuration: {
          baseURL: customModel.baseUrl || "http://localhost:1234/v1",
          fetch: customModel.enableCors ? asFetch(safeFetch) : undefined,
        },
      },
      [ChatModelProviders.OPENAI_FORMAT]: {
        modelName: modelName,
        openAIApiKey: getDecryptedKey(customModel.apiKey || settings.openAIApiKey),
        configuration: {
          baseURL: customModel.baseUrl,
          fetch: customModel.enableCors ? asFetch(safeFetch) : undefined,
          dangerouslyAllowBrowser: true,
        },
        ...this.handleAzureOpenAIExtraArgs(isO1PreviewModel, maxTokens, temperature),
      },
    };

    const selectedProviderConfig =
      providerConfig[customModel.provider as keyof typeof providerConfig] || {};

    // Handle openAIOrgId separately
    if (customModel.provider === ChatModelProviders.OPENAI && settings.openAIOrgId) {
      (selectedProviderConfig as any).openAIOrgId = getDecryptedKey(settings.openAIOrgId);
    }

    return { ...baseConfig, ...selectedProviderConfig };
  }

  private getAzureModelConfig(customModel: CustomModel): ModelConfig {
    const settings: CopilotSettings = getSettings();
    const modelKey: string = getModelKey();
    const isO1PreviewModel: boolean = customModel.name === "o1-preview";

    const deployment: AzureDeployment | undefined = settings.azureOpenAIApiDeployments.find(
      (d: AzureDeployment) => d.modelKey === modelKey
    );

    if (!deployment) {
      throw new Error(`No Azure deployment found for model: ${modelKey}`);
    }

    const baseConfig: ModelConfig = {
      modelName: customModel.name,
      temperature: settings.temperature,
      streaming: true, // Default to true for Azure
      maxRetries: 3,
      maxConcurrency: 3,
      enableCors: customModel.enableCors,
      azureOpenAIApiDeploymentName: deployment.deploymentName,
      azureOpenAIApiInstanceName: deployment.instanceName,
      azureOpenAIApiVersion: deployment.apiVersion,
    };

    const azureConfig: ModelConfig = {
      ...baseConfig,
      azureOpenAIApiKey: getDecryptedKey(deployment.apiKey),
      azureOpenAIApiInstanceName: deployment.instanceName,
      azureOpenAIApiDeploymentName: deployment.deploymentName,
      azureOpenAIApiVersion: deployment.apiVersion,
      configuration: {
        baseURL: customModel.baseUrl,
        fetch: customModel.enableCors ? asFetch(safeFetch) : undefined,
      },
    };

    if (isO1PreviewModel) {
      // Override settings for o1-preview models
      azureConfig.maxCompletionTokens = deployment.specialSettings?.maxCompletionTokens;
      azureConfig.reasoningEffort = deployment.specialSettings?.reasoningEffort;
      azureConfig.temperature = 1; // Fixed temperature for o1-preview
      azureConfig.streaming = false; // No streaming for o1-preview
      azureConfig.maxTokens = undefined; // No max_tokens for o1-preview
    }

    return azureConfig;
  }

  public getChatModelConfiguration(modelKey: string): ModelConfig {
    const model: CustomModel | undefined = this.findCustomModel(
      modelKey,
      getSettings().activeModels
    );
    if (!model) {
      throw new Error(`Model config not found for key: ${modelKey}`);
    }
    if (model.provider === ChatModelProviders.AZURE_OPENAI) {
      return this.getAzureModelConfig(model);
    }
    return this.getModelConfig(model);
  }

  private handleAzureOpenAIExtraArgs(
    isO1PreviewModel: boolean,
    maxTokens: number,
    temperature: number
  ): Record<string, any> {
    const modelConfig: ModelConfig | undefined = getSettings().modelConfigs[getModelKey()];

    if (isO1PreviewModel) {
      return {
        maxCompletionTokens: maxTokens,
        temperature: 1,
        extraParams: {
          ...(modelConfig?.reasoningEffort && {
            reasoning_effort: modelConfig.reasoningEffort,
          }),
        },
      };
    }

    return {
      maxTokens,
      temperature,
    };
  }

  // Build a map of modelKey to model config
  public buildModelMap(): void {
    const activeModels: CustomModel[] = getSettings().activeModels;
    ChatModelManager.modelMap = {};
    const modelMap: typeof ChatModelManager.modelMap = ChatModelManager.modelMap;

    const allModels: CustomModel[] = activeModels ?? BUILTIN_CHAT_MODELS;

    allModels.forEach((model: CustomModel) => {
      if (model.enabled) {
        if (!Object.values(ChatModelProviders).includes(model.provider as ChatModelProviders)) {
          console.warn(`Unknown provider: ${model.provider} for model: ${model.name}`);
          return;
        }

        const constructor: ChatConstructorType = this.getProviderConstructor(model);
        const getDefaultApiKey: () => string =
          this.providerApiKeyMap[model.provider as ChatModelProviders];

        const apiKey: string = model.apiKey || getDefaultApiKey();
        const modelKey = `${model.name}|${model.provider}`;
        modelMap[modelKey] = {
          hasApiKey: Boolean(model.apiKey || apiKey),
          AIConstructor: constructor,
          vendor: model.provider,
        };
      }
    });
  }

  getProviderConstructor(model: CustomModel): ChatConstructorType {
    const constructor: ChatConstructorType =
      CHAT_PROVIDER_CONSTRUCTORS[model.provider as ChatModelProviders];
    if (!constructor) {
      console.warn(`Unknown provider: ${model.provider} for model: ${model.name}`);
      throw new Error(`Unknown provider: ${model.provider} for model: ${model.name}`);
    }
    return constructor;
  }

  getChatModel(): BaseChatModel {
    if (!ChatModelManager.chatModel) {
      throw new Error("No valid chat model available. Please check your API key settings.");
    }
    return ChatModelManager.chatModel;
  }

  setChatModel(model: CustomModel): void {
    const modelKey = `${model.name}|${model.provider}`;
    if (!ChatModelManager.modelMap.hasOwnProperty(modelKey)) {
      throw new Error(`No model found for: ${modelKey}`);
    }

    // Create and return the appropriate model
    const selectedModel: {
      hasApiKey: boolean;
      AIConstructor: ChatConstructorType;
      vendor: string;
    } = ChatModelManager.modelMap[modelKey];
    if (!selectedModel.hasApiKey) {
      const errorMessage = `API key is not provided for the model: ${modelKey}. Model switch failed.`;
      new Notice(errorMessage);
      // Stop execution and deliberate fail the model switch
      throw new Error(errorMessage);
    }

    const modelConfig: ModelConfig =
      model.provider === ChatModelProviders.AZURE_OPENAI
        ? this.getAzureModelConfig(model)
        : this.getModelConfig(model);

    // Add validation for required Azure OpenAI fields
    if (model.provider === ChatModelProviders.AZURE_OPENAI) {
      const requiredFields = [
        "azureOpenAIApiKey",
        "azureOpenAIApiInstanceName",
        "azureOpenAIApiDeploymentName",
        "azureOpenAIApiVersion",
      ];
      for (const field of requiredFields) {
        if (!modelConfig[field as keyof ModelConfig]) {
          const errorMessage = `Missing required field: ${field} for Azure OpenAI model: ${modelKey}`;
          new Notice(errorMessage);
          throw new Error(errorMessage);
        }
      }
    }

    setModelKey(`${model.name}|${model.provider}`);
    try {
      const newModelInstance: BaseChatModel = new selectedModel.AIConstructor({
        ...modelConfig,
      });
      // Set the new model
      ChatModelManager.chatModel = newModelInstance;
    } catch (error) {
      console.error(error);
      new Notice(`Error creating model: ${modelKey}`);
    }
  }

  validateChatModel(chatModel: BaseChatModel): boolean {
    return chatModel !== undefined && chatModel !== null;
  }

  async countTokens(inputStr: string): Promise<number> {
    return ChatModelManager.chatModel?.getNumTokens(inputStr) ?? 0;
  }

  private validateCurrentModel(): void {
    if (!ChatModelManager.chatModel) return;

    const currentModelKey: string = getModelKey();
    if (!currentModelKey) return;

    // Get the model configuration
    const selectedModel:
      | { hasApiKey: boolean; AIConstructor: ChatConstructorType; vendor: string }
      | undefined = ChatModelManager.modelMap[currentModelKey];

    // If API key is missing or model doesn't exist in map
    if (!selectedModel?.hasApiKey) {
      // Clear the current chat model
      ChatModelManager.chatModel = null;
      console.log("Failed to reinitialize model due to missing API key");
    }
  }

  async ping(model: CustomModel): Promise<boolean> {
    const tryPing = async (enableCors: boolean): Promise<void> => {
      const modelToTest: CustomModel = { ...model, enableCors };
      const modelConfig: ModelConfig =
        model.provider === ChatModelProviders.AZURE_OPENAI
          ? this.getAzureModelConfig(modelToTest)
          : this.getModelConfig(modelToTest);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { streaming, temperature, ...pingConfig }: ModelConfig = modelConfig;
      const testModel = new (this.getProviderConstructor(model))({ ...pingConfig });

      try {
        await testModel.invoke([{ role: "user", content: "ping" }]);
      } catch (error) {
        console.error("Ping failed:", error);
        throw error;
      }
    };

    try {
      await tryPing(model.enableCors ?? true);
      return true;
    } catch (error) {
      if (model.enableCors) {
        try {
          await tryPing(false);
          console.warn("Ping succeeded without CORS. Consider disabling CORS for this model.");
          return true;
        } catch (errorWithoutCors) {
          console.error("Ping failed without CORS:", errorWithoutCors);
          return false;
        }
      } else {
        console.error("Ping failed:", error);
        return false;
      }
    }
  }

  private findCustomModel(modelKey: string, models: CustomModel[]): CustomModel | undefined {
    return models.find((model: CustomModel) => `${model.name}|${model.provider}` === modelKey);
  }
}
