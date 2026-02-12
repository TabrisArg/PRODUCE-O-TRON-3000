import React, { useState } from 'react';
import { ToolType } from './types.ts';
import { TOOLS } from './constants.tsx';
import RetroButton from './components/RetroButton.tsx';
import ToolFileList from './components/ToolFileList.tsx';
import ToolCostSimulator from './components/ToolCostSimulator.tsx';
import ToolProjectArchitect from './components/ToolProjectArchitect.tsx';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.HOME);

  const renderTool = () => {
    switch (activeTool) {
      case ToolType.HOME:
        return (
          <div className="flex flex-col items-center justify-center p-8 space-y-8 h-full min-h-[500px]">
            <h2 className="text-8xl font-black text-blue-900 italic tracking-tighter text-center select-none drop-shadow-sm">
              WELCOME
            </h2>
            
            <div className="w-full max-w-5xl retro-inset bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-gray-400 shadow-inner">
              <img 
                src="https://i.ibb.co/TBxrr7WC/picture.jpg" 
                alt="System Visual" 
                className="w-full h-auto block"
              />
            </div>
          </div>
        );
      case ToolType.FILE_LIST:
        return <ToolFileList />;
      case ToolType.COST_SIMULATOR:
        return <ToolCostSimulator />;
      case ToolType.PROJECT_ARCHITECT:
        return <ToolProjectArchitect />;
      default:
        return <div className="p-8 italic text-gray-500">Select a tool from the sidebar.</div>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Top Header Panel */}
      <header className="w-full">
        <div className="win95-bg retro-beveled p-4 flex items-center justify-center shadow-md border-2 border-gray-300">
          <div className="flex items-center gap-6">
            {/* Left GIF */}
            <img 
              src="https://i.ibb.co/xKF8SJwF/left-gif.gif" 
              alt="" 
              className="h-20 w-auto pixelated" 
            />
            
            <div className="flex flex-col items-center">
              <h1 className="text-6xl font-black text-blue-900 tracking-tighter leading-none">
                PRODUCE-O-TRON
              </h1>
            </div>

            {/* Right GIF (Mirrored) */}
            <img 
              src="https://i.ibb.co/cXbnZTVJ/mummy.gif" 
              alt="" 
              className="h-20 w-auto pixelated -scale-x-100" 
            />
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sidebar Navigation */}
        <nav className="w-full md:w-56 flex flex-col gap-2 shrink-0">
          <div className="win95-bg retro-beveled p-2 flex flex-col gap-2 shadow-md border-2 border-gray-300 h-fit">
            <div className="text-[10px] font-bold text-gray-600 uppercase px-2 mb-1 border-b border-gray-400">Main Menu</div>
            <RetroButton 
              active={activeTool === ToolType.HOME}
              onClick={() => setActiveTool(ToolType.HOME)}
              className="w-full justify-start text-xs font-bold uppercase py-2"
            >
              <span className="text-xl">🏠</span>
              <span>Home Portal</span>
            </RetroButton>

            {TOOLS.map((tool) => (
              <RetroButton 
                key={tool.id}
                active={activeTool === tool.id}
                onClick={() => setActiveTool(tool.id)}
                className="w-full justify-start text-xs font-bold uppercase py-2"
              >
                <span className="text-xl">{tool.icon}</span>
                <span className="truncate">{tool.name}</span>
              </RetroButton>
            ))}
          </div>
        </nav>

        {/* Main Workspace */}
        <main className="flex-grow win95-bg retro-beveled p-4 md:p-8 shadow-2xl relative overflow-hidden min-h-[600px] border-2 border-gray-300">
          {/* Subtle Watermark Background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] text-9xl font-black rotate-[-15deg] select-none uppercase">
            Confidential
          </div>
          
          <div className="relative z-10 h-full border-2 border-gray-400 p-1 bg-gray-100/30">
            <div className="bg-white h-full overflow-auto retro-inset shadow-inner rounded-sm">
              {renderTool()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;