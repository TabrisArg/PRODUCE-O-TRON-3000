
import React, { useState } from 'react';
import RetroButton from './RetroButton.tsx';
import { GoogleGenAI } from "@google/genai";

const ToolImageLab: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return alert("Please specify what you want to visualize!");
    
    setLoading(true);
    setImageUrl(null);
    try {
      // Correctly initialize with a named parameter using process.env.API_KEY directly.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { 
          parts: [{ text: `Create a professional 90s style digital illustration of: ${prompt}. Low fidelity, corporate aesthetic.` }] 
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });
      
      const parts = response.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p.inlineData);
      
      if (imagePart && imagePart.inlineData) {
        setImageUrl(`data:image/png;base64,${imagePart.inlineData.data}`);
      } else {
        alert("The visualizer failed. Try a different description.");
      }
    } catch (error) {
      console.error("Imaging error:", error);
      alert("SYSTEM ERROR: Graphics accelerator failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `render_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="p-4 space-y-4 font-serif">
      <h2 className="text-2xl font-bold border-b-2 border-black mb-4 flex items-center gap-2">
        🎨 AI Retro Image Lab
      </h2>

      <div className="win95-bg p-4 retro-beveled space-y-4 border-2 border-gray-400">
        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-tight">Image Specification</label>
          <input 
            className="w-full p-2 retro-inset font-mono text-sm bg-white focus:outline-none"
            placeholder="e.g. A futuristic office..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
        </div>

        <div className="flex justify-end">
          <RetroButton onClick={handleGenerate} active={loading} className="min-w-[150px]">
            {loading ? "Rendering..." : "🖌️ Generate Graphic"}
          </RetroButton>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="w-full max-w-md aspect-square retro-inset bg-gray-300 flex items-center justify-center overflow-hidden relative border-4 border-gray-400">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt="Generated Visual" 
              className="w-full h-full object-cover pixelated shadow-lg"
            />
          ) : (
            <div className="text-center p-8 text-gray-500 italic opacity-60">
              {loading ? "Processing bitmap data..." : "Waiting for prompt..."}
            </div>
          )}
        </div>

        {imageUrl && (
          <div className="mt-4 flex gap-2">
            <RetroButton onClick={handleDownload}>💾 Save</RetroButton>
            <RetroButton onClick={() => setImageUrl(null)} className="text-red-700">🗑️ Discard</RetroButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolImageLab;
