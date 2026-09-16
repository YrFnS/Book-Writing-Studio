import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  handleLogin,
  handleLogout,
  handleSession,
  isAuthConfigured,
  requireSession,
} from "./auth-server";

dotenv.config();

export const app = express();

app.use(express.json({ limit: "10mb" }));

// Studio lock: a single username/password pair held in deployment env vars.
app.get("/api/session", handleSession);
app.post("/api/login", handleLogin);
app.post("/api/logout", handleLogout);

// Everything below spends Gemini quota, so it stays behind the lock.
app.use("/api/gemini", requireSession);

const MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * The set of usable models belongs to whoever owns the key, so it is always
 * read live from Google. Nothing here pins a model name: a pinned name silently
 * rots when Google retires it, and it hides newer models the key can already use.
 */
async function listModels(apiKey: string): Promise<string[]> {
  const response = await fetch(`${MODELS_ENDPOINT}?key=${encodeURIComponent(apiKey)}&pageSize=200`);
  const data: any = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || `Google returned ${response.status}`;
    throw Object.assign(new Error(message), { status: response.status });
  }

  const models: string[] = (data?.models || [])
    .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m: any) => String(m.name).replace(/^models\//, ""));

  if (models.length === 0) {
    throw new Error("This key cannot use any text generation models.");
  }
  return models;
}

const classify = (message: string) => ({
  isRateLimited:
    message.includes("429") || message.includes("quota") || message.includes("RESOURCE_EXHAUSTED"),
  isInvalid:
    message.includes("API key not valid") ||
    message.includes("API_KEY_INVALID") ||
    message.includes("PERMISSION_DENIED"),
});

// Health and default key availability check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasDefaultKey: Boolean(process.env.GEMINI_API_KEY),
    authConfigured: isAuthConfigured(),
  });
});

// Test a Gemini API key for validity and quota
app.post("/api/gemini/test-key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    const keyToUse = apiKey || process.env.GEMINI_API_KEY;

    if (!keyToUse) {
      return res.status(400).json({
        success: false,
        error: "No API key provided and no default key configured.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: keyToUse,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const [firstModel] = await listModels(keyToUse);

    const response = await ai.models.generateContent({
      model: firstModel,
      contents: "Ping. Respond with one word: Active",
    });

    const text = response.text || "";
    return res.json({
      success: true,
      message: "Key is active and has credits",
      model: firstModel,
      sample: text.trim(),
    });
  } catch (error: any) {
    const errorMsg = error?.message || "Unknown error";
    const status = error?.status || (errorMsg.includes("429") ? 429 : 400);

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      error: errorMsg,
      isRateLimited: errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED"),
      isInvalid: errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("PERMISSION_DENIED"),
    });
  }
});

// Fetch the models this key can actually use
app.post("/api/gemini/models", async (req, res) => {
  const keyToUse = req.body?.apiKey || process.env.GEMINI_API_KEY;
  if (!keyToUse) {
    return res.status(400).json({
      success: false,
      error: "Add your Gemini API key first, then the model list loads from your own account.",
    });
  }

  try {
    return res.json({ success: true, models: await listModels(keyToUse) });
  } catch (error: any) {
    const message = error?.message || "Could not read the model list from Google.";
    return res.status(error?.status === 429 ? 429 : 400).json({
      success: false,
      error: message,
      ...classify(message),
    });
  }
});

// Gemini Content Generation with failover handling & fallback models
app.post("/api/gemini/generate", async (req, res) => {
  const { prompt, systemInstruction, model, apiKey, temperature } = req.body;

  const keyToUse = apiKey || process.env.GEMINI_API_KEY;
  if (!keyToUse) {
    return res.status(401).json({
      error: "No Gemini API key available. Please add an API key in Settings or configure GEMINI_API_KEY.",
    });
  }

  // The caller's chosen model first, then the key's own live models as
  // fallbacks, so an overloaded or retired model still has somewhere to go.
  let available: string[] = [];
  try {
    available = await listModels(keyToUse);
  } catch (error: any) {
    if (!model) {
      const message = error?.message || "Could not read the model list from Google.";
      return res.status(error?.status === 429 ? 429 : 400).json({ error: message, ...classify(message) });
    }
  }

  const uniqueModels = Array.from(new Set([model, ...available].filter(Boolean))).slice(0, 4);

  let lastError = null;

  for (const currentModel of uniqueModels) {
    try {
      const ai = new GoogleGenAI({
        apiKey: keyToUse,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const config: any = {};
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (typeof temperature === "number") {
        config.temperature = temperature;
      }

      const response = await ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        ...(Object.keys(config).length > 0 ? { config } : {}),
      });

      const text = response.text || "";
      if (text) {
        return res.json({ text, usedModel: currentModel });
      }
    } catch (error: any) {
      lastError = error;
      console.warn(`Model ${currentModel} failed:`, error?.message);
      // If quota exceeded or rate limited, try next fallback model
      continue;
    }
  }

  const errorMsg = lastError?.message || "An error occurred while generating content across all models";
  const { isRateLimited, isInvalid } = classify(errorMsg);
  const statusCode = isRateLimited ? 429 : isInvalid ? 403 : 500;

  return res.status(statusCode).json({
    error: errorMsg,
    isRateLimited,
    isInvalid,
  });
});

