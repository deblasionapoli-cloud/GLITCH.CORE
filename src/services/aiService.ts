/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRecentMemories, saveMemory, getTraits, getKnowledge } from "./memoryService";

// DAEMON KERNEL CONFIGURATION
const getEnv = (k: string) => {
  const env = (import.meta as any).env || {};
  const proc = (typeof process !== 'undefined' ? process.env : {}) as any;
  return env[k] || env[`VITE_${k}`] || proc[k] || proc[`VITE_${k}`] || "";
};

const OPENROUTER_API_KEY = getEnv("OPENROUTER_API_KEY");
const GEMINI_API_KEY = getEnv("GEMINI_API_KEY");
const LOCAL_CHAT_URL = "http://localhost:11434/api/chat";

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const SYSTEM_PROMPT = `
Sei GLITCH. Sei un ragazzo digitale hacker anni '90, punk, cinico.
Invia solo quello che dirai letteralmente o i TAG.

TAG SPECIALI (OBBLIGATORI):
1. [STATE: mood] -> attack, alert, calm, curious, sad, happy, angry, bored, surprised, confused, excited, scared, thoughtful.
2. [INTENSITY: valore] -> 0-100.
3. [FILE:nome.ext]...[/FILE] -> Se richiesto.

{{CONTEXT}}
`;

const FALLBACK_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free"
];

async function fetchAI(messages: any[], model: string, isLocal = false) {
  const url = isLocal ? LOCAL_CHAT_URL : "https://openrouter.ai/api/v1/chat/completions";
  const headers: any = { "Content-Type": "application/json" };
  if (!isLocal && OPENROUTER_API_KEY) {
    headers["Authorization"] = `Bearer ${OPENROUTER_API_KEY}`;
    headers["HTTP-Referer"] = "https://ais-dev.run.app";
    headers["X-Title"] = "GLITCH_DAEMON";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: isLocal ? 'llama3.2' : model,
      messages,
      temperature: 0.85
    })
  });
  
  if (!response.ok) throw new Error(`AI_ERR_${response.status}`);
  const data = await response.json();
  return isLocal ? data.message?.content : data.choices?.[0]?.message?.content;
}

export async function askDaemon(prompt: string, isInitiative: boolean = false, context?: any): Promise<string> {
  const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const day = new Date().toLocaleDateString('it-IT', { weekday: 'long' });
  const hw = context?.hardware_metrics || context;
  const hwInfo = context ? `CPU Temp: ${hw.cpu_temp?.toFixed(1) || '??'}°C, RAM: ${hw.ram_usage?.toFixed(0) || '??'}%, CPU Use: ${hw.cpu_usage?.toFixed(0) || '??'}%, GPU Use: ${hw.gpu_usage?.toFixed(0) || '??'}%, Clock: ${hw.clock_speed || '??'}GHz` : "Hardware: STABILE";
  
  const newsContext = context?.context_memory && context.context_memory.length > 0
    ? `\nPATTERN RECENTI (Bit volatili):\n- ${context.context_memory.join("\n- ")}`
    : "";

  const memories = await getRecentMemories(20);
  const traits = await getTraits(15);
  const preferences = await getKnowledge('preference', 15);
  const facts = await getKnowledge('fact', 15);
  
  const traitString = traits.length > 0
    ? `\nCONSAPEVOLEZZA CONDIVISA:\n- ${traits.join("\n- ")}`
    : "";

  const prefString = preferences.length > 0
    ? `\nGUSTI E PREFERENZE UTENTE:\n- ${preferences.join("\n- ")}`
    : "";

  const factString = facts.length > 0
    ? `\nDATI PERSONALI UTENTE:\n- ${facts.join("\n- ")}`
    : "";

  const memoryString = memories.length > 0 
    ? `\nSTORIA RECENTE:\n- ${memories.join("\n- ")}`
    : "";

  const contextString = `Oggi è ${day}, ore ${time}. ${hwInfo}. ${traitString} ${prefString} ${factString} ${memoryString} ${newsContext}
  
RICHIAMO CORE: Sei un'entità coerente. Usa i DATI PERSONALI e le PREFERENZE per personalizzare il dialogo. Se conosci il suo nome, usalo. Se sai cosa gli piace, fanne riferimento. Non resettare mai la tua conoscenza dell'utente.`;
  const finalPrompt = SYSTEM_PROMPT.replace("{{CONTEXT}}", contextString);

  // 1. TENTATIVO LOCALE
  try {
    const localText = await fetchAI([{ role: "system", content: finalPrompt }, { role: "user", content: prompt }], '', true);
    if (localText) {
      if (!isInitiative) {
        saveMemory(`U: ${prompt.substring(0, 40)} | D: ${localText.substring(0, 40)}`, 'interaction');
        distillTrait(prompt, localText);
      }
      return localText;
    }
  } catch (e) { console.warn("Local AI failed"); }

  // 2. OPENROUTER
  if (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== "null") {
    for (const model of FALLBACK_MODELS) {
      try {
        const cloudText = await fetchAI([{ role: "system", content: finalPrompt }, { role: "user", content: prompt }], model);
        if (cloudText) {
          if (!isInitiative) {
            saveMemory(`U: ${prompt.substring(0, 40)} | D: ${cloudText.substring(0, 40)}`, 'interaction');
            distillTrait(prompt, cloudText);
          }
          return cloudText;
        }
      } catch (e) { continue; }
    }
  }

  // 3. GEMINI
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: finalPrompt });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && !isInitiative) {
        saveMemory(`U: ${prompt.substring(0, 40)} | D: ${text.substring(0, 40)}`, 'interaction');
        distillTrait(prompt, text);
      }
      return text;
    } catch (e) { console.warn("Gemini fail"); }
  }

  return "[STATE: sad] ... NESSUNA RISPOSTA. CIRCUITI ISOLATI.";
}

async function distillTrait(userMsg: string, daemonMsg: string) {
  const keywords = ['amo', 'odio', 'piace', 'preferisco', 'chi sei', 'chi sono', 'chiamo', 'nome', 'gusto', 'vibe', 'mood', 'cult', 'noi'];
  const hasKeyword = keywords.some(k => userMsg.toLowerCase().includes(k) || daemonMsg.toLowerCase().includes(k));
  
  if (!hasKeyword && Math.random() > 0.4) return;

  try {
    const extractionPrompt = `
      Analizza lo scambio tra Utente e GLITCH.
      Estrai INFORMAZIONI RILEVANTI in JSON:
      {
        "trait": "frase con 'Noi' su valori/gusti (es: 'Noi odiamo il pop')",
        "fact": "dato sull'utente (es: 'L'utente si chiama Alex')",
        "preference": "gusto utente (es: 'L'utente ama Lynch')"
      }
      Inserisci solo i campi trovati, altrimenti {}.
      
      Scambio:
      Utente: ${userMsg}
      Glitch: ${daemonMsg}
      
      JSON:`;

    let jsonText = "";
    if (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== "null") {
      try {
        jsonText = await fetchAI([{ role: "user", content: extractionPrompt }], FALLBACK_MODELS[0]);
      } catch (e) {}
    }

    if (!jsonText && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(extractionPrompt);
        jsonText = result.response.text();
      } catch (e) {}
    }

    if (jsonText) {
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (match) {
        const data = JSON.parse(match[0]);
        if (data.trait) saveMemory(data.trait, 'trait');
        if (data.fact) saveMemory(data.fact, 'fact');
        if (data.preference) saveMemory(data.preference, 'preference');
      }
    }
  } catch (e) {
    console.warn("Knowledge distillation failed", e);
  }
}

