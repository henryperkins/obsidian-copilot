import { Plugin, App } from "obsidian";
import ChainManager from "@/LLMProviders/chainManager";
import { BrevilabsClient } from "@/LLMProviders/brevilabsClient";
import VectorStoreManager from "@/search/vectorStoreManager";
import { FileParserManager } from "@/tools/FileParserManager";
import SharedState from "@/sharedState";
import fetch from "node-fetch";

// Define fetch type to match OpenAI's requirements
export type CustomFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface Configuration {
  baseURL?: string;
  fetch?: CustomFetch;
  dangerouslyAllowBrowser?: boolean;
}

export interface ModelConfig {
  modelName: string;
  temperature: number;
  streaming: boolean;
  maxRetries: number;
  maxConcurrency: number;
  enableCors?: boolean;
  azureOpenAIApiDeploymentName?: string;
  azureOpenAIApiInstanceName?: string;
  azureOpenAIApiVersion?: string;
  azureOpenAIApiKey?: string;
  maxCompletionTokens?: number;
  reasoningEffort?: number;
  maxTokens?: number;
  extraParams?: Record<string, any>;
  configuration?: Configuration;
}

export interface CopilotPlugin extends Plugin {
  app: App;
  chainManager: ChainManager;
  brevilabsClient: BrevilabsClient;
  vectorStoreManager: VectorStoreManager;
  fileParserManager: FileParserManager;
  sharedState: SharedState;
  userMessageHistory: string[];
  settingsUnsubscriber?: () => void;
}

export interface AzureDeployment {
  modelKey: string;
  modelFamily: string;
  deploymentName: string;
  instanceName: string;
  apiVersion: string;
  apiKey: string;
  specialSettings?: {
    maxCompletionTokens?: number;
    reasoningEffort?: number;
  };
}

export enum ChatModels {
  GPT_4o = "gpt-4o",
  GPT_4o_mini = "gpt-4o-mini",
  GPT_4_TURBO = "gpt-4-turbo",
  GEMINI_PRO = "gemini-1.5-pro",
  GEMINI_FLASH = "gemini-1.5-flash",
  AZURE_OPENAI = "azure-openai",
  CLAUDE_3_5_SONNET = "claude-3-5-sonnet-latest",
  CLAUDE_3_5_HAIKU = "claude-3-5-haiku-latest",
  COMMAND_R = "command-r",
  COMMAND_R_PLUS = "command-r-plus",
}

// Helper function for type assertion
export const asFetch = (fn: CustomFetch): typeof fetch => fn as unknown as typeof fetch;
