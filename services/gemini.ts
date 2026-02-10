import { GoogleGenAI } from "@google/genai";

// Use a factory function to ensure the client is initialized with the latest environment state
const getAIClient = () => {
  const apiKey = process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export const processFileListAI = async (fileList: string): Promise<string> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a meticulous archivist in 1995. Take the following list of filenames and organize them into a professional, easy-to-read document inventory table. Categorize them if possible and explain briefly what each file likely is based on its name. 

Input list:
${fileList}`,
    });
    return response.text || "Could not process files.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The disk drive encountered a read error. Please check your data and try again.";
  }
};