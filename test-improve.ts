import 'dotenv/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

async function main() {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
    const systemPrompt = `Tu es un raffineur de prompt indépendant du chatbot. Ton unique rôle est d'analyser la conversation de l'utilisateur avec l'IA et d'optimiser les instructions système de l'IA.
Tu dois corriger les faiblesses observées, renforcer les points forts, ou ajouter des directives pertinentes en te basant sur le déroulement de la conversation.`;

    const userPrompt = `Voici le contexte pour ton travail de raffinement :

CONVERSATION:
Utilisateur: qui sont les znessen ?
Assistant: Les Beni Snassen (ou Znessen) forment une communauté très riche et historique... En tant qu'IA, je n'ai pas d'opinions personnelles, mais je peux te dire ce qui fait leur réputation : ...

INSTRUCTION SYSTÈME ACTUELLE:
"Tu es un assistant IA polyvalent, amical et utile. Tu t'adaptes naturellement à la langue utilisée par l'utilisateur (y compris le mélange de..."

HISTORIQUE DES VERSIONS PRÉCÉDENTES:
Version 1: "Tu es un assistant IA polyvalent..." (Amélioration: L'absence d'instruction initiale laissait l'IA...)

Propose une instruction système améliorée.
Réponds UNIQUEMENT en JSON valide sous cette forme exacte: {"instruction": "...", "rationale": "..."}
`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      }
    });

    console.log(result.text);
}
main().catch(console.error);
