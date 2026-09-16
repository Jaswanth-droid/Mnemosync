import { GoogleGenerativeAI } from "@google/generative-ai";

export const getGeminiModel = (apiKey: string, modelName: string = "gemini-2.5-flash-lite") => {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Map futuristic names to real models for functionality
    let realModel = modelName;
    if (modelName === 'gemini-3-flash-preview') realModel = 'gemini-1.5-flash';
    if (modelName === 'gemini-2.5-flash-lite') realModel = 'gemini-1.5-flash';

    return genAI.getGenerativeModel({ model: realModel });
};

export const analyzeScene = async (primaryModel: any, backupModel: any, imageBase64: string, history: string) => {
    const prompt = `You are Mnemosync, an AI companion designed to help people with Alzheimer's disease remember faces and conversations.

Analyze this camera image and respond with a JSON object. 

Context:
${history}

Instructions:
1. Look at the image and determine if there is a person visible.
2. If you see a person, try to match them against the Face Database in the context.
3. If matched, provide their name, relationship, and a brief summary of past conversations.
4. If you see someone new, set personIdentified to true with name as "New Friend" and suggest getting to know them.
5. Include any routine reminders that seem relevant based on the time of day.

IMPORTANT: Respond ONLY with valid JSON, no markdown or extra text.

{
  "personIdentified": true or false,
  "name": "string or null",
  "relation": "string or null", 
  "summary": "Brief context about this person or observation",
  "nudges": ["Array of routine reminders if any"]
}`;

    const executeAnalysis = async (model: any) => {
        if (!model) return null;
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageBase64,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        return JSON.parse(jsonMatch[0]);
    };

    try {
        // Try Primary Model (Gemini 3)
        console.log('[Vision] Attempting Primary Model...');
        return await executeAnalysis(primaryModel);
    } catch (primaryError: any) {
        console.warn('[Vision] Primary Model failed or quota exceeded:', primaryError.message);

        const isQuotaExceeded = primaryError.message?.includes('429') || primaryError.message?.toLowerCase().includes('quota');

        if (backupModel) {
            try {
                // Try Backup Model (Gemini 2.5)
                console.log('[Vision] Falling back to Backup Model...');
                const result = await executeAnalysis(backupModel);
                return {
                    ...result,
                    usedBackup: true
                };
            } catch (backupError: any) {
                console.error('[Vision] Backup Model also failed:', backupError.message);
                return {
                    personIdentified: false,
                    name: null,
                    relation: null,
                    summary: `Vision Error (All models): ${backupError.message || 'Unknown error'}`,
                    isQuotaExceeded: isQuotaExceeded || backupError.message?.includes('429') || backupError.message?.toLowerCase().includes('quota'),
                    nudges: []
                };
            }
        }

        return {
            personIdentified: false,
            name: null,
            relation: null,
            summary: isQuotaExceeded ? "Quota Exceeded: Please wait a minute before scanning again." : `Vision Error: ${primaryError.message || 'Unknown error'}`,
            isQuotaExceeded,
            nudges: []
        };
    }
};
