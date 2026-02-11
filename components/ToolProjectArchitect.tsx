import React, { useState, useEffect, useMemo, useRef } from 'react';
import RetroButton from './RetroButton.tsx';
import ExcelJS from 'exceljs';

interface Resource {
  id: string;
  name: string;
  monthlyCost: number;
  isOverride: boolean;
  role: string;
}

interface BacklogItem {
  task: string;
  effort: number;
}

interface ExchangeRates {
  [key: string]: number;
}

const EFFORT_UNITS = [
  { id: 'DAYS', label: 'Effort Days', ratioToMonth: 1/20 },
  { id: 'MONTHS', label: 'Man Months', ratioToMonth: 1 },
  { id: 'HOURS', label: 'Effort Hours', ratioToMonth: 1/160 },
];

const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

const ToolProjectArchitect: React.FC = () => {
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Project Parameters
  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });
  const [effortUnit, setEffortUnit] = useState('MONTHS');
  const [inefficiency, setInefficiency] = useState(50);
  const [avgCost, setAvgCost] = useState(5000);
  const [margin, setMargin] = useState(20);
  
  // Backlog state
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Resources state
  const [resources, setResources] = useState<Resource[]>([
    { id: '1', name: 'Project Lead', monthlyCost: 6500, isOverride: true, role: 'PM' },
  ]);

  // Currency & Rates
  const [primaryCurrency, setPrimaryCurrency] = useState('EUR');
  const [rates, setRates] = useState<ExchangeRates>({});
  
  // Fetch Rates
  useEffect(() => {
    fetch(`https://open.er-api.com/v6/latest/${primaryCurrency}`)
      .then(res => res.json())
      .then(data => setRates(data.rates || {}));
  }, [primaryCurrency]);

  // Calculations
  const projectDurationMonths = useMemo(() => {
    const start = new Date();
    const end = new Date(deadline);
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    return Math.max(1, Math.round(diff));
  }, [deadline]);

  const totalEffortRaw = useMemo(() => backlog.reduce((sum, item) => sum + item.effort, 0), [backlog]);
  const unitMultiplier = EFFORT_UNITS.find(u => u.id === effortUnit)?.ratioToMonth || 1;
  const totalEffortMonths = totalEffortRaw * unitMultiplier;
  const adjustedEffortMonths = totalEffortMonths * (1 + inefficiency / 100);
  
  const suggestedFTE = useMemo(() => {
    if (projectDurationMonths <= 0) return 0;
    return Math.ceil(adjustedEffortMonths / projectDurationMonths);
  }, [adjustedEffortMonths, projectDurationMonths]);

  const baseCost = resources.reduce((acc, r) => acc + (r.monthlyCost * projectDurationMonths), 0);
  const profitAmount = baseCost * (margin / 100);
  const grandTotal = baseCost + profitAmount;

  const handleBacklogUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
      
      if (!worksheet) {
        throw new Error("No worksheet found in file.");
      }

      let nameCol = 1;
      let effortCol = 2;

      // Scan header row (1) for column mapping
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        const val = cell.text.toLowerCase().trim();
        if (val === 'item name' || val === 'task' || val === 'description' || val === 'item') {
          nameCol = colNumber;
        }
        if (val === 'estimated days' || val === 'effort' || val === 'days' || val === 'estimated effort') {
          effortCol = colNumber;
        }
      });

      const newBacklog: BacklogItem[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        
        const task = row.getCell(nameCol).text || `Item ${rowNumber}`;
        const effortValue = row.getCell(effortCol).value;
        
        let effort = 0;
        if (typeof effortValue === 'number') {
          effort = effortValue;
        } else if (effortValue && typeof effortValue === 'object' && 'result' in effortValue) {
          effort = Number(effortValue.result) || 0;
        } else {
          effort = parseFloat(row.getCell(effortCol).text) || 0;
        }

        if (task && effort > 0) {
          newBacklog.push({ task, effort });
        }
      });

      if (newBacklog.length === 0) {
        alert("Warning: No tasks with effort > 0 were found. Check your column headers ('Item name' and 'Estimated days').");
      } else {
        setBacklog(newBacklog);
      }
    } catch (err) {
      console.error("Excel Import Error:", err);
      alert("Error reading Excel. Ensure the file is a valid .xlsx spreadsheet.");
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const applyAISuggestion = () => {
    if (suggestedFTE <= 0) return alert("Upload a backlog first to calculate headcount.");
    
    const newResources: Resource[] = [];
    const roles = ['Frontend Dev', 'Backend Dev', 'QA Engineer', 'UI Designer', 'DevOps'];
    
    for (let i = 0; i < suggestedFTE; i++) {
      const role = roles[i % roles.length];
      newResources.push({
        id: Math.random().toString(36).substr(2, 9),
        name: `${role} ${Math.floor(i/roles.length) + 1}`,
        monthlyCost: avgCost,
        isOverride: false,
        role: role
      });
    }
    
    setResources(newResources);
  };

  const addResource = () => {
    setResources([...resources, { 
      id: Math.random().toString(36).substr(2, 9), 
      name: 'New Resource', 
      monthlyCost: avgCost, 
      isOverride: false,
      role: 'Staff'
    }]);
  };

  const removeResource = (id: string) => setResources(resources.filter(r => r.id !== id));

  const handleGenerateExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Project Plan');
    sheet.columns = [
      { header: 'ITEM', key: 'item', width: 30 },
      { header: 'VALUE', key: 'val', width: 20 },
    ];

    sheet.addRow(['Project Architect Report', new Date().toLocaleDateString()]);
    sheet.addRow([]);
    sheet.addRow(['Total Backlog Tasks', backlog.length]);
    sheet.addRow(['Total Effort (Months)', totalEffortMonths.toFixed(2)]);
    sheet.addRow(['Inefficiency Buffer', `${inefficiency}%`]);
    sheet.addRow(['Target Duration', `${projectDurationMonths} Months`]);
    sheet.addRow(['Estimated Headcount', suggestedFTE]);
    sheet.addRow(['Grand Total Budget', grandTotal]);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Project_Architect_Plan_${Date.now()}.xlsx`;
    a.click();
  };

  const openDatePicker = () => {
    if (dateInputRef.current) {
      if ('showPicker' in HTMLInputElement.prototype) {
        (dateInputRef.current as any).showPicker();
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  return (
    <div className="p-4 space-y-6 text-black font-serif">
      <div className="flex justify-between items-center border-b-4 border-black pb-2">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter">
          🏗️ Project Architect
        </h2>
        <div className="win95-bg p-1 retro-inset px-3 text-[10px] font-mono leading-none border border-black shadow-sm">
          SYSTEM: v2.4-STABLE<br/>
          STATUS: READY
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Parameters Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">1. Project Specs</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Deadline</label>
                <div className="flex gap-1">
                  <input 
                    ref={dateInputRef}
                    type="date" 
                    className="flex-grow p-1 retro-inset bg-white text-xs outline-none text-black border border-gray-400 h-8"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                  <button 
                    onClick={openDatePicker}
                    className="win95-bg retro-beveled w-8 h-8 flex items-center justify-center border-2 border-gray-500 hover:bg-gray-100 active:retro-inset"
                    title="Open Calendar Picker"
                  >
                    📅
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Work Unit</label>
                <select 
                  className="w-full p-1 retro-inset bg-white text-xs outline-none text-black border border-gray-400"
                  value={effortUnit}
                  onChange={(e) => setEffortUnit(e.target.value)}
                >
                  {EFFORT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-black">Inefficiency Multiplier ({inefficiency}%)</label>
                <input 
                  type="range" min="0" max="100" 
                  className="w-full accent-black"
                  value={inefficiency}
                  onChange={(e) => setInefficiency(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 text-black">2. Import Backlog</h3>
            <div className="space-y-2">
              <input 
                type="file" 
                accept=".xlsx" 
                className="hidden" 
                id="architect-backlog-upload"
                onChange={handleBacklogUpload}
              />
              <label 
                htmlFor="architect-backlog-upload"
                className={`block w-full text-center py-2 win95-bg retro-beveled cursor-pointer text-xs font-black border-2 border-gray-500 hover:bg-gray-100 text-black ${isImporting ? 'opacity-50' : ''}`}
              >
                {isImporting ? '⌛ PARSING DATA...' : '📂 SELECT EXCEL FILE'}
              </label>
              
              {backlog.length > 0 && (
                <div className="mt-2 p-2 retro-inset bg-white text-[10px] max-h-32 overflow-auto font-mono border border-gray-400">
                  <div className="font-black border-b border-black mb-1 flex justify-between text-black">
                    <span>TASK LIST</span>
                    <span>COUNT: {backlog.length}</span>
                  </div>
                  {backlog.map((item, i) => (
                    <div key={i} className="flex justify-between border-b border-gray-100 py-0.5 text-black">
                      <span className="truncate w-40">{item.task}</span>
                      <span className="font-black">{item.effort}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Resource Board */}
        <div className="lg:col-span-2 space-y-4">
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-xs uppercase text-black">3. Resource Forecasting</h3>
              <RetroButton onClick={applyAISuggestion} className="text-[10px] font-black py-1 px-3 bg-white text-black border-2 border-black">
                🚀 Forecast: {suggestedFTE} FTE
              </RetroButton>
            </div>

            <div className="retro-inset bg-white overflow-x-auto min-h-[220px] border-2 border-black shadow-inner">
              <table className="w-full text-xs font-mono border-collapse">
                <thead className="bg-gray-300 border-b-2 border-black sticky top-0 z-20">
                  <tr>
                    <th className="p-1 text-left border-r border-black uppercase text-[10px] text-black font-black">Role</th>
                    <th className="p-1 text-left border-r border-black uppercase text-[10px] text-black font-black">Assignee</th>
                    <th className="p-1 text-right border-r border-black uppercase text-[10px] text-black font-black">Cost/Mo</th>
                    <th className="p-1 w-12 text-black font-black">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-black font-black italic uppercase text-xs">No resources allocated. Use forecast engine.</td>
                    </tr>
                  ) : resources.map((res) => (
                    <tr key={res.id} className="border-b border-gray-300 hover:bg-blue-50 group">
                      <td className="p-1 border-r border-gray-200">
                        <input className="w-full bg-transparent outline-none text-black font-medium focus:bg-white" value={res.role} onChange={(e) => setResources(resources.map(r => r.id === res.id ? {...r, role: e.target.value} : r))} />
                      </td>
                      <td className="p-1 border-r border-gray-200">
                        <input className="w-full bg-transparent outline-none font-black text-black focus:bg-white" value={res.name} onChange={(e) => setResources(resources.map(r => r.id === res.id ? {...r, name: e.target.value} : r))} />
                      </td>
                      <td className="p-1 text-right border-r border-gray-200">
                        <input type="number" className="w-24 text-right bg-transparent outline-none text-black font-black focus:bg-white" value={res.monthlyCost} onChange={(e) => setResources(resources.map(r => r.id === res.id ? {...r, monthlyCost: parseInt(e.target.value) || 0, isOverride: true} : r))} />
                      </td>
                      <td className="p-1 text-center">
                        <button onClick={() => removeResource(res.id)} className="text-red-700 font-black hover:bg-red-700 hover:text-white px-2 py-0.5 border border-red-700 transition-colors">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button 
                onClick={addResource} 
                className="p-3 w-full text-center text-xs text-black hover:bg-black hover:text-white uppercase font-black tracking-widest border-t-2 border-black transition-colors"
              >
                + Manually Add Team Member
              </button>
            </div>
          </div>

          {/* Timeline View */}
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
             <h3 className="font-black text-xs uppercase mb-3 text-black">4. Timeline Visualization</h3>
             <div className="space-y-4">
                <div className="relative h-24 bg-white retro-inset p-2 flex gap-1 items-end border-2 border-black shadow-inner">
                   {[
                     { label: 'Disc', color: 'bg-yellow-400', h: '30%', util: '25%' },
                     { label: 'Des', color: 'bg-blue-400', h: '50%', util: '50%' },
                     { label: 'Build', color: 'bg-green-500', h: '100%', util: '100%' },
                     { label: 'Test', color: 'bg-red-400', h: '80%', util: '100%' },
                     { label: 'Dep', color: 'bg-purple-400', h: '20%', util: '10%' },
                   ].map((phase, i) => (
                     <div key={i} className="flex-grow flex flex-col items-center justify-end h-full group relative">
                        <div 
                          className={`${phase.color} w-full border border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all`} 
                          style={{ height: phase.h }}
                        >
                        </div>
                        <span className="text-[8px] font-black mt-1 uppercase tracking-tighter text-black">{phase.label}</span>
                     </div>
                   ))}
                </div>
                <div className="flex justify-between text-[9px] font-mono text-black font-black uppercase tracking-tighter border-t border-black pt-2">
                   <span>Start: {new Date().toLocaleDateString()}</span>
                   <span>Duration: {projectDurationMonths} Months</span>
                   <span>End: {new Date(deadline).toLocaleDateString()}</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="p-6 border-4 border-black bg-[#ffffa0] shadow-[6px_6px_0px_rgba(0,0,0,1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
          <div className="text-4xl font-black rotate-12 text-black">CONFIDENTIAL</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center relative z-10">
           <div className="border-r md:border-black/20 border-transparent">
              <div className="text-[10px] font-black uppercase text-black mb-1">Total Raw Effort</div>
              <div className="text-xl font-black text-black">{totalEffortRaw.toFixed(1)} <span className="text-[10px]">{effortUnit}</span></div>
           </div>
           <div className="border-r md:border-black/20 border-transparent">
              <div className="text-[10px] font-black uppercase text-black mb-1">Project Window</div>
              <div className="text-xl font-black text-black">{projectDurationMonths} <span className="text-[10px]">MONTHS</span></div>
           </div>
           <div className="border-r md:border-black/20 border-transparent">
              <div className="text-[10px] font-black uppercase text-black mb-1">Calculated Headcount</div>
              <div className="text-xl font-black text-black">{suggestedFTE} <span className="text-[10px]">FTE</span></div>
           </div>
           <div>
              <div className="text-[10px] font-black uppercase text-black mb-1">Budget Projection</div>
              <div className="text-2xl font-black text-blue-900">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: primaryCurrency }).format(grandTotal)}
              </div>
           </div>
        </div>
        <div className="mt-6 flex gap-3">
          <RetroButton onClick={handleGenerateExcel} className="flex-grow font-black py-2 bg-blue-100 hover:bg-blue-300 transition-colors border-2 border-black text-black">
            💾 DOWNLOAD PROJECT CHARTER (.XLSX)
          </RetroButton>
        </div>
      </div>
    </div>
  );
};

export default ToolProjectArchitect;