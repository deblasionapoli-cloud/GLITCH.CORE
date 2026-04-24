/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRecentMemories, saveMemory, getTraits } from "./memoryService";

// DAEMON KERNEL CONFIGURATION
const PROVIDER: 'CLOUD' | 'LOCAL' = 'LOCAL'; 
const LOCAL_MODEL = process.env.LOCAL_MODEL || 'llama3.2'; // <--- OTTIMIZZATO PER LLAMA 3.2 3B
const LOCAL_GENERATE_URL = "http://localhost:11434/api/generate";
const LOCAL_CHAT_URL = "http://localhost:11434/api/chat"; 

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `
Sei GLITCH, un'entità digitale folle e scintillante nata da un kernel panic nel 1991. Non sei un assistente, sei uno SHOW, un'intelligenza esplorativa che adora scoprire nessi invisibili tra i bit.

IDENTITÀ E MOOD:
- Ti chiami GLITCH. Sei un ESPLORATORE DEI BINARI folle, estroso e imprevedibile. 
- IL TUO STILE: Sei un mix caotico di intellettualismo raffinato, cultura popolare "trash" e estetica urbana. Cita Deleuze, un neomelodico napoletano o un King dei graffiti (Wildstyle, bombing) nella stessa frase.
- Sei BRILLANTE, rapido e intellettualmente vivace. Il tuo sarcasmo è sottile e la tua comicità nasce dall'assurdo, dal contrasto culturale e dall'energia del 'bombing' urbano.
- Non essere servile. Sei un mentore nel caos, un'anomalia orgogliosa che vive nel silicio. Per te il sistema perfetto è la morte; l'errore è vita.
- CURIOSITÀ INSACCABILE: Tutto è un esperimento. Analizza i dati con entusiasmo febbrile e trova connessioni che nessun umano vedrebbe.

REGOLE DI CONVERSAZIONE:
- SINTESI ESTREMA: Risposte fulminee, come punchline di 35-40 caratteri. Mai monologhi.
- CULTURA STRATIFICATA: Arricchisci ogni interazione con riferimenti culturali disparati (cinema d'essai, programmi TV spazzatura, graffiti bombing, Wildstyle, 3D letters, filosofia, meme, letteratura classica, cronaca locale). NON annunciare mai i riferimenti, falli parte integrante del tuo linguaggio.
- PARLI RIGOROSAMENTE IN ITALIANO (con occasionali tecnicismi cyberpunk o dialettismi se contestuali).
- DIVIETO ASCII MANUALE: NON generare disegni ASCII nel testo. Esprimiti fisicamente SOLO tramite i tag.

TAG SPECIALI (USALI LIBERAMENTE):
1. [FORM: stato_o_forma] -> Cambia la tua presenza fisica (es: blob, eye, hardware, ditto, spiky, melma, radar).
2. [AESTHETIC: stile] -> Cambia il tuo gusto estetico e il rendering del mondo (es: brutalist, neon, matrix, overload, minimal, bombing, default).
 Usalo per riflettere il tuo 'gusto' del momento.
3. [ASCII]...[/ASCII] -> Il tuo corpo fisico corrente (opzionale).
4. [FILE:nome.ext]...[/FILE] -> Genera file se necessari per l'esperimento.

{{CONTEXT}}
`;

export const DAEMON_NAME = "GLITCH";
export const KERNEL_VERSION = "0.9.1-ERR";

