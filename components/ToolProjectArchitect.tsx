import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import RetroButton from './RetroButton.tsx';
import ExcelJS from 'exceljs';
import { GAME_DEV_DISCIPLINES } from '../disciplines.ts';
import { RATIOS } from '../conversions.ts';
import { ICONS } from '../src/icons.ts';

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
  allocations: Record<string, number>; // key: YYYY-MM, value: Headcount (e.g. 1.0, 2.0)
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
  { label: '0', value: 0.0 },
  { label: '0.25', value: 0.25 },
  { label: '0.5', value: 0.5 },
  { label: '0.75', value: 0.75 },
  { label: '1', value: 1.0 },
  { label: '1.5', value: 1.5 },
  { label: '2', value: 2.0 },
  { label: '2.5', value: 2.5 },
  { label: '3', value: 3.0 },
  { label: '4', value: 4.0 },
  { label: '5', value: 5.0 },
  { label: '6', value: 6.0 },
  { label: '7', value: 7.0 },
  { label: '8', value: 8.0 },
  { label: '9', value: 9.0 },
  { label: '10', value: 10.0 },
];

const CURRENCIES = [
  { symbol: '€', label: 'EUR' },
  { symbol: '$', label: 'USD' },
  { symbol: '£', label: 'GBP' },
  { symbol: '¥', label: 'JPY' },
];

interface SortableResourceRowProps {
  res: Resource;
  resIdx: number;
  projectMonthsList: Date[];
  displayCurrency: string;
  updateResourceName: (id: string, name: string) => void;
  updateResourceCost: (id: string, cost: number) => void;
  duplicateResource: (id: string) => void;
  deleteResource: (id: string) => void;
  updateAllocation: (resId: string, monthKey: string, val: number) => void;
  onPasteAllocation: (startResId: string, startMonthKey: string, text: string) => void;
  fillSource: { resId: string, monthKey: string, value: number } | null;
  setFillSource: (source: { resId: string, monthKey: string, value: number } | null) => void;
  fillTargetKeys: string[];
  setFillTargetKeys: (keys: string[] | ((prev: string[]) => string[])) => void;
  isNewlyCreated: boolean;
  onFocusHandled: () => void;
  selectedRange: { resId: string, monthKeys: string[] } | null;
  onSelectionUpdate: (range: { resId: string, monthKeys: string[] } | null) => void;
  isSelecting: boolean;
  setIsSelecting: (v: boolean) => void;
}

