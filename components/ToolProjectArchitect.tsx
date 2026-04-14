import React, { useState, useMemo, useEffect, useCallback } from 'react';
import RetroButton from './RetroButton.tsx';
import ExcelJS from 'exceljs';
import { GAME_DEV_DISCIPLINES } from '../disciplines.ts';
import { RATIOS } from '../conversions.ts';

/**
 * Types & Interfaces
 */
interface Milestone {
  id: string;
  name: string;
  duration: number; // in months
  color: string;
}

interface BacklogItem {
  milestoneId: string;
  section: string;
  task: string;
  discipline: string;
  effort: number;
}

interface Resource {
  id: string;
  name: string;
  monthlyCost: number;
  allocations: Record<string, number>; // key: YYYY-MM, value: 0.0 to 1.0
}

/**
 * Constants
 */
const MILESTONE_COLORS = ['FFC6E0B4', 'FFFFCCFF', 'FFBDD7EE', 'FFF8CBAD', 'FFA9D08E', 'FFD9D9D9'];

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

const CURRENCIES = [
  { symbol: '€', label: 'EUR' },
  { symbol: '$', label: 'USD' },
  { symbol: '£', label: 'GBP' },
  { symbol: '¥', label: 'JPY' },
  { symbol: '¥', label: 'CNY' },
  { symbol: 'Fr', label: 'CHF' },
];

