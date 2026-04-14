import React, { useState } from 'react';
import { ToolType } from './types.ts';
import { TOOLS } from './constants.tsx';
import { ICONS } from './src/icons.ts';
import RetroButton from './components/RetroButton.tsx';
import ToolFileList from './components/ToolFileList.tsx';
import ToolCostSimulator from './components/ToolCostSimulator.tsx';
import ToolProjectArchitect from './components/ToolProjectArchitect.tsx';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.HOME);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const renderTool = () => {
    switch (activeTool) {
      case ToolType.HOME:
        return (
          <div className="flex flex-col items-center justify-center p-8 space-y-8 h-full min-h-[500px]">
            <h2 className="text-4xl md:text-8xl font-black text-blue-900 italic tracking-tighter text-center select-none drop-shadow-sm">
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
        return <div className="p-8 italic text-gray-500 text-black">Select a tool from the sidebar.</div>;
    }
  };

  return (
    <div className="max-w-[100vw] xl:max-w-[95%] mx-auto flex flex-col gap-6 px-2 md:px-0">
      {/* Top Header Panel */}
      <header className="w-full">
        <div className="win95-bg retro-beveled p-4 flex items-center justify-center shadow-md border-2 border-gray-300">
          <div className="flex items-center gap-4 md:gap-6 overflow-hidden">
            {/* Left GIF */}
            <img 
              src="https://i.ibb.co/xKF8SJwF/left-gif.gif" 
              alt="" 
              className="h-12 md:h-20 w-auto pixelated shrink-0" 
            />
            
            <div className="flex flex-col items-center min-w-0">
              <h1 className="text-3xl md:text-6xl font-black text-blue-900 tracking-tighter leading-none whitespace-nowrap">
                PRODUCE-O-TRON
              </h1>
            </div>

            {/* Right GIF (Mirrored) */}
            <img 
              src="https://i.ibb.co/cXbnZTVJ/mummy.gif" 
              alt="" 
              className="h-12 md:h-20 w-auto pixelated -scale-x-100 shrink-0" 
            />
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 relative">
        {/* Left Sidebar Navigation */}
        <nav className={`w-full lg:transition-all lg:duration-300 flex flex-col gap-2 shrink-0 ${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}>
          <div className="win95-bg retro-beveled p-2 flex flex-col gap-2 shadow-md border-2 border-gray-300 h-fit relative">
            {/* Collapse Toggle Button (Desktop Only) */}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex absolute -right-3 top-4 w-6 h-6 win95-bg border-2 border-gray-400 items-center justify-center text-[10px] font-bold shadow-sm hover:bg-gray-100 z-50"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? "»" : "«"}
            </button>

            <div className={`text-[10px] font-bold text-gray-600 uppercase px-2 mb-1 border-b border-gray-400 truncate ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
              {isSidebarCollapsed ? "..." : "Main Menu"}
            </div>

            <RetroButton 
              active={activeTool === ToolType.HOME}
              onClick={() => setActiveTool(ToolType.HOME)}
              className={`w-full justify-start text-xs font-bold uppercase py-2 ${isSidebarCollapsed ? '!p-0 aspect-square justify-center min-w-0' : 'px-2'}`}
            >
              <span className="text-xl shrink-0">
                <img src={ICONS.HOME} alt="home" className="w-5 h-5" />
              </span>
              {!isSidebarCollapsed && <span className="ml-2">Home Portal</span>}
            </RetroButton>

            {TOOLS.map((tool) => (
              <RetroButton 
                key={tool.id}
                active={activeTool === tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`w-full justify-start text-xs font-bold uppercase py-2 ${isSidebarCollapsed ? '!p-0 aspect-square justify-center min-w-0' : 'px-2'}`}
              >
                <span className="text-xl shrink-0">{tool.icon}</span>
                {!isSidebarCollapsed && <span className="ml-2 truncate">{tool.name}</span>}
              </RetroButton>
            ))}
          </div>
        </nav>

        {/* Main Workspace */}
        <main className="flex-grow win95-bg retro-beveled p-2 md:p-4 lg:p-6 shadow-2xl relative overflow-hidden min-h-[600px] border-2 border-gray-300">
          {/* Subtle Watermark Background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] text-6xl md:text-9xl font-black rotate-[-15deg] select-none uppercase">
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