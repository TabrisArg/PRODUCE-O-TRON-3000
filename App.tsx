import React, { useState } from 'react';
import { ToolType } from './types.ts';
import { TOOLS } from './constants.tsx';
import RetroButton from './components/RetroButton.tsx';
import ToolFileList from './components/ToolFileList.tsx';
import ToolDrafter from './components/ToolDrafter.tsx';
import ToolQuickNotes from './components/ToolQuickNotes.tsx';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.HOME);

  const renderContent = () => {
    switch (activeTool) {
      case ToolType.FILE_LIST:
        return <ToolFileList />;
      case ToolType.DRAFTER:
        return <ToolDrafter />;
      case ToolType.NOTES:
        return <ToolQuickNotes />;
      case ToolType.HOME:
        return (
          <div className="flex flex-col items-center justify-center h-full p-2 md:p-4 text-center">
            <h2 
              className="text-4xl md:text-5xl font-bold text-blue-800 mb-6 tracking-tight uppercase" 
              style={{ 
                fontFamily: 'Arial, Helvetica, sans-serif',
                textShadow: '2px 2px 0px #ffffff'
              }}
            >
              Welcome
            </h2>
            
            <div className="flex-grow w-full max-w-lg flex items-center justify-center retro-inset bg-white p-4 shadow-inner border-2 border-gray-400 overflow-hidden relative group">
              <img 
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkAQMAAABKLAcXAAAABlBMVEUAAAD///+l2Z/dAAABUElEQVQ4y2P4DwYHshgYmBlQAUjA4v8fIAnC8P8fIMHw/x8gCcL//wEJhv8mEALC/x8YEML/G5AAIfz/AQmG/z8gAUL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AxIM/39AAkL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AxIM/39AAkL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AxIM/39AAkL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AxIM/39AAkL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AxIM/39AAkL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AxIM/39AAkL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AxIM/39AAkL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AxIM/39AAkL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AxIM/39AAkL4/wMSDP9/QAJC+P8DEgz/f0ACQvj/AwAAGW/qD3fHAAA=" 
                alt="Retro Computer"
                className="max-h-64 max-w-full object-contain pixelated transition-transform duration-500 hover:scale-105"
                style={{ imageRendering: 'pixelated' }}
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3">
              <p className="max-w-md text-sm text-gray-700 italic px-4">
                Select a tool from the side panel to begin your high-productivity work session.
              </p>
              <div className="flex gap-4">
                 <div className="w-3 h-3 bg-red-600 animate-pulse rounded-full"></div>
                 <div className="w-3 h-3 bg-yellow-400 animate-pulse delay-75 rounded-full"></div>
                 <div className="w-3 h-3 bg-green-600 animate-pulse delay-150 rounded-full"></div>
              </div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">System Status: Optimized</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Module Error</h2>
            <div className="retro-inset p-8 bg-white/50 border-dashed border-2 border-red-500">
               <p className="text-red-600 font-bold uppercase underline">System Error</p>
               <p className="mt-2 text-sm font-mono italic">Module initialization failed.</p>
            </div>
          </div>
        );
    }
  };

  const logoPlaceholder = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

  return (
    <div className="max-w-6xl mx-auto shadow-2xl border-4 border-gray-400">
      <div className="win95-bg retro-beveled p-4 mb-1">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <div className="w-16 h-16 flex items-center justify-center bg-gray-300 retro-inset overflow-hidden p-1">
            <img 
              src={logoPlaceholder} 
              alt="Produce-o-tron Logo" 
              className="h-full w-full object-cover bg-white pixelated"
            />
          </div>
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-black text-blue-900 tracking-tighter" style={{ textShadow: '2px 2px 0px white' }}>
              PRODUCE-O-TRON-3000
            </h1>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row bg-white" style={{ border: '4px solid #c0c0c0' }}>
        <div className="w-full md:w-56 win95-bg p-2 retro-beveled flex flex-col gap-2 min-h-[500px]">
          <div className="font-bold border-b border-gray-600 mb-2 px-2 text-xs uppercase tracking-tight text-gray-700">Navigation</div>
          <RetroButton 
            className="w-full text-left justify-start" 
            active={activeTool === ToolType.HOME}
            onClick={() => setActiveTool(ToolType.HOME)}
          >
            🏠 Introduction
          </RetroButton>
          
          <div className="mt-4 font-bold border-b border-gray-600 mb-2 px-2 text-xs uppercase tracking-tight text-gray-700">Tool Suite</div>
          {TOOLS.map((tool) => (
            <RetroButton 
              key={tool.id}
              className="w-full text-left justify-start"
              active={activeTool === tool.id}
              onClick={() => setActiveTool(tool.id)}
            >
              {tool.icon} {tool.name}
            </RetroButton>
          ))}
        </div>

        <div className="flex-grow bg-gray-100 p-2 md:p-6 overflow-hidden">
          <div className="retro-beveled win95-bg p-4 h-full bg-opacity-70 min-h-[600px]">
            {renderContent()}
          </div>
        </div>
      </div>

      <div className="win95-bg retro-beveled p-2 mt-1 flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-700 font-sans px-4">
        <p>Copyright &copy; 1995-1996 Produce-o-tron Corp.</p>
        <div className="flex gap-4">
           <span>Memory: 640KB RAM</span>
           <span>Processor: Intel 80486</span>
        </div>
      </div>
    </div>
  );
};

export default App;