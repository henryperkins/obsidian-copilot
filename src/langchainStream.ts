// Import statements
import { AI_SENDER } from "@/constants";
import ChainManager from "@/LLMProviders/chainManager";
import { ChatMessage } from "@/sharedState";
import { formatDateTime } from "./utils";
import { getModelKey } from "./aiParams";

// Type definitions
export type Role = "assistant" | "user" | "system";

// Function to get AI response
export const getAIResponse = async (
  userMessage: ChatMessage,
  chainManager: ChainManager,
  addMessage: (message: ChatMessage) => void,
  updateCurrentAiMessage: (message: string) => void,
  updateShouldAbort: (abortController: AbortController | null) => void,
  options: {
    debug?: boolean;
    ignoreSystemMessage?: boolean;
    updateLoading?: (loading: boolean) => void;
    updateLoadingMessage?: (message: string) => void;
    selectedText?: string;
  } = {}
) => {
  const { selectedText } = options;
  const abortController = new AbortController();
  updateShouldAbort(abortController);
  try {
    const chatModel = chainManager.chatModelManager.getChatModel();
    const modelConfig = chainManager.chatModelManager.getChatModelConfiguration(getModelKey());
    const memory = chainManager.memoryManager.getMemory();
    const memoryVariables = await memory.loadMemoryVariables({ selectedText });

    const modelName = (chatModel as any).modelName || (chatModel as any).model || "";
    const isO1PreviewModel = modelName === "o1-preview";

    if (options.debug) {
      console.log("Model configuration:", modelConfig);
      console.log("Is o1-preview model:", isO1PreviewModel);
      console.log("Memory variables:", memoryVariables);
    }

    if (modelConfig.streaming && !isO1PreviewModel) {
      const chain = ChainManager.getChain();

      const chatStream = await chain.stream({
        history: memoryVariables.history,
        input: userMessage.message,
      });

      let fullAIResponse = "";
      for await (const chunk of chatStream) {
        if (abortController.signal.aborted) break;
        const content = typeof chunk === "string" ? chunk : chunk.content;
        if (typeof content === "string") {
          fullAIResponse += content;
          updateCurrentAiMessage(fullAIResponse);
        }
      }
      addMessage({
        sender: AI_SENDER,
        message: fullAIResponse,
        isVisible: true,
        timestamp: formatDateTime(new Date()),
      });
    } else {
      const response = await chatModel.invoke([{ role: "user", content: userMessage.message }]);
      addMessage({
        sender: AI_SENDER,
        message: typeof response.content === "string" ? response.content : "",
        isVisible: true,
        timestamp: formatDateTime(new Date()),
      });
    }
  } catch (error) {
    console.error("Model request failed:", error);
    let errorMessage = "Model request failed: ";

    if (error instanceof Error) {
      errorMessage += error.message;
      if (error.cause) {
        errorMessage += ` Cause: ${error.cause}`;
      }
    } else if (typeof error === "object" && error !== null) {
      errorMessage += JSON.stringify(error);
    } else {
      errorMessage += String(error);
    }

    const modelName = (chatModel as any).modelName || (chatModel as any).model || "";
    const isO1PreviewModel = modelName === "o1-preview";

    if (isO1PreviewModel) {
      if (errorMessage.includes("system message")) {
        errorMessage = "Error: o1-preview models do not support system messages.";
      }
    }

    addMessage({
      sender: AI_SENDER,
      message: `Error: ${errorMessage}`,
      isVisible: true,
      timestamp: formatDateTime(new Date()),
    });
  }
};
