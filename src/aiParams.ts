import { ChainType } from "@/chainFactory";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatModelProviders } from "@/constants";
import { atom, useAtom } from "jotai";
import { settingsAtom, settingsStore } from "@/settings/model";
import { O1_PREVIEW } from "@/constants";

const userModelKeyAtom = atom<string | null>(null);
const modelKeyAtom = atom(
  (get) => {
    const userValue = get(userModelKeyAtom);
    if (userValue !== null) {
      return userValue;
    }
    return get(settingsAtom).defaultModelKey;
  },
  (get, set, newValue) => {
    set(userModelKeyAtom, newValue);
  }
);

const userChainTypeAtom = atom<ChainType | null>(null);
const chainTypeAtom = atom(
  (get) => {
    const userValue = get(userChainTypeAtom);
    if (userValue !== null) {
      return userValue;
    }
    return get(settingsAtom).defaultChainType;
  },
  (get, set, newValue) => {
    set(userChainTypeAtom, newValue);
  }
);

export interface ModelConfig {
  modelName: string;
  temperature: number;
  stream: boolean;
  maxRetries: number;
  maxConcurrency: number;
  maxTokens?: number;
  maxCompletionTokens?: number; // Added for o1-preview models
  openAIApiKey?: string;
  openAIOrgId?: string;
  anthropicApiKey?: string;
  cohereApiKey?: string;
  azureOpenAIApiKey?: string;
  azureOpenAIApiInstanceName?: string;
  azureOpenAIApiDeploymentName?: string;
  azureOpenAIApiVersion?: string; // Added for o1-preview models
  // Google and TogetherAI API key share this property
  apiKey?: string;
  openAIProxyBaseUrl?: string;
  groqApiKey?: string;
  enableCors?: boolean;
  isO1PreviewModel?: boolean; // Added to identify o1-preview models
  isO1Preview?: boolean;
}

export interface SetChainOptions {
  prompt?: ChatPromptTemplate;
  chatModel?: BaseChatModel;
  noteFile?: any;
  abortController?: AbortController;
  refreshIndex?: boolean;
}

export interface CustomModel {
  name: string;
  modelName: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
  isEmbeddingModel?: boolean;
  isBuiltIn?: boolean;
  enableCors?: boolean;
  core?: boolean;
  stream?: boolean;
  temperature?: number;
  context?: number;
  // OpenAI specific fields
  openAIOrgId?: string;

  // Azure OpenAI specific fields
  azureOpenAIApiInstanceName?: string;
  azureOpenAIApiDeploymentName?: string;
  azureOpenAIApiVersion?: string;
  azureOpenAIApiEmbeddingDeploymentName?: string;
  isO1Preview?: boolean;
}

export function setModelKey(modelKey: string) {
  settingsStore.set(modelKeyAtom, modelKey);
}

export function getModelKey(): string {
  return settingsStore.get(modelKeyAtom);
}

export function subscribeToModelKeyChange(callback: () => void): () => void {
  return settingsStore.sub(modelKeyAtom, callback);
}

export function useModelKey() {
  return useAtom(modelKeyAtom, {
    store: settingsStore,
  });
}

export function getChainType(): ChainType {
  return settingsStore.get(chainTypeAtom);
}

export function setChainType(chainType: ChainType) {
  settingsStore.set(chainTypeAtom, chainType);
}

export function subscribeToChainTypeChange(callback: () => void): () => void {
  return settingsStore.sub(chainTypeAtom, callback);
}

export function useChainType() {
  return useAtom(chainTypeAtom, {
    store: settingsStore,
  });
}

// Export utility functions
export function isO1PreviewModel(modelName: string): boolean {
  return modelName.includes("azure-openai/models/o1-preview");
}

export function validateO1PreviewModel(model: CustomModel): void {
  if (model.provider !== ChatModelProviders.AZURE_OPENAI) return; // Only proceed if provider is Azure OpenAI
  if (!isO1PreviewModel(model.modelName)) return;

  if (model.name !== O1_PREVIEW.MODEL_ID) {
    throw new Error(`Invalid O1-preview model ID. Expected: ${O1_PREVIEW.MODEL_ID}`);
  }

  // Validate required Azure OpenAI settings
  if (!model.azureOpenAIApiVersion) {
    throw new Error("Azure OpenAI API version is required for o1-preview models");
  }

  // Force O1-preview settings
  model.stream = false; // Streaming must be disabled for o1-preview
  model.isO1Preview = true;
}
