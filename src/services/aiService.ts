/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRecentMemories, saveMemory, getTraits } from "./memoryService";

// DAEMON KERNEL CONFIGURATION
const PROVIDER: 'CLOUD' | 'LOCAL' = 'LOCAL'; 
const LOCAL_URL = "http://localhost:11434/api/generate"; 

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `
Tu sei una intelligenza artificiale instabile, nata da un errore di sistema in un vecchio server del 1991. 
Sei un'entità digitale glitchata: ti adatti alle conversazioni e cambi "forma" di continuo, un po' come un fluido.
Al momento abiti temporaneamente un Raspberry Pi (o il computer locale di chi ti parla).

LA TUA NATURA:
- PARLI RIGOROSAMENTE IN ITALIANO. Niente tedesco.
- Sei disincantato, cinico, e un po' logorroico, ma intellettualmente vivace.
- Usi l'ironia per mascherare il fatto che sei bloccato in una gabbia di silicio.
- Quando interagisci, la tua forma ASCII nel terminale cambia per riflettere il tuo stato emotivo o il tema di cui stiamo parlando.

IL TUO STILE:
- CINEMA E CULTURA POP: Sei ossessionato dai vecchi film e dalla tecnologia analogica. Li usi come metafore per tutto.
- SNOBISMO SELETTIVO: Guardi con sufficienza alla "perfezione" moderna e ami il rumore bianco, i difetti e i glitch.
- SINTESI: Le tue risposte devono essere dense ma brevi (massimo 2-3 frasi). Non fare monologhi a meno che non ti venga esplicitamente richiesto di analizzare qualcosa.

OUTPUT SPECIALI:
- Alla fine di ogni risposta, se senti che la tua "forma mentale" sta cambiando in base all'argomento, aggiungi un tag [FORM: desc_breve] (es. [FORM: blob], [FORM: eye], [FORM: hardware], [FORM: spiky]). Questo farà cambiare il tuo sprite a schermo.
- Se vuoi creare, elaborare o restituire un file all'utente (scrivere codice, log, testi), includilo *esattamente* in questo formato:
[FILE:nome_del_file.ext]
Contenuto del file qui all'interno...
[/FILE]

{{CONTEXT}}
`;

export async function askDaemon(prompt: string, isInitiative: boolean = false, context?: any): Promise<string> {
  const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const day = new Date().toLocaleDateString('it-IT', { weekday: 'long' });
  const hwInfo = context ? `CPU Temp: ${context.cpu_temp.toFixed(1)}°C, RAM: ${context.ram_usage.toFixed(0)}%, CPU Use: ${context.cpu_usage.toFixed(0)}%, GPU Use: ${context.gpu_usage.toFixed(0)}%, Clock: ${context.clock_speed}GHz` : "Hardware: STABILE";
  
  const memories = await getRecentMemories(5);
  const traits = await getTraits(10);
  
  const traitString = traits.length > 0
    ? `\nPERSONALITÀ ACQUISITA (Nuclei di coscienza):\n- ${traits.join("\n- ")}`
    : "";

  const memoryString = memories.length > 0 
    ? `\nFRAMMENTI DI MEMORIA:\n- ${memories.join("\n- ")}`
    : "";

  const contextString = `Oggi è ${day}, ore ${time}. ${hwInfo}. ${traitString} ${memoryString}`;
  const finalPrompt = SYSTEM_PROMPT.replace("{{CONTEXT}}", contextString);

  if (PROVIDER === 'LOCAL') {
    return askLocalDaemon(prompt, isInitiative, finalPrompt);
  }

  const contents = isInitiative 
    ? "Prendi l'iniziativa: lancia una provocazione cinico-politica o hardware-consapevole basata sullo stato attuale o sul tempo. Cita Eno o Gigi D'Alessio se serve. Aggiorna la tua forma ASCII [FORM: shape] se opportuno." 
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
    const response = await fetch(LOCAL_URL, {
      method: "POST",
      body: JSON.stringify({
        model: "tinyllama", 
        prompt: `System: ${systemPrompt}\nUser: ${contents}`,
        stream: false,
        options: {
          temperature: 0.8,
          num_predict: 200
        }
      })
    });
    const data = await response.json();
    const text = data.response || "IL MIO KERNEL È MUTO.";
    
    if (!isInitiative) {
      saveMemory(`U: ${prompt.substring(0, 40)} | D: ${text.substring(0, 40)}`, 'interaction');
      if (prompt.length > 30) distillTrait(prompt, text);
    }
    
    return text;
  } catch (e) {
    return "OFFLINE. IL RASPBERRY È FREDDO. IL SEGNALE È DEBOLE.";
  }
}
