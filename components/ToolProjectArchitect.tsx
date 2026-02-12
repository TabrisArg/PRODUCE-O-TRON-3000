import React, { useState, useMemo, useEffect } from 'react';
import RetroButton from './RetroButton.tsx';
import ExcelJS from 'exceljs';
import { GAME_DEV_DISCIPLINES } from '../disciplines.ts';
import { RATIOS } from '../conversions.ts';

interface Resource {
  id: string;
  name: string;
  monthlyCost: number;
  isOverride: boolean;
  role: string;
  allocations: Record<string, number>;
}

interface BacklogItem {
  task: string;
  effort: number;
}

interface Milestone {
  id: string;
  name: string;
  duration: number; // in months
  color: string;
}

const DEFAULT_MILESTONES: Milestone[] = [
  { id: 'ms1', name: 'MS-1 Preproduction', duration: 2, color: 'FFC6E0B4' },
  { id: 'ms2', name: 'MS-2 Production', duration: 3, color: 'FFFFCCFF' },
  { id: 'ms3', name: 'MS-3 Finalization', duration: 2, color: 'FFBDD7EE' },
  { id: 'ms4', name: 'MS-4 Certification', duration: 2, color: 'FFF8CBAD' },
  { id: 'ms5', name: 'MS-5 Post Launch support', duration: 2, color: 'FFA9D08E' },
];

const EFFORT_UNITS = [
  { id: 'DAYS', label: 'Effort Days', short: 'days', ratioToMonth: RATIOS.DAYS_TO_MONTH },
  { id: 'MONTHS', label: 'Man Months', short: 'm-mo', ratioToMonth: RATIOS.MONTH_TO_MONTH },
  { id: 'HOURS', label: 'Effort Hours', short: 'hrs', ratioToMonth: RATIOS.HOURS_TO_MONTH },
];

const ALLOCATION_OPTIONS = [
  { label: '100%', value: 1.0 },
  { label: '75%', value: 0.75 },
  { label: '50%', value: 0.5 },
  { label: '25%', value: 0.25 },
  { label: '0%', value: 0.0 },
];

