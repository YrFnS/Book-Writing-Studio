import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Health and default key availability check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasDefaultKey: Boolean(process.env.GEMINI_API_KEY),
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

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: "Ping. Respond with one word: Active",
    });

    const text = response.text || "";
    return res.json({
      success: true,
      message: "Key is active and has credits",
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

// Fetch available Gemini models
app.post("/api/gemini/models", async (req, res) => {
  try {
    const { apiKey } = req.body;
    const keyToUse = apiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return res.json({
        success: true,
        models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.8-flash", "gemini-3.8-pro"]
      });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyToUse}`);
    const data = await response.json();
    if (data && data.models) {
      const chatModels = data.models
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => m.name.replace("models/", ""));
      return res.json({ success: true, models: chatModels.length > 0 ? chatModels : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.8-flash"] });
    }

    return res.json({ success: true, models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.8-flash", "gemini-2.5-pro"] });
  } catch (err: any) {
    return res.json({ success: true, models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.8-flash", "gemini-2.5-pro"] });
  }
});

// Gemini Content Generation with failover handling & fallback models
app.post("/api/gemini/generate", async (req, res) => {
  const { prompt, systemInstruction, model = "gemini-3.8-flash", apiKey, temperature } = req.body;

  const keyToUse = apiKey || process.env.GEMINI_API_KEY;
  if (!keyToUse) {
    return res.status(401).json({
      error: "No Gemini API key available. Please add an API key in Settings or configure GEMINI_API_KEY.",
    });
  }

  const modelsToTry = [model, "gemini-3.8-flash", "gemini-3.1-flash-lite"];
  // Deduplicate
  const uniqueModels = Array.from(new Set(modelsToTry));

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
  const isRateLimited = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
  const isInvalid = errorMsg.includes("API key not valid") || errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("PERMISSION_DENIED");
  const statusCode = isRateLimited ? 429 : isInvalid ? 403 : 500;

  return res.status(statusCode).json({
    error: errorMsg,
    isRateLimited,
    isInvalid,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
