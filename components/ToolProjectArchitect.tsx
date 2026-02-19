import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  discipline?: string;
  milestoneId?: string;
}

interface Milestone {
  id: string;
  name: string;
  duration: number; // in months
  color: string;
}

const DEFAULT_MILESTONES: Milestone[] = [
  { id: 'ms1', name: 'MS-1 Preproduction', duration: 2, color: 'FFC6E0B4' },
  { id: 'ms2', name: 'MS-2 Production', duration: 4, color: 'FFFFCCFF' },
  { id: 'ms3', name: 'MS-3 Finalization', duration: 2, color: 'FFBDD7EE' },
  { id: 'ms4', name: 'MS-4 Certification', duration: 1, color: 'FFF8CBAD' },
  { id: 'ms5', name: 'MS-5 Post Launch', duration: 2, color: 'FFA9D08E' },
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
  const [milestones, setMilestones] = useState<Milestone[]>(DEFAULT_MILESTONES);
  const [effortUnit, setEffortUnit] = useState('DAYS'); // Default to DAYS
  const [inefficiency, setInefficiency] = useState(0); // Default to 0%
  const [marginStr, setMarginStr] = useState("25");
  const [contingencyStr, setContingencyStr] = useState("20");
  const [globalRateStr, setGlobalRateStr] = useState("");
  const [isAutoSync, setIsAutoSync] = useState(true); // Control reactive updates
  
  const margin = parseFloat(marginStr) || 0;
  const contingency = parseFloat(contingencyStr) || 0;
  const globalRate = parseFloat(globalRateStr) || 0;

  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [prevStartDate, setPrevStartDate] = useState(startDate);

  const totalMilestoneDuration = useMemo(() => milestones.reduce((sum, ms) => sum + ms.duration, 0), [milestones]);
  
  const deadline = useMemo(() => {
    const d = new Date(startDate);
    d.setMonth(d.getUTCMonth() + totalMilestoneDuration);
    return d.toISOString().split('T')[0];
  }, [startDate, totalMilestoneDuration]);

  const currentUnit = useMemo(() => EFFORT_UNITS.find(u => u.id === effortUnit) || EFFORT_UNITS[0], [effortUnit]);
  const projectDurationMonths = useMemo(() => totalMilestoneDuration, [totalMilestoneDuration]);

  const projectMonthsList = useMemo(() => {
    const start = new Date(startDate);
    const list = [];
    for (let i = 0; i < projectDurationMonths; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      list.push(d);
    }
    return list;
  }, [startDate, projectDurationMonths]);

  const monthToMilestoneMap = useMemo(() => {
    const mapping: Record<string, string> = {};
    let monthIndex = 0;
    milestones.forEach(ms => {
      for (let i = 0; i < ms.duration; i++) {
        if (monthIndex < projectMonthsList.length) {
          const key = projectMonthsList[monthIndex].toISOString().slice(0, 7);
          mapping[key] = ms.id;
          monthIndex++;
        }
      }
    });
    return mapping;
  }, [milestones, projectMonthsList]);

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
        const rateToUse = globalRate > 0 ? globalRate : (res.monthlyCost || 0);
        cost += rateToUse * allocation;
      });
    });
    return { totalAllocatedManMonths: manMonths, baseCost: cost };
  }, [resources, projectMonthsList, globalRate]);

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

  // Unified Suggestion Logic
  const applyAISuggestion = useCallback((silent = false) => {
    if (suggestedFTE < 0 || backlog.length === 0) return;
    
    const disciplineMilestoneMap: Record<string, Set<string>> = {};
    const needsByDiscipline: Record<string, number> = {};

    backlog.forEach(item => {
      let discId = 'ta';
      const discStr = item.discipline?.toLowerCase().trim() || '';
      
      const matched = GAME_DEV_DISCIPLINES.find(d => {
        const dName = d.name.toLowerCase();
        return dName.includes(discStr) || discStr.includes(dName) || 
               (discStr === 'qa' && d.id === 'qa') ||
               (discStr === 'ui' && d.id === 'ui');
      });

      if (matched) discId = matched.id;

      needsByDiscipline[discId] = (needsByDiscipline[discId] || 0) + item.effort;
      
      if (item.milestoneId) {
        if (!disciplineMilestoneMap[discId]) disciplineMilestoneMap[discId] = new Set();
        disciplineMilestoneMap[discId].add(item.milestoneId);
      }
    });

    const totalRawEffort = Object.values(needsByDiscipline).reduce((a, b) => a + b, 0);
    const newResources: Resource[] = [];
    
    Object.entries(needsByDiscipline).forEach(([discId, effort]) => {
      const disc = GAME_DEV_DISCIPLINES.find(d => d.id === discId)!;
      const weight = effort / totalRawEffort;
      const baseCount = Math.max(1, Math.round(weight * suggestedFTE));
      
      // Safety factor already included in suggestedFTE via adjustedEffortMonths
      const count = baseCount; 

      const activeMilestones = disciplineMilestoneMap[discId] || new Set();

      for (let i = 0; i < count; i++) {
        const initialAllocations: Record<string, number> = {};
        projectMonthsList.forEach(m => {
          const key = m.toISOString().slice(0, 7);
          const currentMsId = monthToMilestoneMap[key];
          // Allocate if discipline has tasks in this milestone OR if we have no specific milestone data (fallback to 100%)
          initialAllocations[key] = (activeMilestones.has(currentMsId) || activeMilestones.size === 0) ? 1.0 : 0.0;
        });
        
        newResources.push({
          id: `${discId}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          name: `${disc.name} ${i + 1}`,
          monthlyCost: disc.defaultCost,
          isOverride: false,
          role: disc.name,
          allocations: initialAllocations
        });
      }
    });

    setResources(newResources);
  }, [suggestedFTE, backlog, projectDurationMonths, projectMonthsList, monthToMilestoneMap]);

  // Effect for Auto-Sync
  useEffect(() => {
    if (isAutoSync && backlog.length > 0) {
      applyAISuggestion(true);
    }
  }, [inefficiency, backlog, isAutoSync, applyAISuggestion]);

  const handleBacklogUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      
      if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(arrayBuffer);
        await workbook.csv.read({ 
          stream: { 
            read: () => {
              const encoder = new TextEncoder();
              return encoder.encode(text);
            } 
          } as any 
        });
      } else {
        await workbook.xlsx.load(arrayBuffer);
      }
      
      const worksheet = workbook.getWorksheet('Backlog') || workbook.getWorksheet(1) || workbook.worksheets[0];
      if (!worksheet) throw new Error("No worksheet found.");

      const newMilestones: Milestone[] = [];
      const newBacklog: BacklogItem[] = [];
      
      let sectionCol = 1, packageCol = 2, discCol = 3, estimateCol = 4;
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, col) => {
        const val = cell.text.toLowerCase().trim();
        if (val.includes('section')) sectionCol = col;
        if (val.includes('package') || val.includes('work') || val.includes('task')) packageCol = col;
        if (val.includes('discipline') || val.includes('role')) discCol = col;
        if (val.includes('estimate') || val.includes('effort') || val.includes('value')) estimateCol = col;
      });

      let currentMilestoneId = '';
      worksheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        
        const sectionVal = row.getCell(sectionCol).text.trim();
        const packageVal = row.getCell(packageCol).text.trim();
        const discVal = row.getCell(discCol).text.trim();
        const estVal = row.getCell(estimateCol).value;

        if (sectionVal) {
          const parseResult = sectionVal.match(/(.+)\s*[- ]\s*(\d+)\s*months?/i);
          if (parseResult) {
            currentMilestoneId = `ms-${newMilestones.length}`;
            newMilestones.push({
              id: currentMilestoneId,
              name: parseResult[1].trim(),
              duration: parseInt(parseResult[2]),
              color: DEFAULT_MILESTONES[newMilestones.length % DEFAULT_MILESTONES.length].color
            });
          }
        }

        const effort = typeof estVal === 'number' ? estVal : parseFloat(row.getCell(estimateCol).text) || 0;
        if (packageVal && effort > 0) {
          newBacklog.push({
            task: packageVal,
            effort: effort,
            discipline: discVal,
            milestoneId: currentMilestoneId
          });
        }
      });

      if (newMilestones.length > 0) setMilestones(newMilestones);
      setBacklog(newBacklog);
      
      // Auto-detect unit based on file content/name
      if (file.name.toLowerCase().includes('day') || newBacklog.some(b => b.effort > 15)) {
        setEffortUnit('DAYS');
      }

    } catch (err) {
      console.error(err);
      alert("Error reading file. Ensure headers: Section, Work Package, Discipline, Estimate.");
    } finally {
      setIsImporting(false);
    }
  };

  const updateAllocation = (resId: string, monthKey: string, value: number) => {
    setIsAutoSync(false); // Disable auto-sync once user starts manual edits
    setResources(prev => prev.map(res => {
      if (res.id === resId) {
        return { ...res, allocations: { ...res.allocations, [monthKey]: value } };
      }
      return res;
    }));
  };

  const handleManualResourceEdit = (id: string, updates: Partial<Resource>) => {
    setIsAutoSync(false);
    setResources(resources.map(r => r.id === id ? {...r, ...updates} : r));
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Project Timeline');
    const columns = [
      { header: 'ROLE', key: 'role', width: 30 },
      ...projectMonthsList.map((_, i) => ({ header: `M${i+1}`, key: `m${i+1}`, width: 10 })),
      { header: 'Total', key: 'total', width: 12 }
    ];
    worksheet.columns = columns;

    const msRow = worksheet.getRow(1);
    let colCursor = 2;
    milestones.forEach(ms => {
      const startCol = colCursor;
      const endCol = Math.min(colCursor + ms.duration - 1, projectDurationMonths + 1);
      const cell = msRow.getCell(startCol);
      cell.value = ms.name;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ms.color } };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
      if (startCol !== endCol) worksheet.mergeCells(1, startCol, 1, endCol);
      colCursor += ms.duration;
    });

    resources.forEach((res) => {
      const row = worksheet.addRow({ role: res.name + ' (' + res.role + ')' });
      let rowTotal = 0;
      projectMonthsList.forEach((m, mIdx) => {
        const key = m.toISOString().slice(0, 7);
        const val = res.allocations[key] || 0;
        rowTotal += val;
        row.getCell(mIdx + 2).value = val || '';
      });
      row.getCell(projectDurationMonths + 2).value = rowTotal;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Architect_Report_${Date.now()}.xlsx`;
    a.click();
  };

  return (
    <div className="p-4 space-y-6 text-black font-serif">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-black pb-2 gap-4">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-black">
          🏗️ Project Architect v4.4
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="win95-bg p-1 retro-inset px-3 text-[10px] font-mono leading-none border border-black shadow-sm text-black">
            <span className="opacity-50 text-[8px] uppercase block mb-1 font-sans font-bold text-black">Primary Metrics</span>
            WORKLOAD: {workloadDisplay.toFixed(1)} {currentUnit.short}<br/>
            ALLOCATED: {allocatedDisplay.toFixed(1)} {currentUnit.short}
          </div>
          <div className="win95-bg p-1 retro-inset px-3 text-[10px] font-mono leading-none border border-black shadow-sm text-black">
            <span className="opacity-50 text-[8px] uppercase block mb-1 font-sans font-bold text-black">Equivalent Workload</span>
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
                />
              </div>
              <div className="p-2 retro-inset bg-gray-100/50">
                 <label className="block text-[9px] font-bold uppercase text-black opacity-60">Calculated Project End</label>
                 <div className="text-sm font-black text-blue-900">{new Date(deadline).toLocaleDateString()}</div>
                 <div className="text-[8px] text-gray-500 font-mono italic leading-none mt-1">Sum: {totalMilestoneDuration} months</div>
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
              <div>
                <label className="block text-[10px] font-bold uppercase text-black italic">Global Monthly Self-Cost Override</label>
                <input 
                  type="text" 
                  placeholder="Leave empty for role-based rates"
                  className="w-full p-1 retro-inset bg-white text-xs border border-gray-400 h-8" 
                  value={globalRateStr} 
                  onChange={(e) => setGlobalRateStr(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">2. Calibration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Unit of Effort</label>
                <select className="w-full p-1 retro-inset bg-white text-xs border border-gray-400 h-8 outline-none" value={effortUnit} onChange={(e) => setEffortUnit(e.target.value)}>
                  {EFFORT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
                <div className="mt-1 text-[9px] font-mono opacity-60 text-black">
                  RAW INPUT: {totalEffortRaw.toFixed(1)} {currentUnit.short}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Safety Factor / Inefficiency ({inefficiency}%)</label>
                <input type="range" min="0" max="200" step="5" className="w-full h-8 accent-black" value={inefficiency} onChange={(e) => setInefficiency(parseInt(e.target.value))} />
                <div className="flex justify-between items-center mt-2">
                   <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={isAutoSync} 
                        onChange={(e) => setIsAutoSync(e.target.checked)} 
                        className="w-4 h-4 accent-blue-900 border-2 border-black"
                      />
                      <span className="text-[10px] font-black uppercase group-hover:underline">Auto-Sync Headcount</span>
                   </label>
                   {!isAutoSync && <span className="text-[8px] text-red-700 font-bold uppercase tracking-tight">Sync Disabled (Manual Mode)</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">3. Import Data</h3>
            <input type="file" accept=".xlsx,.csv" className="hidden" id="arch-upload-v10" onChange={handleBacklogUpload} />
            <label htmlFor="arch-upload-v10" className="block w-full text-center py-2 win95-bg retro-beveled cursor-pointer text-xs font-black border-2 border-gray-500 hover:bg-gray-100 text-black">
              {isImporting ? '⌛ PARSING...' : '📂 SELECT FILE (CSV/XLSX)'}
            </label>
            {backlog.length > 0 && (
              <div className="mt-2 p-2 retro-inset bg-white text-[10px] max-h-48 overflow-auto font-mono border border-gray-400 text-black">
                <div className="font-black border-b border-black mb-1 sticky top-0 bg-white">INVENTORY ({backlog.length} ITEMS)</div>
                {backlog.map((item, i) => (
                  <div key={i} className="flex justify-between truncate border-b border-gray-100 p-1">
                    <span>{item.task}</span>
                    <b className="text-blue-800 ml-2">{item.effort} <span className="text-[7px] opacity-40">{item.discipline}</span></b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-xs uppercase text-black italic underline decoration-blue-500">4. Allocation Matrix</h3>
              <RetroButton 
                onClick={() => {
                  setIsAutoSync(true);
                  applyAISuggestion();
                }} 
                className={`text-[10px] font-black py-1 px-3 border-2 border-black ${isAutoSync ? 'bg-blue-50' : 'bg-white'}`}
              >
                🚀 Force Re-Sync Headcount
              </RetroButton>
            </div>
            <div className="retro-inset bg-white overflow-auto min-h-[400px] border-2 border-black relative">
              <table className="w-full text-[10px] font-mono border-collapse min-w-[1200px]">
                <thead className="bg-gray-300 border-b-2 border-black sticky top-0 z-20 shadow-sm">
                  <tr className="text-black font-black uppercase text-[9px] h-8">
                    <th className="sticky left-0 bg-gray-300 z-30 border-r border-black" colSpan={2}></th>
                    {milestones.map((ms, idx) => (
                      <th 
                        key={idx} 
                        colSpan={ms.duration} 
                        className="border-r border-black text-center px-1 retro-beveled shadow-inner"
                        style={{ 
                          backgroundColor: `#${ms.color.length === 8 ? ms.color.slice(2) : ms.color}`,
                          borderBottom: '1px solid black'
                        }}
                      >
                        <div className="truncate px-2 font-black tracking-tight">{ms.name}</div>
                      </th>
                    ))}
                  </tr>
                  <tr className="text-black font-black uppercase text-center border-t border-black">
                    <th className="p-2 text-left border-r border-black sticky left-0 bg-gray-300 w-56 z-30 text-black">Staff / Discipline</th>
                    <th className="p-2 border-r border-black text-[8px] w-20 text-black">Rate / Mo</th>
                    {projectMonthsList.map((d, i) => (
                      <th key={i} className="p-2 border-r border-black text-[8px] whitespace-nowrap min-w-[80px] text-black">
                        M{i+1}<br/>{d.toLocaleString('default', { month: 'short' })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.length === 0 ? (
                    <tr><td colSpan={projectMonthsList.length + 2} className="p-32 text-center text-gray-400 italic font-black uppercase text-xs">Waiting for data import...</td></tr>
                  ) : resources.map((res) => (
                    <tr key={res.id} className="border-b border-gray-200 hover:bg-blue-50 group">
                      <td className="p-2 border-r border-black font-black bg-gray-50 sticky left-0 z-10 w-56 text-black">
                        <input 
                          className="bg-transparent font-black outline-none w-full text-black" 
                          value={res.name} 
                          onChange={(e) => handleManualResourceEdit(res.id, { name: e.target.value })} 
                        />
                        <span className="text-[8px] opacity-70 block text-black">{res.role}</span>
                      </td>
                      <td className="p-2 border-r border-black text-right font-bold text-black">
                        €{(globalRate > 0 ? globalRate : res.monthlyCost).toLocaleString()}
                        {globalRate > 0 && <div className="text-[7px] opacity-40 italic">GLOBAL OVERRIDE</div>}
                      </td>
                      {projectMonthsList.map((m, i) => {
                        const monthKey = m.toISOString().slice(0, 7);
                        const allocation = res.allocations[monthKey] ?? 0;
                        return (
                          <td key={i} className={`p-1 border-r border-gray-100 text-center ${allocation > 0 ? 'bg-blue-50/50' : 'opacity-30'}`}>
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
                 <div className="text-[9px] font-black uppercase mb-2 opacity-60 text-black leading-none">Suggested Headcount</div>
                 <div className="flex-grow flex flex-col justify-center">
                   <div className="text-2xl font-black text-black leading-tight">{suggestedFTE}</div>
                   <div className="text-[10px] font-black uppercase text-black leading-none tracking-tight">FTE</div>
                 </div>
               </div>
               <div className="border-r border-black/10 px-2 flex flex-col justify-start">
                 <div className="text-[9px] font-black uppercase mb-2 opacity-60 text-black leading-none">Workload Gap</div>
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