const ToolProjectArchitect: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 11);
    return d.toISOString().split('T')[0];
  });
  const [effortUnit, setEffortUnit] = useState('MONTHS');
  const [inefficiency, setInefficiency] = useState(50);
  const [marginStr, setMarginStr] = useState("25");
  const [contingencyStr, setContingencyStr] = useState("20");
  
  const margin = parseFloat(marginStr) || 0;
  const contingency = parseFloat(contingencyStr) || 0;

  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [prevStartDate, setPrevStartDate] = useState(startDate);

  useEffect(() => {
    if (startDate === prevStartDate || resources.length === 0) return;
    const oldDate = new Date(prevStartDate);
    const newDate = new Date(startDate);
    const monthDiff = (newDate.getFullYear() - oldDate.getFullYear()) * 12 + (newDate.getMonth() - oldDate.getMonth());
    if (monthDiff !== 0) {
      setResources(prev => prev.map(res => {
        const newAllocations: Record<string, number> = {};
        Object.entries(res.allocations).forEach(([key, val]) => {
          const d = new Date(key + "-02");
          d.setMonth(d.getMonth() + monthDiff);
          const newKey = d.toISOString().slice(0, 7);
          newAllocations[newKey] = val as number;
        });
        return { ...res, allocations: newAllocations };
      }));
    }
    setPrevStartDate(startDate);
  }, [startDate, prevStartDate, resources]);

  const currentUnit = useMemo(() => EFFORT_UNITS.find(u => u.id === effortUnit) || EFFORT_UNITS[1], [effortUnit]);

  const projectDurationMonths = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(deadline);
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return Math.max(1, Math.ceil(diff));
  }, [startDate, deadline]);

  const projectMonthsList = useMemo(() => {
    const start = new Date(startDate);
    const list = [];
    for (let i = 0; i < projectDurationMonths; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      list.push(d);
    }
    return list;
  }, [startDate, projectDurationMonths]);

  const totalEffortRaw = useMemo(() => backlog.reduce((sum, item) => sum + (item.effort || 0), 0), [backlog]);

  const adjustedEffortMonths = useMemo(() => {
    const multiplier = currentUnit.ratioToMonth;
    const baseMonths = totalEffortRaw * multiplier;
    return baseMonths * (1 + inefficiency / 100);
  }, [totalEffortRaw, currentUnit, inefficiency]);

  const workloadDisplay = useMemo(() => adjustedEffortMonths / currentUnit.ratioToMonth, [adjustedEffortMonths, currentUnit]);

  const crossUnitEquivalents = useMemo(() => {
    return EFFORT_UNITS.filter(u => u.id !== effortUnit).map(u => {
      const val = adjustedEffortMonths / u.ratioToMonth;
      return { label: u.short, value: val };
    });
  }, [adjustedEffortMonths, effortUnit]);

  const { totalAllocatedManMonths, baseCost } = useMemo(() => {
    let manMonths = 0;
    let cost = 0;
    resources.forEach(res => {
      projectMonthsList.forEach(m => {
        const key = m.toISOString().slice(0, 7);
        const allocation = res.allocations[key] ?? 0;
        manMonths += allocation;
        cost += (res.monthlyCost || 0) * allocation;
      });
    });
    return { totalAllocatedManMonths: manMonths, baseCost: cost };
  }, [resources, projectMonthsList]);

  const allocatedDisplay = useMemo(() => totalAllocatedManMonths / currentUnit.ratioToMonth, [totalAllocatedManMonths, currentUnit]);

  const grandTotal = useMemo(() => {
    const profitAmount = baseCost * (margin / 100);
    const subtotalWithMargin = baseCost + profitAmount;
    const contingencyAmount = subtotalWithMargin * (contingency / 100);
    return subtotalWithMargin + contingencyAmount;
  }, [baseCost, margin, contingency]);

  const suggestedFTE = useMemo(() => 
    projectDurationMonths > 0 ? Math.ceil(adjustedEffortMonths / projectDurationMonths) : 0
  , [adjustedEffortMonths, projectDurationMonths]);

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Project Timeline');
    const milestoneList = [...DEFAULT_MILESTONES];
    const columns = [
      { header: 'UNDISPUTED', key: 'role', width: 25 },
      ...projectMonthsList.map((_, i) => ({ header: `Month ${i+1}`, key: `m${i+1}`, width: 12 })),
      { header: 'Total', key: 'total', width: 12 }
    ];
    worksheet.columns = columns;

    const msRow = worksheet.getRow(1);
    let colCursor = 2;
    milestoneList.forEach(ms => {
      const startCol = colCursor;
      const endCol = Math.min(colCursor + ms.duration - 1, projectDurationMonths + 1);
      if (startCol > projectDurationMonths + 1) return;
      const cell = msRow.getCell(startCol);
      cell.value = ms.name;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ms.color } };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
      if (startCol !== endCol) worksheet.mergeCells(1, startCol, 1, endCol);
      colCursor += ms.duration;
    });
    
    const monthRow = worksheet.getRow(2);
    monthRow.eachCell((cell, colNum) => {
      if (colNum > 1 && colNum <= projectDurationMonths + 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
      }
    });

    resources.forEach((res) => {
      const row = worksheet.addRow({ role: res.role });
      let rowTotal = 0;
      projectMonthsList.forEach((m, mIdx) => {
        const key = m.toISOString().slice(0, 7);
        const val = res.allocations[key] || 0;
        rowTotal += val;
        row.getCell(mIdx + 2).value = val || '';
        row.getCell(mIdx + 2).alignment = { horizontal: 'center' };
      });
      row.getCell(projectDurationMonths + 2).value = rowTotal;
      row.getCell(projectDurationMonths + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Project_Architect_Plan_${Date.now()}.xlsx`;
    a.click();
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
    setResources(prev => prev.map(res => {
      if (res.id === resId) {
        return { ...res, allocations: { ...res.allocations, [monthKey]: value } };
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
      projectMonthsList.forEach(m => { initialAllocations[m.toISOString().slice(0, 7)] = 1.0; });
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
    projectMonthsList.forEach(m => { initialAllocations[m.toISOString().slice(0, 7)] = 1.0; });
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-black pb-2 gap-4">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-black">
          🏗️ Project Architect v3.9
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="win95-bg p-1 retro-inset px-3 text-[10px] font-mono leading-none border border-black shadow-sm text-black">
            <span className="opacity-50 text-[8px] uppercase block mb-1 font-sans font-bold">Primary Metrics</span>
            WORKLOAD: {workloadDisplay.toFixed(1)} {currentUnit.short}<br/>
            ALLOCATED: {allocatedDisplay.toFixed(1)} {currentUnit.short}
          </div>
          <div className="win95-bg p-1 retro-inset px-3 text-[10px] font-mono leading-none border border-black shadow-sm text-black">
            <span className="opacity-50 text-[8px] uppercase block mb-1 font-sans font-bold">Equivalent Workload</span>
            {crossUnitEquivalents.map((eq, i) => (
              <React.Fragment key={eq.label}>
                {eq.value.toFixed(1)} {eq.label}
                {i < crossUnitEquivalents.length - 1 ? <span className="mx-2 opacity-30">|</span> : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">1. Lifecycle Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Project Start</label>
                <input 
                  type="date" 
                  className="w-full p-1 retro-inset bg-white text-xs text-black border border-gray-400 h-8 cursor-pointer" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e) => (e.target as any).showPicker?.()}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Project Deadline</label>
                <input 
                  type="date" 
                  className="w-full p-1 retro-inset bg-white text-xs text-black border border-gray-400 h-8 cursor-pointer" 
                  value={deadline} 
                  onChange={(e) => setDeadline(e.target.value)}
                  onClick={(e) => (e.target as any).showPicker?.()}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-black">Margin (%)</label>
                  <input type="text" className="w-full p-1 retro-inset bg-white text-xs border border-gray-400 h-8" value={marginStr} onChange={(e) => setMarginStr(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-black">Buffer (%)</label>
                  <input type="text" className="w-full p-1 retro-inset bg-white text-xs border border-gray-400 h-8" value={contingencyStr} onChange={(e) => setContingencyStr(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">2. Workload Calibration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Input Effort Unit</label>
                <select className="w-full p-1 retro-inset bg-white text-xs border border-gray-400 h-8 outline-none" value={effortUnit} onChange={(e) => setEffortUnit(e.target.value)}>
                  {EFFORT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
                <div className="mt-1 text-[9px] font-mono opacity-60">
                  SUM: {totalEffortRaw.toFixed(1)} {currentUnit.short}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Safety Factor / Inefficiency ({inefficiency}%)</label>
                <input type="range" min="0" max="100" step="5" className="w-full h-8 accent-black" value={inefficiency} onChange={(e) => setInefficiency(parseInt(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">3. Backlog Inventory</h3>
            <input type="file" accept=".xlsx" className="hidden" id="arch-upload-v6" onChange={handleBacklogUpload} />
            <label htmlFor="arch-upload-v6" className="block w-full text-center py-2 win95-bg retro-beveled cursor-pointer text-xs font-black border-2 border-gray-500 hover:bg-gray-100 text-black">
              {isImporting ? '⌛ READING DATA...' : '📂 LOAD BACKLOG (XLSX)'}
            </label>
            {backlog.length > 0 && (
              <div className="mt-2 p-2 retro-inset bg-white text-[10px] max-h-48 overflow-auto font-mono border border-gray-400 text-black">
                {backlog.map((item, i) => <div key={i} className="flex justify-between truncate border-b border-gray-100 p-1"><span>{item.task}</span><b>{item.effort}</b></div>)}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-xs uppercase text-black italic underline decoration-blue-500">4. Allocation Matrix (Man-Months)</h3>
              <RetroButton onClick={applyAISuggestion} className="text-[10px] font-black py-1 px-3 bg-white border-2 border-black">🚀 Generate Schedule</RetroButton>
            </div>
            <div className="retro-inset bg-white overflow-auto min-h-[400px] border-2 border-black relative">
              <table className="w-full text-[10px] font-mono border-collapse min-w-[1200px]">
                <thead className="bg-gray-300 border-b-2 border-black sticky top-0 z-20">
                  <tr className="text-black font-black uppercase text-center">
                    <th className="p-2 text-left border-r border-black sticky left-0 bg-gray-300 w-56 z-30">Role / Resource</th>
                    <th className="p-2 border-r border-black text-[8px] w-20">Rate</th>
                    {projectMonthsList.map((d, i) => (
                      <th key={i} className="p-2 border-r border-black text-[8px] whitespace-nowrap min-w-[80px]">
                        M{i+1}<br/>{d.toLocaleString('default', { month: 'short' })} '{d.getFullYear().toString().slice(-2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.length === 0 ? (
                    <tr><td colSpan={projectMonthsList.length + 2} className="p-32 text-center text-gray-400 italic font-black uppercase text-xs">Awaiting data input...</td></tr>
                  ) : resources.map((res) => (
                    <tr key={res.id} className="border-b border-gray-200 hover:bg-blue-50">
                      <td className="p-2 border-r border-black font-black bg-gray-50 sticky left-0 z-10 w-56 text-black">
                        <input className="bg-transparent font-black outline-none w-full" value={res.name} onChange={(e) => setResources(resources.map(r => r.id === res.id ? {...r, name: e.target.value} : r))} />
                        <span className="text-[8px] opacity-70 block">{res.role}</span>
                      </td>
                      <td className="p-2 border-r border-black text-right font-bold text-black">€{res.monthlyCost.toLocaleString()}</td>
                      {projectMonthsList.map((m, i) => {
                        const monthKey = m.toISOString().slice(0, 7);
                        const allocation = res.allocations[monthKey] ?? 0;
                        return (
                          <td key={i} className={`p-1 border-r border-gray-100 text-center ${allocation > 0 ? 'bg-blue-50' : ''}`}>
                            <select 
                              className={`w-16 p-1 text-center text-[10px] retro-inset outline-none font-bold win95-bg border border-gray-400 cursor-pointer ${allocation === 0 ? 'text-gray-400' : 'text-blue-900 bg-white'}`}
                              value={allocation} 
                              onChange={(e) => updateAllocation(res.id, monthKey, parseFloat(e.target.value))}
                            >
                              {ALLOCATION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-between">
               <button onClick={addManualResource} className="text-[9px] font-black uppercase underline text-blue-800">+ Add Manual Resource</button>
               <button onClick={() => setResources([])} className="text-[9px] font-black uppercase text-red-700 underline">Wipe Schedule</button>
            </div>
          </div>

          <div className="p-6 border-4 border-black bg-[#ffffa0] shadow-[8px_8px_0px_rgba(0,0,0,1)] flex flex-col items-center">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center w-full mb-8 items-stretch">
               <div className="border-r border-black/10 px-2 flex flex-col justify-start">
                 <div className="text-[9px] font-black uppercase mb-2 opacity-60 text-black leading-none">Timeline</div>
                 <div className="flex-grow flex flex-col justify-center">
                   <div className="text-2xl font-black text-black leading-tight">{projectDurationMonths}m</div>
                 </div>
               </div>
               <div className="border-r border-black/10 px-2 flex flex-col justify-start">
                 <div className="text-[9px] font-black uppercase mb-2 opacity-60 text-black leading-none">Allocation</div>
                 <div className="flex-grow flex flex-col justify-center">
                   <div className="text-2xl font-black text-black leading-tight">{allocatedDisplay.toFixed(1)}</div>
                   <div className="text-[10px] font-black uppercase text-black leading-none">{currentUnit.short}</div>
                 </div>
               </div>
               <div className="border-r border-black/10 px-2 flex flex-col justify-start">
                 <div className="text-[9px] font-black uppercase mb-2 opacity-60 text-black leading-none">Gap to Goal</div>
                 <div className="flex-grow flex flex-col justify-center">
                   <div className={`text-2xl font-black leading-tight ${((allocatedDisplay - workloadDisplay) >= 0) ? 'text-green-700' : 'text-red-700'}`}>
                     {(allocatedDisplay - workloadDisplay).toFixed(1)}
                   </div>
                   <div className={`text-[10px] font-black uppercase leading-none ${((allocatedDisplay - workloadDisplay) >= 0) ? 'text-green-700' : 'text-red-700'}`}>
                     {currentUnit.short}
                   </div>
                 </div>
               </div>
               <div className="px-2 flex flex-col justify-start min-w-0">
                 <div className="text-[9px] font-black uppercase mb-2 opacity-60 text-black italic leading-none">Projected Budget</div>
                 <div className="flex-grow flex flex-col justify-center overflow-hidden">
                   <div className="text-xl md:text-2xl lg:text-3xl font-black text-blue-900 drop-shadow-sm leading-tight break-words">
                     €{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                   </div>
                 </div>
               </div>
            </div>
            <RetroButton onClick={handleExportExcel} className="w-full font-black py-4 bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] uppercase text-black text-xl hover:bg-gray-50 active:shadow-none active:translate-x-1 active:translate-y-1">
              💾 EXPORT PROJECTION (.XLSX)
            </RetroButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolProjectArchitect;