
import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini client following the guidelines: use a named parameter and direct process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const processFileListAI = async (fileList: string): Promise<string> => {
  try {
    // Generate content using the specified model and prompt as per guidelines.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a meticulous archivist in 1995. Take the following list of filenames and organize them into a professional, easy-to-read document inventory table. Categorize them if possible and explain briefly what each file likely is based on its name. 

Input list:
${fileList}`,
    });
    // Access the generated text directly through the .text property as per guidelines.
    return response.text || "Could not process files.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The disk drive encountered a read error. Please check your data and try again.";
  }
};
