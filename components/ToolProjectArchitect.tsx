import React, { useState, useMemo } from 'react';
import RetroButton from './RetroButton.tsx';
import ExcelJS from 'exceljs';
import { GAME_DEV_DISCIPLINES, Discipline } from '../disciplines.ts';

interface Resource {
  id: string;
  name: string;
  monthlyCost: number;
  isOverride: boolean;
  role: string;
  // Map of "YYYY-MM" to allocation factor (0.0 to 1.0)
  allocations: Record<string, number>;
}

interface BacklogItem {
  task: string;
  effort: number;
}

const EFFORT_UNITS = [
  { id: 'DAYS', label: 'Effort Days', ratioToMonth: 1/20 },
  { id: 'MONTHS', label: 'Man Months', ratioToMonth: 1 },
  { id: 'HOURS', label: 'Effort Hours', ratioToMonth: 1/160 },
];

const ToolProjectArchitect: React.FC = () => {
  // Project Parameters
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });
  const [effortUnit, setEffortUnit] = useState('MONTHS');
  const [inefficiency, setInefficiency] = useState(50);
  const [margin, setMargin] = useState(20);
  
  // Backlog state
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Resources state
  const [resources, setResources] = useState<Resource[]>([]);

  // Calculations
  const projectDurationMonths = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(deadline);
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return Math.max(0.1, parseFloat(diff.toFixed(2)));
  }, [startDate, deadline]);

  const totalEffortRaw = useMemo(() => backlog.reduce((sum, item) => sum + item.effort, 0), [backlog]);
  const unitMultiplier = EFFORT_UNITS.find(u => u.id === effortUnit)?.ratioToMonth || 1;
  const totalEffortMonths = totalEffortRaw * unitMultiplier;
  const adjustedEffortMonths = totalEffortMonths * (1 + inefficiency / 100);
  
  const suggestedFTE = useMemo(() => {
    if (projectDurationMonths <= 0) return 0;
    return Math.ceil(adjustedEffortMonths / projectDurationMonths);
  }, [adjustedEffortMonths, projectDurationMonths]);

  const projectMonthsList = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(deadline);
    const list = [];
    const curr = new Date(start.getFullYear(), start.getMonth(), 1);
    const endBound = new Date(end.getFullYear(), end.getMonth(), 1);
    
    while (curr <= endBound || list.length < Math.ceil(projectDurationMonths)) {
      list.push(new Date(curr));
      curr.setMonth(curr.getMonth() + 1);
      if (list.length > 120) break;
    }
    return list;
  }, [startDate, deadline, projectDurationMonths]);

  // Derived Financials based on allocations
  const { totalAllocatedManMonths, baseCost } = useMemo(() => {
    let manMonths = 0;
    let cost = 0;

    resources.forEach(res => {
      projectMonthsList.forEach(monthDate => {
        const key = monthDate.toISOString().slice(0, 7);
        const allocation = res.allocations[key] ?? 0;
        manMonths += allocation;
        cost += res.monthlyCost * allocation;
      });
    });

    return { totalAllocatedManMonths: manMonths, baseCost: cost };
  }, [resources, projectMonthsList]);

  const profitAmount = baseCost * (margin / 100);
  const grandTotal = baseCost + profitAmount;

  // Optimization Logic
  const optimizationSuggestion = useMemo(() => {
    if (backlog.length === 0) return null;
    const recommendedDuration = Math.ceil(adjustedEffortMonths);
    if (projectDurationMonths > recommendedDuration + 1) {
      return {
        recommendedDuration,
        message: `System Alert: Workload (${adjustedEffortMonths.toFixed(1)} m-mo) only needs ${recommendedDuration} months at full capacity. Current window is ${projectDurationMonths} months. Reduce timeline?`
      };
    }
    return null;
  }, [adjustedEffortMonths, projectDurationMonths, backlog]);

  const acceptOptimization = () => {
    if (!optimizationSuggestion) return;
    const start = new Date(startDate);
    start.setMonth(start.getMonth() + optimizationSuggestion.recommendedDuration);
    setDeadline(start.toISOString().split('T')[0]);
  };

  const handleBacklogUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
      if (!worksheet) throw new Error("No worksheet found.");
      let nameCol = 1, effortCol = 2;
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const val = cell.text.toLowerCase().trim();
        if (['item name', 'task', 'description', 'item'].includes(val)) nameCol = colNumber;
        if (['estimated days', 'effort', 'days', 'estimated effort'].includes(val)) effortCol = colNumber;
      });
      const newBacklog: BacklogItem[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const task = row.getCell(nameCol).text;
        const val = row.getCell(effortCol).value;
        const effort = typeof val === 'number' ? val : parseFloat(row.getCell(effortCol).text) || 0;
        if (task && effort > 0) newBacklog.push({ task, effort });
      });
      setBacklog(newBacklog);
    } catch (err) {
      alert("Error reading Excel.");
    } finally {
      setIsImporting(false);
    }
  };

  const updateAllocation = (resId: string, monthKey: string, value: number) => {
    // Clamp between 0 and 1
    const clamped = Math.max(0, Math.min(1, value));
    setResources(prev => prev.map(res => {
      if (res.id === resId) {
        return {
          ...res,
          allocations: { ...res.allocations, [monthKey]: clamped }
        };
      }
      return res;
    }));
  };

  const applyAISuggestion = () => {
    if (suggestedFTE <= 0) return alert("Upload a backlog first to calculate headcount.");
    
    const needs = { ui: 0, code: 0, art: 0, design: 0, test: 0 };
    backlog.forEach(item => {
      const t = item.task.toLowerCase();
      if (t.includes('icon') || t.includes('menu') || t.includes('ui') || t.includes('canvas')) needs.ui++;
      if (t.includes('code') || t.includes('script') || t.includes('logic') || t.includes('server')) needs.code++;
      if (t.includes('art') || t.includes('model') || t.includes('texture') || t.includes('sprite')) needs.art++;
      if (t.includes('level') || t.includes('mechanic') || t.includes('quest')) needs.design++;
      if (t.includes('test') || t.includes('bug') || t.includes('qa')) needs.test++;
    });

    const newResources: Resource[] = [];
    const getDisc = (id: string) => GAME_DEV_DISCIPLINES.find(d => d.id === id) || GAME_DEV_DISCIPLINES[0];

    for (let i = 0; i < suggestedFTE; i++) {
      let targetDisc;
      if (needs.ui > needs.code && needs.ui > needs.art) targetDisc = getDisc('ui');
      else if (needs.code > needs.art) targetDisc = getDisc('gp');
      else if (needs.test > 0 && i % 4 === 0) targetDisc = getDisc('qa');
      else if (needs.design > 0 && i % 3 === 0) targetDisc = getDisc('gd');
      else targetDisc = getDisc('ta');
      
      const initialAllocations: Record<string, number> = {};
      projectMonthsList.forEach(m => {
        initialAllocations[m.toISOString().slice(0, 7)] = 1.0;
      });

      newResources.push({
        id: Math.random().toString(36).substr(2, 9),
        name: `${targetDisc.name} ${Math.floor(i/3) + 1}`,
        monthlyCost: targetDisc.defaultCost,
        isOverride: false,
        role: targetDisc.name,
        allocations: initialAllocations
      });
    }
    setResources(newResources);
  };

  const addManualResource = () => {
    const initialAllocations: Record<string, number> = {};
    projectMonthsList.forEach(m => {
      initialAllocations[m.toISOString().slice(0, 7)] = 1.0;
    });

    setResources([...resources, { 
      id: Math.random().toString(36).substr(2,9), 
      name: 'Manual Resource', 
      monthlyCost: 5000, 
      isOverride: false, 
      role: 'Staff',
      allocations: initialAllocations
    }]);
  };

  return (
    <div className="p-4 space-y-6 text-black font-serif">
      <div className="flex justify-between items-center border-b-4 border-black pb-2">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-black">
          🏗️ Project Architect v2.8
        </h2>
        <div className="win95-bg p-1 retro-inset px-3 text-[10px] font-mono leading-none border border-black shadow-sm text-black">
          WORKLOAD: {adjustedEffortMonths.toFixed(1)} m-mo<br/>
          ALLOCATED: {totalAllocatedManMonths.toFixed(1)} m-mo
        </div>
      </div>

      {optimizationSuggestion && (
        <div className="p-3 bg-blue-100 border-2 border-blue-600 shadow-md flex flex-col md:flex-row justify-between items-center gap-3 animate-pulse">
          <p className="text-xs font-black uppercase text-blue-900 leading-tight">
            💡 {optimizationSuggestion.message}
          </p>
          <RetroButton onClick={acceptOptimization} className="bg-blue-600 text-white text-[10px] font-black py-1 h-8">
            REDUCE TIMELINE
          </RetroButton>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Column */}
        <div className="lg:col-span-1 space-y-4">
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">1. Timeline Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Project Start</label>
                <input type="date" className="w-full p-1 retro-inset bg-white text-xs text-black border border-gray-400 h-8" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Project Deadline</label>
                <input type="date" className="w-full p-1 retro-inset bg-white text-xs text-black border border-gray-400 h-8" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <div className="flex-grow">
                  <label className="block text-[10px] font-bold uppercase text-black">Input Unit</label>
                  <select className="w-full p-1 retro-inset bg-white text-xs text-black border border-gray-400" value={effortUnit} onChange={(e) => setEffortUnit(e.target.value)}>
                    {EFFORT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </div>
                <div className="flex-grow">
                   <label className="block text-[10px] font-bold uppercase text-black">Margin ({margin}%)</label>
                   <input type="number" className="w-full p-1 retro-inset bg-white text-xs text-black border border-gray-400 h-8" value={margin} onChange={(e) => setMargin(parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Inefficiency Multiplier ({inefficiency}%)</label>
                <input type="range" min="0" max="200" className="w-full accent-black" value={inefficiency} onChange={(e) => setInefficiency(parseInt(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">2. Backlog Inventory</h3>
            <input type="file" accept=".xlsx" className="hidden" id="arch-upload-v4" onChange={handleBacklogUpload} />
            <label htmlFor="arch-upload-v4" className="block w-full text-center py-2 win95-bg retro-beveled cursor-pointer text-xs font-black border-2 border-gray-500 hover:bg-gray-100 text-black">
              {isImporting ? '⌛ ACCESSING DATA...' : '📂 LOAD BACKLOG (XLSX)'}
            </label>
            {backlog.length > 0 && (
              <div className="mt-2 p-2 retro-inset bg-white text-[10px] max-h-48 overflow-auto font-mono text-black border border-gray-400">
                {backlog.map((item, i) => <div key={i} className="flex justify-between truncate border-b border-gray-100 p-1"><span>{item.task}</span><b>{item.effort}</b></div>)}
              </div>
            )}
          </div>

          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">3. Capacity Status</h3>
            <div className="text-[10px] font-mono uppercase bg-gray-50 p-2 retro-inset text-black space-y-1">
              <div>Efficiency Target: {(adjustedEffortMonths).toFixed(1)} MM</div>
              <div>Current Allocation: {(totalAllocatedManMonths).toFixed(1)} MM</div>
              <div className={`font-black ${totalAllocatedManMonths >= adjustedEffortMonths ? 'text-green-700' : 'text-red-700'}`}>
                {totalAllocatedManMonths >= adjustedEffortMonths ? '✅ FULLY STAFFED' : '⚠️ UNDERSTAFFED'}
              </div>
            </div>
          </div>
        </div>

        {/* Roadmap Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-xs uppercase text-black">4. Roadmap & Monthly Allocation (%)</h3>
              <RetroButton onClick={applyAISuggestion} className="text-[10px] font-black py-1 px-3 bg-white border-2 border-black">
                🚀 Generate Resource Mix
              </RetroButton>
            </div>
            
            <div className="retro-inset bg-white overflow-auto min-h-[400px] border-2 border-black relative">
              <table className="w-full text-[10px] font-mono border-collapse min-w-[1200px]">
                <thead className="bg-gray-300 border-b-2 border-black sticky top-0 z-20">
                  <tr className="text-black font-black uppercase text-center">
                    <th className="p-2 text-left border-r border-black sticky left-0 bg-gray-300 w-56 z-30">Discipline / Assignee</th>
                    <th className="p-2 border-r border-black text-[8px] w-20">Cost/Mo</th>
                    {projectMonthsList.map((d, i) => (
                      <th key={i} className="p-2 border-r border-black text-[8px] whitespace-nowrap min-w-[80px]">
                        {d.toLocaleString('default', { month: 'short' })} '{d.getFullYear().toString().slice(-2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.length === 0 ? (
                    <tr>
                      <td colSpan={projectMonthsList.length + 2} className="p-32 text-center text-gray-400 italic font-black uppercase text-xs">No roadmap data. Load a backlog and click "Generate Resource Mix".</td>
                    </tr>
                  ) : resources.map((res) => (
                    <tr key={res.id} className="border-b border-gray-200 hover:bg-blue-50 group">
                      <td className="p-2 border-r border-black font-black bg-gray-50 sticky left-0 z-10 w-56">
                        <div className="flex flex-col">
                          <div className="flex justify-between">
                            <input className="bg-transparent font-black outline-none text-black truncate w-full" value={res.name} onChange={(e) => setResources(resources.map(r => r.id === res.id ? {...r, name: e.target.value} : r))} />
                            <button onClick={() => setResources(resources.filter(r => r.id !== res.id))} className="text-red-600 opacity-0 group-hover:opacity-100 hover:font-black ml-1">×</button>
                          </div>
                          <span className="text-[8px] opacity-70 font-bold uppercase">{res.role}</span>
                        </div>
                      </td>
                      <td className="p-2 border-r border-black text-right">
                        <input 
                          type="number" 
                          className="w-full bg-transparent text-right outline-none font-bold text-black" 
                          value={res.monthlyCost} 
                          onChange={(e) => setResources(resources.map(r => r.id === res.id ? {...r, monthlyCost: parseInt(e.target.value) || 0} : r))} 
                        />
                      </td>
                      {projectMonthsList.map((m, i) => {
                        const monthKey = m.toISOString().slice(0, 7);
                        const allocation = res.allocations[monthKey] ?? 0;
                        return (
                          <td key={i} className={`p-1 border-r border-gray-100 text-center ${allocation > 0 ? 'bg-blue-50' : ''}`}>
                            <div className="flex flex-col items-center">
                              <input 
                                type="number" 
                                min="0" 
                                max="100" 
                                className={`w-12 p-0.5 text-center text-[10px] retro-inset outline-none font-bold ${allocation === 0 ? 'text-gray-300' : 'text-blue-900 bg-white'}`}
                                value={Math.round(allocation * 100)} 
                                onChange={(e) => updateAllocation(res.id, monthKey, (parseInt(e.target.value) || 0) / 100)}
                              />
                              <div 
                                className="h-1.5 w-full mt-1 border border-gray-300 bg-gray-100 overflow-hidden"
                                title={`${Math.round(allocation * 100)}% Allocation`}
                              >
                                <div className="h-full bg-blue-600" style={{ width: `${allocation * 100}%` }}></div>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-between">
               <button onClick={addManualResource} className="text-[9px] font-black uppercase underline text-black">Add Manual Resource</button>
               <button onClick={() => setResources([])} className="text-[9px] font-black uppercase text-red-700 underline">Clear Board</button>
            </div>
          </div>

          {/* Consolidated Totals */}
          <div className="p-6 border-4 border-black bg-[#ffffa0] shadow-[8px_8px_0px_rgba(0,0,0,1)]">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
               <div className="border-r border-black/10">
                 <div className="text-[9px] font-black uppercase mb-1 opacity-60 text-black">Effort Gap</div>
                 <div className={`text-xl font-black ${totalAllocatedManMonths >= adjustedEffortMonths ? 'text-green-700' : 'text-red-700'}`}>
                   {(totalAllocatedManMonths - adjustedEffortMonths).toFixed(1)} MM
                 </div>
               </div>
               <div className="border-r border-black/10">
                 <div className="text-[9px] font-black uppercase mb-1 opacity-60 text-black">Project Duration</div>
                 <div className="text-xl font-black text-black">{projectDurationMonths}mo</div>
               </div>
               <div className="border-r border-black/10">
                 <div className="text-[9px] font-black uppercase mb-1 opacity-60 text-black">Personnel Count</div>
                 <div className="text-xl font-black text-black">{resources.length} HEADS</div>
               </div>
               <div>
                 <div className="text-[9px] font-black uppercase mb-1 opacity-60 text-black">Total Fiscal Projection</div>
                 <div className="text-2xl font-black text-blue-900">€{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
               </div>
            </div>
            <div className="mt-6 flex gap-2">
              <RetroButton className="flex-grow font-black py-3 bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] uppercase text-black">
                💾 Export Detailed Forecast (.xlsx)
              </RetroButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolProjectArchitect;