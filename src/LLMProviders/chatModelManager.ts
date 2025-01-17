import { CustomModel, isO1PreviewModel, getModelKey, ModelConfig, setModelKey } from "@/aiParams";
import { BUILTIN_CHAT_MODELS, ChatModelProviders } from "@/constants";
import { getDecryptedKey } from "@/encryptionService";
import { getModelKeyFromModel, getSettings, subscribeToSettingsChange } from "@/settings/model";
import { err2String, safeFetch } from "@/utils";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatCohere } from "@langchain/cohere";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { Notice } from "obsidian";

type ChatConstructorType = new (config: any) => BaseChatModel;

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

export default class ChatModelManager {
  private static instance: ChatModelManager;
  private chatModel: BaseChatModel | null = null;
  private modelMap: Record<
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

  private async getModelConfig(customModel: CustomModel): Promise<ModelConfig> {
    const settings = getSettings();
    const isO1Preview = isO1PreviewModel(customModel.modelName);

    if (isO1Preview && customModel.provider === ChatModelProviders.AZURE_OPENAI) {
      await this.validateO1PreviewModel(customModel);
    }

    const baseConfig: ModelConfig = {
      modelName: customModel.modelName,
      temperature: isO1Preview ? 1 : (customModel.temperature ?? settings.temperature),
      stream: isO1Preview ? false : (customModel.stream ?? settings.stream ?? true),
      maxRetries: 3,
      maxConcurrency: 3,
      ...(isO1Preview
        ? {
            maxCompletionTokens: settings.maxTokens,
          }
        : {}),
    };

    const providerConfig: {
      [K in ChatModelProviders]?: any;
    } = {
      [ChatModelProviders.OPENAI]: {
        openAIApiKey: await getDecryptedKey(customModel.apiKey || settings.openAIApiKey),
        openAIOrgId: await getDecryptedKey(customModel.openAIOrgId || settings.openAIOrgId),
        configuration: {
          baseURL: customModel.baseUrl,
          fetch: customModel.enableCors ? safeFetch : undefined,
        },
      },
      [ChatModelProviders.AZURE_OPENAI]: {
        azureOpenAIApiKey: await getDecryptedKey(customModel.apiKey || settings.azureOpenAIApiKey),
        azureOpenAIApiInstanceName:
          customModel.azureOpenAIApiInstanceName || settings.azureOpenAIApiInstanceName,
        azureOpenAIApiDeploymentName:
          customModel.azureOpenAIApiDeploymentName || settings.azureOpenAIApiDeploymentName,
        azureOpenAIApiVersion: customModel.azureOpenAIApiVersion || settings.azureOpenAIApiVersion,
        configuration: {
          baseURL: customModel.baseUrl,
          fetch: customModel.enableCors ? safeFetch : undefined,
        },
        streaming: false, // Force streaming off for Azure OpenAI
      },
      [ChatModelProviders.ANTHROPIC]: {
        anthropicApiKey: await getDecryptedKey(customModel.apiKey || settings.anthropicApiKey),
        modelName: customModel.modelName,
        anthropicApiUrl: customModel.baseUrl,
        clientOptions: {
          defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" },
          fetch: customModel.enableCors ? safeFetch : undefined,
        },
        streaming: customModel.stream ?? true,
      },
      [ChatModelProviders.COHEREAI]: {
        apiKey: await getDecryptedKey(customModel.apiKey || settings.cohereApiKey),
        model: customModel.modelName,
        streaming: customModel.stream ?? true,
      },
      [ChatModelProviders.GOOGLE]: {
        apiKey: await getDecryptedKey(customModel.apiKey || settings.googleApiKey),
        modelName: customModel.modelName,
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
        streaming: customModel.stream ?? true,
      },
      [ChatModelProviders.OPENROUTERAI]: {
        openAIApiKey: await getDecryptedKey(customModel.apiKey || settings.openRouterAiApiKey),
        configuration: {
          baseURL: customModel.baseUrl || "https://openrouter.ai/api/v1",
          fetch: customModel.enableCors ? safeFetch : undefined,
        },
        streaming: customModel.stream ?? true,
      },
      [ChatModelProviders.GROQ]: {
        apiKey: await getDecryptedKey(customModel.apiKey || settings.groqApiKey),
        modelName: customModel.modelName,
        streaming: customModel.stream ?? true,
      },
      [ChatModelProviders.OLLAMA]: {
        model: customModel.modelName,
        apiKey: customModel.apiKey || "default-key",
        baseUrl: customModel.baseUrl || "http://localhost:11434",
        streaming: customModel.stream ?? true,
      },
      [ChatModelProviders.LM_STUDIO]: {
        modelName: customModel.modelName,
        openAIApiKey: customModel.apiKey || "default-key",
        configuration: {
          baseURL: customModel.baseUrl || "http://localhost:1234/v1",
          fetch: customModel.enableCors ? safeFetch : undefined,
        },
        streaming: customModel.stream ?? true,
      },
      [ChatModelProviders.OPENAI_FORMAT]: {
        openAIApiKey: await getDecryptedKey(customModel.apiKey || settings.openAIApiKey),
        configuration: {
          baseURL: customModel.baseUrl,
          fetch: customModel.enableCors ? safeFetch : undefined,
          dangerouslyAllowBrowser: true,
        },
        streaming: customModel.stream ?? true,
      },
    };

    const selectedProviderConfig = providerConfig[customModel.provider as ChatModelProviders] || {};
    return { ...baseConfig, ...selectedProviderConfig };
  }

