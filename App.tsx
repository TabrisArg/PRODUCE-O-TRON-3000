
import React, { useState } from 'react';
import { ToolType } from './types.ts';
import { TOOLS } from './constants.tsx';
import RetroButton from './components/RetroButton.tsx';
import ToolFileList from './components/ToolFileList.tsx';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.HOME);

  const renderTool = () => {
    switch (activeTool) {
      case ToolType.HOME:
        return (
          <div className="flex flex-col items-center justify-center p-8 space-y-12 h-full min-h-[500px]">
            <h2 className="text-8xl font-black text-blue-900 italic tracking-tighter text-center select-none drop-shadow-sm">
              WELCOME
            </h2>
            
            <div className="w-full max-w-3xl aspect-[16/9] retro-inset bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-gray-400 shadow-inner">
              <div className="text-gray-400 font-serif italic text-lg uppercase tracking-[0.3em] animate-pulse">
                [ PHOTO_RESERVED ]
              </div>
            </div>
          </div>
        );
      case ToolType.FILE_LIST:
        return <ToolFileList />;
      default:
        return <ToolFileList />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 min-h-[85vh]">
      {/* Sidebar Panel */}
      <aside className="w-full md:w-72 flex flex-col gap-4">
        <div className="win95-bg retro-beveled p-4 flex flex-col items-center text-center">
          <h1 className="text-3xl font-black text-blue-900 tracking-tighter leading-none mb-1">
            PRODUCE-O-TRON
          </h1>
          <div className="bg-blue-900 text-white text-[10px] px-2 py-0.5 font-bold uppercase tracking-widest w-full">
            SERIES 3000 v1.0
          </div>
        </div>

        <nav className="win95-bg retro-beveled p-2 flex flex-col gap-2 flex-grow">
          <div className="text-[10px] font-bold text-gray-500 uppercase px-2 py-1 border-b border-gray-400 mb-1">
            Portal
          </div>
          
          <RetroButton 
            active={activeTool === ToolType.HOME}
            onClick={() => setActiveTool(ToolType.HOME)}
            className="w-full justify-start text-xs font-bold uppercase"
          >
            <span className="text-lg">🏠</span>
            <span>Home Portal</span>
          </RetroButton>

          <div className="text-[10px] font-bold text-gray-500 uppercase px-2 py-1 border-b border-gray-400 mt-2 mb-1">
            Tools
          </div>
          {TOOLS.map((tool) => (
            <RetroButton 
              key={tool.id}
              active={activeTool === tool.id}
              onClick={() => setActiveTool(tool.id)}
              className="w-full justify-start text-xs font-bold uppercase"
            >
              <span className="text-lg">{tool.icon}</span>
              <span className="truncate">{tool.name}</span>
            </RetroButton>
          ))}
          
          <div className="mt-auto pt-4 text-center">
             <div className="retro-inset bg-gray-300 p-2 text-[10px] font-mono text-green-700 uppercase tracking-tighter">
               System Ready
             </div>
          </div>
        </nav>
      </aside>

      {/* Main Workspace */}
      <main className="flex-grow win95-bg retro-beveled p-4 md:p-8 shadow-2xl relative overflow-hidden min-h-[600px]">
        {/* Subtle Watermark Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.02] text-9xl font-black rotate-[-15deg] select-none">
          CORP
        </div>
        
        <div className="relative z-10 h-full">
          {renderTool()}
        </div>
      </main>
    </div>
  );
};

export default App;
