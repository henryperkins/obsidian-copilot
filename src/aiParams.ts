import { ChainType } from "./chainFactory";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { CopilotSettings } from "./settings/model";
import { atom, useAtom } from "jotai";
import { getSettings, settingsAtom, settingsStore, updateSetting } from "./settings/model";
import { ModelConfig } from "./types";
export { ModelConfig };

const userModelKeyAtom = atom<string | null>(null);
const modelKeyAtom = atom(
  (get) => {
    const userValue = get(userModelKeyAtom);
    if (userValue !== null) {
      return userValue;
    }
    return (get(settingsAtom) as CopilotSettings).defaultModelKey;
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
    return (get(settingsAtom) as CopilotSettings).defaultChainType;
  },
  (get, set, newValue) => {
    set(userChainTypeAtom, newValue);
  }
);

export interface SetChainOptions {
  prompt?: ChatPromptTemplate;
  chatModel?: BaseChatModel;
  noteFile?: any;
  abortController?: AbortController;
  refreshIndex?: boolean;
}

export interface CustomModel {
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
  isEmbeddingModel?: boolean;
  isBuiltIn?: boolean;
  enableCors?: boolean;
  core?: boolean;
  azureOpenAIApiDeploymentName?: string;
  azureOpenAIApiInstanceName?: string;
  azureOpenAIApiVersion?: string;
}

export function setModelKey(modelKey: string): void {
  settingsStore.set(modelKeyAtom, modelKey);
}

export function getModelKey(): string {
  return settingsStore.get(modelKeyAtom);
}

export function subscribeToModelKeyChange(callback: () => void): () => void {
  return settingsStore.sub(modelKeyAtom, callback);
}

export function useModelKey(): [string | null, (newValue: string) => void] {
  return useAtom(modelKeyAtom, {
    store: settingsStore,
  });
}

export function getChainType(): ChainType {
  return settingsStore.get(chainTypeAtom);
}

export function setChainType(chainType: ChainType): void {
  settingsStore.set(chainTypeAtom, chainType);
}

export function subscribeToChainTypeChange(callback: () => void): () => void {
  return settingsStore.sub(chainTypeAtom, callback);
}

export function useChainType(): [ChainType | null, (newValue: ChainType) => void] {
  return useAtom(chainTypeAtom, {
    store: settingsStore,
  });
}

export function updateModelConfig(modelKey: string, config: Partial<ModelConfig>): void {
  const settings = getSettings();
  const updatedModelConfigs = {
    ...settings.modelConfigs,
    [modelKey]: {
      ...(settings.modelConfigs[modelKey] || {}), // in case current model config does not exist
      ...config,
    },
  };
  updateSetting("modelConfigs", updatedModelConfigs);
}

export function findCustomModel(modelKey: string, models: CustomModel[]): CustomModel | undefined {
  return models.find((model: CustomModel) => `${model.name}|${model.provider}` === modelKey);
}
