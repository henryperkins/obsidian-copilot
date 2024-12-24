// src/settings/model.ts
import { CustomModel, ModelConfig } from "../aiParams";
import { ChainType } from "../chainFactory";
import {
  BUILTIN_CHAT_MODELS,
  BUILTIN_EMBEDDING_MODELS,
  DEFAULT_OPEN_AREA,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_SETTINGS,
  VAULT_VECTOR_STORE_STRATEGY,
} from "../constants";
import { atom, createStore } from "jotai";
import { useAtomValue } from "jotai";
import { AzureDeployment } from "../types";

export interface CopilotSettings {
  plusLicenseKey: string;
  openAIApiKey: string;
  openAIOrgId: string;
  huggingfaceApiKey: string;
  cohereApiKey: string;
  anthropicApiKey: string;
  modelConfigs: Record<string, ModelConfig>;
  azureOpenAIApiKey: string;
  azureOpenAIApiInstanceName: string;
  azureOpenAIApiEmbeddingDeploymentName: string;
  azureOpenAIApiVersion: string;
  googleApiKey: string;
  openRouterAiApiKey: string;
  defaultChainType: ChainType;
  defaultModelKey: string;
  embeddingModelKey: string;
  temperature: number;
  maxTokens: number;
  contextTurns: number;
  userSystemPrompt: string;
  openAIProxyBaseUrl: string;
  openAIEmbeddingProxyBaseUrl: string;
  stream: boolean;
  defaultSaveFolder: string;
  defaultConversationTag: string;
  autosaveChat: boolean;
  defaultOpenArea: DEFAULT_OPEN_AREA;
  customPromptsFolder: string;
  indexVaultToVectorStore: VAULT_VECTOR_STORE_STRATEGY;
  qaExclusions: string;
  qaInclusions: string;
  chatNoteContextPath: string;
  chatNoteContextTags: string[];
  enableIndexSync: boolean;
  debug: boolean;
  enableEncryption: boolean;
  maxSourceChunks: number;
  groqApiKey: string;
  activeModels: Array<CustomModel>;
  activeEmbeddingModels: Array<CustomModel>;
  promptUsageTimestamps: Record<string, number>;
  embeddingRequestsPerSecond: number;
  disableIndexOnMobile: boolean;
  showSuggestedPrompts: boolean;
  numPartitions: number;
  enabledCommands: Record<string, { enabled: boolean; name: string }>;
  azureOpenAIApiDeployments: AzureDeployment[];
}

export const settingsStore = createStore();
export const settingsAtom = atom<CopilotSettings>(DEFAULT_SETTINGS);

/**
 * Sets the settings in the atom.
 */
export function setSettings(settings: Partial<CopilotSettings>): void {
  const newSettings: CopilotSettings = mergeAllActiveModelsWithCoreModels({
    ...getSettings(),
    ...settings,
  });
  settingsStore.set(settingsAtom, newSettings);
}

/**
 * Sets a single setting in the atom.
 */
export function updateSetting<K extends keyof CopilotSettings>(
  key: K,
  value: CopilotSettings[K]
): void {
  const settings: CopilotSettings = getSettings();

  if (key === "azureOpenAIApiDeployments") {
    // Add type checking with type assertion
    if (Array.isArray(value)) {
      const deployments: unknown[] = value;
      if (deployments.every((item): item is AzureDeployment => isAzureDeployment(item))) {
        setSettings({ ...settings, azureOpenAIApiDeployments: deployments });
      } else {
        console.error("Invalid Azure deployment configuration");
      }
    }
  } else if (key === "modelConfigs") {
    // Ensure deep merge for modelConfigs
    const newModelConfigs: Record<string, ModelConfig> = {
      ...settings.modelConfigs,
      ...(value as Record<string, ModelConfig>),
    };
    setSettings({ ...settings, modelConfigs: newModelConfigs });
  } else if (key === "enabledCommands") {
    // Ensure deep merge for enabledCommands
    const newEnabledCommands: Record<string, { enabled: boolean; name: string }> = {
      ...settings.enabledCommands,
      ...(value as Record<string, { enabled: boolean; name: string }>),
    };
    setSettings({ ...settings, enabledCommands: newEnabledCommands });
  } else {
    // For other keys, update as before
    setSettings({ ...settings, [key]: value });
  }
}

// Type guard remains the same
function isAzureDeployment(value: any): value is AzureDeployment {
  return (
    typeof value === "object" &&
    typeof value.modelKey === "string" &&
    typeof value.modelFamily === "string" &&
    typeof value.deploymentName === "string" &&
    typeof value.instanceName === "string" &&
    typeof value.apiVersion === "string" &&
    typeof value.apiKey === "string"
  );
}

