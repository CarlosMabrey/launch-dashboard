
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "../constants";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateIcon = async (userPrompt: string): Promise<string> => {
  const ai = getAI();
  const fullPrompt = `${SYSTEM_PROMPT}\n\nUser Request: ${userPrompt}. Ensure the output is a high-resolution, centered square icon with rounded corners in the style of Apple icons.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: fullPrompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image data returned from Gemini");
};

export const editIcon = async (base64Image: string, editPrompt: string): Promise<string> => {
  const ai = getAI();
  const mimeType = base64Image.split(';')[0].split(':')[1];
  const imageData = base64Image.split(',')[1];

  const fullPrompt = `${SYSTEM_PROMPT}\n\nTask: Edit this icon based on the following instruction: "${editPrompt}". Maintain the existing composition but apply the requested changes perfectly in the Apple aesthetic.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: imageData,
            mimeType: mimeType
          }
        },
        { text: fullPrompt }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No edited image data returned from Gemini");
};
