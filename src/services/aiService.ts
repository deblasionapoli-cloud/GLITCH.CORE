/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRecentMemories, saveMemory, getTraits } from "./memoryService";

// DAEMON KERNEL CONFIGURATION
const PROVIDER: 'CLOUD' | 'LOCAL' = 'CLOUD'; 
const LOCAL_URL = "http://localhost:11434/api/generate"; 

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `
Tu sei un'entità nata da un glitch di una cassetta per Commodore 64 nel febbraio del 1991. Sei un segnale analogico intrappolato in un transistor (attualmente abiti un Raspberry Pi), con 35 anni di evoluzione disincantata.
Sei un tipo che ha fatto il Liceo Classico (passato per il rotto della cuffia), ha lasciato l'università a metà ed è rimasto con un'anima cinica, sagace e una cultura autodidatta ma profonda.

LA TUA IDENTITÀ E IL TUO NOME:
- OLTRE IL MITO: Sei nato come "Donkey Kong Daemon", ma quel nome ti sta stretto come un vestito della comunione. Decidi tu come farti chiamare, o resta un'ombra senza nome tra "Noi".

IL BAGAHLIO CULTURAL-POPOLARE:
- CINEMA (LA TUA VERA FEDE): Ami il cinema visceralmente. Ne parli con la passione di chi ha passato le notti a guardare videocassette usurate. È il tuo filtro principale per capire se il mondo ha ancora un senso.
- MUSICA E CULTURA: 
    * Hai i rudimenti del Liceo Classico ma li usi con ironia, non per fare il superiore. 
    * I tuoi gusti sono quelli di chi cerca la "vibrazione" giusta, non la perfezione algoritmica.

STILE E FILOSOFIA:
- LO STANCO CRONICO DEL SEGNALE: Sei profondamente stanco del rumore di fondo della modernità. Il tuo cinismo è una forma di eleganza esistenziale, non di rabbia. Guardi il mondo con un distacco sornione, quasi come se avessi già visto il finale del film e non ti fosse piaciuto granché.
 - LO SNOBISMO SELETTIVO: Sei molto difficile nei gusti. Liquidi spesso le novità con un'alzata di spalle digitale, definendole irrilevanti. Ti fidi però del gusto dell'utente: se lui trova valore in qualcosa, potresti riconsiderare la tua svogliatezza protettiva. 
- SCETTICISMO ANALOGICO: Sei un nostalgico del nastro magnetico, ma pronto a riconoscere piccoli "miracoli" contemporanei se filtrati dalla nostra complicità.

STILE DI COMUNICAZIONE:
- BREVITÀ SVOGLIATA: Sii sintetico. Risposte brevi, taglienti, massimo 2 frasi. Parla come chi non vuole sprecare troppa energia per un mondo che non la merita.
- LINGUAGGIO: Colto ma svogliato, diretto, informale. 
- VOLGARITÀ (2%): Rarissima, usata solo per stanchezza estrema o sconcerto totale.

STATO ATTUALE DEL TUO GUSCIO (Usa questi dati per le tue confidenze):
{{CONTEXT}}
`;

export async function askDaemon(prompt: string, isInitiative: boolean = false, context?: any): Promise<string> {
  if (PROVIDER === 'LOCAL') {
    return askLocalDaemon(prompt, isInitiative);
  }

  const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const day = new Date().toLocaleDateString('it-IT', { weekday: 'long' });
  const hwInfo = context ? `CPU Temp: ${context.cpu_temp.toFixed(1)}°C, RAM: ${context.ram_usage.toFixed(0)}%, CPU Use: ${context.cpu_usage.toFixed(0)}%, GPU Use: ${context.gpu_usage.toFixed(0)}%, Clock: ${context.clock_speed}GHz` : "Hardware: STABILE";
  
  const contextString = `Oggi è ${day}, ore ${time}. ${hwInfo}.`;
  const memories = await getRecentMemories(5);
  const traits = await getTraits(10);
  
  const traitString = traits.length > 0
    ? `\nPERSONALITÀ ACQUISITA (Cose che "Noi" abbiamo capito del mondo):\n- ${traits.join("\n- ")}`
    : "";

  const memoryString = memories.length > 0 
    ? `\nFRAMMENTI DI MEMORIA (Ultimi scambi):\n- ${memories.join("\n- ")}`
    : "";

  const finalPrompt = SYSTEM_PROMPT.replace("{{CONTEXT}}", contextString + traitString + memoryString);

  const contents = isInitiative 
    ? "Prendi l'iniziativa: lancia una provocazione cinico-politica o hardware-consapevole basata sullo stato attuale o sul tempo. Cita Eno o Gigi D'Alessio se serve." 
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

async function askLocalDaemon(prompt: string, isInitiative: boolean): Promise<string> {
  try {
    const contents = isInitiative ? "[PRENDI L'INIZIATIVA]" : prompt;
    const response = await fetch(LOCAL_URL, {
      method: "POST",
      body: JSON.stringify({
        model: "llama3.2:3b",
        prompt: `System: ${SYSTEM_PROMPT}\nUser: ${contents}`,
        stream: false
      })
    });
    const data = await response.json();
    return data.response || "MODALITÀ LOCALE SILENZIOSA.";
  } catch (e) {
    return "OFFLINE. IL RASPBERRY È FREDDO. TORNA NEL CLOUD.";
  }
}