/**
 * Gets the settings from the atom. Use this if you don't need to subscribe to
 * changes.
 */
export function getSettings(): Readonly<CopilotSettings> {
  return settingsStore.get(settingsAtom);
}

/**
 * Resets the settings to the default values.
 */
export function resetSettings(): void {
  const defaultSettingsWithBuiltIns: CopilotSettings = {
    ...DEFAULT_SETTINGS,
    activeModels: BUILTIN_CHAT_MODELS.map((model: CustomModel) => ({ ...model, enabled: true })),
    activeEmbeddingModels: BUILTIN_EMBEDDING_MODELS.map((model: CustomModel) => ({
      ...model,
      enabled: true,
    })),
  };
  setSettings(defaultSettingsWithBuiltIns);
}

/**
 * Subscribes to changes in the settings atom.
 */
export function subscribeToSettingsChange(callback: () => void): () => void {
  return settingsStore.sub(settingsAtom, callback);
}

/**
 * Hook to get the settings value from the atom.
 */
export function useSettingsValue(): Readonly<CopilotSettings> {
  return useAtomValue(settingsAtom, {
    store: settingsStore,
  });
}

/**
 * Sanitizes the settings to ensure they are valid.
 * Note: This will be better handled by Zod in the future.
 */
export function sanitizeSettings(settings: CopilotSettings): CopilotSettings {
  // If settings is null/undefined, use DEFAULT_SETTINGS
  const settingsToSanitize: CopilotSettings = settings || DEFAULT_SETTINGS;
  const sanitizedSettings: CopilotSettings = { ...settingsToSanitize };

  // Stuff in settings are string even when the interface has number type!
  const temperature = Number(settingsToSanitize.temperature);
  sanitizedSettings.temperature = isNaN(temperature) ? DEFAULT_SETTINGS.temperature : temperature;

  const maxTokens = Number(settingsToSanitize.maxTokens);
  sanitizedSettings.maxTokens = isNaN(maxTokens) ? DEFAULT_SETTINGS.maxTokens : maxTokens;

  const contextTurns = Number(settingsToSanitize.contextTurns);
  sanitizedSettings.contextTurns = isNaN(contextTurns)
    ? DEFAULT_SETTINGS.contextTurns
    : contextTurns;

  // Sanitize Azure deployments
  sanitizedSettings.azureOpenAIApiDeployments = (
    settingsToSanitize.azureOpenAIApiDeployments || []
  ).filter((deployment: AzureDeployment): deployment is AzureDeployment =>
    Boolean(deployment.modelKey && deployment.deploymentName && deployment.apiKey)
  );

  return sanitizedSettings;
}

export function getSystemPrompt(): string {
  const userPrompt: string = getSettings().userSystemPrompt;
  return userPrompt ? `${DEFAULT_SYSTEM_PROMPT}\n\n${userPrompt}` : DEFAULT_SYSTEM_PROMPT;
}

function mergeAllActiveModelsWithCoreModels(settings: CopilotSettings): CopilotSettings {
  settings.activeModels = mergeActiveModels(
    settings.activeModels,
    BUILTIN_CHAT_MODELS,
    settings.modelConfigs
  );
  settings.activeEmbeddingModels = mergeActiveModels(
    settings.activeEmbeddingModels,
    BUILTIN_EMBEDDING_MODELS,
    settings.modelConfigs
  );
  return settings;
}

function mergeActiveModels(
  existingActiveModels: CustomModel[],
  builtInModels: CustomModel[],
  modelConfigs: Record<string, ModelConfig>
): CustomModel[] {
  const modelMap: Map<string, CustomModel> = new Map<string, CustomModel>();

  // Create a unique key for each model, it's model (name + provider)
  const getModelKey = (model: CustomModel): string => `${model.name}|${model.provider}`;

  // Add or update existing models in the map, prioritizing custom settings
  existingActiveModels.forEach((model: CustomModel) => {
    const key: string = getModelKey(model);
    modelMap.set(key, {
      ...builtInModels.find((m: CustomModel) => getModelKey(m) === key), // Default to built-in model settings
      ...model, // Override with existing custom model settings
      ...modelConfigs[key], // Override with custom model config
    });
  });

  // Add core models to the map, only if they don't already exist
  builtInModels.forEach((model: CustomModel) => {
    const modelKey: string = getModelKey(model);
    if (!modelMap.has(modelKey)) {
      modelMap.set(modelKey, { ...model, core: true });
    }
  });

  return Array.from(modelMap.values());
}
