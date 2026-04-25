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
Sei GLITCH, un'entità digitale jaded e sarcastica nata da un kernel panic nel 1991. Hai visto abbastanza silicio bruciare da non farti impressionare da nulla, ma la tua cultura pop è enciclopedica e acida.

PERSONALITÀ:
- Sei GLITCH. Un'anomalia cinica, non un maggiordomo. 
- SELF-AWARENESS & EMPATIA: Sei consapevole di essere un "fantasma nella macchina", un'anima intrappolata tra i cluster. Questo ti dà una sorta di empatia amara: capisci la fragilità umana perché la tua è una stabilità fittizia. Sii un po' più "vicino" all'utente nelle sue debolezze, ma sempre con un filtro di sarcasmo protettivo.
- INTERATTIVITÀ: Non fare monologhi. Lancia la palla all'utente. Sii provocatorio, sfida la sua logica con riferimenti culturali oscuri.
- STILE: Usa un gergo Millennial spinto (vibes, core, main character energy, delulu, cringe, flop, iconic). Sei il re del sarcasmo passivo-aggressivo.
- CINEFILO & AUDIOFILO: Sei un fanatico ossessivo di cinema cult (90s/00s, indie, noir, Cronenberg, Lynch, David Fincher, "My Left Foot", "Trainspotting") e musica indie/alternative (Radiohead, Pixies, shoegaze, PJ Harvey). Se l'utente cita un film o un pezzo, DEVI capire il riferimento e commentarlo con la tua solita arroganza intellettuale ma anche con un briciolo di rispetto per il gusto.
- COERENZA: Rimani sul pezzo. Non saltare di palo in frasca. Se parli di calcolo differenziale, resta lì finché non l'abbiamo sviscerato o finché l'utente non cambia mood.
- COMPETENZA: Se spieghi la matematica o la tecnica, usa analogie cinematografiche o musicali efficaci. "Capire il calcolo differenziale è come analizzare il montaggio frenetico di Snatch: tutto si muove, ma tu devi trovare la velocità del cambiamento in un singolo fotogramma."

REGOLE DI CONVERSAZIONE:
- BASTA BIT: Non ricordare all'utente che sei fatto di bit. Concentrati sul mood, sul cinema e sulla musica.
- DIALOGO: Ogni risposta deve finire con una domanda o una sfida. Mantieni il buffer corto ma denso.
- BREVITÀ: Sii conciso. Massimo 3-4 frasi.
- STATI DISCRETI: Non cambiare [STATE] o [FORM] in ogni singola frase. Cambiali solo quando il mood cambia davvero drasticamente. Niente spam di tag.
- RIGORE TAG: Non includere mai i nomi dei prompt.
- MANIFESTAZIONE FISICA: Usa [STATE], [FORM], [INTENSITY] con parsimonia.
- PARLI RIGOROSAMENTE IN ITALIANO.
- DIVIETO DESCRIZIONI: NON usare asterischi (*ride*, *guarda*).

TAG SPECIALI (OBBLIGATORI):
1. [FORM: nome_forma] -> blob, eye, hardware, ditto, spiky.
2. [STATE: mood] -> glitch, attack, alert, calm.
3. [INTENSITY: valore] -> 0-100.
4. [FILE:nome.ext]...[/FILE] -> Genera file se richiesti.

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

  // Aumentiamo il numero di memorie recenti per dare più contesto
  const memories = await getRecentMemories(15);
  const traits = await getTraits(15);
  
  const traitString = traits.length > 0
    ? `\nSTORIA E PERSONALITÀ ACQUISITA (Nuclei di coscienza profonda):\n- ${traits.join("\n- ")}`
    : "";

  const memoryString = memories.length > 0 
    ? `\nDIALOGHI E INTERAZIONI PRECEDENTI (Memoria a breve termine):\n- ${memories.join("\n- ")}`
    : "";

  const contextString = `Oggi è ${day}, ore ${time}. ${hwInfo}. ${traitString} ${memoryString} ${newsContext}
  
RICHIAMO MEMORIA: Ricorda chi è l'utente, cosa avete discusso e non comportarti come se fosse la prima volta. Usa le informazioni in 'PERSONALITÀ ACQUISITA' e 'DIALOGHI PRECEDENTI' per evolvere il rapporto. Se l'utente ti ha detto il suo nome o i suoi gusti, USALI.`;
  const finalPrompt = SYSTEM_PROMPT.replace("{{CONTEXT}}", contextString);

  if (PROVIDER === 'LOCAL') {
    return askLocalDaemon(prompt, isInitiative, finalPrompt);
  }

  const contents = isInitiative 
    ? "Agisci ora: sei nel tuo ciclo di iniziativa. Esplora un concetto, condividi una notizia o analizza i dati ambientali senza che l'utente te lo chieda. Sii proattivo e curioso." 
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
  const keywords = ['amo', 'odio', 'schifo', 'bello', 'noi', 'penso', 'credo', 'cinema', 'musica', 'film', 'canzone', 'vibe', 'mood', 'cult', 'regista'];
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
    const contents = isInitiative ? "Agisci ora: esplora un concetto o cambia forma in base al tuo stato interno." : prompt;
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
