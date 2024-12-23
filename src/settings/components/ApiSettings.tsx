import { updateSetting, useSettingsValue } from "@/settings/model";
import React, { useState } from "react";
import ApiSetting from "./ApiSetting";
import Collapsible from "./Collapsible";
import { getModelKey, updateModelConfig } from "@/aiParams";

const ApiSettings: React.FC = () => {
  const settings = useSettingsValue();
  const selectedModelKey = getModelKey();
  const [azureDeployments, setAzureDeployments] = useState(
    settings.azureOpenAIApiDeployments || []
  );

  // --- Handler functions ---
  const handleMaxCompletionTokensChange = (value: string) => {
    const maxCompletionTokens = parseInt(value, 10);
    // Check if the parsed value is a valid number and greater than 0
    if (!isNaN(maxCompletionTokens) && maxCompletionTokens > 0) {
      updateModelConfig(selectedModelKey, { maxCompletionTokens });
    } else {
      // Optionally, log an error or reset to a default value
      console.error("Invalid maxCompletionTokens value:", value);
    }
  };

  const handleReasoningEffortChange = (value: string) => {
    const reasoningEffort = parseFloat(value);
    // Check if the parsed value is a valid number and within an acceptable range
    if (!isNaN(reasoningEffort) && reasoningEffort >= 0) {
      updateModelConfig(selectedModelKey, { reasoningEffort });
    } else {
      // Optionally, log an error or reset to a default value
      console.error("Invalid reasoningEffort value:", value);
    }
  };

  const handleAddAzureDeployment = () => {
    const newDeployment = { deploymentName: "", instanceName: "", apiKey: "", apiVersion: "" };
    if (!newDeployment.deploymentName || !newDeployment.instanceName) {
      console.error("Model key or deployment name cannot be empty");
      return;
    }
    setAzureDeployments([...azureDeployments, newDeployment]);
  };

  const handleAzureDeploymentChange = (index: number, field: string, value: string) => {
    if (!value) {
      console.error("Model key or deployment name cannot be empty");
      return;
    }
    const updatedDeployments = azureDeployments.map((deployment, i) =>
      i === index ? { ...deployment, [field]: value } : deployment
    );
    setAzureDeployments(updatedDeployments);
    updateSetting("azureOpenAIApiDeployments", updatedDeployments);
  };

  const handleRemoveAzureDeployment = (index: number) => {
    const updatedDeployments = azureDeployments.filter((_, i) => i !== index);
    setAzureDeployments(updatedDeployments);
    updateSetting("azureOpenAIApiDeployments", updatedDeployments);
  };

  // --- Rest of the component ---
  return (
    <div>
      <h1>API Settings</h1>
      <p>All your API keys are stored locally.</p>
      <div className="warning-message">
        Make sure you have access to the model and the correct API key.
        <br />
        If errors occur, please try resetting to default and re-enter the API key.
      </div>
      <div>
        <div>
          <ApiSetting
            title="OpenAI API Key"
            value={settings.openAIApiKey}
            setValue={(value) => updateSetting("openAIApiKey", value)}
            placeholder="Enter OpenAI API Key"
          />
          <p>
            You can find your API key at{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://platform.openai.com/api-keys
            </a>
          </p>
          <ApiSetting
            title="OpenAI Organization ID (optional)"
            value={settings.openAIOrgId}
            setValue={(value) => updateSetting("openAIOrgId", value)}
            placeholder="Enter OpenAI Organization ID if applicable"
          />
        </div>
        <div className="warning-message">
          <span>If you are a new user, try </span>
          <a
            href="https://platform.openai.com/playground?mode=chat"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenAI playground
          </a>
          <span> to see if you have correct API access first.</span>
        </div>
      </div>
      <br />
      <Collapsible title="Google API Settings">
        <div>
          <ApiSetting
            title="Google API Key"
            value={settings.googleApiKey}
            setValue={(value) => updateSetting("googleApiKey", value)}
            placeholder="Enter Google API Key"
          />
          <p>
            If you have Google Cloud, you can get Gemini API key{" "}
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              here
            </a>
            .
            <br />
            Your API key is stored locally and is only used to make requests to Google's services.
          </p>
        </div>
      </Collapsible>

      <Collapsible title="Anthropic API Settings">
        <div>
          <ApiSetting
            title="Anthropic API Key"
            value={settings.anthropicApiKey}
            setValue={(value) => updateSetting("anthropicApiKey", value)}
            placeholder="Enter Anthropic API Key"
          />
          <p>
            If you have Anthropic API access, you can get the API key{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              here
            </a>
            .
            <br />
            Your API key is stored locally and is only used to make requests to Anthropic's
            services.
          </p>
        </div>
      </Collapsible>

      <Collapsible title="OpenRouter.ai API Settings">
        <div>
          <ApiSetting
            title="OpenRouter AI API Key"
            value={settings.openRouterAiApiKey}
            setValue={(value) => updateSetting("openRouterAiApiKey", value)}
            placeholder="Enter OpenRouter AI API Key"
          />
          <p>
            You can get your OpenRouterAI key{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
              here
            </a>
            .
            <br />
            Find models{" "}
            <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">
              here
            </a>
            .
          </p>
        </div>
      </Collapsible>

      <Collapsible title="Azure OpenAI API Settings">
        <div>
          <ApiSetting
            title="Azure OpenAI API Key"
            value={settings.azureOpenAIApiKey}
            setValue={(value) => updateSetting("azureOpenAIApiKey", value)}
            placeholder="Enter Azure OpenAI API Key"
          />
          <ApiSetting
            title="Azure OpenAI API Instance Name"
            value={settings.azureOpenAIApiInstanceName}
            setValue={(value) => updateSetting("azureOpenAIApiInstanceName", value)}
            placeholder="Enter Azure OpenAI API Instance Name"
            type="text"
          />
          {azureDeployments.map((deployment, index) => (
            <div key={index} className="azure-deployment">
              <ApiSetting
                title={`Azure OpenAI API Deployment Name ${index + 1}`}
                description="This is your actual model, no need to pass a model name separately."
                value={deployment.deploymentName}
                setValue={(value) =>
                  handleAzureDeploymentChange(index, "deploymentName", value)
                }
                placeholder="Enter Azure OpenAI API Deployment Name"
                type="text"
              />
              <ApiSetting
                title={`Azure OpenAI API Version ${index + 1}`}
                value={deployment.apiVersion}
                setValue={(value) => handleAzureDeploymentChange(index, "apiVersion", value)}
                placeholder="Enter Azure OpenAI API Version"
                type="text"
              />
              <ApiSetting
                title={`Azure OpenAI API Key ${index + 1}`}
                value={deployment.apiKey}
                setValue={(value) => handleAzureDeploymentChange(index, "apiKey", value)}
                placeholder="Enter Azure OpenAI API Key"
                type="text"
              />
              <button onClick={() => handleRemoveAzureDeployment(index)}>Remove</button>
            </div>
          ))}
          <button onClick={handleAddAzureDeployment}>Add Deployment</button>
        </div>
      </Collapsible>

      <Collapsible title="Groq API Settings">
        <div>
          <ApiSetting
            title="Groq API Key"
            value={settings.groqApiKey}
            setValue={(value) => updateSetting("groqApiKey", value)}
            placeholder="Enter Groq API Key"
          />
          <p>
            If you have Groq API access, you can get the API key{" "}
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
              here
            </a>
            .
            <br />
            Your API key is stored locally and is only used to make requests to Groq's services.
          </p>
        </div>
      </Collapsible>

      <Collapsible title="Cohere API Settings">
        <ApiSetting
          title="Cohere API Key"
          value={settings.cohereApiKey}
          setValue={(value) => updateSetting("cohereApiKey", value)}
          placeholder="Enter Cohere API Key"
        />
        <p>
          Get your free Cohere API key{" "}
          <a href="https://dashboard.cohere.ai/api-keys" target="_blank" rel="noreferrer">
            here
          </a>
        </p>
      </Collapsible>

      {selectedModelKey.startsWith("o1") && (
        <div>
          <ApiSetting
            title="Max Completion Tokens"
            value={
              settings.modelConfigs[selectedModelKey]?.maxCompletionTokens?.toString() || ""
            }
            setValue={handleMaxCompletionTokensChange}
            placeholder="Enter Max Completion Tokens"
            type="number"
          />
          <ApiSetting
            title="Reasoning Effort"
            value={
              settings.modelConfigs[selectedModelKey]?.reasoningEffort?.toString() || ""
            }
            setValue={handleReasoningEffortChange}
            placeholder="Enter Reasoning Effort"
            type="number"
          />
        </div>
      )}
    </div>
  );
};

export default ApiSettings;