const ToolProjectArchitect: React.FC = () => {
  // --- State ---
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // --- Settings ---
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [effortUnit, setEffortUnit] = useState('MONTHS');
  const [currency, setCurrency] = useState('€');
  const [customCurrency, setCustomCurrency] = useState('');
  const [inefficiency, setInefficiency] = useState(0); // 0% to 200%
  const [marginStr, setMarginStr] = useState("0");
  const [contingencyStr, setContingencyStr] = useState("0");
  const [selfCostStr, setSelfCostStr] = useState("1000");
  const [isAutoSync, setIsAutoSync] = useState(true);
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);

  // --- Derived Values ---
  const margin = parseFloat(marginStr) || 0;
  const contingency = parseFloat(contingencyStr) || 0;
  const selfCost = parseFloat(selfCostStr) || 0;
  const displayCurrency = useMemo(() => customCurrency || currency, [currency, customCurrency]);
  const currentUnit = useMemo(() => EFFORT_UNITS.find(u => u.id === effortUnit) || EFFORT_UNITS[0], [effortUnit]);

  const totalMilestoneDuration = useMemo(() => milestones.reduce((sum, ms) => sum + ms.duration, 0), [milestones]);
  
  const projectMonthsList = useMemo(() => {
    const start = new Date(startDate);
    const list = [];
    for (let i = 0; i < totalMilestoneDuration; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      list.push(d);
    }
    return list;
  }, [startDate, totalMilestoneDuration]);

  // --- Logic: Calculations ---
  const getCanonicalDisciplineName = useCallback((name: string) => {
    const discInfo = GAME_DEV_DISCIPLINES.find(d => 
      d.name.toLowerCase() === name.toLowerCase() || 
      name.toLowerCase() === d.id.toLowerCase() ||
      name.toLowerCase().includes(d.name.toLowerCase()) ||
      name.toLowerCase().includes(d.id.toLowerCase())
    );
    return discInfo ? discInfo.name : name;
  }, []);

  const getWorkloadStatus = useCallback((milestoneId: string, disciplineName: string) => {
    const canonicalName = getCanonicalDisciplineName(disciplineName);
    
    const discTasks = backlog.filter(item => 
      item.milestoneId === milestoneId &&
      getCanonicalDisciplineName(item.discipline || '') === canonicalName
    );
    
    const totalEffortInUnit = discTasks.reduce((sum, item) => sum + item.effort, 0);
    const requiredMM = totalEffortInUnit * currentUnit.ratioToMonth * (1 + inefficiency / 100);
    
    const matchingResources = resources.filter(r => {
      const resCanonical = getCanonicalDisciplineName(r.name);
      return resCanonical === canonicalName || r.name.toLowerCase().includes(canonicalName.toLowerCase());
    });
    
    const ms = milestones.find(m => m.id === milestoneId);
    if (!ms) return { requiredMM: 0, allocatedMM: 0, isOverloaded: false };

    let allocatedMM = 0;
    let monthOffset = 0;
    for (const m of milestones) {
      if (m.id === milestoneId) {
        const msMonths = projectMonthsList.slice(monthOffset, monthOffset + m.duration);
        for (const d of msMonths) {
          const key = d.toISOString().slice(0, 7);
          allocatedMM += matchingResources.reduce((sum, r) => sum + (r.allocations[key] || 0), 0);
        }
        break;
      }
      monthOffset += m.duration;
    }

    return {
      requiredMM,
      allocatedMM,
      isOverloaded: requiredMM > allocatedMM + 0.05 // Small buffer
    };
  }, [backlog, resources, milestones, currentUnit, inefficiency, projectMonthsList, getCanonicalDisciplineName]);

  const workloadAlerts = useMemo(() => {
    if (backlog.length === 0 || milestones.length === 0) return [];
    const alerts: { milestoneId: string, milestoneName: string, discipline: string, required: number, allocated: number }[] = [];
    const uniqueDisciplines = Array.from(new Set(backlog.map(i => i.discipline?.trim() || '').filter(d => d !== '')));
    
    uniqueDisciplines.forEach(disc => {
      milestones.forEach(ms => {
        const status = getWorkloadStatus(ms.id, disc);
        if (status.isOverloaded) {
          alerts.push({
            milestoneId: ms.id,
            milestoneName: ms.name,
            discipline: disc,
            required: status.requiredMM,
            allocated: status.allocatedMM
          });
        }
      });
    });
    return alerts;
  }, [backlog, milestones, getWorkloadStatus]);

  const spreadWorkload = (disciplineName: string, milestoneId: string) => {
    const canonicalName = getCanonicalDisciplineName(disciplineName);
    const baseResourceIndex = resources.findIndex(r => {
      const resCanonical = getCanonicalDisciplineName(r.name);
      return resCanonical === canonicalName || r.name.toLowerCase().includes(canonicalName.toLowerCase());
    });
    const baseResource = baseResourceIndex !== -1 ? resources[baseResourceIndex] : null;
    
    const targetMilestone = milestones.find(m => m.id === milestoneId);
    if (!targetMilestone) return;

    const newId = `res-spread-${Date.now()}`;
    const allocations: Record<string, number> = {};
    
    // Initialize all months to 0
    projectMonthsList.forEach(m => {
      allocations[m.toISOString().slice(0, 7)] = 0;
    });

    // Find the months belonging to the target milestone and set to 1.0 (100%)
    let monthOffset = 0;
    for (const m of milestones) {
      if (m.id === milestoneId) {
        const msMonths = projectMonthsList.slice(monthOffset, monthOffset + m.duration);
        msMonths.forEach(d => {
          allocations[d.toISOString().slice(0, 7)] = 1.0;
        });
        break;
      }
      monthOffset += m.duration;
    }

    const newName = baseResource ? `${baseResource.name} (Spread)` : `${disciplineName} (Spread)`;
    const newCost = baseResource ? baseResource.monthlyCost : (selfCost || 1000);

    const newResource: Resource = {
      id: newId,
      name: newName,
      monthlyCost: newCost,
      allocations
    };

    setResources(prev => {
      const newList = [...prev];
      if (baseResourceIndex !== -1) {
        newList.splice(baseResourceIndex + 1, 0, newResource);
      } else {
        newList.push(newResource);
      }
      return newList;
    });
  };

  // --- Logic: Backlog Parsing ---
  const getCellValue = (cell: ExcelJS.Cell): string => {
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

  const handleBacklogUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      
      if (file.name.endsWith('.csv')) {
        const text = new TextDecoder().decode(arrayBuffer);
        const lines = text.split(/\r?\n/).filter(l => l.trim()).map(line => {
          return line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        });
        const ws = workbook.addWorksheet('Backlog');
        lines.forEach((line, i) => ws.getRow(i + 1).values = line);
      } else {
        await workbook.xlsx.load(arrayBuffer);
      }

      const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
      if (!worksheet) throw new Error("Empty file or worksheet not found.");

      // 1. Find Header Row
      let headerRowIdx = 1;
      let colMap = { section: -1, task: -1, discipline: -1, effort: -1, duration: -1 };
      
      for (let i = 1; i <= 20; i++) {
        const row = worksheet.getRow(i);
        let foundTask = false;
        let foundEffort = false;
        
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          const val = getCellValue(cell).toLowerCase();
          if (!val) return;
          
          if (val === 'section' || val === 'phase' || val === 'milestone' || val === 'category' || val === 'stage') {
            colMap.section = col;
          }
          if (val.includes('task') || val.includes('package') || val.includes('work') || val === 'item' || val === 'wp' || val.includes('name')) {
            colMap.task = col;
            foundTask = true;
          }
          const isDisc = val === 'discipline' || val === 'role' || val.includes('discipline') || val.includes('role') || val.includes('staff') || val.includes('resource') || val === 'disc' || val === 'who';
          if (isDisc) {
            colMap.discipline = col;
          }
          if (val.includes('effort') || val.includes('estimate') || val.includes('value') || val === 'days' || val === 'hours' || val === 'months' || val === 'mm' || val === 'est') {
            colMap.effort = col;
            foundEffort = true;
          }
          if (val.includes('duration')) {
            colMap.duration = col;
          }
        });

        if (foundTask && foundEffort) {
          headerRowIdx = i;
          break;
        }
      }

      // Fallback guessing
      if (colMap.section === -1) colMap.section = 1;
      if (colMap.task === -1) colMap.task = 2;
      if (colMap.discipline === -1) colMap.discipline = 3;
      if (colMap.effort === -1) colMap.effort = 4;
      if (colMap.duration === -1) colMap.duration = 5;

      // 2. Parse Rows
      const newBacklog: BacklogItem[] = [];
      const extractedPhases: { id: string, name: string, duration: number }[] = [];
      let currentMilestoneId = "ms-0"; // Default to first milestone
      let lastSection = "";

      worksheet.eachRow((row, rowNum) => {
        if (rowNum <= headerRowIdx) return;

        const section = getCellValue(row.getCell(colMap.section));
        const task = getCellValue(row.getCell(colMap.task));
        const discipline = getCellValue(row.getCell(colMap.discipline));
        
        let effort = 0;
        const effortCell = row.getCell(colMap.effort);
        if (typeof effortCell.value === 'number') {
          effort = effortCell.value;
        } else {
          effort = parseFloat(getCellValue(effortCell).replace(/[^\d.]/g, '')) || 0;
        }

        let duration = 0;
        const durationCell = row.getCell(colMap.duration);
        if (durationCell) {
          if (typeof durationCell.value === 'number') {
            duration = Math.ceil(durationCell.value);
          } else {
            duration = Math.ceil(parseFloat(getCellValue(durationCell).replace(/[^\d.]/g, ''))) || 0;
          }
        }

        const isMilestoneHeader = (duration > 0) || (section && !task && !discipline && effort === 0);

        if (isMilestoneHeader && section && section !== lastSection) {
          lastSection = section;
          let finalDuration = duration;
          if (finalDuration === 0) {
            const match = section.match(/(\d+)\s*(month|week)s?/i);
            finalDuration = match ? parseInt(match[1]) : 1;
          }
          
          const msName = section.replace(/[- ]?\d+\s*(month|week)s?/i, '').trim();
          currentMilestoneId = `ms-${extractedPhases.length}`;
          
          extractedPhases.push({
            id: currentMilestoneId,
            name: msName,
            duration: finalDuration
          });
          return;
        }

        const taskName = task || (effort > 0 ? section : "");
        if (taskName && effort > 0 && !taskName.toLowerCase().includes('total')) {
          newBacklog.push({ 
            milestoneId: currentMilestoneId,
            section: section || lastSection, 
            task: taskName, 
            discipline, 
            effort 
          });
        }
      });

      // 3. Update State
      setBacklog(newBacklog);
      
      const finalPhases = extractedPhases.length > 0 
        ? extractedPhases 
        : [{ id: "ms-0", name: "Production", duration: 6 }];

      setMilestones(finalPhases.map((p, i) => ({
        id: p.id,
        name: p.name,
        duration: p.duration,
        color: MILESTONE_COLORS[i % MILESTONE_COLORS.length]
      })));

      if (newBacklog.length === 0) {
        alert("No items found. Check headers: Section, Task, Discipline, Effort.");
      }

    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error parsing file.");
    } finally {
      setIsImporting(false);
    }
  };

  // --- Logic: Resource Suggestion ---
  const applyAISuggestion = useCallback(() => {
    if (backlog.length === 0 || milestones.length === 0) {
      console.log("Auto-suggestion skipped: backlog or milestones empty", { backlogLen: backlog.length, msLen: milestones.length });
      return;
    }

    const newResources: Resource[] = [];
    
    // Identify unique disciplines in the backlog, filtering out empty ones
    const uniqueDisciplines = Array.from(new Set(
      backlog
        .map(item => (item.discipline?.trim() || ''))
        .filter(d => d !== '')
    ));

    if (uniqueDisciplines.length === 0) {
      uniqueDisciplines.push('General');
    }

    uniqueDisciplines.forEach((discName, idx) => {
      const canonicalName = getCanonicalDisciplineName(discName);
      const discInfo = GAME_DEV_DISCIPLINES.find(d => d.name === canonicalName) || { name: canonicalName, defaultCost: selfCost || 1000 };

      const allocations: Record<string, number> = {};
      let monthOffset = 0;

      milestones.forEach(ms => {
        const discTasks = backlog.filter(item => 
          item.milestoneId === ms.id &&
          getCanonicalDisciplineName(item.discipline || '') === canonicalName
        );

        const totalEffortInUnit = discTasks.reduce((sum, item) => sum + item.effort, 0);
        const requiredMM = totalEffortInUnit * currentUnit.ratioToMonth * (1 + inefficiency / 100);
        
        // Ensure we don't divide by zero
        const msDuration = Math.max(1, ms.duration);
        const requiredHeadcount = requiredMM / msDuration;

        // Round up to nearest 0.25, but cap at 1.0 for the initial suggestion
        const val = Math.min(1.0, Math.ceil(requiredHeadcount * 4) / 4);

        const msMonths = projectMonthsList.slice(monthOffset, monthOffset + msDuration);
        msMonths.forEach(d => {
          const key = d.toISOString().slice(0, 7);
          allocations[key] = val;
        });
        monthOffset += msDuration;
      });

      newResources.push({
        id: `res-${canonicalName.replace(/[^a-zA-Z0-9]/g, '_')}-${idx}`,
        name: `${discInfo.name}`,
        monthlyCost: discInfo.defaultCost,
        allocations
      });
    });

    setResources(newResources);
  }, [backlog, milestones, selfCost, currentUnit, inefficiency, projectMonthsList, getCanonicalDisciplineName]);

  useEffect(() => {
    if (isAutoSync && backlog.length > 0) {
      applyAISuggestion();
    }
  }, [backlog, milestones, effortUnit, inefficiency, isAutoSync, applyAISuggestion]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openColorPickerId && !(e.target as HTMLElement).closest('.color-picker-container')) {
        setOpenColorPickerId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openColorPickerId]);

  // --- Logic: Manual Edits ---
  const updateAllocation = (resId: string, monthKey: string, val: number) => {
    setResources(prev => prev.map(r => 
      r.id === resId ? { ...r, allocations: { ...r.allocations, [monthKey]: val } } : r
    ));
  };

  const addManualResource = () => {
    const newId = `res-manual-${Date.now()}`;
    const allocations: Record<string, number> = {};
    projectMonthsList.forEach(m => {
      allocations[m.toISOString().slice(0, 7)] = 0;
    });
    
    setResources(prev => [...prev, {
      id: newId,
      name: "New Role",
      monthlyCost: selfCost || 1000,
      allocations
    }]);
  };

  const deleteResource = (id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));
  };

  const duplicateResource = (id: string) => {
    const source = resources.find(r => r.id === id);
    if (!source) return;

    const sourceIndex = resources.findIndex(r => r.id === id);
    const newId = `res-dup-${Date.now()}`;
    
    // Check if it's already a duplicate to increment number
    let newName = source.name;
    const match = newName.match(/(.*)\s(\d+)$/);
    if (match) {
      newName = `${match[1]} ${parseInt(match[2]) + 1}`;
    } else {
      newName = `${newName} 2`;
    }

    const duplicate: Resource = {
      ...source,
      id: newId,
      name: newName,
      allocations: { ...source.allocations }
    };

    const newResources = [...resources];
    newResources.splice(sourceIndex + 1, 0, duplicate);
    setResources(newResources);
  };

  const moveResource = (id: string, direction: 'up' | 'down') => {
    const index = resources.findIndex(r => r.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === resources.length - 1) return;

    const newResources = [...resources];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newResources[index], newResources[targetIndex]] = [newResources[targetIndex], newResources[index]];
    setResources(newResources);
  };

  const updateResourceName = (id: string, name: string) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, name } : r));
  };

  const updateResourceCost = (id: string, monthlyCost: number) => {
    setResources(prev => prev.map(r => r.id === id ? { ...r, monthlyCost } : r));
  };

  const addMilestone = () => {
    const newId = `ms-${Date.now()}`;
    setMilestones(prev => [...prev, {
      id: newId,
      name: "New Phase",
      duration: 1,
      color: MILESTONE_COLORS[prev.length % MILESTONE_COLORS.length]
    }]);
  };

  const deleteMilestone = (id: string) => {
    if (milestones.length <= 1) return;
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  const moveMilestone = (id: string, direction: 'up' | 'down') => {
    const index = milestones.findIndex(m => m.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === milestones.length - 1) return;

    const newMilestones = [...milestones];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newMilestones[index], newMilestones[targetIndex]] = [newMilestones[targetIndex], newMilestones[index]];
    setMilestones(newMilestones);
  };

  const updateMilestone = (id: string, updates: Partial<Milestone>) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  // --- Logic: Sample Download ---
  const downloadSampleBacklog = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Backlog');

    // Define columns
    worksheet.columns = [
      { header: 'Milestone', key: 'milestone', width: 25 },
      { header: 'Work Package', key: 'task', width: 40 },
      { header: 'Discipline', key: 'discipline', width: 25 },
      { header: 'Estimate', key: 'estimate', width: 15 },
      { header: 'Milestone duration (months)', key: 'duration', width: 25 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };

    // Sample Data
    const data = [
      { milestone: 'prepropd', duration: 2 },
      { milestone: 'prepropd', task: 'Project Setup', discipline: 'Engine Programmer', estimate: 3 },
      { milestone: 'prepropd', task: 'Build pipelines', discipline: 'Engine Programmer', estimate: 2 },
      { milestone: 'prepropd', task: 'Hardware Setup', discipline: 'Engine Programmer', estimate: 2 },
      { milestone: 'prepropd', task: 'Access to developer portals', discipline: 'Producer', estimate: 1 },
      { milestone: '', task: '', discipline: '', estimate: '' }, // Empty row
      { milestone: 'main prod', duration: 6 },
      { milestone: 'main prod', task: 'Save files', discipline: 'Engine Programmer', estimate: 5 },
      { milestone: 'main prod', task: 'Mod support', discipline: 'Engine Programmer', estimate: 5 },
      { milestone: 'main prod', task: 'NVN Renderer implementation', discipline: 'Rendering Programmer', estimate: 55 },
      { milestone: 'main prod', task: 'Shader changes / optimizations', discipline: 'Rendering Programmer', estimate: 13 },
      { milestone: '', task: '', discipline: '', estimate: '' },
      { milestone: 'polish', duration: 3 },
      { milestone: 'polish', task: 'Bug fixing', discipline: 'Engine Programmer', estimate: 55 },
      { milestone: 'polish', task: 'Localization', discipline: 'QA Tester', estimate: 5 },
      { milestone: '', task: '', discipline: '', estimate: '' },
      { milestone: 'cert', duration: 3 },
      { milestone: 'cert', task: 'Bug fixing', discipline: 'Engine Programmer', estimate: 55 },
      { milestone: '', task: '', discipline: '', estimate: '' },
      { milestone: 'post', duration: 1 },
      { milestone: 'post', task: 'Bug fixing', discipline: 'Engine Programmer', estimate: 21 },
      { milestone: 'post', task: 'Documentation', discipline: 'Engine Programmer', estimate: 5 },
    ];

    data.forEach(item => {
      const row = worksheet.addRow(item);
      if (item.duration) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        row.font = { bold: true };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sample_Backlog_Template.xlsx`;
    a.click();
  };

  // --- Logic: Export ---
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Project Projection');

    // 1. Headers
    const phaseRow = worksheet.getRow(1);
    const monthRow = worksheet.getRow(2);
    phaseRow.getCell(1).value = "Phase";
    monthRow.getCell(1).value = "Resource / Month";
    monthRow.getCell(2).value = "Rate/Mo";

    let colCursor = 3;
    milestones.forEach(ms => {
      const startCol = colCursor;
      const endCol = colCursor + ms.duration - 1;
      const cell = phaseRow.getCell(startCol);
      cell.value = ms.name;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ms.color } };
      cell.alignment = { horizontal: 'center' };
      if (startCol !== endCol) worksheet.mergeCells(1, startCol, 1, endCol);
      
      for (let i = 0; i < ms.duration; i++) {
        const date = projectMonthsList[colCursor - 3 + i];
        monthRow.getCell(colCursor + i).value = `M${colCursor - 2} (${date.toLocaleString('default', { month: 'short' })})`;
      }
      colCursor += ms.duration;
    });
    monthRow.getCell(colCursor).value = "TOTAL MM";

    // 2. Data Rows
    let rowIdx = 3;
    resources.forEach(res => {
      const row = worksheet.getRow(rowIdx++);
      row.getCell(1).value = res.name;
      const rate = res.monthlyCost;
      row.getCell(2).value = rate;
      row.getCell(2).numFmt = `"${displayCurrency}"#,##0`;
      
      let totalMM = 0;
      projectMonthsList.forEach((m, i) => {
        const key = m.toISOString().slice(0, 7);
        const val = res.allocations[key] || 0;
        totalMM += val;
        row.getCell(i + 3).value = val;
      });
      row.getCell(colCursor).value = totalMM;
    });

    // 3. Financials
    const totalMMRow = worksheet.getRow(rowIdx++);
    totalMMRow.getCell(1).value = "TOTAL MM";
    totalMMRow.font = { bold: true };
    projectMonthsList.forEach((m, i) => {
      const key = m.toISOString().slice(0, 7);
      const sum = resources.reduce((s, r) => s + (r.allocations[key] || 0), 0);
      totalMMRow.getCell(i + 3).value = sum;
    });

    const costRow = worksheet.getRow(rowIdx++);
    costRow.getCell(1).value = "COSTS";
    projectMonthsList.forEach((m, i) => {
      const key = m.toISOString().slice(0, 7);
      const cost = resources.reduce((s, r) => s + (r.allocations[key] || 0) * r.monthlyCost, 0);
      costRow.getCell(i + 3).value = cost;
      costRow.getCell(i + 3).numFmt = `"${displayCurrency}"#,##0`;
    });

    // Styling
    worksheet.columns.forEach(col => col.width = 15);
    worksheet.getColumn(1).width = 30;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Project_Architect_Export_${Date.now()}.xlsx`;
    a.click();
  };

  // --- Calculations for UI ---
  const totalMM = useMemo(() => {
    return resources.reduce((sum, res) => {
      return sum + Object.values(res.allocations).reduce((s, v) => s + v, 0);
    }, 0);
  }, [resources]);

  const totalCost = useMemo(() => {
    return resources.reduce((sum, res) => {
      const rate = res.monthlyCost;
      return sum + Object.values(res.allocations).reduce((s, v) => s + v * rate, 0);
    }, 0);
  }, [resources]);

  return (
    <div className="p-6 space-y-8 text-black font-serif bg-[#C0C0C0] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center border-b-4 border-black pb-4">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter flex items-center gap-3">
          📅 Project Architect <span className="text-sm not-italic font-normal opacity-50">v5.0</span>
        </h1>
        <div className="flex gap-4">
          <RetroButton 
            onClick={() => {
              setBacklog([]);
              setMilestones([]);
              setResources([]);
            }}
            className="text-[10px] py-1 px-4 border border-black bg-red-100 hover:bg-red-200 flex items-center gap-1"
          >
            🗑️ Clear Data
          </RetroButton>
          <div className="win95-bg p-2 retro-inset border border-black shadow-sm text-[10px] font-mono">
            <span className="block opacity-50 uppercase font-sans font-bold">Total MM</span>
            {totalMM.toFixed(1)}
          </div>
          <div className="win95-bg p-2 retro-inset border border-black shadow-sm text-[10px] font-mono">
            <span className="block opacity-50 uppercase font-sans font-bold">Total Cost</span>
            {displayCurrency}{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Step 1: Import */}
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1">1. Import Backlog</h3>
            <div className="space-y-2">
              <input type="file" accept=".xlsx,.csv" className="hidden" id="backlog-upload" onChange={handleBacklogUpload} />
              <label htmlFor="backlog-upload" className="block w-full text-center py-4 win95-bg retro-beveled cursor-pointer text-sm font-black border-2 border-gray-500 hover:bg-gray-100 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2">
                {isImporting ? '⌛ PARSING...' : '📂 UPLOAD BACKLOG'}
              </label>
              <button 
                onClick={downloadSampleBacklog}
                className="w-full text-center py-2 win95-bg retro-beveled cursor-pointer text-[10px] font-bold border-2 border-gray-500 hover:bg-gray-100 shadow-[1px_1px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 uppercase flex items-center justify-center gap-1"
              >
                ⬇️ Download Sample Template
              </button>
            </div>
            {backlog.length > 0 && (
              <div className="mt-2 text-[10px] font-bold text-green-700 uppercase">✓ {backlog.length} Items Loaded</div>
            )}
          </div>

          {/* Step 2: Settings */}
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400 space-y-4">
            <h3 className="font-black text-xs uppercase border-b border-gray-400 pb-1">2. Project Settings</h3>
            
            <div>
              <label className="block text-[10px] font-bold uppercase mb-1">Start Date</label>
              <input type="date" className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase mb-1">Effort Unit</label>
              <select className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" value={effortUnit} onChange={e => setEffortUnit(e.target.value)}>
                {EFFORT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase mb-1">Currency</label>
              <div className="flex flex-wrap gap-1 mb-1">
                {CURRENCIES.map(c => (
                  <button
                    key={c.label}
                    onClick={() => { setCurrency(c.symbol); setCustomCurrency(''); }}
                    className={`px-2 py-1 text-[9px] font-bold border ${currency === c.symbol && !customCurrency ? 'bg-blue-600 text-white border-blue-700' : 'win95-bg border-gray-600 hover:bg-gray-100'}`}
                  >
                    {c.label} ({c.symbol})
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Custom (e.g. kr, R$)" 
                className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" 
                value={customCurrency} 
                onChange={e => setCustomCurrency(e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1">Margin %</label>
                <input type="text" className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" value={marginStr} onChange={e => setMarginStr(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1">Buffer %</label>
                <input type="text" className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" value={contingencyStr} onChange={e => setContingencyStr(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase mb-1">Inefficiency %</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  className="flex-grow" 
                  value={inefficiency} 
                  onChange={e => setInefficiency(parseInt(e.target.value))} 
                />
                <span className="text-xs font-mono w-8">{inefficiency}%</span>
              </div>
              <p className="text-[8px] opacity-50 mt-1 italic">Adds overhead to all backlog estimates.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold uppercase mb-1">Self Cost (per MM)</label>
                <div className="flex gap-1">
                  <input type="text" className="flex-grow p-1 retro-inset bg-white text-xs border border-gray-400" value={selfCostStr} onChange={e => setSelfCostStr(e.target.value)} />
                  <button 
                    onClick={() => setResources(prev => prev.map(r => ({ ...r, monthlyCost: selfCost })))}
                    className="px-2 py-1 win95-bg border border-gray-600 text-[8px] font-bold uppercase hover:bg-gray-100 active:bg-gray-200"
                    title="Apply to all roles"
                  >
                    Apply All
                  </button>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAutoSync} onChange={e => setIsAutoSync(e.target.checked)} className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">Auto-Sync Resources</span>
            </label>
          </div>

          {/* Step 3: Parsed Backlog Preview */}
          {backlog.length > 0 && (
            <div className="win95-bg p-4 retro-beveled border-2 border-gray-400 space-y-2 max-h-[400px] flex flex-col">
              <h3 className="font-black text-xs uppercase border-b border-gray-400 pb-1">3. Parsed Backlog</h3>
              <div className="overflow-auto retro-inset bg-white flex-grow">
                <table className="w-full text-[8px] font-mono border-collapse">
                  <thead className="sticky top-0 bg-gray-200">
                    <tr>
                      <th className="border-b border-r border-gray-300 p-1 text-left">Section</th>
                      <th className="border-b border-r border-gray-300 p-1 text-left">Task</th>
                      <th className="border-b border-r border-gray-300 p-1 text-left">Disc</th>
                      <th className="border-b border-gray-300 p-1 text-right">Eff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backlog.map((item, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-1 border-r border-gray-100 truncate max-w-[60px]">{item.section}</td>
                        <td className="p-1 border-r border-gray-100 truncate max-w-[80px]">{item.task}</td>
                        <td className="p-1 border-r border-gray-100 truncate max-w-[60px] font-bold">{item.discipline}</td>
                        <td className="p-1 text-right">{item.effort}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Main Content: Matrix */}
        <div className="lg:col-span-3 space-y-6">
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400 min-h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <h3 className="font-black text-xs uppercase italic underline decoration-blue-500">Allocation Matrix</h3>
                {workloadAlerts.length > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-2 py-1 rounded animate-pulse">
                    <span className="text-[10px] font-black text-red-600">
                      ⚠️ {workloadAlerts.length} OVERLOADS DETECTED
                    </span>
                  </div>
                )}
              </div>
              <RetroButton onClick={applyAISuggestion} className="text-[10px] py-1 px-4 border border-black bg-white hover:bg-gray-100">
                🔄 Re-calculate Headcount
              </RetroButton>
            </div>

            {workloadAlerts.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-400 retro-beveled space-y-2">
                <h4 className="text-[10px] font-black uppercase text-red-700">Workload Alerts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {workloadAlerts.map((alert, i) => (
                    <div key={i} className="bg-white p-2 border border-red-200 flex justify-between items-center gap-2">
                      <div className="text-[9px]">
                        <span className="font-black text-red-600">[{alert.milestoneName}]</span> {alert.discipline}: 
                        <span className="ml-1 font-mono">{alert.allocated.toFixed(1)}/{alert.required.toFixed(1)} MM</span>
                      </div>
                      <button 
                        onClick={() => spreadWorkload(alert.discipline, alert.milestoneId)}
                        className="text-[8px] px-2 py-1 bg-red-600 text-white font-black uppercase hover:bg-red-700 rounded shadow-sm"
                      >
                        Spread Workload
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-grow retro-inset bg-white overflow-auto border border-gray-400 relative">
              <table className="w-full text-[10px] font-mono border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-20 bg-gray-200 shadow-sm">
                  <tr>
                    <th className="sticky left-0 bg-gray-200 z-30 border-r border-black w-48 p-2">
                      <button 
                        onClick={addMilestone}
                        className="w-full text-[9px] py-1 bg-blue-50 border border-blue-600 text-blue-700 hover:bg-blue-100 rounded uppercase font-black shadow-sm active:shadow-none active:translate-y-0.5 flex items-center justify-center gap-1"
                      >
                        ➕ Add Phase
                      </button>
                    </th>
                    {milestones.map((ms, idx) => (
                      <th 
                        key={ms.id} 
                        colSpan={ms.duration} 
                        className="border-r border-black text-center text-[9px] font-black uppercase px-2 group relative"
                        style={{ backgroundColor: `#${ms.color.slice(2)}` }}
                      >
                        <div className="flex flex-col items-center gap-1 py-1">
                          <div className="flex items-center gap-1 w-full justify-center">
                            <button 
                              onClick={() => moveMilestone(ms.id, 'up')} 
                              disabled={idx === 0}
                              className="hover:scale-125 disabled:opacity-20 transition-transform"
                              title="Move Left"
                            >
                              ◀
                            </button>
                            <input 
                              className="bg-white/40 border-none text-center w-full focus:bg-white outline-none rounded px-1 py-0.5 text-[10px] placeholder-black/30" 
                              value={ms.name} 
                              placeholder="Phase Name"
                              onChange={e => updateMilestone(ms.id, { name: e.target.value })}
                            />
                            <button 
                              onClick={() => moveMilestone(ms.id, 'down')} 
                              disabled={idx === milestones.length - 1}
                              className="hover:scale-125 disabled:opacity-20 transition-transform"
                              title="Move Right"
                            >
                              ▶
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-black/5 rounded px-1">
                              <button 
                                onClick={() => updateMilestone(ms.id, { duration: Math.max(1, ms.duration - 1) })} 
                                className="hover:bg-black/10 px-1.5 rounded transition-colors"
                              >
                                -
                              </button>
                              <span className="mx-1 min-w-[30px]">{ms.duration} MO</span>
                              <button 
                                onClick={() => updateMilestone(ms.id, { duration: ms.duration + 1 })} 
                                className="hover:bg-black/10 px-1.5 rounded transition-colors"
                              >
                                +
                              </button>
                            </div>
                            <div className="relative color-picker-container">
                              <button 
                                onClick={() => setOpenColorPickerId(openColorPickerId === ms.id ? null : ms.id)}
                                className="w-6 h-6 border-2 border-black/20 rounded shadow-sm hover:scale-110 transition-transform flex items-center justify-center bg-white/20"
                                title="Change Color"
                              >
                                🎨
                              </button>
                              
                              {openColorPickerId === ms.id && (
                                <div className="absolute top-full left-0 mt-2 z-50 win95-bg p-3 retro-beveled border-2 border-gray-400 shadow-xl min-w-[140px]">
                                  <div className="flex justify-between items-center mb-2 border-b border-gray-400 pb-1">
                                    <span className="text-[9px] font-black uppercase">Pick Color</span>
                                    <button onClick={() => setOpenColorPickerId(null)} className="text-xs hover:text-red-600">×</button>
                                  </div>
                                  
                                  <div className="grid grid-cols-3 gap-2 mb-3">
                                    {MILESTONE_COLORS.map(c => (
                                      <button
                                        key={c}
                                        onClick={() => {
                                          updateMilestone(ms.id, { color: c });
                                          setOpenColorPickerId(null);
                                        }}
                                        className={`w-7 h-7 border border-black/40 hover:scale-110 transition-transform ${ms.color === c ? 'ring-2 ring-blue-500' : ''}`}
                                        style={{ backgroundColor: `#${c.slice(2)}` }}
                                      />
                                    ))}
                                  </div>
                                  
                                  <div className="space-y-2 pt-2 border-t border-gray-400">
                                    <button 
                                      onClick={() => {
                                        const usedColors = milestones.map(m => m.color);
                                        const available = MILESTONE_COLORS.find(c => !usedColors.includes(c));
                                        const nextColor = available || MILESTONE_COLORS[Math.floor(Math.random() * MILESTONE_COLORS.length)];
                                        updateMilestone(ms.id, { color: nextColor });
                                      }}
                                      className="w-full text-[9px] py-1.5 win95-bg retro-beveled border border-gray-600 font-black uppercase hover:bg-gray-100 active:retro-inset flex items-center justify-center gap-1"
                                    >
                                      🎲 Suggest
                                    </button>
                                    
                                    <div className="flex items-center justify-between gap-2 px-1">
                                      <span className="text-[8px] font-bold uppercase">Custom:</span>
                                      <input 
                                        type="color" 
                                        className="w-5 h-5 p-0 border border-black/20 bg-transparent cursor-pointer"
                                        value={`#${ms.color.slice(2)}`}
                                        onChange={e => updateMilestone(ms.id, { color: `FF${e.target.value.slice(1).toUpperCase()}` })}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <button 
                              onClick={() => deleteMilestone(ms.id)} 
                              className="text-red-600 hover:scale-125 transition-transform opacity-0 group-hover:opacity-100"
                              title="Delete Phase"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr className="h-8 border-t border-black">
                    <th className="sticky left-0 bg-gray-200 z-30 border-r border-black p-2 text-left uppercase">Resource</th>
                    {projectMonthsList.map((m, i) => (
                      <th key={i} className="border-r border-black p-1 text-[8px] text-center whitespace-nowrap min-w-[80px]">
                        M{i+1}<br/>{m.toLocaleString('default', { month: 'short' })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.length === 0 ? (
                    <tr>
                      <td colSpan={projectMonthsList.length + 1} className="p-32 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <span className="opacity-20 italic font-black uppercase text-xl">Upload backlog or add roles manually</span>
                          <button 
                            onClick={addManualResource}
                            className="text-sm px-6 py-3 bg-green-100 border-2 border-green-600 text-green-700 hover:bg-green-200 rounded font-black uppercase shadow-[4px_4px_0px_rgba(0,0,0,0.1)] active:shadow-none active:translate-x-1 active:translate-y-1 flex items-center gap-2"
                          >
                            ➕ Add First Role
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {resources.map((res, resIdx) => (
                        <tr key={res.id} className="border-b border-gray-100 hover:bg-blue-50 group">
                          <td className="sticky left-0 bg-white z-10 border-r border-black p-0 font-bold truncate">
                            <div className="flex items-center h-full">
                              {/* Reorder Handles */}
                              <div className="flex flex-col border-r border-gray-200 bg-gray-50">
                                <button 
                                  onClick={() => moveResource(res.id, 'up')}
                                  disabled={resIdx === 0}
                                  className="p-1 hover:bg-gray-200 disabled:opacity-10 text-[8px] flex items-center justify-center"
                                >
                                  ▲
                                </button>
                                <button 
                                  onClick={() => moveResource(res.id, 'down')}
                                  disabled={resIdx === resources.length - 1}
                                  className="p-1 hover:bg-gray-200 disabled:opacity-10 text-[8px] flex items-center justify-center"
                                >
                                  ▼
                                </button>
                              </div>

                              {/* Role Name & Actions */}
                              <div className="flex-grow flex items-center px-2 gap-2 overflow-hidden">
                                <div className="flex flex-col flex-grow min-w-0">
                                  <input 
                                    className="bg-transparent border-none outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 p-0.5 w-full text-xs font-bold"
                                    value={res.name}
                                    onChange={e => updateResourceName(res.id, e.target.value)}
                                  />
                                  <div className="flex items-center gap-1 opacity-60">
                                    <span className="text-[8px]">{displayCurrency}</span>
                                    <input 
                                      className="bg-transparent border-none outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 p-0 w-16 text-[9px] font-mono"
                                      value={res.monthlyCost}
                                      onChange={e => updateResourceCost(res.id, parseFloat(e.target.value) || 0)}
                                    />
                                    <span className="text-[7px] uppercase">/ MM</span>
                                  </div>
                                </div>
                                
                                <div className="hidden group-hover:flex items-center gap-1">
                                  <button 
                                    onClick={() => duplicateResource(res.id)}
                                    title="Duplicate"
                                    className="p-1 hover:bg-blue-100 text-blue-600 text-[10px] border border-blue-200 rounded"
                                  >
                                    📋
                                  </button>
                                  <button 
                                    onClick={() => deleteResource(res.id)}
                                    title="Delete"
                                    className="p-1 hover:bg-red-100 text-red-600 text-[10px] border border-red-200 rounded"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                          {projectMonthsList.map((m, i) => {
                            const key = m.toISOString().slice(0, 7);
                            const val = res.allocations[key] || 0;
                            return (
                              <td key={i} className="border-r border-gray-100 p-0">
                                <select 
                                  className={`w-full h-full p-1 text-center outline-none cursor-pointer font-bold ${val > 0 ? 'text-blue-800 bg-blue-50/30' : 'text-gray-300'}`}
                                  value={val}
                                  onChange={e => updateAllocation(res.id, key, parseFloat(e.target.value))}
                                >
                                  {ALLOCATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      
                      {/* Summary Rows */}
                      <tr className="bg-gray-100 font-black border-t-2 border-black">
                        <td className="sticky left-0 bg-gray-100 z-10 border-r border-black p-2 uppercase flex justify-between items-center">
                          <span>Total MM</span>
                          <button 
                            onClick={addManualResource}
                            className="text-[10px] px-2 py-1 bg-green-100 border border-green-600 text-green-700 hover:bg-green-200 rounded flex items-center gap-1"
                          >
                            ➕ Add Role
                          </button>
                        </td>
                        {projectMonthsList.map((m, i) => {
                          const key = m.toISOString().slice(0, 7);
                          const sum = resources.reduce((s, r) => s + (r.allocations[key] || 0), 0);
                          return <td key={i} className="border-r border-black text-center p-2">{sum.toFixed(1)}</td>;
                        })}
                      </tr>
                      <tr className="bg-gray-50 font-black border-t border-black">
                        <td className="sticky left-0 bg-gray-50 z-10 border-r border-black p-2 uppercase">Monthly Cost</td>
                        {projectMonthsList.map((m, i) => {
                          const key = m.toISOString().slice(0, 7);
                          const cost = resources.reduce((s, r) => s + (r.allocations[key] || 0) * r.monthlyCost, 0);
                          return <td key={i} className="border-r border-black text-center p-2">{displayCurrency}{cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>;
                        })}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Metrics & Export */}
            <div className="mt-6 p-6 border-4 border-black bg-[#ffffa0] shadow-[6px_6px_0px_rgba(0,0,0,1)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="border-r border-black/10 pr-4">
                  <div className="text-[9px] font-black uppercase opacity-50 mb-1">Total Effort</div>
                  <div className="text-2xl font-black">{totalMM.toFixed(1)} <span className="text-xs font-normal">MM</span></div>
                </div>
                <div className="border-r border-black/10 pr-4">
                  <div className="text-[9px] font-black uppercase opacity-50 mb-1">Total Cost</div>
                  <div className="text-2xl font-black">{displayCurrency}{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="border-r border-black/10 pr-4">
                  <div className="text-[9px] font-black uppercase opacity-50 mb-1">Total Profit</div>
                  <div className="text-2xl font-black">{displayCurrency}{(totalCost * (margin / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase opacity-50 mb-1">Total Budget</div>
                  <div className="text-2xl font-black text-blue-900">{displayCurrency}{(totalCost * (1 + margin / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
              <RetroButton onClick={handleExportExcel} className="w-full py-4 text-xl font-black uppercase shadow-[4px_4px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 flex items-center justify-center gap-3">
                💾 EXPORT PROJECTION (.XLSX)
              </RetroButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolProjectArchitect;