const SortableResourceRow: React.FC<SortableResourceRowProps> = ({
  res,
  resIdx,
  projectMonthsList,
  displayCurrency,
  updateResourceName,
  updateResourceCost,
  duplicateResource,
  deleteResource,
  updateAllocation,
  onPasteAllocation,
  fillSource,
  setFillSource,
  fillTargetKeys,
  setFillTargetKeys,
  isNewlyCreated,
  onFocusHandled,
  selectedRange,
  onSelectionUpdate,
  isSelecting,
  setIsSelecting,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: res.id });

  const getAllocationColor = (val: number) => {
    if (val <= 0) return 'bg-white';
    if (val <= 1) return 'bg-blue-50';
    if (val <= 2) return 'bg-blue-100';
    if (val <= 3) return 'bg-blue-200';
    if (val <= 5) return 'bg-blue-300';
    if (val <= 8) return 'bg-blue-400';
    return 'bg-blue-500';
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  const handleCellMouseDown = (monthKey: string) => {
    setIsSelecting(true);
    onSelectionUpdate({ resId: res.id, monthKeys: [monthKey] });
  };

  const handleCellMouseEnter = (monthKey: string) => {
    if (!isSelecting || !selectedRange || selectedRange.resId !== res.id) return;
    
    // Create range between first selected and this one
    const startIdx = projectMonthsList.findIndex(m => m.toISOString().slice(0, 7) === selectedRange.monthKeys[0]);
    const currentIdx = projectMonthsList.findIndex(m => m.toISOString().slice(0, 7) === monthKey);
    
    if (startIdx === -1 || currentIdx === -1) return;
    
    const min = Math.min(startIdx, currentIdx);
    const max = Math.max(startIdx, currentIdx);
    const newKeys = projectMonthsList.slice(min, max + 1).map(m => m.toISOString().slice(0, 7));
    
    onSelectionUpdate({ resId: res.id, monthKeys: newKeys });
  };

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      className={`border-b border-gray-100 hover:bg-blue-50 group ${isDragging ? 'bg-blue-100 shadow-lg' : ''}`}
    >
      <td className="sticky left-0 bg-white z-10 border-r border-black p-0 font-bold w-80 min-w-[320px] transition-all duration-300">
        <div className="flex items-center h-full w-full overflow-hidden">
          {/* Windows 95 Style Drag Handle */}
          <div 
            {...attributes} 
            {...listeners}
            className="w-6 self-stretch bg-gray-200 border-r border-gray-400 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center gap-1 py-2"
            title="Drag to reorder"
          >
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-1 h-1 bg-gray-600 rounded-full shadow-[1px_1px_0px_white]" />
            ))}
          </div>

          {/* Role Name & Actions */}
          <div className="flex-grow flex items-center px-2 gap-2 min-w-0">
            <div className="flex flex-col flex-grow min-w-0">
              <input 
                ref={(el) => {
                  if (el && isNewlyCreated) {
                    el.focus();
                    el.select();
                    onFocusHandled();
                  }
                }}
                className={`outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 p-0.5 w-full text-lg font-bold transition-colors ${res.name === "New Role" ? 'bg-yellow-200 ring-2 ring-yellow-500 rounded animate-pulse' : 'bg-transparent border-none'}`}
                value={res.name}
                onChange={e => updateResourceName(res.id, e.target.value)}
              />
              <div className="flex items-center gap-1 opacity-60">
                <span className="text-xs">{displayCurrency}</span>
                <input 
                  className="bg-transparent border-none outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 p-0 w-20 text-sm font-mono"
                  value={res.monthlyCost}
                  onChange={e => updateResourceCost(res.id, parseFloat(e.target.value) || 0)}
                />
                <span className="text-[11px] uppercase">/ MM</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <button 
                onClick={() => duplicateResource(res.id)}
                title="Duplicate"
                className="p-1.5 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded shadow-sm"
              >
                <img src={ICONS.DUPLICATE} alt="dup" className="w-6 h-6" />
              </button>
              <button 
                onClick={() => deleteResource(res.id)}
                title="Delete"
                className="p-1.5 hover:bg-red-100 text-red-600 border border-red-200 rounded shadow-sm"
              >
                <img src={ICONS.TRASH} alt="del" className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </td>
      {projectMonthsList.map((m, i) => {
        const key = m.toISOString().slice(0, 7);
        const val = res.allocations[key] || 0;
        const isFilling = fillSource?.resId === res.id && fillTargetKeys.includes(key);
        const isSelected = selectedRange?.resId === res.id && selectedRange.monthKeys.includes(key);
        const bgColor = isFilling ? 'bg-blue-600/30' : isSelected ? 'bg-yellow-200' : getAllocationColor(val);
        
        return (
          <td 
            key={i} 
            className={`border-r border-gray-100 p-0 relative group/cell transition-colors duration-200 ${bgColor} ${isSelected ? 'ring-2 ring-yellow-500 z-10' : ''}`}
            onMouseDown={(e) => {
              // Only trigger if not clicking the fill handle or if right button?
              // Let's say if we click the cell itself but not input? 
              // Actually, better to catch on the td.
              if (e.button === 0) {
                handleCellMouseDown(key);
              }
            }}
            onMouseEnter={() => {
              handleCellMouseEnter(key);
              if (fillSource && fillSource.resId === res.id) {
                const sourceIdx = projectMonthsList.findIndex(pm => pm.toISOString().slice(0, 7) === fillSource.monthKey);
                const currentIdx = i;
                const start = Math.min(sourceIdx, currentIdx);
                const end = Math.max(sourceIdx, currentIdx);
                const newTargets = projectMonthsList.slice(start, end + 1).map(pm => pm.toISOString().slice(0, 7));
                setFillTargetKeys(newTargets);
              }
            }}
          >
            <input 
              type="text"
              className={`w-full h-full p-1 text-center outline-none font-bold bg-transparent ${val > 0 ? 'text-blue-900 drop-shadow-sm' : 'text-gray-300'}`}
              value={val === 0 ? '' : val}
              placeholder="0"
              onChange={e => {
                const newVal = parseFloat(e.target.value.replace(',', '.')) || 0;
                updateAllocation(res.id, key, newVal);
              }}
              onPaste={e => {
                const text = e.clipboardData.getData('text');
                if (text && (text.includes('\t') || text.includes('\n'))) {
                  e.preventDefault();
                  onPasteAllocation(res.id, key, text);
                }
              }}
            />
            {/* Excel Fill Handle */}
            <div 
              className="absolute bottom-0 right-0 w-2 h-2 bg-blue-600 cursor-crosshair z-20 opacity-0 group-hover/cell:opacity-100 shadow-[0_0_2px_white]"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent selection start
                setFillSource({ resId: res.id, monthKey: key, value: val });
                setFillTargetKeys([key]);
              }}
            />
          </td>
        );
      })}
    </tr>
  );
};

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [fillSource, setFillSource] = useState<{ resId: string, monthKey: string, value: number } | null>(null);
  const [fillTargetKeys, setFillTargetKeys] = useState<string[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [isRedistributeOpen, setIsRedistributeOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ resId: string, monthKeys: string[] } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (topScrollRef.current && topScrollRef.current !== e.target) {
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (scrollRef.current && scrollRef.current !== e.target) {
      scrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const pushToUndo = useCallback(() => {
    // We capture the state INSIDE setUndoStack to ensure we are using the stable values from the closure
    // but the comparison ensures we don't push the exact same state twice.
    const snapshot = {
      backlog,
      milestones,
      resources,
      startDate,
      effortUnit,
      currency,
      customCurrency,
      inefficiency,
      marginStr,
      contingencyStr,
      selfCostStr,
      isAutoSync,
      dismissedAlerts,
    };
    
    const snapshotStr = JSON.stringify(snapshot);

    setUndoStack(prev => {
      if (prev.length > 0) {
        const lastSnapshotStr = JSON.stringify(prev[0]);
        if (snapshotStr === lastSnapshotStr) return prev;
      }
      return [JSON.parse(snapshotStr), ...prev].slice(0, 50);
    });
  }, [backlog, milestones, resources, startDate, effortUnit, currency, customCurrency, inefficiency, marginStr, contingencyStr, selfCostStr, isAutoSync, dismissedAlerts]);

  const undo = () => {
    if (undoStack.length === 0) return;
    const [lastState, ...rest] = undoStack;
    
    setBacklog(lastState.backlog);
    setMilestones(lastState.milestones);
    setResources(lastState.resources);
    setStartDate(lastState.startDate);
    setEffortUnit(lastState.effortUnit);
    setCurrency(lastState.currency);
    setCustomCurrency(lastState.customCurrency);
    setInefficiency(lastState.inefficiency);
    setMarginStr(lastState.marginStr);
    setContingencyStr(lastState.contingencyStr);
    setSelfCostStr(lastState.selfCostStr);
    setIsAutoSync(lastState.isAutoSync);
    setDismissedAlerts(lastState.dismissedAlerts || {});
    
    setUndoStack(rest);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      pushToUndo();
      setResources((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMouseUp = useCallback(() => {
    if (fillSource && fillTargetKeys.length > 0) {
      pushToUndo();
      setResources(prev => prev.map(r => {
        if (r.id === fillSource.resId) {
          const newAllocations = { ...r.allocations };
          fillTargetKeys.forEach(key => {
            newAllocations[key] = fillSource.value;
          });
          return { ...r, allocations: newAllocations };
        }
        return r;
      }));
    }
    setFillSource(null);
    setFillTargetKeys([]);
    setIsSelecting(false);
  }, [fillSource, fillTargetKeys]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

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
    const alerts: { milestoneId: string, milestoneName: string, discipline: string, required: number, allocated: number, isCompensatable: boolean }[] = [];
    const uniqueDisciplines = Array.from(new Set(backlog.map(i => i.discipline?.trim() || '').filter(d => d !== '')));
    
    uniqueDisciplines.forEach(disc => {
      // 1. Project-wide stats for this discipline to check compensatability
      const canonicalName = getCanonicalDisciplineName(disc);
      const discTasks = backlog.filter(item => getCanonicalDisciplineName(item.discipline || '') === canonicalName);
      const projectRequiredMM = discTasks.reduce((sum, item) => sum + item.effort, 0) * currentUnit.ratioToMonth * (1 + inefficiency / 100);
      
      const matchingResources = resources.filter(r => {
        const resCanonical = getCanonicalDisciplineName(r.name);
        return resCanonical === canonicalName || r.name.toLowerCase().includes(canonicalName.toLowerCase());
      });
      
      const projectAllocatedMM = matchingResources.reduce((sum, r) => {
        return sum + Object.values(r.allocations).reduce((s, val) => s + val, 0);
      }, 0);

      const isCompensatable = projectAllocatedMM >= projectRequiredMM - 0.05;

      // 2. Milestone specific alerts
      milestones.forEach(ms => {
        const alertKey = `${ms.id}-${disc}`;
        if (dismissedAlerts[alertKey]) return;

        const status = getWorkloadStatus(ms.id, disc);
        if (status.isOverloaded) {
          alerts.push({
            milestoneId: ms.id,
            milestoneName: ms.name,
            discipline: disc,
            required: status.requiredMM,
            allocated: status.allocatedMM,
            isCompensatable
          });
        }
      });
    });
    return alerts;
  }, [backlog, milestones, resources, inefficiency, currentUnit, getWorkloadStatus, getCanonicalDisciplineName, dismissedAlerts]);

  const spreadWorkload = (disciplineName: string, milestoneId: string) => {
    pushToUndo();
    const canonicalName = getCanonicalDisciplineName(disciplineName);
    const status = getWorkloadStatus(milestoneId, disciplineName);
    const targetMilestone = milestones.find(m => m.id === milestoneId);
    
    if (!targetMilestone) return;

    const gap = Math.max(0, status.requiredMM - status.allocatedMM);
    // Calculated required headcount per month to cover the gap, rounded up to nearest integer
    const requiredHeadcount = Math.ceil(gap / targetMilestone.duration) || 1;

    // Try to find an existing resource that matches this discipline's canonical name
    const existingIndex = resources.findIndex(r => {
      const resCanonical = getCanonicalDisciplineName(r.name);
      return resCanonical === canonicalName;
    });

    if (existingIndex !== -1) {
      // Update existing row
      setResources(prev => {
        const next = [...prev];
        const res = { ...next[existingIndex] };
        // Change ID to prevent auto-sync from overwriting it later
        res.id = `res-spread-${canonicalName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}`;
        const newAllocations = { ...res.allocations };
        
        let monthOffset = 0;
        for (const m of milestones) {
          if (m.id === milestoneId) {
            const msMonths = projectMonthsList.slice(monthOffset, monthOffset + m.duration);
            msMonths.forEach(d => {
              const key = d.toISOString().slice(0, 7);
              // Add the required headcount to cover the current gap in this phase
              newAllocations[key] = (newAllocations[key] || 0) + requiredHeadcount;
            });
            break;
          }
          monthOffset += m.duration;
        }
        
        res.allocations = newAllocations;
        next[existingIndex] = res;
        return next;
      });
    } else {
      // Case where no discipline row exists - create a support row
      const newId = `res-spread-${Date.now()}`;
      const allocations: Record<string, number> = {};
      
      projectMonthsList.forEach(m => {
        allocations[m.toISOString().slice(0, 7)] = 0;
      });

      let monthOffset = 0;
      for (const m of milestones) {
        if (m.id === milestoneId) {
          const msMonths = projectMonthsList.slice(monthOffset, monthOffset + m.duration);
          msMonths.forEach(d => {
            allocations[d.toISOString().slice(0, 7)] = requiredHeadcount;
          });
          break;
        }
        monthOffset += m.duration;
      }

      const newResource: Resource = {
        id: newId,
        name: `${disciplineName} (Support)`,
        monthlyCost: selfCost || 1000,
        allocations
      };

      setResources(prev => [...prev, newResource]);
    }
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

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          const data = JSON.parse(re.target?.result as string);
          if (data.resources && data.milestones) {
            setBacklog(data.backlog || []);
            setMilestones(data.milestones || []);
            setResources(data.resources || []);
            setStartDate(data.startDate || new Date().toISOString().slice(0, 10));
            setEffortUnit(data.effortUnit || 'MONTHS');
            setCurrency(data.currency || '€');
            setCustomCurrency(data.customCurrency || '');
            setInefficiency(data.inefficiency || 0);
            setMarginStr(data.marginStr || "0");
            setContingencyStr(data.contingencyStr || "0");
            setSelfCostStr(data.selfCostStr || "1000");
            setIsAutoSync(data.isAutoSync !== undefined ? data.isAutoSync : true);
            setUndoStack([]);
            alert("Working file loaded successfully.");
          } else {
            alert("Invalid working file format.");
          }
        } catch (err) {
          alert("Error parsing working file.");
        }
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

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
      setUndoStack([]);
      
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
      e.target.value = '';
    }
  };

  // --- Logic: Resource Suggestion ---
  const redistributeWorkload = (targetDiscipline: string | 'all') => {
    if (backlog.length === 0 || milestones.length === 0) {
      return;
    }
    pushToUndo();

    const totalDuration = milestones.reduce((sum, m) => sum + m.duration, 0);
    if (totalDuration === 0) return;

    const disciplinesToProcess = targetDiscipline === 'all' 
      ? Array.from(new Set(backlog.map(i => i.discipline?.trim() || '').filter(d => d !== '')))
      : [targetDiscipline];

    if (disciplinesToProcess.length === 0 && targetDiscipline === 'all') {
      disciplinesToProcess.push('General');
    }

    setResources(prev => {
      let newList = [...prev];
      
      disciplinesToProcess.forEach(discName => {
        const canonicalName = getCanonicalDisciplineName(discName);
        const discTasks = backlog.filter(item => getCanonicalDisciplineName(item.discipline || '') === canonicalName);
        
        const totalEffortInUnit = discTasks.reduce((sum, item) => sum + item.effort, 0);
        const totalRequiredMM = totalEffortInUnit * currentUnit.ratioToMonth * (1 + inefficiency / 100);
        const avgHeadcount = Math.ceil(totalRequiredMM / totalDuration) || 1;

        const existingIdx = newList.findIndex(r => getCanonicalDisciplineName(r.name) === canonicalName);
        
        const allocations: Record<string, number> = {};
        projectMonthsList.forEach(m => {
          allocations[m.toISOString().slice(0, 7)] = avgHeadcount;
        });

        const newId = `res-redist-${canonicalName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}`;

        if (existingIdx !== -1) {
          // Replace it with a redist ID so auto-sync stops touching it
          newList[existingIdx] = { 
            ...newList[existingIdx], 
            id: newId, 
            allocations 
          };
        } else {
          const discInfo = GAME_DEV_DISCIPLINES.find(d => d.name === canonicalName) || { name: canonicalName, defaultCost: selfCost || 1000 };
          newList.unshift({
            id: newId,
            name: canonicalName,
            monthlyCost: discInfo.defaultCost,
            allocations
          });
        }
      });
      
      return newList;
    });
    
    setIsRedistributeOpen(false);
  };

  const backlogDisciplines = useMemo(() => {
    return Array.from(new Set(
      backlog
        .map(item => (item.discipline?.trim() || ''))
        .filter(d => d !== '')
    )).sort();
  }, [backlog]);

  const applyAISuggestion = useCallback(() => {
    if (backlog.length === 0 || milestones.length === 0) {
      return;
    }

    // 1. Group unique disciplines by their canonical names
    const canonicalDisciplines = Array.from(new Set(
      backlog
        .map(item => getCanonicalDisciplineName(item.discipline || ''))
        .filter(d => d !== '')
    ));

    if (canonicalDisciplines.length === 0) {
      canonicalDisciplines.push('General');
    }

    // 2. Calculate the "Backlog-Derived" resources
    const newResources: Resource[] = canonicalDisciplines.map((canonicalName) => {
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
        
        const msDuration = Math.max(1, ms.duration);
        const requiredHeadcount = Math.ceil(requiredMM / msDuration);

        const msMonths = projectMonthsList.slice(monthOffset, monthOffset + msDuration);
        msMonths.forEach(d => {
          const key = d.toISOString().slice(0, 7);
          allocations[key] = requiredHeadcount;
        });
        monthOffset += msDuration;
      });

      return {
        id: `res-auto-${canonicalName.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: `${discInfo.name}`,
        monthlyCost: discInfo.defaultCost,
        allocations
      };
    });

    setResources(prev => {
      // 1. If prev is empty, this is the first import. Use backlog order.
      if (prev.length === 0) return newResources;

      // 2. Create map of calculated resources by their canonical name for easier matching
      const newResourcesByCanonical = new Map(
        newResources.map(r => [getCanonicalDisciplineName(r.name), r])
      );
      const handledCanonicalNames = new Set<string>();

      // 3. Update existing resources while maintaining current order
      const updatedPrev = prev.map(r => {
        const canonical = getCanonicalDisciplineName(r.name);
        const calculatedMatch = newResourcesByCanonical.get(canonical);

        if (calculatedMatch) {
          handledCanonicalNames.add(canonical);
          // If it's the auto-sync row, update its allocations
          if (r.id.startsWith('res-auto-')) {
            return {
              ...r,
              allocations: calculatedMatch.allocations
            };
          }
          // If it's a manual/redist row, we don't overwrite its allocations (it's user controlled)
          // but we've marked this discipline as "handled" so no new auto-row is added.
        }
        return r;
      });

      // 4. Remove auto-sync resources that are no longer in the backlog
      const filteredPrev = updatedPrev.filter(r => {
        if (r.id.startsWith('res-auto-')) {
          const canonical = getCanonicalDisciplineName(r.name);
          return newResourcesByCanonical.has(canonical);
        }
        return true;
      });

      // 5. Add any completely new auto-synced disciplines to the bottom of the list
      const brandNew = newResources.filter(r => {
        const canonical = getCanonicalDisciplineName(r.name);
        return !handledCanonicalNames.has(canonical);
      });
      
      return [...filteredPrev, ...brandNew];
    });
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
      if (isRedistributeOpen && !(e.target as HTMLElement).closest('.redistribute-container')) {
        setIsRedistributeOpen(false);
      }
      if (selectedRange && !(e.target as HTMLElement).closest('td.relative')) {
        setSelectedRange(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openColorPickerId, isRedistributeOpen]);

  // --- Logic: Manual Edits ---
  const updateAllocation = (resId: string, monthKey: string, val: number) => {
    pushToUndo();
    setResources(prev => prev.map(r => 
      r.id === resId ? { ...r, allocations: { ...r.allocations, [monthKey]: val } } : r
    ));
  };

  const handleTimelinePaste = (startResId: string, startMonthKey: string, text: string) => {
    // Excel/Sheets paste data as TSV (tab separated). 
    // We trim trailing newlines to avoid creating an empty row at the end.
    const trimmedText = text.replace(/[\r\n]+$/, '');
    if (!trimmedText && text.length > 0) {
      // If it was only newlines, we should probably still not process
      return;
    }
    if (!text) return;

    const rows = trimmedText.split(/\r?\n/).map(r => r.split('\t'));

    pushToUndo();

    setResources(prev => {
      const next = [...prev];
      const startResIdx = next.findIndex(r => r.id === startResId);
      const startMonthIdx = projectMonthsList.findIndex(m => m.toISOString().slice(0, 7) === startMonthKey);

      if (startResIdx === -1 || startMonthIdx === -1) return prev;

      rows.forEach((row, rowOffset) => {
        const resIdx = startResIdx + rowOffset;
        if (resIdx < next.length) {
          const res = { ...next[resIdx], allocations: { ...next[resIdx].allocations } };
          row.forEach((cellVal, colOffset) => {
            const monthIdx = startMonthIdx + colOffset;
            if (monthIdx < projectMonthsList.length) {
              const monthKey = projectMonthsList[monthIdx].toISOString().slice(0, 7);
              // Clean value (remove spaces, swap commas for dots if needed)
              const cleanVal = cellVal.trim().replace(/\s/g, '').replace(',', '.');
              const numVal = parseFloat(cleanVal) || 0;
              res.allocations[monthKey] = numVal;
            }
          });
          next[resIdx] = res;
        }
      });
      return next;
    });
  };

  const handleDistribute = () => {
    if (!selectedRange || selectedRange.monthKeys.length === 0) return;

    const totalToDistributeStr = prompt("Enter total amount to distribute over selected period:", "1.0");
    if (totalToDistributeStr === null || totalToDistributeStr === "") return;
    const total = parseFloat(totalToDistributeStr.replace(',', '.'));
    if (isNaN(total)) {
      alert("Invalid number");
      return;
    }

    pushToUndo();
    const count = selectedRange.monthKeys.length;
    const baseValue = Math.floor(total / count);
    const remainder = total % count;

    setResources(prev => prev.map(res => {
      if (res.id !== selectedRange.resId) return res;
      
      const newAllocations = { ...res.allocations };
      selectedRange.monthKeys.forEach((key, idx) => {
        const isLast = idx === count - 1;
        newAllocations[key] = isLast ? Number((baseValue + remainder).toFixed(2)) : Number(baseValue.toFixed(2));
      });

      // Stable ID transformation: only change if it's an auto row that needs to become manual
      let newId = res.id;
      if (res.id.startsWith('res-auto-')) {
        // We use the canonical name to keep it linked but stop auto-sync
        newId = `res-manual-${getCanonicalDisciplineName(res.name).replace(/\s/g, '_')}`;
        // Ensure uniqueness
        if (prev.some(p => p.id === newId && p.id !== res.id)) {
          newId = `${newId}-${Date.now()}`;
        }
      }

      return { ...res, id: newId, allocations: newAllocations };
    }));
    setSelectedRange(null);
  };

  const addManualResource = () => {
    pushToUndo();
    const newId = `res-manual-${Date.now()}`;
    const allocations: Record<string, number> = {};
    projectMonthsList.forEach(m => {
      allocations[m.toISOString().slice(0, 7)] = 0;
    });
    
    setResources(prev => [{
      id: newId,
      name: "New Role",
      monthlyCost: selfCost || 1000,
      allocations
    }, ...prev]);
    setNewlyCreatedId(newId);
  };

  const deleteResource = (id: string) => {
    pushToUndo();
    setResources(prev => prev.filter(r => r.id !== id));
  };

  const duplicateResource = (id: string) => {
    const source = resources.find(r => r.id === id);
    if (!source) return;
    pushToUndo();

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
    setNewlyCreatedId(newId);
  };

  const updateResourceName = (id: string, name: string) => {
    pushToUndo();
    setResources(prev => prev.map(r => r.id === id ? { ...r, name } : r));
  };

  const updateResourceCost = (id: string, monthlyCost: number) => {
    pushToUndo();
    setResources(prev => prev.map(r => r.id === id ? { ...r, monthlyCost } : r));
  };

  const addMilestone = () => {
    pushToUndo();
    const newId = `ms-${Date.now()}`;
    setMilestones(prev => [...prev, {
      id: newId,
      name: "New Phase",
      duration: 1,
      color: MILESTONE_COLORS[prev.length % MILESTONE_COLORS.length]
    }]);
    setNewlyCreatedId(newId);
  };

  const deleteMilestone = (id: string) => {
    if (milestones.length <= 1) return;
    pushToUndo();
    setMilestones(prev => prev.filter(m => m.id !== id));
  };

  const moveMilestone = (id: string, direction: 'up' | 'down') => {
    const index = milestones.findIndex(m => m.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === milestones.length - 1) return;

    pushToUndo();
    const newMilestones = [...milestones];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newMilestones[index], newMilestones[targetIndex]] = [newMilestones[targetIndex], newMilestones[index]];
    setMilestones(newMilestones);
  };

  const updateMilestone = (id: string, updates: Partial<Milestone>) => {
    pushToUndo();
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

  const handleExportWorkingFile = () => {
    const data = {
      backlog,
      milestones,
      resources,
      startDate,
      effortUnit,
      currency,
      customCurrency,
      inefficiency,
      marginStr,
      contingencyStr,
      selfCostStr,
      isAutoSync,
      version: "5.0"
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Project_Architect_Working_File_${new Date().toISOString().slice(0, 10)}.json`;
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
          <img src={ICONS.CALENDAR} alt="calendar" className="w-8 h-8" />
          Project Architect <span className="text-sm not-italic font-normal opacity-50">v5.0</span>
        </h1>
        <div className="flex gap-4">
          <RetroButton 
            onClick={undo}
            disabled={undoStack.length === 0}
            className={`text-[10px] py-1 px-4 border border-black flex items-center gap-1 ${undoStack.length === 0 ? '' : 'bg-blue-100'}`}
          >
            <span className="text-xl">↩️</span>
            Undo ({undoStack.length})
          </RetroButton>

          {selectedRange && (
            <RetroButton 
              onClick={handleDistribute}
              className="text-[10px] py-1 px-4 border border-black bg-yellow-400 hover:bg-yellow-500 flex items-center gap-1 shadow-lg"
              title="Distribute value over selected cells"
            >
              <img src={ICONS.SUGGEST} alt="distribute" className="w-5 h-5" />
              DISTRIBUTE
            </RetroButton>
          )}

          <RetroButton 
            onClick={() => {
              pushToUndo();
              setBacklog([]);
              setMilestones([]);
              setResources([]);
              setDismissedAlerts({});
              setIsRedistributeOpen(false);
              setFillSource(null);
              setFillTargetKeys([]);
            }}
            className="text-[10px] py-1 px-4 border border-black bg-red-100 hover:bg-red-200 flex items-center gap-1"
          >
            <img src={ICONS.TRASH} alt="clear" className="w-12 h-12" />
            Clear Data
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
        {!isSidebarCollapsed && (
          <div className="lg:col-span-1 space-y-6">
            <div className="flex justify-end mb-2">
              <button 
                onClick={() => setIsSidebarCollapsed(true)}
                className="text-[10px] px-2 py-1 win95-bg border border-gray-600 hover:bg-gray-100 flex items-center gap-1 font-bold"
                title="Collapse Sidebar"
              >
                <img src={ICONS.MOVE_LEFT} alt="collapse" className="w-3 h-3" />
                COLLAPSE
              </button>
            </div>
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1 italic text-blue-700">Resume Session</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="file" accept=".json" className="hidden" id="working-file-upload" onChange={handleBacklogUpload} />
                <label htmlFor="working-file-upload" className="flex flex-col items-center justify-center py-2 win95-bg retro-beveled cursor-pointer text-[10px] font-black border-2 border-blue-400 hover:bg-blue-50 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 gap-1 text-center h-full">
                  <img src={ICONS.CALENDAR} alt="restore" className="w-6 h-6" />
                  LOAD FILE
                </label>
                
                <button 
                  onClick={handleExportWorkingFile}
                  className="flex flex-col items-center justify-center py-2 win95-bg retro-beveled cursor-pointer text-[10px] font-black border-2 border-green-600 hover:bg-green-50 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 gap-1 text-center h-full"
                >
                  <img src={ICONS.SAVE} alt="save" className="w-6 h-6" />
                  SAVE PROGRESS
                </button>
              </div>
              <p className="text-[9px] opacity-60 leading-tight">Save/Load your project progress as a JSON file to keep working later.</p>
            </div>
          </div>

          {/* Step 1: Import */}
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400">
            <h3 className="font-black text-xs uppercase mb-3 border-b border-gray-400 pb-1">1. Import Backlog</h3>
            <div className="space-y-2">
              <input type="file" accept=".xlsx,.csv" className="hidden" id="backlog-upload" onChange={handleBacklogUpload} />
              <label htmlFor="backlog-upload" className="block w-full text-center py-4 win95-bg retro-beveled cursor-pointer text-sm font-black border-2 border-gray-500 hover:bg-gray-100 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2">
                {isImporting ? '⌛ PARSING...' : (
                  <span className="flex items-center gap-2">
                    <img src={ICONS.FOLDER} alt="upload" className="w-5 h-5" />
                    UPLOAD BACKLOG
                  </span>
                )}
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
              <input type="date" className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" value={startDate} onChange={e => { pushToUndo(); setStartDate(e.target.value); }} />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase mb-1">Effort Unit</label>
              <select className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" value={effortUnit} onChange={e => { pushToUndo(); setEffortUnit(e.target.value); }}>
                {EFFORT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase mb-1">Currency</label>
              <div className="flex flex-wrap gap-1 mb-1">
                {CURRENCIES.map(c => (
                  <button
                    key={c.label}
                    onClick={() => { pushToUndo(); setCurrency(c.symbol); setCustomCurrency(''); }}
                    className={`px-3 py-2 text-lg font-bold border ${currency === c.symbol && !customCurrency ? 'bg-blue-600 text-white border-blue-700' : 'win95-bg border-gray-600 hover:bg-gray-100'}`}
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>
              <input 
                type="text" 
                placeholder="Custom (e.g. kr, R$)" 
                className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" 
                value={customCurrency} 
                onChange={e => { pushToUndo(); setCustomCurrency(e.target.value); }} 
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1">Margin %</label>
                <input type="text" className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" value={marginStr} onChange={e => { pushToUndo(); setMarginStr(e.target.value); }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1">Buffer %</label>
                <input type="text" className="w-full p-1 retro-inset bg-white text-xs border border-gray-400" value={contingencyStr} onChange={e => { pushToUndo(); setContingencyStr(e.target.value); }} />
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
                  onChange={e => { pushToUndo(); setInefficiency(parseInt(e.target.value)); }} 
                />
                <span className="text-xs font-mono w-8">{inefficiency}%</span>
              </div>
              <p className="text-[8px] opacity-50 mt-1 italic">Adds overhead to all backlog estimates.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold uppercase mb-1">Self Cost (per MM)</label>
                <div className="flex gap-1">
                  <input type="text" className="flex-grow p-1 retro-inset bg-white text-xs border border-gray-400" value={selfCostStr} onChange={e => { pushToUndo(); setSelfCostStr(e.target.value); }} />
                  <button 
                    onClick={() => { pushToUndo(); setResources(prev => prev.map(r => ({ ...r, monthlyCost: selfCost }))); }}
                    className="px-2 py-1 win95-bg border border-gray-600 text-[8px] font-bold uppercase hover:bg-gray-100 active:bg-gray-200"
                    title="Apply to all roles"
                  >
                    Apply All
                  </button>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isAutoSync} onChange={e => { pushToUndo(); setIsAutoSync(e.target.checked); }} className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">Auto-Sync Resources</span>
            </label>
          </div>

          {/* Step 3: Project Summary */}
          {backlog.length > 0 && (
            <div className="win95-bg p-6 retro-beveled border-2 border-gray-400 space-y-4 max-h-[500px] flex flex-col shrink-0">
              <h3 className="font-black text-sm uppercase border-b-2 border-gray-400 pb-2 flex justify-between items-center">
                <span>3. Project Summary</span>
                <span className="text-[10px] lowercase opacity-60 font-normal italic">(Generated from backlog)</span>
              </h3>
              
              <div className="space-y-4 text-sm">
                {/* Peak Stats */}
                {(() => {
                  const monthKeys = projectMonthsList.map(m => m.toISOString().slice(0, 7));
                  let peakTotal = 0;
                  monthKeys.forEach(key => {
                    const monthSum = resources.reduce((sum, r) => sum + (r.allocations[key] || 0), 0);
                    if (monthSum > peakTotal) peakTotal = monthSum;
                  });

                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white/50 border border-gray-300 shadow-sm">
                        <div className="text-[10px] font-black uppercase opacity-50 mb-1 leading-none">Peak Headcount</div>
                        <div className="text-2xl font-black">{peakTotal.toFixed(1)}</div>
                      </div>
                      <div className="p-3 bg-white/50 border border-gray-300 shadow-sm">
                        <div className="text-[10px] font-black uppercase opacity-50 mb-1 leading-none">Total Duration</div>
                        <div className="text-2xl font-black">
                          {milestones.reduce((sum, m) => sum + m.duration, 0)} 
                          <span className="text-xs ml-1 font-bold lowercase">{effortUnit}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Team Peak Breakdown */}
                <div className="p-3 bg-white/50 border border-gray-300 shadow-sm">
                  <div className="text-[10px] font-black uppercase opacity-50 mb-2 leading-none">Peak Headcount by Discipline</div>
                  <div className="space-y-2 max-h-[220px] overflow-auto pr-2">
                    {(() => {
                      const monthKeys = projectMonthsList.map(m => m.toISOString().slice(0, 7));
                      const resourcesByDisc: Record<string, Resource[]> = {};
                      
                      resources.forEach(r => {
                        const canon = getCanonicalDisciplineName(r.name);
                        if (!resourcesByDisc[canon]) resourcesByDisc[canon] = [];
                        resourcesByDisc[canon].push(r);
                      });

                      const peakEntries = Object.entries(resourcesByDisc).map(([name, rList]) => {
                        let maxVal = 0;
                        monthKeys.forEach(key => {
                          const mSum = rList.reduce((s, r) => s + (r.allocations[key] || 0), 0);
                          if (mSum > maxVal) maxVal = mSum;
                        });
                        return { name, peak: maxVal };
                      }).sort((a,b) => b.peak - a.peak);

                      if (peakEntries.length === 0) return <div className="text-xs italic opacity-50">No resources allocated yet.</div>;
                      
                      return peakEntries.map(({ name, peak }) => (
                        <div key={name} className="flex justify-between items-end border-b border-gray-200 pb-1">
                          <span className="font-bold text-xs truncate max-w-[140px] uppercase">{name}</span>
                          <span className="text-xs font-mono bg-blue-100 px-1.5 rounded">{peak.toFixed(1)} <span className="text-[10px]">Peak</span></span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
        )}
        
        {/* Main Content: Matrix */}
        <div className={`${isSidebarCollapsed ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-6`}>
          <div className="win95-bg p-4 retro-beveled border-2 border-gray-400 min-h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                {isSidebarCollapsed && (
                  <button 
                    onClick={() => setIsSidebarCollapsed(false)}
                    className="p-1 win95-bg border border-gray-600 hover:bg-gray-100 flex items-center justify-center"
                    title="Expand Sidebar"
                  >
                    <img src={ICONS.MOVE_RIGHT} alt="expand" className="w-4 h-4" />
                  </button>
                )}
                <h3 className="font-black text-lg uppercase italic underline decoration-blue-500">Allocation Matrix</h3>
                {workloadAlerts.length > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-2 py-1 rounded animate-pulse">
                    <span className="text-sm font-black text-red-600">
                      ⚠️ {workloadAlerts.length} OVERLOADS DETECTED
                    </span>
                  </div>
                )}
              </div>
              <div className="relative redistribute-container">
                <RetroButton onClick={() => setIsRedistributeOpen(!isRedistributeOpen)} className="text-sm py-1 px-4 border border-black bg-white hover:bg-gray-100">
                  <span className="flex items-center gap-2">
                    <img src={ICONS.RECALCULATE} alt="recalc" className="w-6 h-6" />
                    Redistribute
                  </span>
                </RetroButton>

                {isRedistributeOpen && (
                  <div className="absolute top-full right-0 mt-1 z-50 win95-bg border-2 border-gray-400 shadow-[2px_2px_0px_rgba(0,0,0,1)] p-1 min-w-[150px] max-h-[300px] overflow-auto">
                    <button 
                      onClick={() => redistributeWorkload('all')}
                      className="w-full text-left px-4 py-2 hover:bg-blue-800 hover:text-white text-sm font-bold border border-transparent hover:border-white"
                    >
                      ALL
                    </button>
                    <div className="border-t border-gray-400 my-1" />
                    {backlogDisciplines.map(d => (
                      <button 
                        key={d}
                        onClick={() => redistributeWorkload(d)}
                        className="w-full text-left px-4 py-2 hover:bg-blue-800 hover:text-white text-sm border border-transparent hover:border-white"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {workloadAlerts.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-400 retro-beveled space-y-2">
                <h4 className="text-sm font-black uppercase text-red-700">Workload Alerts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {workloadAlerts.map((alert, i) => (
                    <div key={i} className="bg-white p-2 border border-red-200 flex justify-between items-center gap-2">
                      <div className="text-sm">
                        <span className="font-black text-red-600">[{alert.milestoneName}]</span> {alert.discipline}: 
                        <span className="ml-1 font-mono">{alert.allocated.toFixed(1)}/{alert.required.toFixed(1)} MM</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {alert.isCompensatable ? (
                          <button 
                            onClick={() => { pushToUndo(); setDismissedAlerts(prev => ({ ...prev, [`${alert.milestoneId}-${alert.discipline}`]: true })); }}
                            className="text-[10px] px-2 py-1 win95-bg border border-blue-600 text-blue-700 font-bold uppercase hover:bg-blue-50 flex items-center gap-1"
                            title="Total project capacity covers this overload"
                          >
                            <span className="text-sm">⚖️</span> Compensate
                          </button>
                        ) : (
                          <button 
                            onClick={() => spreadWorkload(alert.discipline, alert.milestoneId)}
                            className="text-[10px] px-2 py-1 bg-red-600 text-white font-black uppercase hover:bg-red-700 rounded shadow-sm"
                          >
                            Add Support
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative flex-grow flex flex-col min-h-0 bg-white border border-gray-400 retro-inset overflow-hidden">
              {/* Top Horizontal Scrollbar (Mirrors bottom) */}
              <div 
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="overflow-x-scroll overflow-y-hidden h-4 bg-gray-200 border-b border-gray-400 sticky top-0 z-40 scroll-smooth"
              >
                <div style={{ width: (320 + projectMonthsList.length * 80) + 'px' }} className="h-px" />
              </div>

              <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-grow overflow-x-scroll overflow-y-auto h-[600px] max-h-[calc(100vh-350px)] relative"
              >
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                <table className="w-full text-base font-mono border-collapse min-w-[1000px]">
                  <thead className="sticky top-0 z-20 bg-gray-200 shadow-sm">
                  <tr>
                    <th className="sticky left-0 bg-gray-200 z-30 border-r border-black w-80 min-w-[320px] p-2 transition-all duration-300">
                      <button 
                        onClick={addMilestone}
                        className="w-full text-sm py-1 bg-blue-50 border border-blue-600 text-blue-700 hover:bg-blue-100 rounded uppercase font-black shadow-sm active:shadow-none active:translate-y-0.5 flex items-center justify-center gap-1"
                      >
                        <img src={ICONS.ADD} alt="add" className="w-4 h-4" />
                        Add Phase
                      </button>
                    </th>
                    {milestones.map((ms, idx) => (
                      <th 
                        key={ms.id} 
                        colSpan={ms.duration} 
                        className="border-r border-black text-center text-sm font-black uppercase px-2 group relative"
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
                              <img src={ICONS.MOVE_LEFT} alt="left" className="w-4 h-4" />
                            </button>
                            <input 
                              ref={(el) => {
                                if (el && newlyCreatedId === ms.id) {
                                  el.focus();
                                  el.select();
                                  setNewlyCreatedId(null);
                                }
                              }}
                              className="bg-white/40 border-none text-center w-full focus:bg-white outline-none rounded px-1 py-0.5 text-sm placeholder-black/30" 
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
                              <img src={ICONS.MOVE_RIGHT} alt="right" className="w-4 h-4" />
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
                                className="w-8 h-8 border-2 border-black/20 rounded shadow-sm hover:scale-110 transition-transform flex items-center justify-center bg-white/20"
                                title="Change Color"
                              >
                                  <img src={ICONS.COLOR_PICKER} alt="color" className="w-4 h-4" />
                              </button>
                              
                              {openColorPickerId === ms.id && (
                                <div className="absolute top-full left-0 mt-2 z-50 win95-bg p-3 retro-beveled border-2 border-gray-400 shadow-xl min-w-[140px]">
                                  <div className="flex justify-between items-center mb-2 border-b border-gray-400 pb-1">
                                    <span className="text-sm font-black uppercase">Pick Color</span>
                                    <button onClick={() => setOpenColorPickerId(null)} className="text-base hover:text-red-600">×</button>
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
                                      className="w-full text-sm py-1.5 win95-bg retro-beveled border border-gray-600 font-black uppercase hover:bg-gray-100 active:retro-inset flex items-center justify-center gap-1"
                                    >
                                      <span className="flex items-center gap-1">
                                        <img src={ICONS.SUGGEST} alt="dice" className="w-4 h-4" />
                                        Suggest
                                      </span>
                                    </button>
                                    
                                    <div className="flex items-center justify-between gap-2 px-1">
                                      <span className="text-xs font-bold uppercase">Custom:</span>
                                      <input 
                                        type="color" 
                                        className="w-6 h-6 p-0 border border-black/20 bg-transparent cursor-pointer"
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
                              className="text-red-600 hover:scale-125 transition-transform opacity-0 group-hover:opacity-100 shrink-0"
                              title="Delete Phase"
                            >
                              <img src={ICONS.TRASH} alt="delete" className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr className="h-10 border-t border-black">
                    <th className="sticky left-0 bg-gray-200 z-30 border-r border-black p-2 uppercase text-xs">
                      <div className="flex justify-between items-center w-full">
                        <span>Resource</span>
                        <button 
                          onClick={addManualResource}
                          className="text-[10px] px-2 py-0.5 bg-green-100 border border-green-600 text-green-700 hover:bg-green-200 rounded flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                          title="Add Manual Resource"
                        >
                          <img src={ICONS.ADD} alt="add" className="w-3 h-3" />
                          Add Role
                        </button>
                      </div>
                    </th>
                    {projectMonthsList.map((m, i) => (
                      <th key={i} className="border-r border-black p-1 text-xs text-center whitespace-nowrap min-w-[80px]">
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
                          <span className="opacity-20 italic font-black uppercase text-2xl">Upload backlog or add roles manually</span>
                          <button 
                            onClick={addManualResource}
                            className="text-lg px-6 py-3 bg-green-100 border-2 border-green-600 text-green-700 hover:bg-green-200 rounded font-black uppercase shadow-[4px_4px_0px_rgba(0,0,0,0.1)] active:shadow-none active:translate-x-1 active:translate-y-1 flex items-center gap-2"
                          >
                            <img src={ICONS.ADD} alt="add" className="w-6 h-6" />
                            Add First Role
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      <SortableContext 
                      items={resources.map(r => r.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {resources.map((res, resIdx) => (
                        <SortableResourceRow 
                          key={res.id}
                          res={res}
                          resIdx={resIdx}
                          projectMonthsList={projectMonthsList}
                          displayCurrency={displayCurrency}
                          updateResourceName={updateResourceName}
                          updateResourceCost={updateResourceCost}
                          duplicateResource={duplicateResource}
                          deleteResource={deleteResource}
                          updateAllocation={updateAllocation}
                          onPasteAllocation={handleTimelinePaste}
                          fillSource={fillSource}
                          setFillSource={setFillSource}
                          fillTargetKeys={fillTargetKeys}
                          setFillTargetKeys={setFillTargetKeys}
                          isNewlyCreated={newlyCreatedId === res.id}
                          onFocusHandled={() => setNewlyCreatedId(null)}
                          selectedRange={selectedRange}
                          onSelectionUpdate={setSelectedRange}
                          isSelecting={isSelecting}
                          setIsSelecting={setIsSelecting}
                        />
                      ))}
                    </SortableContext>
                     
                      {/* Summary Rows */}
                      <tr className="bg-gray-100 font-black border-t-2 border-black">
                        <td className="sticky left-0 bg-gray-100 z-10 border-r border-black p-2 uppercase text-sm">
                          Total MM
                        </td>
                        {projectMonthsList.map((m, i) => {
                          const key = m.toISOString().slice(0, 7);
                          const sum = resources.reduce((s, r) => s + (r.allocations[key] || 0), 0);
                          return <td key={i} className="border-r border-black text-center p-2 text-sm">{sum.toFixed(1)}</td>;
                        })}
                      </tr>
                      <tr className="bg-gray-50 font-black border-t border-black">
                        <td className="sticky left-0 bg-gray-50 z-10 border-r border-black p-2 uppercase text-sm">Monthly Cost</td>
                        {projectMonthsList.map((m, i) => {
                          const key = m.toISOString().slice(0, 7);
                          const cost = resources.reduce((s, r) => s + (r.allocations[key] || 0) * r.monthlyCost, 0);
                          return <td key={i} className="border-r border-black text-center p-2 text-sm">{displayCurrency}{cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>;
                        })}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </DndContext>
          </div>
        </div>

            {/* Footer Metrics & Export */}
            <div className="mt-6 p-6 border-4 border-black bg-[#ffffa0] shadow-[6px_6px_0px_rgba(0,0,0,1)]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="border-r border-black/10 pr-4">
                  <div className="text-sm font-black uppercase opacity-50 mb-1">Total Effort</div>
                  <div className="text-4xl font-black">{totalMM.toFixed(1)} <span className="text-sm font-normal">MM</span></div>
                </div>
                <div className="border-r border-black/10 pr-4">
                  <div className="text-sm font-black uppercase opacity-50 mb-1">Total Cost</div>
                  <div className="text-4xl font-black">{displayCurrency}{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="border-r border-black/10 pr-4">
                  <div className="text-sm font-black uppercase opacity-50 mb-1">Total Profit</div>
                  <div className="text-4xl font-black">{displayCurrency}{(totalCost * (margin / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div className="text-sm font-black uppercase opacity-50 mb-1">Total Budget</div>
                  <div className="text-4xl font-black text-blue-900">{displayCurrency}{(totalCost * (1 + margin / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
              <RetroButton onClick={handleExportExcel} className="w-full py-4 text-3xl font-black uppercase shadow-[4px_4px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 flex items-center justify-center gap-3">
                <img src={ICONS.SAVE} alt="export" className="w-8 h-8" />
                EXPORT PROJECTION (.XLSX)
              </RetroButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolProjectArchitect;
