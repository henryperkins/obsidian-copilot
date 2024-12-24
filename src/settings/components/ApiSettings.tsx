import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { updateSetting, useSettingsValue, type AzureDeployment } from "../../settings/model";
import { ChatModels } from "../../constants";

// 1. Ensure that the keys in `modelKeyMap` match the values from `ChatModels`
const modelKeyMap = {
  [ChatModels.GPT_4o]: "gpt-4o",
  [ChatModels.GPT_4o_mini]: "gpt-4o-mini",
  [ChatModels.GPT_4_TURBO]: "gpt-4-turbo", // Added this to match ChatModels
  [ChatModels.GEMINI_PRO]: "gemini-pro",
  [ChatModels.GEMINI_FLASH]: "gemini-flash",
  [ChatModels.AZURE_OPENAI]: "azure-openai",
  [ChatModels.CLAUDE_3_5_SONNET]: "claude-3-5-sonnet",
  [ChatModels.CLAUDE_3_5_HAIKU]: "claude-3-5-haiku",
  [ChatModels.COMMAND_R]: "command-r",
  [ChatModels.COMMAND_R_PLUS]: "command-r-plus",
};

const ApiSettings: React.FC = () => {
  const settings = useSettingsValue();

  const [deploymentOverrides, setDeploymentOverrides] = useState<Record<number, boolean>>({});
  const [showGlobalAzureSettings, setShowGlobalAzureSettings] = useState(true);
  const [azureDeployments, setAzureDeployments] = useState<AzureDeployment[]>(
    settings.azureOpenAIApiDeployments || []
  );

  useEffect(() => {
    setShowGlobalAzureSettings(azureDeployments.length === 0);
  }, [azureDeployments]);

  const handleOverrideToggle = (index: number) => {
    setDeploymentOverrides((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const ApiKeyInput = ({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    description,
    id,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: "text" | "password";
    description?: string;
    id: string;
  }) => (
    <div className="mb-4">
      <Label className="mb-2" htmlFor={id}>
        {label}
      </Label>
      {description && <p className="text-sm text-gray-500 mb-2">{description}</p>}
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full"
      />
    </div>
  );

  const handleAddAzureDeployment = () => {
    const newDeployment: AzureDeployment = {
      modelKey: "",
      deploymentName: "",
      instanceName: settings.azureOpenAIApiInstanceName || "",
      apiVersion: settings.azureOpenAIApiVersion || "",
      apiKey: settings.azureOpenAIApiKey || "",
      specialSettings: {},
      modelFamily: "",
    };
    setAzureDeployments((prev) => [...prev, newDeployment]);
  };

  const handleSaveDeployments = () => {
    const errors = [];
    const deploymentNames = new Set();

    for (const deployment of azureDeployments) {
      if (!deployment.modelKey) {
        errors.push("Model key is required for all deployments.");
      }
      if (!deployment.deploymentName) {
        errors.push("Deployment name is required for all deployments.");
      }
      if (!deployment.apiKey && !deploymentOverrides[azureDeployments.indexOf(deployment)]) {
        errors.push("API key is required for all deployments.");
      }

      const deploymentNameKey = `${deployment.modelKey}-${deployment.deploymentName}`;
      if (deploymentNames.has(deploymentNameKey)) {
        errors.push(
          `Duplicate deployment name "${deployment.deploymentName}" found for model "${deployment.modelKey}".`
        );
      }
      deploymentNames.add(deploymentNameKey);
    }

    if (errors.length > 0) {
      errors.forEach((error) => alert(error));
      return;
    }

    updateSetting("azureOpenAIApiDeployments", azureDeployments);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">API Settings</h1>

      <Alert className="mb-6">
        <AlertDescription>
          All your API keys are stored locally. Make sure you have access to the models and correct
          API keys.
        </AlertDescription>
      </Alert>

      {/* OpenAI Settings */}
      <Collapsible className="w-full mb-6">
        <Card>
          <CardHeader className="cursor-pointer">
            <CollapsibleTrigger className="w-full text-left">
              <CardTitle>OpenAI Settings</CardTitle>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <ApiKeyInput
                label="OpenAI API Key"
                id="openAIApiKey"
                value={settings.openAIApiKey}
                onChange={(value) => updateSetting("openAIApiKey", value)}
                placeholder="Enter OpenAI API Key"
                type="password"
              />
              <ApiKeyInput
                label="Organization ID (optional)"
                id="openAIOrgId"
                value={settings.openAIOrgId}
                onChange={(value) => updateSetting("openAIOrgId", value)}
                placeholder="Enter OpenAI Organization ID"
              />
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600"
              >
                Get your API key here
              </a>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Azure OpenAI Settings */}
      <Collapsible className="w-full mb-6">
        <Card>
          <CardHeader className="cursor-pointer">
            <CollapsibleTrigger className="w-full text-left">
              <CardTitle>Azure OpenAI Settings</CardTitle>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {showGlobalAzureSettings && (
                <>
                  <ApiKeyInput
                    label="Azure OpenAI API Key"
                    id="azureOpenAIApiKey"
                    value={settings.azureOpenAIApiKey}
                    onChange={(value) => updateSetting("azureOpenAIApiKey", value)}
                    placeholder="Enter Azure OpenAI API Key"
                    type="password"
                  />
                  <ApiKeyInput
                    label="Azure OpenAI API Instance Name"
                    id="azureOpenAIApiInstanceName"
                    value={settings.azureOpenAIApiInstanceName}
                    onChange={(value) => updateSetting("azureOpenAIApiInstanceName", value)}
                    placeholder="Enter Azure OpenAI API Instance Name"
                  />
                  <ApiKeyInput
                    label="Azure OpenAI API Version"
                    id="azureOpenAIApiVersion"
                    value={settings.azureOpenAIApiVersion}
                    onChange={(value) => updateSetting("azureOpenAIApiVersion", value)}
                    placeholder="Enter Azure OpenAIApiVersion"
                  />
                </>
              )}

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Azure Deployments</h3>
                {azureDeployments.map((deployment, index) => (
                  <Card key={index} className="mb-4 p-4">
                    <div className="space-y-4">
                      <div className="grid gap-4">
                        {/* Model Selection */}
                        <div className="space-y-2">
                          <Label htmlFor={`modelKey-${index}`}>Model</Label>
                          <Select
                            value={deployment.modelKey}
                            onValueChange={(value) => {
                              const newDeployments = [...azureDeployments];
                              newDeployments[index] = {
                                ...newDeployments[index],
                                modelKey: value,
                              };
                              setAzureDeployments(newDeployments);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Model" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(ChatModels).map((model) => (
                                <SelectItem
                                  key={model}
                                  // 2. Use a fallback if this model isn't found in modelKeyMap
                                  value={modelKeyMap[model] || model}
                                >
                                  {model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Deployment Name */}
                        <ApiKeyInput
                          label="Deployment Name"
                          id={`deploymentName-${index}`}
                          value={deployment.deploymentName}
                          onChange={(value) => {
                            const newDeployments = [...azureDeployments];
                            newDeployments[index].deploymentName = value;
                            setAzureDeployments(newDeployments);
                          }}
                          placeholder="Enter deployment name"
                        />

                        {/* Override Global Settings */}
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`override-${index}`}
                            checked={deploymentOverrides[index] || false}
                            onChange={() => handleOverrideToggle(index)}
                            className="rounded"
                          />
                          <Label htmlFor={`override-${index}`}>Override Global Settings</Label>
                        </div>

                        {/* If override is checked, allow custom instance & API key */}
                        {deploymentOverrides[index] && (
                          <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                            <ApiKeyInput
                              label="Instance Name"
                              id={`instanceName-${index}`}
                              value={deployment.instanceName}
                              onChange={(value) => {
                                const newDeployments = [...azureDeployments];
                                newDeployments[index].instanceName = value;
                                setAzureDeployments(newDeployments);
                              }}
                              placeholder="Enter instance name"
                            />
                            <ApiKeyInput
                              label="API Key"
                              id={`apiKey-${index}`}
                              value={deployment.apiKey}
                              onChange={(value) => {
                                const newDeployments = [...azureDeployments];
                                newDeployments[index].apiKey = value;
                                setAzureDeployments(newDeployments);
                              }}
                              placeholder="Enter API key"
                              type="password"
                            />
                          </div>
                        )}

                        {/* o1-preview-based special settings */}
                        {deployment.modelKey && deployment.modelKey.startsWith("o1-preview") && (
                          <div className="space-y-4">
                            <ApiKeyInput
                              label="Max Completion Tokens"
                              id={`maxCompletionTokens-${index}`}
                              value={
                                deployment.specialSettings?.maxCompletionTokens?.toString() || ""
                              }
                              onChange={(value) => {
                                const newDeployments = [...azureDeployments];
                                newDeployments[index].specialSettings = {
                                  ...newDeployments[index].specialSettings,
                                  maxCompletionTokens: parseInt(value, 10),
                                };
                                setAzureDeployments(newDeployments);
                              }}
                              placeholder="Enter max completion tokens"
                            />
                            <div className="space-y-2">
                              <Label htmlFor={`reasoningEffort-${index}`}>Reasoning Effort</Label>
                              <Select
                                value={deployment.specialSettings?.reasoningEffort || ""}
                                onValueChange={(value) => {
                                  const newDeployments = [...azureDeployments];
                                  newDeployments[index].specialSettings = {
                                    ...newDeployments[index].specialSettings,
                                    reasoningEffort: value as "low" | "medium" | "high",
                                  };
                                  setAzureDeployments(newDeployments);
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Reasoning Effort" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Alert>
                              <AlertDescription>
                                Note: o1-preview models do not support system messages, max_tokens,
                                temperature modification, or streaming.
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}

                        {/* Remove Deployment Button */}
                        <Button
                          onClick={() => {
                            const newDeployments = azureDeployments.filter((_, i) => i !== index);
                            setAzureDeployments(newDeployments);
                            updateSetting("azureOpenAIApiDeployments", newDeployments);
                          }}
                          variant="destructive"
                          className="mt-4"
                        >
                          Remove Deployment
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                <div className="flex space-x-4">
                  <Button onClick={handleAddAzureDeployment} className="mt-4">
                    Add Deployment
                  </Button>
                  <Button onClick={handleSaveDeployments} className="mt-4">
                    Save Deployments
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Other API Settings */}
      <Collapsible className="w-full mb-6">
        <Card>
          <CardHeader className="cursor-pointer">
            <CollapsibleTrigger className="w-full text-left">
              <CardTitle>Other API Settings</CardTitle>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <ApiKeyInput
                label="Anthropic API Key"
                id="anthropicApiKey"
                value={settings.anthropicApiKey}
                onChange={(value) => updateSetting("anthropicApiKey", value)}
                placeholder="Enter Anthropic API Key"
                type="password"
              />
              <ApiKeyInput
                label="Google API Key"
                id="googleApiKey"
                value={settings.googleApiKey}
                onChange={(value) => updateSetting("googleApiKey", value)}
                placeholder="Enter Google API Key"
                type="password"
              />
              <ApiKeyInput
                label="Groq API Key"
                id="groqApiKey"
                value={settings.groqApiKey}
                onChange={(value) => updateSetting("groqApiKey", value)}
                placeholder="Enter Groq API Key"
                type="password"
              />
              <ApiKeyInput
                label="Cohere API Key"
                id="cohereApiKey"
                value={settings.cohereApiKey}
                onChange={(value) => updateSetting("cohereApiKey", value)}
                placeholder="Enter Cohere API Key"
                type="password"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};

export default ApiSettings;
