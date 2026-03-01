import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeTask(description: string): Promise<AIResponse> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this enterprise task and determine the workflow: "${description}"`,
    config: {
      systemInstruction: "You are an expert enterprise workflow architect. Analyze the input and return a JSON object with: 'analysis' (string), 'suggestedSteps' (array of strings representing agent actions), and 'requiresApproval' (boolean).",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysis: { type: Type.STRING },
          suggestedSteps: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          requiresApproval: { type: Type.BOOLEAN }
        },
        required: ["analysis", "suggestedSteps", "requiresApproval"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as AIResponse;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return {
      analysis: "Error analyzing task.",
      suggestedSteps: ["Manual Review Required"],
      requiresApproval: true
    };
  }
}

export async function generateAgentAction(step: string, context: string): Promise<string> {
  // If the step involves research or finding information, use Google Search grounding
  const isResearch = /research|find|check|search|verify|lookup/i.test(step);
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `As an AI agent, perform this action: "${step}" based on this context: "${context}". 
               If this is a research task, use your search tools to find real, up-to-date information. 
               Provide a professional summary of your findings.`,
    config: {
      systemInstruction: "You are a specialized enterprise AI agent. Provide real data if possible. Keep your response concise and professional.",
      tools: isResearch ? [{ googleSearch: {} }] : undefined
    }
  });

  let text = response.text || "Action completed successfully.";
  
  // Append grounding links if available
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks && chunks.length > 0) {
    text += "\n\n**Sources:**\n" + chunks
      .filter(c => c.web)
      .map(c => `- [${c.web?.title}](${c.web?.uri})`)
      .join("\n");
  }

  return text;
}
