
import React, { useState, useEffect } from 'react';
import RetroButton from './RetroButton.tsx';

const ToolQuickNotes: React.FC = () => {
  const [notes, setNotes] = useState<string>(() => {
    return localStorage.getItem('produce-o-tron-notes') || "";
  });

  useEffect(() => {
    localStorage.setItem('produce-o-tron-notes', notes);
  }, [notes]);

  const handleClear = () => {
    if (confirm("Are you sure you want to clear your notes? This cannot be undone.")) {
      setNotes("");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([notes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4 font-serif h-full flex flex-col">
      <h2 className="text-2xl font-bold border-b-2 border-black mb-4 flex items-center gap-2">
        📝 Quick Notes
      </h2>

      <div className="flex-grow flex flex-col min-h-[400px]">
        <div className="win95-bg p-1 retro-beveled mb-2 flex justify-between items-center text-xs px-2">
          <span>Untitled - Notepad</span>
          <span className="opacity-70">Char Count: {notes.length}</span>
        </div>
        
        <textarea
          className="flex-grow p-4 retro-inset font-mono text-sm resize-none focus:outline-none bg-white"
          placeholder="Start typing your notes here... they are saved automatically to your local storage."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <RetroButton onClick={handleDownload}>
          💾 Save to Disk (.txt)
        </RetroButton>
        <RetroButton onClick={handleClear} className="text-red-800">
          🗑️ Clear All
        </RetroButton>
      </div>
    </div>
  );
};

export default ToolQuickNotes;
