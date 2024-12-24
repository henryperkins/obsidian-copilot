import {
  ChainRunner,
  CopilotPlusChainRunner,
  LLMChainRunner,
  VaultQAChainRunner,
} from "./chainRunner";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { App, Notice } from "obsidian";
import { BrevilabsClient } from "./brevilabsClient";
import ChatModelManager from "./chatModelManager";
import EmbeddingsManager from "./embeddingManager";
import PromptManager from "./promptManager";
import {
  getChainType,
  getModelKey,
  SetChainOptions,
  setChainType,
  subscribeToChainTypeChange,
  subscribeToModelKeyChange,
  CustomModel,
} from "../aiParams";
import ChainFactory, { ChainType, Document } from "../chainFactory";
import {
  AI_SENDER,
  BUILTIN_CHAT_MODELS,
  USER_SENDER,
  VAULT_VECTOR_STORE_STRATEGY,
} from "../constants";
import { HybridRetriever } from "../search/hybridRetriever";
import VectorStoreManager from "../search/vectorStoreManager";
import {
  getSettings,
  getSystemPrompt,
  subscribeToSettingsChange,
  AzureDeployment,
  CopilotSettings,
} from "../settings/model";
import { ChatMessage } from "../sharedState";
import { findCustomModel, formatDateTime } from "../utils";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import MemoryManager from "./memoryManager";

export default class ChainManager {
  private static chain: RunnableSequence;
  private static retrievalChain: RunnableSequence;

  public app: App;
  public vectorStoreManager: VectorStoreManager;
  public chatModelManager: ChatModelManager;
  public memoryManager: MemoryManager;
  public embeddingsManager: EmbeddingsManager;
  public promptManager: PromptManager;
  public brevilabsClient: BrevilabsClient;
  public static retrievedDocuments: Document[] = [];

  constructor(app: App, vectorStoreManager: VectorStoreManager, brevilabsClient: BrevilabsClient) {
    // Instantiate singletons
    this.app = app;
    this.vectorStoreManager = vectorStoreManager;
    this.memoryManager = MemoryManager.getInstance();
    this.chatModelManager = ChatModelManager.getInstance();
    this.embeddingsManager = EmbeddingsManager.getInstance();
    this.promptManager = PromptManager.getInstance();
    this.brevilabsClient = brevilabsClient;
    this.createChainWithNewModel();
    subscribeToModelKeyChange(() => this.createChainWithNewModel());
    subscribeToChainTypeChange(() =>
      this.setChain(getChainType(), {
        refreshIndex:
          getSettings().indexVaultToVectorStore === VAULT_VECTOR_STORE_STRATEGY.ON_MODE_SWITCH &&
          (getChainType() === ChainType.VAULT_QA_CHAIN ||
            getChainType() === ChainType.COPILOT_PLUS_CHAIN),
      })
    );
    subscribeToSettingsChange(() => this.createChainWithNewModel());
  }

  static getChain(): RunnableSequence {
    return ChainManager.chain;
  }

  static getRetrievalChain(): RunnableSequence {
    return ChainManager.retrievalChain;
  }

  private validateChainType(chainType: ChainType): void {
    if (chainType === undefined || chainType === null) throw new Error("No chain type set");
  }

  private validateChatModel(): void {
    if (!this.chatModelManager.validateChatModel(this.chatModelManager.getChatModel())) {
      const errorMsg =
        "Chat model is not initialized properly, check your API key in Copilot setting and make sure you have API access.";
      new Notice(errorMsg);
      throw new Error(errorMsg);
    }
  }

  private validateChainInitialization(): void {
    if (!ChainManager.chain || !isSupportedChain(ChainManager.chain)) {
      console.error("Chain is not initialized properly, re-initializing chain: ", getChainType());
      this.setChain(getChainType());
    }
  }

  static storeRetrieverDocuments(documents: Document[]): void {
    ChainManager.retrievedDocuments = documents;
  }

