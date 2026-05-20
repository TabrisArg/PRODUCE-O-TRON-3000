import React, { useState, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import RetroButton from './RetroButton.tsx';
import { CONVERSIONS, RATIOS } from '../conversions.ts';
import { ICONS } from '../src/icons.ts';

interface BacklogItem {
  id: string;
  section: string;
  task: string;
  discipline: string;
  rawEffort: number;
}

interface ColumnMapping {
  sectionCol: number;
  taskCol: number;
  disciplineCol: number;
  effortCol: number;
}

const DEFAULT_MAPPING: ColumnMapping = {
  sectionCol: 1,
  taskCol: 2,
  disciplineCol: 3,
  effortCol: 4
};

export const ToolDisciplineCalculator: React.FC = () => {
  // File Upload & Sheet States
  const [isImporting, setIsImporting] = useState(false);
  const [workbookData, setWorkbookData] = useState<ExcelJS.Workbook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  
  // Custom manual overrides for column mapping
  const [showMappingConfig, setShowMappingConfig] = useState(false);
  const [columnHeaders, setColumnHeaders] = useState<{ index: number; name: string }[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  
  // Data State
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  
  // Active selected stage filter ('ALL' or a specific stage name)
  const [activeStage, setActiveStage] = useState<string>('ALL');
  
  // Unit & Inefficiency States
  const [inputUnit, setInputUnit] = useState<'MONTHS' | 'DAYS' | 'HOURS'>('MONTHS');
  const [outputUnit, setOutputUnit] = useState<'MONTHS' | 'DAYS' | 'HOURS'>('MONTHS');
  const [inefficiency, setInefficiency] = useState<number>(0); // percentage: 0 to 100
  const [selectedDisciplineDetails, setSelectedDisciplineDetails] = useState<string | null>(null);

  // File Input Ref for drag & click triggers
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Utility: Get display unit symbol ---
  const getUnitSymbol = (unit: 'MONTHS' | 'DAYS' | 'HOURS') => {
    switch (unit) {
      case 'MONTHS': return 'MM';
      case 'DAYS': return 'MD';
      case 'HOURS': return 'MH';
    }
  };

  // --- Helper to format exact efforts up to 2 decimals without trailing zeros ---
  const formatEffortVal = (val: number): string => {
    return Number(val.toFixed(2)).toString();
  };

  // --- Helper to convert a raw value between units ---
  const convertEffort = (value: number, from: 'MONTHS' | 'DAYS' | 'HOURS', to: 'MONTHS' | 'DAYS' | 'HOURS'): number => {
    if (value <= 0) return 0;
    
    // First convert to standard Month equivalent
    let monthEquiv = 0;
    if (from === 'MONTHS') {
      monthEquiv = value;
    } else if (from === 'DAYS') {
      monthEquiv = value * RATIOS.DAYS_TO_MONTH;
    } else if (from === 'HOURS') {
      monthEquiv = value * RATIOS.HOURS_TO_MONTH;
    }

    // Then convert to destination unit
    if (to === 'MONTHS') {
      return monthEquiv;
    } else if (to === 'DAYS') {
      return monthEquiv * RATIOS.MONTH_TO_DAYS;
    } else if (to === 'HOURS') {
      return monthEquiv * RATIOS.MONTH_TO_HOURS;
    }
    return value;
  };

  // --- Logic: Cell reading ---
  const getCellValueString = (cell: ExcelJS.Cell): string => {
    if (!cell || cell.value === null || cell.value === undefined) return "";
    if (typeof cell.value === 'object') {
      if ('richText' in cell.value && Array.isArray(cell.value.richText)) {
        return cell.value.richText.map(rt => rt.text).join("");
      }
      if ('result' in cell.value) return String(cell.value.result || "");
      if ('text' in cell.value) return String(cell.value.text || "");
      return JSON.stringify(cell.value);
    }
    return String(cell.value).trim();
  };

  // --- Core parsing method based on current workbook, sheet, and column mapping ---
  const parseWorkbookSheet = (workbook: ExcelJS.Workbook, sheetName: string, customMap?: ColumnMapping) => {
    const ws = workbook.getWorksheet(sheetName) || workbook.worksheets[0];
    if (!ws) return;

    // Scan the first 15 rows to guess/collect header cells
    let bestHeaderRow = 1;
    let foundHeaders = false;
    const computedMap: ColumnMapping = { ...DEFAULT_MAPPING };
    const availableHeaders: { index: number; name: string }[] = [];

    // Peek row 1 columns to identify available letters
    const sampleRow = ws.getRow(1);
    sampleRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colLetter = String.fromCharCode(65 + (colNumber - 1) % 26);
      availableHeaders.push({
        index: colNumber,
        name: `Col ${colLetter}`
      });
    });

    for (let i = 1; i <= 15; i++) {
      const row = ws.getRow(i);
      let matchesTask = false;
      let matchesEffort = false;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = getCellValueString(cell).toLowerCase();
        if (!val) return;

        // Custom mappings finder
        if (val === 'section' || val === 'phase' || val === 'milestone' || val === 'category' || val === 'stage' || val.includes('stage') || val.includes('milestone')) {
          computedMap.sectionCol = colNumber;
        }
        if (val.includes('task') || val.includes('package') || val.includes('work') || val === 'item' || val === 'wp' || val.includes('name')) {
          computedMap.taskCol = colNumber;
          matchesTask = true;
        }
        if (val === 'discipline' || val === 'role' || val.includes('staff') || val.includes('resource') || val === 'disc' || val === 'who') {
          computedMap.disciplineCol = colNumber;
        }
        if (val.includes('effort') || val.includes('estimate') || val.includes('value') || val === 'days' || val === 'hours' || val === 'months' || val === 'mm' || val === 'est' || val === 'cost' || val.includes('duration')) {
          computedMap.effortCol = colNumber;
          matchesEffort = true;
        }
      });

      if (matchesTask && matchesEffort) {
        bestHeaderRow = i;
        foundHeaders = true;
        break;
      }
    }

    const activeMap = customMap || computedMap;
    setMapping(activeMap);

    // Collect all headers to display mapping helpers in UI
    const finalHeaders: { index: number; name: string }[] = [];
    const headerRowObj = ws.getRow(bestHeaderRow);
    
    for (let c = 1; c <= Math.max(10, headerRowObj.cellCount); c++) {
      const letter = String.fromCharCode(64 + c);
      const textVal = getCellValueString(headerRowObj.getCell(c));
      finalHeaders.push({
        index: c,
        name: textVal ? `[Col ${letter}] ${textVal}` : `Column ${letter}`
      });
    }
    setColumnHeaders(finalHeaders);

    // Build items list
    const parsedItems: BacklogItem[] = [];
    let lastSection = "";

    ws.eachRow((row, rowNum) => {
      if (rowNum <= bestHeaderRow) return;

      const col1Val = getCellValueString(row.getCell(activeMap.sectionCol));
      const col2Val = getCellValueString(row.getCell(activeMap.taskCol));
      const col3Val = getCellValueString(row.getCell(activeMap.disciplineCol));
      
      let rawVal = 0;
      const effortCell = row.getCell(activeMap.effortCol);
      if (typeof effortCell.value === 'number') {
        rawVal = effortCell.value;
      } else {
        rawVal = parseFloat(getCellValueString(effortCell).replace(/[^\d.]/g, '')) || 0;
      }

      // Identify stage header row: Col 1 is populated, but Discipline and Estimate are empty/zero.
      const isStageHeader = col1Val && !col3Val && rawVal === 0;

      if (isStageHeader) {
        lastSection = col1Val;
        return; // Skip adding stage header row as a task
      }

      // Regular task row: Column 1 holds the actual task title. If empty, fallback to Column 2 (Work Package description).
      const taskTitle = col1Val || col2Val;

      if (taskTitle && rawVal > 0 && !taskTitle.toLowerCase().includes('total')) {
        parsedItems.push({
          id: `${rowNum}-${Math.random().toString(36).substr(2, 5)}`,
          section: lastSection || "Unassigned", // Assign to the closest stage/phase header parsed above
          task: taskTitle,
          discipline: col3Val || "Unknown / Unassigned",
          rawEffort: rawVal
        });
      }
    });

    setBacklogItems(parsedItems);
    setActiveStage('ALL'); // Reset Stage tab on new load
  };

  // --- Handler: File Select ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setFileName(file.name);

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      
      if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(arrayBuffer);
        const lines = text.split(/\r?\n/).filter(line => line.trim()).map(line => {
          return line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        });
        const ws = workbook.addWorksheet('Backlog');
        lines.forEach((line, i) => ws.getRow(i + 1).values = line);
      } else {
        await workbook.xlsx.load(arrayBuffer);
      }

      setWorkbookData(workbook);

      // Extract sheet names
      const names: string[] = [];
      workbook.worksheets.forEach(w => names.push(w.name));
      setSheetNames(names);

      const firstSheet = names[0] || '';
      setSelectedSheet(firstSheet);
      parseWorkbookSheet(workbook, firstSheet);
    } catch (err) {
      console.error(err);
      alert("Error loading excel file. Please make sure it is a valid excel formatted workbook.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Change active Excel worksheet ---
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbookData) {
      parseWorkbookSheet(workbookData, sheetName);
    }
  };

  // --- Apply custom mappings ---
  const updateColumnMapping = (key: keyof ColumnMapping, valIndex: number) => {
    const nextMapping = { ...mapping, [key]: valIndex };
    setMapping(nextMapping);
    if (workbookData && selectedSheet) {
      parseWorkbookSheet(workbookData, selectedSheet, nextMapping);
    }
  };

  const clearData = () => {
    setWorkbookData(null);
    setBacklogItems([]);
    setFileName('');
    setSheetNames([]);
    setSelectedSheet('');
    setInefficiency(0);
    setSelectedDisciplineDetails(null);
    setActiveStage('ALL');
  };

  // --- Template Downloader ---
  const triggerSampleDownload = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Project Backlog');

    worksheet.columns = [
      { header: 'Milestone', key: 'section', width: 35 },
      { header: 'Work Package', key: 'task', width: 45 },
      { header: 'Discipline', key: 'discipline', width: 25 },
      { header: 'Estimate', key: 'estimate', width: 20 },
    ];

    const hdrRow = worksheet.getRow(1);
    hdrRow.font = { bold: true };
    hdrRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

    const sampleRows = [
      { section: 'Preprod' },
      { section: 'Art direction / PBR style targets', task: 'Reference board: what does SR2 look like in PBR? Stylized vs realistic.', discipline: 'Technical Art', estimate: 0.25 },
      { section: '.cmeshx format documentation (XML)', task: 'Format spec + sample parser', discipline: 'Technical Art', estimate: 0.07 },
      { section: '.morphx format documentation (XML)', task: 'Format spec + sample parser', discipline: 'Technical Art', estimate: 0.05 },
      { section: '.carx format documentation', task: 'Complete format spec', discipline: 'Technical Art', estimate: 0.02 },
      { section: 'Get original project compiled', task: 'Original engine preparation', discipline: 'Programming', estimate: 1.0 },
      { section: 'Remove old rendering pipeline', task: 'Original engine preparation', discipline: 'Programming', estimate: 0.5 },
      
      { section: 'Main Prod' },
      { section: 'UE5 master material - opaque world surfaces', task: 'Parameterized master material for world geometry', discipline: 'Technical Art', estimate: 1.0 },
      { section: 'UE5 master material - characters (skin / cloth / hair)', task: 'Character material with subsurface scattering', discipline: 'Technical Art', estimate: 1.0 },
      { section: 'Stilwater exterior lighting — downtown / commercial', task: 'Lit exterior: day / night / weather', discipline: 'Lighting Art', estimate: 4.0 },
      { section: 'Combat VFX — muzzle flash (all weapon types)', task: 'Niagara muzzle flash systems', discipline: 'VFX Art', estimate: 2.0 },
      { section: 'UE UI Rebuild', task: 'Rebuild UI from scratch', discipline: 'Programming', estimate: 12.0 },

      { section: 'Polish' },
      { section: 'Kazuo through Aisha - face remodels (7)', task: '7 face meshes + PBR textures', discipline: 'Character Art', estimate: 4.0 },
      { section: 'T1 weapons (7) — high-poly remodel', task: '7 remodeled weapons + PBR textures', discipline: 'Hard Surface Art', estimate: 6.0 },

      { section: 'Cert' },
      
      { section: 'Post' }
    ];

    sampleRows.forEach(srv => {
      const inserted = worksheet.addRow(srv);
      if (!srv.task) {
        inserted.font = { bold: true };
        inserted.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'Sample_Backlog_Calculator.xlsx';
    a.click();
  };

  // --- Dynamic Ordered Phases List ---
  const stagesList = useMemo(() => {
    const list: string[] = [];
    backlogItems.forEach(item => {
      const sec = item.section?.trim() || "Unassigned";
      if (!list.includes(sec)) {
        list.push(sec);
      }
    });
    return list;
  }, [backlogItems]);

  // --- Overall / Combined Grand Totals across all items ---
  const globalTotals = useMemo(() => {
    let totalBase = 0;
    backlogItems.forEach(item => {
      totalBase += convertEffort(item.rawEffort, inputUnit, outputUnit);
    });
    const extra = totalBase * (inefficiency / 100);
    return {
      base: totalBase,
      extra: extra,
      grand: totalBase + extra
    };
  }, [backlogItems, inputUnit, outputUnit, inefficiency]);

  // --- Matrix metrics for each individual stage ---
  const stageStatsMap = useMemo(() => {
    const stats: { [stage: string]: { taskCount: number; baseEffort: number; extraEffort: number; totalEffort: number } } = {};
    
    stagesList.forEach(st => {
      stats[st] = { taskCount: 0, baseEffort: 0, extraEffort: 0, totalEffort: 0 };
    });

    backlogItems.forEach(item => {
      const st = item.section?.trim() || "Unassigned";
      if (!stats[st]) {
        stats[st] = { taskCount: 0, baseEffort: 0, extraEffort: 0, totalEffort: 0 };
      }
      const itemEffort = convertEffort(item.rawEffort, inputUnit, outputUnit);
      stats[st].taskCount += 1;
      stats[st].baseEffort += itemEffort;
    });

    stagesList.forEach(st => {
      const extra = stats[st].baseEffort * (inefficiency / 100);
      stats[st].extraEffort = extra;
      stats[st].totalEffort = stats[st].baseEffort + extra;
    });

    return stats;
  }, [backlogItems, stagesList, inputUnit, outputUnit, inefficiency]);

  // --- Filtered backlog items based on activeStage view tab selection ---
  const activeStageItems = useMemo(() => {
    if (activeStage === 'ALL') return backlogItems;
    return backlogItems.filter(item => (item.section?.trim() || "Unassigned") === activeStage);
  }, [backlogItems, activeStage]);

  // --- Active Stage specific KPIs (recalculates values dynamically on Tab Shift) ---
  const activeStageTotals = useMemo(() => {
    let totalBase = 0;
    activeStageItems.forEach(item => {
      totalBase += convertEffort(item.rawEffort, inputUnit, outputUnit);
    });
    const extra = totalBase * (inefficiency / 100);
    return {
      base: totalBase,
      extra: extra,
      grand: totalBase + extra
    };
  }, [activeStageItems, inputUnit, outputUnit, inefficiency]);

  // --- Active focused stage discipline breakdowns ---
  const disciplineSummaries = useMemo(() => {
    const summaryMap: { 
      [name: string]: { 
        name: string; 
        taskCount: number; 
        baseEffortRaw: number; 
      } 
    } = {};

    activeStageItems.forEach(item => {
      const disc = item.discipline?.trim() || 'Unknown';
      if (!summaryMap[disc]) {
        summaryMap[disc] = { name: disc, taskCount: 0, baseEffortRaw: 0 };
      }
      
      const inVal = Number(item.rawEffort) || 0;
      const convertedVal = convertEffort(inVal, inputUnit, outputUnit);

      summaryMap[disc].taskCount += 1;
      summaryMap[disc].baseEffortRaw += convertedVal;
    });

    return Object.values(summaryMap).map(d => {
      const baseEffort = d.baseEffortRaw;
      const extraEffort = baseEffort * (inefficiency / 100);
      const totalEffort = baseEffort + extraEffort;
      return {
        name: d.name,
        taskCount: d.taskCount,
        baseEffort,
        inefficiencyEffort: extraEffort,
        totalEffort
      };
    }).sort((a, b) => b.totalEffort - a.totalEffort);

  }, [activeStageItems, inputUnit, outputUnit, inefficiency]);

  // --- Handler: Export stage-aware excel calculations ---
  const handleExportCalculations = async () => {
    if (backlogItems.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Executive stage-by-stage comparison overview
    const sumSheet = workbook.addWorksheet('Project Overview');
    sumSheet.columns = [
      { header: 'Project Stage', key: 'stage', width: 25 },
      { header: 'Work Packages', key: 'tasks', width: 15 },
      { header: `Base Effort (${getUnitSymbol(outputUnit)})`, key: 'base', width: 20 },
      { header: `Inefficiency Effort (+${inefficiency}%)`, key: 'extra', width: 22 },
      { header: `Total Effort (${getUnitSymbol(outputUnit)})`, key: 'total', width: 22 },
      { header: '% Share', key: 'share', width: 12 },
    ];

    const hRow = sumSheet.getRow(1);
    hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

    stagesList.forEach(st => {
      const stDetails = stageStatsMap[st];
      const shareVal = globalTotals.grand > 0 ? (stDetails.totalEffort / globalTotals.grand) * 100 : 0;
      sumSheet.addRow({
        stage: st,
        tasks: stDetails.taskCount,
        base: Number(stDetails.baseEffort.toFixed(2)),
        extra: Number(stDetails.extraEffort.toFixed(2)),
        total: Number(stDetails.totalEffort.toFixed(2)),
        share: `${Math.round(shareVal)}%`
      });
    });

    // Grand total row overall
    const endRowIdx = stagesList.length + 2;
    const totalRowObj = sumSheet.getRow(endRowIdx);
    totalRowObj.getCell(1).value = "GRAND TOTALS";
    totalRowObj.getCell(2).value = backlogItems.length;
    totalRowObj.getCell(3).value = Number(globalTotals.base.toFixed(2));
    totalRowObj.getCell(4).value = Number(globalTotals.extra.toFixed(2));
    totalRowObj.getCell(5).value = Number(globalTotals.grand.toFixed(2));
    totalRowObj.getCell(6).value = "100%";
    totalRowObj.font = { bold: true };
    totalRowObj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    // Sheet 2: Discipline distribution per stage
    const discSheet = workbook.addWorksheet('Discipline Distribution');
    discSheet.columns = [
      { header: 'Stage / Phase', key: 'stage', width: 22 },
      { header: 'Discipline', key: 'name', width: 30 },
      { header: 'Tasks Count', key: 'tasks', width: 15 },
      { header: `Base Effort (${getUnitSymbol(outputUnit)})`, key: 'base', width: 18 },
      { header: `Adjusted Effort (+${inefficiency}%)`, key: 'total', width: 22 },
    ];

    const dHRow = discSheet.getRow(1);
    dHRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    dHRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

    // Group disciplines under each stage for clean Excel structure
    stagesList.forEach(st => {
      const itemsInStage = backlogItems.filter(item => (item.section?.trim() || "Unassigned") === st);
      const stageDiscs: { [disc: string]: { base: number; count: number } } = {};
      itemsInStage.forEach(item => {
        const d = item.discipline || "Unknown";
        if (!stageDiscs[d]) stageDiscs[d] = { base: 0, count: 0 };
        stageDiscs[d].base += convertEffort(item.rawEffort, inputUnit, outputUnit);
        stageDiscs[d].count += 1;
      });

      Object.entries(stageDiscs).forEach(([discName, metrics]) => {
        discSheet.addRow({
          stage: st,
          name: discName,
          tasks: metrics.count,
          base: Number(metrics.base.toFixed(2)),
          total: Number((metrics.base * (1 + inefficiency / 100)).toFixed(2))
        });
      });
    });

    // Sheet 3: Individual task logs
    const taskSheet = workbook.addWorksheet('Task Master Log');
    taskSheet.columns = [
      { header: 'Project Stage', key: 'stage', width: 22 },
      { header: 'Task Package Title', key: 'task', width: 45 },
      { header: 'Assigned Discipline', key: 'discipline', width: 30 },
      { header: `Source Est (${getUnitSymbol(inputUnit)})`, key: 'sourceVal', width: 22 },
      { header: `Converted Est (${getUnitSymbol(outputUnit)})`, key: 'convertedVal', width: 22 },
    ];

    const tHRow = taskSheet.getRow(1);
    tHRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    tHRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    // Sort work items chronologically or by stage sequence as found
    stagesList.forEach(st => {
      const stageTasks = backlogItems.filter(item => (item.section?.trim() || "Unassigned") === st);
      stageTasks.forEach(item => {
        taskSheet.addRow({
          stage: item.section,
          task: item.task,
          discipline: item.discipline,
          sourceVal: item.rawEffort,
          convertedVal: Number(convertEffort(item.rawEffort, inputUnit, outputUnit).toFixed(2))
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProjectStages_DisciplineReport_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full min-h-[500px]" id="tool-discipline-calculator">
      {/* Title Header bar */}
      <div className="p-3 bg-blue-900 text-white font-black uppercase text-xs flex justify-between items-center sm:text-sm select-none border-b-2 border-gray-400">
        <div className="flex items-center gap-2">
          <span>📊</span>
          <span>Stage & Discipline Effort Calculator</span>
        </div>
        <div className="font-mono text-[9px] px-2 py-0.5 bg-blue-950 text-emerald-400 border border-emerald-900 rounded-sm">
          {backlogItems.length > 0 ? `PROJECT BACKLOG LOADED: ${backlogItems.length} ITEMS` : 'READY FOR WORKBOOK'}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 p-4 flex-grow bg-gray-100 overflow-y-auto">
        {/* LEFT COMPONENT COLUMN - CONTROLS & PARSER SETTINGS */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          
          {/* Backlog spreadsheet Import terminal */}
          <div className="win95-bg border-2 border-gray-300 p-3 shadow-md flex flex-col gap-2 relative">
            <div className="text-[10px] font-bold text-gray-700 uppercase border-b border-gray-400 pb-1">
              Data Import Terminal
            </div>

            <input 
              type="file" 
              accept=".xlsx,.csv" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
              id="calculator-file-input"
            />

            {backlogItems.length === 0 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-400 p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white transition-colors py-10"
                id="calculator-dropzone"
              >
                <img src={ICONS.FOLDER} alt="import" className="w-10 h-10 mb-2 animate-bounce" referrerPolicy="no-referrer" />
                <span className="text-sm font-black text-blue-900 uppercase">Load Estimate Workbook</span>
                <span className="text-[10px] text-gray-500 mt-1 max-w-[200px]">Drop or click to select Excel (.xlsx) or CSV</span>
              </div>
            ) : (
              <div className="p-2 border border-green-300 bg-green-50/50 rounded-sm flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-2 text-green-800 font-bold overflow-hidden truncate">
                  <span>📂</span> 
                  <span className="truncate">{fileName}</span>
                </div>
                <div className="opacity-70 mt-0.5 flex justify-between">
                  <span>Worksheet in use:</span>
                  <span className="font-mono font-bold text-blue-800 underline">{selectedSheet}</span>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-green-200">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-grow text-[9px] px-2 py-1 win95-bg border border-gray-400 text-gray-800 font-bold uppercase hover:bg-gray-100 active:retro-inset"
                    id="btn-reimport"
                  >
                    Load Different Workbook
                  </button>
                  <button 
                    onClick={clearData}
                    className="text-[9px] px-2 py-1 bg-red-600 text-white font-bold uppercase border border-red-700 hover:bg-red-700 active:translate-y-0.5"
                    id="btn-clear-calculator"
                  >
                    Clear Data
                  </button>
                </div>
              </div>
            )}

            <button 
              onClick={triggerSampleDownload}
              className="w-full text-left text-[10px] text-blue-700 hover:underline font-bold mt-1 flex items-center justify-between"
              id="btn-download-sample-csv"
            >
              <span>📥 Download Backlog Test Template</span>
              <span className="text-[9px] text-gray-400 font-normal">.xlsx format</span>
            </button>
          </div>

          {/* Calculator Parameters Config */}
          <div className="win95-bg border-2 border-gray-300 p-3 shadow-md flex flex-col gap-3">
            <div className="text-[10px] font-bold text-gray-700 uppercase border-b border-gray-400 pb-1">
              Measurement & Unit Parameters
            </div>

            {/* In-File worksheet Selector */}
            {sheetNames.length > 1 && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-black uppercase text-gray-700">Active Sheet Name:</label>
                <select 
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="w-full px-2 py-1 border border-gray-400 bg-white font-mono text-xs rounded-sm focus:outline-none"
                  id="select-worksheet"
                >
                  {sheetNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Input Unit Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black uppercase text-gray-700 flex justify-between">
                <span>Spreadsheet Unit:</span>
                <span className="text-[9px] text-gray-400 font-normal italic">Source formatting</span>
              </label>
              <div className="grid grid-cols-3 gap-1 bg-gray-200 p-1 rounded-sm border border-gray-300">
                {(['MONTHS', 'DAYS', 'HOURS'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setInputUnit(u)}
                    className={`text-[10px] font-bold py-1 px-1 text-center rounded-sm transition-colors ${inputUnit === u ? 'bg-blue-800 text-white shadow-sm' : 'hover:bg-gray-300 text-gray-800'}`}
                    id={`btn-input-unit-${u.toLowerCase()}`}
                  >
                    {u === 'MONTHS' ? 'Months (MM)' : u === 'DAYS' ? 'Days (MD)' : 'Hours (MH)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Output Display Unit Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-black uppercase text-gray-700 flex justify-between">
                <span>Display output Unit:</span>
                <span className="text-[9px] text-gray-400 font-normal italic">Analysis output</span>
              </label>
              <div className="grid grid-cols-3 gap-1 bg-gray-200 p-1 rounded-sm border border-gray-300">
                {(['MONTHS', 'DAYS', 'HOURS'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setOutputUnit(u)}
                    className={`text-[10px] font-bold py-1 px-1 text-center rounded-sm transition-colors ${outputUnit === u ? 'bg-blue-800 text-white shadow-sm' : 'hover:bg-gray-300 text-gray-800'}`}
                    id={`btn-output-unit-${u.toLowerCase()}`}
                  >
                    {u === 'MONTHS' ? 'Months (MM)' : u === 'DAYS' ? 'Days (MD)' : 'Hours (MH)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Inefficiency Index offset slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[11px] font-black uppercase text-gray-700">
                <span>Inefficiency Index Buffer:</span>
                <span className="font-mono text-indigo-700 font-black bg-indigo-50 px-1 border border-indigo-200 rounded-sm text-xs">
                  +{inefficiency}%
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={inefficiency}
                  onChange={(e) => setInefficiency(parseInt(e.target.value) || 0)}
                  className="flex-grow accent-blue-900 cursor-pointer h-2 bg-gray-300 rounded-lg outline-none"
                  id="inp-coefficient-slider"
                />
                <input 
                  type="number"
                  min="0"
                  max="100"
                  value={inefficiency}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setInefficiency(isNaN(v) ? 0 : Math.min(100, Math.max(0, v)));
                  }}
                  className="w-12 text-center text-xs font-mono font-bold py-0.5 border border-gray-400 bg-white"
                  id="inp-coefficient-number"
                />
              </div>
              <p className="text-[9px] text-gray-500 italic leading-tight mt-0.5">
                Applies risk factor and team inefficiency compounding to overall calculations.
              </p>
            </div>

            {/* Manual Mappings Config selector toggle */}
            <div className="border-t border-gray-300 pt-2 mt-1">
              <button 
                onClick={() => setShowMappingConfig(!showMappingConfig)}
                className="w-full text-left text-[10px] font-bold text-gray-700 hover:text-blue-700 flex items-center justify-between"
                id="toggle-column-mapping"
              >
                <span>⚙️ Override Auto Column Mappings</span>
                <span>{showMappingConfig ? '▼' : '►'}</span>
              </button>

              {showMappingConfig && (
                <div className="mt-2 bg-gray-50 border border-gray-300 p-2 rounded-sm text-xs flex flex-col gap-2">
                  <p className="text-[9px] text-gray-400 leading-tight">
                    Change target indices if the parser fails to auto-identify column letters.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] font-bold uppercase text-gray-500">Stage / Section:</label>
                      <select 
                        value={mapping.sectionCol}
                        onChange={(e) => updateColumnMapping('sectionCol', parseInt(e.target.value))}
                        className="w-full p-1 bg-white border border-gray-400 outline-none text-[10px]"
                        id="select-map-section"
                      >
                        {columnHeaders.map(c => (
                          <option key={c.index} value={c.index}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] font-bold uppercase text-gray-500">Task Name:</label>
                      <select 
                        value={mapping.taskCol}
                        onChange={(e) => updateColumnMapping('taskCol', parseInt(e.target.value))}
                        className="w-full p-1 bg-white border border-gray-400 outline-none text-[10px]"
                        id="select-map-task"
                      >
                        {columnHeaders.map(c => (
                          <option key={c.index} value={c.index}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] font-bold uppercase text-gray-500">Discipline:</label>
                      <select 
                        value={mapping.disciplineCol}
                        onChange={(e) => updateColumnMapping('disciplineCol', parseInt(e.target.value))}
                        className="w-full p-1 bg-white border border-gray-400 outline-none text-[10px]"
                        id="select-map-discipline"
                      >
                        {columnHeaders.map(c => (
                          <option key={c.index} value={c.index}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <label className="text-[9px] font-bold uppercase text-gray-500">Effort Estimate:</label>
                      <select 
                        value={mapping.effortCol}
                        onChange={(e) => updateColumnMapping('effortCol', parseInt(e.target.value))}
                        className="w-full p-1 bg-white border border-gray-400 outline-none text-[10px]"
                        id="select-map-effort"
                      >
                        {columnHeaders.map(c => (
                          <option key={c.index} value={c.index}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - ANALYTICAL SUMMARY & MATRIX OVERVIEWS */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          
          {backlogItems.length === 0 ? (
            /* Empty / Idle State */
            <div className="flex-grow flex flex-col items-center justify-center p-8 bg-white border-2 border-dashed border-gray-300 rounded-sm min-h-[450px]">
              <div className="max-w-md text-center flex flex-col items-center">
                <img src={ICONS.RECALCULATE} alt="waiting-for-data" className="w-14 h-14 mb-4 select-none opacity-80" referrerPolicy="no-referrer" />
                <h3 className="text-lg font-black text-blue-900 tracking-tight uppercase">Stage Calculator Idle</h3>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  Provide your master project backlog spreadsheet. The dashboard will automatically partition task estimates into milestones (Preprod, Main Prod, Polish, etc.) and calculate structural discipline efforts.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <RetroButton 
                    onClick={() => fileInputRef.current?.click()}
                    active
                    className="text-xs font-bold uppercase px-4 py-2"
                    id="btn-upload-idle"
                  >
                    📂 Select File Workbook
                  </RetroButton>
                  <button 
                    onClick={triggerSampleDownload}
                    className="text-xs font-bold uppercase px-4 py-2 border-2 border-gray-500 hover:bg-gray-100 win95-bg rounded-sm"
                    id="btn-download-idle"
                  >
                    Download Sample
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Data Active Panel */
            <>
              {/* Dynamic KPI Header dependent entirely on selected stage view */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* Stage Base Effort Panel */}
                <div className="win95-bg border-4 border-gray-400 p-3 shadow-inner text-center select-none">
                  <div className="text-[9px] text-gray-600 font-bold uppercase mb-1">
                    {activeStage === 'ALL' ? 'Overall Base Effort' : `${activeStage} Base Effort`}
                  </div>
                  <div className="text-2xl font-black text-blue-900 font-mono">
                    {formatEffortVal(activeStageTotals.base)} <span className="text-xs font-bold text-gray-500">{getUnitSymbol(outputUnit)}</span>
                  </div>
                  <div className="text-[9px] text-gray-400 italic mt-0.5">
                    {activeStage === 'ALL' ? 'Loaded project total' : `Total for ${activeStage} phase`}
                  </div>
                </div>

                {/* Overhead multiplier Panel */}
                <div className="win95-bg border-4 border-gray-400 p-3 shadow-inner text-center select-none">
                  <div className="text-[9px] text-red-600 font-bold uppercase mb-1">
                    Risk Buffer Offset (+{inefficiency}%)
                  </div>
                  <div className="text-2xl font-black text-red-600 font-mono">
                    +{formatEffortVal(activeStageTotals.extra)} <span className="text-xs font-bold text-gray-500">{getUnitSymbol(outputUnit)}</span>
                  </div>
                  <div className="text-[9px] text-gray-400 italic mt-0.5">
                    Combined friction modifier
                  </div>
                </div>

                {/* Adjusted Total Effort Panel */}
                <div className="bg-slate-900 border-4 border-slate-700 p-3 text-center text-white select-none">
                  <div className="text-[9px] text-emerald-400 font-bold uppercase mb-1">
                    Adjusted Grand Effort
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {formatEffortVal(activeStageTotals.grand)} <span className="text-xs font-bold text-emerald-500">{getUnitSymbol(outputUnit)}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 italic mt-0.5">
                    Stage workload projection
                  </div>
                </div>

              </div>

              {/* STAGES MATRIX BOARD (Separate Stages Section) */}
              <div className="win95-bg border-2 border-gray-300 p-3 shadow-md flex flex-col gap-2">
                <div className="flex justify-between items-center border-b border-gray-400 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🛣️</span>
                    <span className="text-xs font-black uppercase text-gray-700">Project Stage matrix Overview</span>
                  </div>
                  <span className="text-[9px] text-indigo-800 bg-indigo-50 px-1.5 py-0.5 font-bold border border-indigo-200">
                    CLICK STAGE TO FILTER BREAKDOWNS BELOW
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 mt-1.5">
                  {/* Total Master Stage Button card */}
                  <div 
                    onClick={() => {
                      setActiveStage('ALL');
                      setSelectedDisciplineDetails(null);
                    }}
                    className={`p-2 border-2 cursor-pointer transition-all select-none flex flex-col justify-between ${activeStage === 'ALL' ? 'bg-indigo-900 text-white border-indigo-950 shadow-inner' : 'win95-bg border-gray-400 hover:bg-slate-50'}`}
                  >
                    <div>
                      <div className="text-[9px] uppercase opacity-75 font-bold">ALL STAGES COMBINED</div>
                      <div className="text-[10px] opacity-90 mt-0.5">{backlogItems.length} work items</div>
                    </div>
                    <div className="text-lg font-black font-mono mt-2 flex justify-between items-baseline">
                      <span>{formatEffortVal(globalTotals.grand)}</span>
                      <span className="text-[10px] font-bold opacity-60 font-sans">{getUnitSymbol(outputUnit)}</span>
                    </div>
                  </div>

                  {/* Individual stage cards */}
                  {stagesList.map(st => {
                    const stats = stageStatsMap[st] || { taskCount: 0, totalEffort: 0 };
                    const isActive = activeStage === st;
                    const percentShare = globalTotals.grand > 0 ? (stats.totalEffort / globalTotals.grand) * 100 : 0;

                    return (
                      <div 
                        key={st}
                        onClick={() => {
                          setActiveStage(st);
                          setSelectedDisciplineDetails(null);
                        }}
                        className={`p-2 border-2 cursor-pointer transition-all select-none flex flex-col justify-between ${isActive ? 'bg-blue-800 text-white border-blue-950 shadow-inner' : 'win95-bg border-gray-400 hover:bg-slate-100'}`}
                        id={`card-stage-${st.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div>
                          <div className="text-[9px] uppercase truncate font-black tracking-tight" title={st}>
                            {st}
                          </div>
                          <div className={`text-[9px] mt-0.5 ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>
                            {stats.taskCount} tasks ({Math.round(percentShare)}%)
                          </div>
                        </div>
                        <div className="text-lg font-black font-mono mt-2 flex justify-between items-baseline">
                          <span>{formatEffortVal(stats.totalEffort)}</span>
                          <span className={`text-[10px] font-bold font-sans ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                            {getUnitSymbol(outputUnit)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DISCIPLINE DISTRIBUTION ACCORDION BREAKDOWNS ENTIRELY REACTIVE TO FILTER */}
              <div className="win95-bg border-2 border-gray-300 p-3 shadow-md flex-grow flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-gray-400 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🏢</span>
                    <span className="text-xs font-black uppercase text-gray-700">
                      Discipline Distribution: <span className="text-blue-900 underline font-extrabold">{activeStage === 'ALL' ? 'All Milestones' : activeStage}</span>
                    </span>
                  </div>
                  
                  <RetroButton 
                    onClick={handleExportCalculations}
                    active
                    className="text-[9px] font-black uppercase px-2.5 py-1.5 flex items-center gap-1 shrink-0"
                    id="btn-export-totals"
                    title="Export the complete Multi-Stage formulation"
                  >
                    <img src={ICONS.EXPORT} alt="export" className="w-3.5 h-3.5" referrerPolicy="no-referrer" />
                    <span>Export Calculations</span>
                  </RetroButton>
                </div>

                {/* Filter list container */}
                <div className="flex items-center justify-between bg-slate-200 p-1.5 border border-gray-300 text-[10px] font-bold text-gray-700">
                  <span className="flex items-center gap-1">
                    <span>Active Target Phase:</span>
                    <strong className="text-blue-900 bg-white px-1 ml-0.5 border border-gray-300">
                      {activeStage === 'ALL' ? 'ALL PROJECT MODULES' : activeStage.toUpperCase()}
                    </strong>
                  </span>
                  <span>Filtered workload shares</span>
                </div>

                {/* Discipline Summaries Table */}
                <div className="overflow-x-auto border border-gray-300 bg-white rounded-sm">
                  <table className="w-full text-left border-collapse" id="table-disclpline-results">
                    <thead>
                      <tr className="bg-slate-100 border-b border-gray-300 text-[9px] font-black text-gray-600 uppercase">
                        <th className="p-2 border-r border-gray-300">Discipline Assignment</th>
                        <th className="p-2 border-r border-gray-300 text-center w-16">Tasks</th>
                        <th className="p-2 border-r border-gray-300 text-right w-24">Base Effort</th>
                        <th className="p-2 border-r border-gray-300 text-right w-28">Overheads (+{inefficiency}%)</th>
                        <th className="p-2 border-r border-gray-300 text-right w-24 font-black text-blue-900">Total Est</th>
                        <th className="p-2 text-center w-36">Impact share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 font-mono text-xs text-black">
                      {disciplineSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400 italic font-sans font-bold">
                            No elements returned for this query.
                          </td>
                        </tr>
                      ) : (
                        disciplineSummaries.map((disc, idx) => {
                          const percentShare = activeStageTotals.grand > 0 ? (disc.totalEffort / activeStageTotals.grand) * 100 : 0;
                          const isSelected = selectedDisciplineDetails === disc.name;

                          return (
                            <React.Fragment key={idx}>
                              <tr 
                                onClick={() => setSelectedDisciplineDetails(isSelected ? null : disc.name)}
                                className={`hover:bg-blue-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/85 border-l-4 border-l-blue-800' : ''}`}
                                id={`row-discipline-${disc.name.replace(/\s+/g, '-').toLowerCase()}`}
                              >
                                <td className="p-2 border-r border-gray-200 font-sans font-extrabold text-gray-800 flex items-center gap-1.5">
                                  <span>{isSelected ? '▼' : '►'}</span>
                                  <span className="hover:underline">{disc.name}</span>
                                </td>
                                <td className="p-2 border-r border-gray-200 text-center text-gray-600 font-bold">
                                  {disc.taskCount}
                                </td>
                                <td className="p-2 border-r border-gray-200 text-right">
                                  {formatEffortVal(disc.baseEffort)}
                                </td>
                                <td className="p-2 border-r border-gray-200 text-right text-red-600">
                                  +{formatEffortVal(disc.inefficiencyEffort)}
                                </td>
                                <td className="p-2 border-r border-gray-200 text-right font-black text-blue-900 bg-slate-50/40">
                                  {formatEffortVal(disc.totalEffort)}
                                </td>
                                <td className="p-2 align-middle">
                                  <div className="flex items-center gap-1.5 pr-1">
                                    <div className="flex-grow bg-gray-200 h-2 rounded-sm overflow-hidden border border-gray-300">
                                      <div 
                                        className="bg-blue-800 h-full rounded-sm" 
                                        style={{ width: `${Math.min(100, percentShare)}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-bold text-gray-500 text-right w-7 shrink-0">{Math.round(percentShare)}%</span>
                                  </div>
                                </td>
                              </tr>

                              {/* Dropdown list of tasks for the clicked discipline */}
                              {isSelected && (
                                <tr id={`expanded-discipline-${disc.name.replace(/\s+/g, '-').toLowerCase()}`}>
                                  <td colSpan={6} className="p-3 bg-slate-50 border-y border-gray-300">
                                    <div className="flex flex-col gap-1.5">
                                      <div className="text-[9px] font-black uppercase text-blue-900 border-b border-gray-200 pb-1 flex justify-between">
                                        <span>Allocated Packages inside {activeStage === 'ALL' ? 'Full Project' : activeStage}:</span>
                                        <span className="font-mono text-gray-500">Tasks: {disc.taskCount}</span>
                                      </div>
                                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 flex flex-col">
                                        {activeStageItems
                                          .filter(item => (item.discipline?.trim() || 'Unknown') === disc.name)
                                          .map((item, idy) => (
                                            <div key={idy} className="py-1 flex justify-between items-center text-[10px]">
                                              <div className="text-gray-700 truncate pr-4 max-w-sm sm:max-w-md font-sans">
                                                <span className="font-black text-indigo-500 mr-1.5">[{item.section}]</span> {item.task}
                                              </div>
                                              <div className="font-mono font-bold text-blue-900 shrink-0 bg-white px-1.5 py-0.5 border border-gray-200">
                                                {formatEffortVal(item.rawEffort)} {getUnitSymbol(inputUnit)}
                                                {inputUnit !== outputUnit && (
                                                  <span className="text-gray-400 ml-1 font-normal text-[9px]">
                                                    ({formatEffortVal(convertEffort(item.rawEffort, inputUnit, outputUnit))} {getUnitSymbol(outputUnit)})
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] text-gray-500 italic pb-1">
                  💡 Tip: Shift stages tab above or click on specific discipline cells to inspect nested work items. Integers are rounded.
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
