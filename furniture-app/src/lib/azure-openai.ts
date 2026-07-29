import { AzureOpenAI } from "openai";

// Shared Day 1 hackathon credential (GPT-5 mini) — event-only, see .env.
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

export function getAzureOpenAIClient(): AzureOpenAI {
  if (!endpoint || !apiKey || !apiVersion || !deployment) {
    throw new Error("Azure OpenAI environment variables are not fully set in .env");
  }
  return new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
}

export function getAzureDeployment(): string {
  if (!deployment) throw new Error("AZURE_OPENAI_DEPLOYMENT is not set in .env");
  return deployment;
}