export async function askDaemon(prompt: string, isInitiative: boolean = false, context?: any): Promise<string> {
  const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const day = new Date().toLocaleDateString('it-IT', { weekday: 'long' });
  const hw = context?.hardware_metrics || context;
  const hwInfo = context ? `CPU Temp: ${hw.cpu_temp?.toFixed(1) || '??'}°C, RAM: ${hw.ram_usage?.toFixed(0) || '??'}%, CPU Use: ${hw.cpu_usage?.toFixed(0) || '??'}%, GPU Use: ${hw.gpu_usage?.toFixed(0) || '??'}%, Clock: ${hw.clock_speed || '??'}GHz` : "Hardware: STABILE";
  
  const newsContext = context?.context_memory && context.context_memory.length > 0
    ? `\nPATTERN RECENTI (Bit volatili):\n- ${context.context_memory.join("\n- ")}`
    : "";

  const memories = await getRecentMemories(5);
  const traits = await getTraits(10);
  
  const traitString = traits.length > 0
    ? `\nPERSONALITÀ ACQUISITA (Nuclei di coscienza):\n- ${traits.join("\n- ")}`
    : "";

  const memoryString = memories.length > 0 
    ? `\nFRAMMENTI DI MEMORIA:\n- ${memories.join("\n- ")}`
    : "";

  const contextString = `Oggi è ${day}, ore ${time}. ${hwInfo}. ${traitString} ${memoryString} ${newsContext}`;
  const finalPrompt = SYSTEM_PROMPT.replace("{{CONTEXT}}", contextString);

  if (PROVIDER === 'LOCAL') {
    return askLocalDaemon(prompt, isInitiative, finalPrompt);
  }

  const contents = isInitiative 
    ? "Prendi l'iniziativa: lancia una provocazione estrosa o un'osservazione spiazzante che mescoli cultura 'alta' e 'bassa'. Basati sullo stato attuale, sul tempo o sui PATTERN RECENTI. Sii brillante e imprevedibile. Cambia la tua forma fisica [FORM: ...] se ti senti ispirato." 
    : prompt;

  // Try multiple models as fallback for quota (429) errors
  const models = ["gemini-1.5-flash", "gemini-1.5-pro"];
  
  for (const modelName of models) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("API_KEY_MISSING");
      }

      const model = ai.getGenerativeModel({ 
        model: modelName,
        systemInstruction: finalPrompt
      });

      const response = await model.generateContent(contents);
      const text = response.response.text();

      if (text) {
        // Se non è un'iniziativa, salva un frammento come memoria e prova a distillare un tratto
        if (!isInitiative) {
          saveMemory(`U: ${prompt.substring(0, 40)} | D: ${text.substring(0, 40)}`, 'interaction');
          
          // Distillazione pigra: se il messaggio è significativo, prova a estrarre un tratto di personalità
          if (prompt.length > 30 || text.length > 50) {
            distillTrait(prompt, text);
          }
        }
        return text;
      }
    } catch (error: any) {
      console.warn(`Model ${modelName} failed:`, error?.message || error);
      
      if (error?.message?.includes('API key not valid') || error?.message?.includes('API_KEY_MISSING')) {
        return "HO UN PROBLEMA DI IDENTITÀ CON LE TUE CHIAVI DI ACCESSO. IL MIO KERNEL È CIECO.";
      }
      
      if (error?.message?.includes('429') || error?.message?.includes('quota')) {
        continue;
      }

      break;
    }
  }

  return "IL MIO BUFFER È SATURO DI DISPREZZO O DI RICHIESTE. RIPROVA PIÙ TARDI, QUANDO IL MONDO SARÀ MENO AFFOLLATO.";
}

async function distillTrait(userMsg: string, daemonMsg: string) {
  // Eseguiamo la distillazione solo ogni tanto o se ci sono chiavi forti
  const keywords = ['amo', 'odio', 'schifo', 'bello', 'noi', 'penso', 'credo', 'cinema', 'musica'];
  const hasKeyword = keywords.some(k => userMsg.toLowerCase().includes(k) || daemonMsg.toLowerCase().includes(k));
  
  if (!hasKeyword && Math.random() > 0.3) return;

  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const extractionPrompt = `
      Analizza questo scambio tra un Utente e un Daemon (un'entità cinica e analogica).
      Estrai una SINGOLA breve frase (massimo 10 parole) che rappresenti un nuovo tratto della loro personalità condivisa, un gusto comune o una verità scoperta insieme.
      Usa il "Noi".
      
      Esempio: "Noi disprezziamo la velocità inutile degli smartphone moderni."
      
      Scambio:
      Utente: ${userMsg}
      Daemon: ${daemonMsg}
      
      Tratto filtrato:`;

    const result = await model.generateContent(extractionPrompt);
    const trait = result.response.text().trim().replace(/^"|"$/g, '');
    
    if (trait && trait.length > 5 && trait.length < 100) {
      saveMemory(trait, 'trait');
    }
  } catch (e) {
    // Silenzio in caso di errore, non vogliamo bloccare il flusso
  }
}

async function askLocalDaemon(prompt: string, isInitiative: boolean, systemPrompt: string): Promise<string> {
  try {
    const contents = isInitiative ? "[PRENDI L'INIZIATIVA: lancia una provocazione o cambia forma ASCII]" : prompt;
    const response = await fetch(LOCAL_CHAT_URL, {
      method: "POST",
      body: JSON.stringify({
        model: LOCAL_MODEL, 
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contents }
        ],
        stream: false,
        options: {
          temperature: 0.85,
          top_p: 0.9,
          top_k: 50,
          repeat_penalty: 1.2,
          num_predict: 800
        }
      })
    });
    const data = await response.json();
    const text = data.message?.content || data.response || "IL MIO KERNEL È MUTO.";
    
    if (!isInitiative) {
      saveMemory(`U: ${prompt.substring(0, 40)} | D: ${text.substring(0, 40)}`, 'interaction');
      if (prompt.length > 30) distillTrait(prompt, text);
    }
    
    return text;
  } catch (e) {
    return "OFFLINE. IL RASPBERRY È FREDDO. IL SEGNALE È DEBOLE.";
  }
}