  /**
   * Update the active model and create a new chain with the specified model
   * name.
   */
  createChainWithNewModel(): void {
    let newModelKey = getModelKey();
    try {
      let customModel: CustomModel | undefined = findCustomModel(
        newModelKey,
        getSettings().activeModels
      );
      if (!customModel) {
        console.error(
          "Resetting to default model. No model configuration found for: ",
          newModelKey
        );
        customModel = BUILTIN_CHAT_MODELS[0];
        newModelKey = customModel.name + "|" + customModel.provider;
      }
      if (customModel.provider === "azure openai") {
        const settings: CopilotSettings = getSettings();
        const azureDeployments: AzureDeployment[] = settings.azureOpenAIApiDeployments || [];
        const deployment: AzureDeployment | undefined = azureDeployments.find(
          (d: AzureDeployment) => d.modelKey === newModelKey
        );
        if (deployment) {
          customModel.apiKey = deployment.apiKey;
          customModel.azureOpenAIApiInstanceName = deployment.instanceName;
          customModel.azureOpenAIApiDeploymentName = deployment.deploymentName;
          customModel.azureOpenAIApiVersion = deployment.apiVersion;
        }
      }
      this.chatModelManager.setChatModel(customModel);
      // Must update the chatModel for chain because ChainFactory always
      // retrieves the old chain without the chatModel change if it exists!
      // Create a new chain with the new chatModel
      this.setChain(getChainType(), {
        prompt: this.getEffectivePrompt(customModel),
      });
      console.log(`Model successfully set to ${newModelKey}`);
    } catch (error) {
      console.error("createChainWithNewModel failed:", error);
      console.log("modelKey:", newModelKey);
    }
  }

