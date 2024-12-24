import { getModelKey, updateModelConfig, setModelKey } from "@/aiParams";
import { updateSetting, useSettingsValue } from "@/settings/model";
import { AzureDeployment } from "@/settings/model";
import React, { useState, useEffect } from "react";
import ApiSetting from "./ApiSetting";
import Collapsible from "./Collapsible";
import { Notice } from "obsidian";
import { getSettings } from "../model";

const ApiSettings: React.FC = () => {
  const settings = useSettingsValue();
  const currentModelKey = getModelKey();
  const currentModelConfig = settings.modelConfigs[currentModelKey] || {};
  const isO1Model = currentModelKey.startsWith("o1");

  const handleMaxCompletionTokensChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      updateModelConfig(currentModelKey, { maxCompletionTokens: numValue });
    } else {
      console.error("Invalid maxCompletionTokens value:", value);
    }
  };

  const handleReasoningEffortChange = (value: string) => {
    if (value === "low" || value === "medium" || value === "high") {
      updateModelConfig(currentModelKey, { reasoningEffort: value });
    }
  };

  const [azureDeployments, setAzureDeployments] = useState<AzureDeployment[]>([]);

  useEffect(() => {
    const deployments: AzureDeployment[] = getSettings().azureOpenAIApiDeployments || [];
    setAzureDeployments(deployments);
  }, [getSettings().azureOpenAIApiDeployments]);

  const handleAddAzureDeployment = () => {
    const availableModels = Object.keys(getSettings().modelConfigs).filter(
      (modelKey) => !azureDeployments.some((deployment) => deployment.modelKey === modelKey)
    );
    const defaultModelKey = availableModels.length > 0 ? availableModels[0] : "";

    if (
      azureDeployments.length > 0 &&
      !azureDeployments[azureDeployments.length - 1].deploymentName
    ) {
      new Notice("Please fill in the deployment name for the previous entry first.");
      return;
    }

    if (!defaultModelKey) {
      new Notice("Please add a model first.");
      return;
    }

    setAzureDeployments((prev) => [
      ...prev,
      {
        modelKey: defaultModelKey,
        deploymentName: "",
        instanceName: "",
        apiVersion: "",
        apiKey: getSettings().azureOpenAIApiKey || "",
        specialSettings: {},
      },
    ]);
  };

  const handleAzureDeploymentChange = (
    index: number,
    field: keyof Omit<AzureDeployment, "specialSettings">,
    value: string
  ) => {
    if (field === "deploymentName" || field === "instanceName") {
      if (!value) {
        new Notice(`Azure OpenAI ${field} is required.`);
        return;
      }
    }

    setAzureDeployments((prev) =>
      prev.map((deployment, i) => (i === index ? { ...deployment, [field]: value } : deployment))
    );
  };

  const handleAzureDeploymentSpecialSettingsChange = (
    index: number,
    field: keyof NonNullable<AzureDeployment["specialSettings"]>,
    value: string | number
  ) => {
    setAzureDeployments((prev) =>
      prev.map((deployment, i) => {
        if (i !== index) return deployment;
        const newSpecialSettings = { ...(deployment.specialSettings || {}) };
        if (field === "maxCompletionTokens") {
          newSpecialSettings.maxCompletionTokens = Number(value);
        } else if (field === "reasoningEffort") {
          newSpecialSettings.reasoningEffort = value as "low" | "medium" | "high";
        }
        return { ...deployment, specialSettings: newSpecialSettings };
      })
    );
  };

  const handleRemoveAzureDeployment = (index: number) => {
    setAzureDeployments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDeployments = () => {
    const validDeployments = azureDeployments.filter(
      (deployment): deployment is AzureDeployment => {
        if (!deployment.modelKey || !deployment.deploymentName || !deployment.apiKey) {
          new Notice("Model key, deployment name, and API key are required for all deployments.");
          return false;
        }
        return true;
      }
    );

    if (validDeployments.length !== azureDeployments.length) {
      new Notice("Removed entries with empty model key, deployment name, or API key.");
    }

    updateSetting("azureOpenAIApiDeployments", validDeployments);
  };

  const validateAzureFields = (deployment: AzureDeployment): boolean => {
    if (!deployment.deploymentName || !deployment.instanceName) {
      new Notice("Azure OpenAI Deployment Name and Instance Name are required.");
      return false;
    }
    return true;
  };

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
            title="Azure OpenAI API Embedding Deployment Name"
            description="(Optional) For embedding provider Azure OpenAI"
            value={settings.azureOpenAIApiEmbeddingDeploymentName}
            setValue={(value) => updateSetting("azureOpenAIApiEmbeddingDeploymentName", value)}
            placeholder="Enter Azure OpenAI API Embedding Deployment Name"
          />
          <h3>Azure OpenAI Deployments</h3>
          {Object.keys(getSettings().modelConfigs).length > 0 && (
            <>
              {azureDeployments.map((deployment, index) => (
                <div key={index} className="azure-deployment">
                  <div className="modelKey">
                    <label htmlFor={`modelKey-${index}`}>Model Key:</label>
                    <select
                      id={`modelKey-${index}`}
                      value={deployment.modelKey}
                      onChange={(e) => {
                        handleAzureDeploymentChange(index, "modelKey", e.target.value);
                        setModelKey(e.target.value);
                      }}
                    >
                      {Object.keys(getSettings().modelConfigs).map((modelKey) => (
                        <option key={modelKey} value={modelKey}>
                          {modelKey}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ApiSetting
                    title={`Deployment Name for ${deployment.modelKey}`}
                    value={deployment.deploymentName}
                    setValue={(value) =>
                      handleAzureDeploymentChange(index, "deploymentName", value)
                    }
                    placeholder="Enter deployment name"
                  />
                  <ApiSetting
                    title="Azure OpenAI API Instance Name"
                    value={deployment.instanceName}
                    setValue={(value) => handleAzureDeploymentChange(index, "instanceName", value)}
                    placeholder="Enter Azure OpenAI API Instance Name"
                  />
                  <ApiSetting
                    title="Azure OpenAI API Version"
                    value={deployment.apiVersion}
                    setValue={(value) => handleAzureDeploymentChange(index, "apiVersion", value)}
                    placeholder="Enter Azure OpenAI API Version"
                  />
                  <ApiSetting
                    title="Azure OpenAI API Key"
                    value={deployment.apiKey}
                    setValue={(value) => handleAzureDeploymentChange(index, "apiKey", value)}
                    placeholder="Enter Azure OpenAI API Key"
                  />
                  {deployment.modelKey === "o1-preview" && (
                    <>
                      <ApiSetting
                        title="Max Completion Tokens (o1-preview)"
                        value={deployment.specialSettings?.maxCompletionTokens?.toString() || ""}
                        setValue={(value) =>
                          handleAzureDeploymentSpecialSettingsChange(
                            index,
                            "maxCompletionTokens",
                            value
                          )
                        }
                        placeholder="Enter max completion tokens"
                      />
                      <ApiSetting
                        title="Reasoning Effort (o1-preview)"
                        value={deployment.specialSettings?.reasoningEffort || ""}
                        setValue={(value) =>
                          handleAzureDeploymentSpecialSettingsChange(
                            index,
                            "reasoningEffort",
                            value
                          )
                        }
                        placeholder="Enter reasoning effort (low, medium, high)"
                      />
                      <div className="warning-message">
                        Note: o1-preview models do not support system messages, max_tokens,
                        temperature modification, or streaming.
                      </div>
                    </>
                  )}
                  {!validateAzureFields(deployment) && (
                    <div className="warning-message">
                      Warning: Azure OpenAI Deployment Name and Instance Name are required.
                    </div>
                  )}
                  <button type="button" onClick={() => handleRemoveAzureDeployment(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddAzureDeployment}
                disabled={Object.keys(getSettings().modelConfigs).length === 0}
              >
                Add Azure OpenAI Deployment
              </button>
              <button type="button" onClick={handleSaveDeployments}>
                Save Deployments
              </button>
            </>
          )}
          {isO1Model && (
            <>
              <ApiSetting
                title="Max Completion Tokens (o1 series)"
                description="Set the max completion tokens for o1 series models."
                value={currentModelConfig.maxCompletionTokens?.toString() || ""}
                setValue={handleMaxCompletionTokensChange}
                placeholder="Enter max completion tokens"
              />
              <ApiSetting
                title="Reasoning Effort (o1)"
                description="Set the reasoning effort for o1 model (low, medium, high)."
                value={currentModelConfig.reasoningEffort || ""}
                setValue={handleReasoningEffortChange}
                placeholder="Enter reasoning effort (low, medium, high)"
              />
            </>
          )}
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
          <a href="https://dashboard.cohere.ai/api-keys" target="_blank" rel="noopener noreferrer">
            here
          </a>
        </p>
      </Collapsible>
    </div>
  );
};

export default ApiSettings;