  private buildModelMap() {
    const activeModels = getSettings().activeModels;
    this.modelMap = {};
    const modelMap = this.modelMap;

    const allModels = activeModels ?? BUILTIN_CHAT_MODELS;

    allModels.forEach((model) => {
      if (model.enabled) {
        if (!Object.values(ChatModelProviders).includes(model.provider as ChatModelProviders)) {
          console.warn(`Unknown provider: ${model.provider} for model: ${model.name}`);
          return;
        }

        const constructor = this.getProviderConstructor(model);
        const getDefaultApiKey = this.providerApiKeyMap[model.provider as ChatModelProviders];

        const apiKey = model.apiKey || getDefaultApiKey();
        const modelKey = getModelKeyFromModel(model);
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
    if (!this.chatModel) {
      throw new Error("No valid chat model available. Please check your API key settings.");
    }
    return this.chatModel;
  }

  async setChatModel(model: CustomModel): Promise<void> {
    const modelKey = getModelKeyFromModel(model);
    if (!this.modelMap.hasOwnProperty(modelKey)) {
      throw new Error(`No model found for: ${modelKey}`);
    }

    // Create and return the appropriate model
    const selectedModel = this.modelMap[modelKey];
    if (!selectedModel.hasApiKey) {
      const errorMessage = `API key is not provided for the model: ${modelKey}. Model switch failed.`;
      new Notice(errorMessage);
      // Stop execution and deliberately fail the model switch
      throw new Error(errorMessage);
    }

    const modelConfig = await this.getModelConfig(model);

    const isO1Preview = isO1PreviewModel(model.modelName);

    if (!isO1Preview) {
      // Validate API key and model configuration by pinging the model
      try {
        await this.ping(model);
      } catch (error) {
        const errorMessage = `Failed to initialize model: ${modelKey}. ${error.message}`;
        new Notice(errorMessage);
        // Reset chatModel to null
        this.chatModel = null;
        // Stop execution and deliberately fail the model switch
        throw new Error(errorMessage);
      }
    }

    setModelKey(modelKey);
    try {
      const { stream, ...configWithoutStream } = modelConfig;
      const newModelInstance = new selectedModel.AIConstructor({
        ...configWithoutStream,
        streaming: stream,
      });
      // Set the new model
      this.chatModel = newModelInstance;
    } catch (error) {
      console.error(error);
      new Notice(`Error creating model: ${modelKey}`);
      // Reset chatModel to null
      this.chatModel = null;
      // Rethrow the error to be handled upstream
      throw error;
    }
  }

  validateChatModel(chatModel: BaseChatModel): boolean {
    if (chatModel === undefined || chatModel === null) {
      return false;
    }
    return true;
  }

  async countTokens(inputStr: string): Promise<number> {
    return this.chatModel?.getNumTokens(inputStr) ?? 0;
  }

  private validateCurrentModel(): void {
    if (!this.chatModel) return;

    const currentModelKey = getModelKey();
    if (!currentModelKey) return;

    // Get the model configuration
    const selectedModel = this.modelMap[currentModelKey];

    // If API key is missing or model doesn't exist in map
    if (!selectedModel?.hasApiKey) {
      // Clear the current chat model
      this.chatModel = null;
      console.log("Failed to reinitialize model due to missing API key");
    }
  }

  async validateO1PreviewModel(customModel: CustomModel): Promise<void> {
    if (
      customModel.provider !== ChatModelProviders.AZURE_OPENAI ||
      !isO1PreviewModel(customModel.modelName)
    ) {
      return;
    }

    const settings = getSettings();
    const apiKey = customModel.apiKey || settings.azureOpenAIApiKey;
    const instanceName =
      customModel.azureOpenAIApiInstanceName || settings.azureOpenAIApiInstanceName;
    const deploymentName =
      customModel.azureOpenAIApiDeploymentName || settings.azureOpenAIApiDeploymentName;
    const apiVersion = customModel.azureOpenAIApiVersion || settings.azureOpenAIApiVersion;

    if (!apiKey || !instanceName || !deploymentName || !apiVersion) {
      throw new Error(
        "Azure OpenAI API key, instance name, deployment name, and API version are required. Please check your settings."
      );
    }

    // Ensure the API version is properly set
    customModel.azureOpenAIApiVersion = apiVersion;
  }

  async ping(model: CustomModel): Promise<boolean> {
    const tryPing = async (enableCors: boolean) => {
      const modelToTest = { ...model, enableCors };
      const isO1Preview = isO1PreviewModel(modelToTest.modelName);

      // Skip ping for o1-preview models
      if (modelToTest.provider === ChatModelProviders.AZURE_OPENAI && isO1Preview) {
        return;
      }

      const modelConfig = await this.getModelConfig(modelToTest);

      // Remove unnecessary config for ping test
      const pingConfig = { ...modelConfig };

      // Set appropriate token limit based on model type
      if (isO1Preview) {
        pingConfig.maxCompletionTokens = 10;
        delete pingConfig.maxTokens;
      } else {
        pingConfig.maxTokens = 10;
        delete pingConfig.maxCompletionTokens;
      }

      const testModel = new (this.getProviderConstructor(modelToTest))(pingConfig);
      await testModel.invoke([{ role: "user", content: "hello" }], {
        timeout: 3000,
      });
    };

    try {
      // First try without CORS
      await tryPing(false);
      return true;
    } catch (firstError) {
      console.log("First ping attempt failed, trying with CORS...");
      try {
        // Second try with CORS
        await tryPing(true);
        new Notice(
          "Connection successful, but requires CORS to be enabled. Please enable CORS for this model once you add it above."
        );
        return true;
      } catch (error) {
        const msg =
          "\nwithout CORS Error: " +
          err2String(firstError) +
          "\nwith CORS Error: " +
          err2String(error);
        throw new Error(msg);
      }
    }
  }
}