  private getEffectivePrompt(customModel: CustomModel): ChatPromptTemplate {
    const modelName: string = customModel.name;
    const isO1PreviewModel: boolean = modelName === "o1-preview";

    const effectivePrompt: ChatPromptTemplate = ChatPromptTemplate.fromMessages([
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    if (!isO1PreviewModel) {
      effectivePrompt = ChatPromptTemplate.fromMessages([
        [AI_SENDER, getSystemPrompt() || ""],
        effectivePrompt,
      ]);
    }

    return effectivePrompt;
  }

  async setChain(chainType: ChainType, options: SetChainOptions = {}): Promise<void> {
    if (!this.chatModelManager.validateChatModel(this.chatModelManager.getChatModel())) {
      console.error("setChain failed: No chat model set.");
      return;
    }

    this.validateChainType(chainType);

    // Get chatModel, memory, prompt, and embeddingAPI from respective managers
    const chatModel: BaseChatModel = this.chatModelManager.getChatModel();
    const memory: MemoryManager = this.memoryManager.getMemory();
    const chatPrompt: ChatPromptTemplate = this.promptManager.getChatPrompt();

    switch (chainType) {
      case ChainType.LLM_CHAIN: {
        ChainManager.chain = ChainFactory.createNewLLMChain({
          llm: chatModel,
          memory: memory,
          prompt: options.prompt || chatPrompt,
          abortController: options.abortController,
        }) as RunnableSequence;

        setChainType(ChainType.LLM_CHAIN);
        break;
      }

      case ChainType.VAULT_QA_CHAIN: {
        const { embeddingsAPI } = await this.initializeQAChain(options);

        const retriever: HybridRetriever = new HybridRetriever(
          this.vectorStoreManager.dbOps,
          this.app.vault,
          chatModel,
          embeddingsAPI,
          this.brevilabsClient,
          {
            minSimilarityScore: 0.01,
            maxK: getSettings().maxSourceChunks,
            salientTerms: [],
          },
          getSettings().debug
        );

        // Create new conversational retrieval chain
        ChainManager.retrievalChain = ChainFactory.createConversationalRetrievalChain(
          {
            llm: chatModel,
            retriever: retriever,
            systemMessage: getSystemPrompt(),
          },
          ChainManager.storeRetrieverDocuments.bind(ChainManager),
          getSettings().debug
        );

        setChainType(ChainType.VAULT_QA_CHAIN);
        if (getSettings().debug) {
          console.log("New Vault QA chain with hybrid retriever created for entire vault");
          console.log("Set chain:", ChainType.VAULT_QA_CHAIN);
        }
        break;
      }

      case ChainType.COPILOT_PLUS_CHAIN: {
        // For initial load of the plugin
        await this.initializeQAChain(options);
        ChainManager.chain = ChainFactory.createNewLLMChain({
          llm: chatModel,
          memory: memory,
          prompt: options.prompt || chatPrompt,
          abortController: options.abortController,
        }) as RunnableSequence;

        setChainType(ChainType.COPILOT_PLUS_CHAIN);
        break;
      }

      default:
        this.validateChainType(chainType);
        break;
    }
  }

  private getChainRunner(): ChainRunner {
    const chainType: ChainType = getChainType();
    switch (chainType) {
      case ChainType.LLM_CHAIN:
        return new LLMChainRunner(this);
      case ChainType.VAULT_QA_CHAIN:
        return new VaultQAChainRunner(this);
      case ChainType.COPILOT_PLUS_CHAIN:
        return new CopilotPlusChainRunner(this);
      default:
        throw new Error(`Unsupported chain type: ${chainType}`);
    }
  }

  private async initializeQAChain(
    options: SetChainOptions
  ): Promise<{ embeddingsAPI: any; db: any }> {
    const embeddingsAPI: any = this.embeddingsManager.getEmbeddingsAPI();
    if (!embeddingsAPI) {
      throw new Error("Error getting embeddings API. Please check your settings.");
    }

    const db: any = await this.vectorStoreManager.getOrInitializeDb(embeddingsAPI);

    // Handle index refresh if needed
    if (options.refreshIndex) {
      await this.vectorStoreManager.indexVaultToVectorStore();
    }

    return { embeddingsAPI, db };
  }

  async runChain(
    userMessage: ChatMessage,
    abortController: AbortController,
    updateCurrentAiMessage: (message: string) => void,
    addMessage: (message: ChatMessage) => void,
    options: {
      debug?: boolean;
      ignoreSystemMessage?: boolean;
      updateLoading?: (loading: boolean) => void;
    } = {}
  ): Promise<string> {
    const { debug = false, ignoreSystemMessage = false } = options;

    if (debug) console.log("==== Step 0: Initial user message ====\n", userMessage);

    this.validateChatModel();
    this.validateChainInitialization();

    const chatModel: BaseChatModel = this.chatModelManager.getChatModel();
    const modelName: string = (chatModel as any).modelName || (chatModel as any).model || "";
    const isO1PreviewModel: boolean = modelName === "o1-preview";

    // Handle ignoreSystemMessage
    if (ignoreSystemMessage || isO1PreviewModel) {
      const effectivePrompt: ChatPromptTemplate = ChatPromptTemplate.fromMessages([
        new MessagesPlaceholder("history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]);

      this.setChain(getChainType(), {
        prompt: effectivePrompt,
      });
    }

    const chainRunner: ChainRunner = this.getChainRunner();
    try {
      return await chainRunner.run(
        userMessage,
        abortController,
        updateCurrentAiMessage,
        addMessage,
        options
      );
    } catch (error) {
      if (isO1PreviewModel) {
        console.error("Error in o1-preview model execution:", error);
        if (error instanceof Error && error.message.includes("system message")) {
          addMessage({
            message: "Error: o1-preview models do not support system messages.",
            sender: AI_SENDER,
            isVisible: true,
            timestamp: formatDateTime(new Date()),
          });
        } else {
          addMessage({
            message: `Error in o1-preview model: ${error instanceof Error ? error.message : String(error)}`,
            sender: AI_SENDER,
            isVisible: true,
            timestamp: formatDateTime(new Date()),
          });
        }
      } else {
        throw error;
      }
    }
  }

  async updateMemoryWithLoadedMessages(messages: ChatMessage[]): Promise<void> {
    await this.memoryManager.clearChatMemory();
    for (let i = 0; i < messages.length; i += 2) {
      const userMsg: ChatMessage | undefined = messages[i];
      const aiMsg: ChatMessage | undefined = messages[i + 1];
      if (userMsg && aiMsg && userMsg.sender === USER_SENDER) {
        await this.memoryManager
          .getMemory()
          .saveContext({ input: userMsg.message }, { output: aiMsg.message });
      }
    }
  }
}

function isSupportedChain(chain: RunnableSequence): boolean {
  // Implementation of this function is not provided in the original code
  // You should implement it based on your specific requirements
  return true; // Placeholder implementation
}
