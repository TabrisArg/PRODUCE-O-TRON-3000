
import React, { useState } from 'react';
import RetroButton from './RetroButton.tsx';
import { GoogleGenAI } from "@google/genai";

const ToolDrafter: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Professional");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return alert("Please specify what you need to draft!");
    
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a high-level corporate secretary in 1995. Draft a ${tone} memo or email based on the following instructions: "${prompt}". Use professional 90s corporate language.`,
      });
      
      setDraft(response.text || "The typewriter jammed. Please try again.");
    } catch (error) {
      console.error("Drafting error:", error);
      setDraft("SYSTEM ERROR: Failed to interface with the Drafting Engine.");
    } finally {
      setLoading(false);
    }
  };

  const copyToNotes = () => {
    const existing = localStorage.getItem('produce-o-tron-notes') || "";
    const updated = existing + (existing ? "\n\n--- AI DRAFT ---\n" : "") + draft;
    localStorage.setItem('produce-o-tron-notes', updated);
    alert("Draft appended to Quick Notes!");
  };

  return (
    <div className="p-4 space-y-4 font-serif">
      <h2 className="text-2xl font-bold border-b-2 border-black mb-4 flex items-center gap-2">
        ✍️ AI Document Drafter
      </h2>

      <div className="win95-bg p-4 retro-beveled space-y-4 border-2 border-gray-400">
        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-tight">Instruction / Topic</label>
          <textarea 
            className="w-full p-2 retro-inset font-mono text-sm h-24 bg-white focus:outline-none"
            placeholder="Example: Write a polite email to my boss asking for a raise, or a memo about the new water cooler policy."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-grow">
            <label className="block text-xs font-bold uppercase tracking-tight mb-1">Select Tone</label>
            <select 
              className="w-full win95-bg retro-beveled p-1 font-mono text-sm border-2 border-gray-600 outline-none"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              <option>Professional</option>
              <option>Casual</option>
              <option>Urgent</option>
              <option>Persuasive</option>
              <option>Apologetic</option>
            </select>
          </div>
          <div className="pt-5">
            <RetroButton onClick={handleGenerate} active={loading} className="w-full">
              {loading ? "Drafting..." : "📠 Execute Draft"}
            </RetroButton>
          </div>
        </div>
      </div>

      {draft && (
        <div className="space-y-2 mt-6">
          <div className="win95-bg p-1 retro-beveled text-[10px] font-bold px-2 flex justify-between">
            <span>WORD PROCESSOR - DRAFT_OUTPUT.TXT</span>
            <span>MODIFIED: {new Date().toLocaleTimeString()}</span>
          </div>
          <div className="retro-inset p-6 bg-white font-mono text-sm min-h-[300px] whitespace-pre-wrap leading-relaxed shadow-inner">
            {draft}
          </div>
          <div className="flex justify-end gap-2">
            <RetroButton onClick={() => {
              navigator.clipboard.writeText(draft);
              alert("Draft copied to clipboard!");
            }}>
              📋 Copy
            </RetroButton>
            <RetroButton onClick={copyToNotes}>
              📄 Send to Notes
            </RetroButton>
          </div>
        </div>
      )}

      {!draft && !loading && (
        <div className="p-12 border-2 border-dashed border-gray-400 text-center opacity-40 italic">
          Drafting engine on standby. Please enter instructions above.
        </div>
      )}
    </div>
  );
};

export default ToolDrafter;
