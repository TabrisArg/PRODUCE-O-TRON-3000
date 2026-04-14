import React, { useState, useEffect } from 'react';
import RetroButton from './RetroButton.tsx';
import ExcelJS from 'exceljs';

interface Resource {
  id: string;
  name: string;
  monthlyCost: number;
  isOverride: boolean;
}

interface ExchangeRates {
  [key: string]: number;
}

const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

const ToolCostSimulator: React.FC = () => {
  // Budget States
  const [months, setMonths] = useState(6);
  const [avgCost, setAvgCost] = useState(5000);
  const [margin, setMargin] = useState(20);
  const [contingency, setContingency] = useState(10);
  const [resources, setResources] = useState<Resource[]>([
    { id: '1', name: 'Lead Engineer', monthlyCost: 5000, isOverride: false },
    { id: '2', name: 'Designer', monthlyCost: 5000, isOverride: false },
  ]);

  // Currency States
  const [primaryCurrency, setPrimaryCurrency] = useState('EUR');
  const [secondaryCurrency, setSecondaryCurrency] = useState('USD');
  const [rates, setRates] = useState<ExchangeRates>({});
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // Fetch Exchange Rates
  useEffect(() => {
    const fetchRates = async () => {
      setIsFetching(true);
      try {
        const response = await fetch(`https://open.er-api.com/v6/latest/${primaryCurrency}`);
        const data = await response.json();
        if (data && data.rates) {
          setRates(data.rates);
          setLastUpdate(new Date().toLocaleTimeString());
        }
      } catch (error) {
        console.error("Currency Fetch Error:", error);
      } finally {
        setIsFetching(false);
      }
    };
    fetchRates();
  }, [primaryCurrency]);

  const addResource = () => {
    const newRes: Resource = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Resource ${resources.length + 1}`,
      monthlyCost: avgCost,
      isOverride: false,
    };
    setResources([...resources, newRes]);
  };

  const removeResource = (id: string) => {
    if (resources.length <= 1) return;
    setResources(resources.filter(r => r.id !== id));
  };

  const updateResourceName = (id: string, name: string) => {
    setResources(resources.map(r => r.id === id ? { ...r, name } : r));
  };

  const updateResourceCost = (id: string, cost: number) => {
    setResources(resources.map(r => r.id === id ? { ...r, monthlyCost: cost, isOverride: true } : r));
  };

  useEffect(() => {
    setResources(prev => prev.map(r => r.isOverride ? r : { ...r, monthlyCost: avgCost }));
  }, [avgCost]);

  const resetOverride = (id: string) => {
    setResources(resources.map(r => r.id === id ? { ...r, monthlyCost: avgCost, isOverride: false } : r));
  };

  // Calculations (Always in Primary)
  const baseCost = resources.reduce((acc, r) => acc + (r.monthlyCost * months), 0);
  const profitAmount = baseCost * (margin / 100);
  const subtotalWithMargin = baseCost + profitAmount;
  const contingencyAmount = subtotalWithMargin * (contingency || 0) / 100;
  const grandTotal = subtotalWithMargin + contingencyAmount;

  // Excel Generation Logic
  const handleGenerateExcel = async () => {
    const hasSecondary = secondaryCurrency !== 'NONE' && rates[secondaryCurrency];
    const rate = hasSecondary ? rates[secondaryCurrency] : 1;
    
    const pCurr = CURRENCIES.find(c => c.code === primaryCurrency);
    const sCurr = CURRENCIES.find(c => c.code === secondaryCurrency);
    
    const primaryFormat = `"${pCurr?.symbol || ''}"#,##0`;
    const secondaryFormat = `"${sCurr?.symbol || ''}"#,##0`;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Budget Estimate');

    const cols = [
      { header: 'ITEM', key: 'item', width: 40 },
      { header: `VAL (${primaryCurrency})`, key: 'valPrimary', width: 22 },
      { header: `TOTAL (${primaryCurrency})`, key: 'totalPrimary', width: 22 },
    ];

    if (hasSecondary) {
      cols.push({ header: `VAL (${secondaryCurrency})`, key: 'valSecondary', width: 22 });
      cols.push({ header: `TOTAL (${secondaryCurrency})`, key: 'totalSecondary', width: 22 });
    }
    worksheet.columns = cols;

    const titleRow = worksheet.insertRow(1, ["FISCAL PROJECTION ENGINE - BUDGET REPORT"]);
    titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
    worksheet.mergeCells(1, 1, 1, hasSecondary ? 5 : 3);

    worksheet.addRow(["Generated via Produce-o-tron 3000", new Date().toLocaleString()]);
    worksheet.addRow([]);

    resources.forEach(res => {
      const primaryMonthly = res.monthlyCost;
      const primaryTotal = res.monthlyCost * months;
      const dataRowValues = [res.name.toUpperCase(), primaryMonthly, primaryTotal];
      
      if (hasSecondary) {
        dataRowValues.push(primaryMonthly * rate, primaryTotal * rate);
      }
      const newRow = worksheet.addRow(dataRowValues);
      
      newRow.getCell(2).numFmt = primaryFormat;
      newRow.getCell(3).numFmt = primaryFormat;
      if (hasSecondary) {
        newRow.getCell(4).numFmt = secondaryFormat;
        newRow.getCell(5).numFmt = secondaryFormat;
      }
    });

    const addSummaryRow = (label: string, primaryValue: number, color?: string) => {
      const rowData = [label, primaryValue, primaryValue];
      if (hasSecondary) {
        rowData.push(primaryValue * rate, primaryValue * rate);
      }
      const row = worksheet.addRow(rowData);
      row.getCell(2).numFmt = primaryFormat;
      row.getCell(3).numFmt = primaryFormat;
      if (hasSecondary) {
        row.getCell(4).numFmt = secondaryFormat;
        row.getCell(5).numFmt = secondaryFormat;
      }
      if (color) {
        row.eachCell((cell, colNumber) => {
          if (colNumber >= 1) {
             cell.font = { color: { argb: color }, bold: true };
          }
        });
      }
      return row;
    };

    worksheet.addRow([]);
    addSummaryRow("BASE OPERATION COST", baseCost);
    addSummaryRow(`PROFIT MARGIN (${margin}%)`, profitAmount, 'FF0D47A1');
    addSummaryRow("OPERATING SUBTOTAL", subtotalWithMargin);
    addSummaryRow(`CONTINGENCY BUFFER (${contingency}%)`, contingencyAmount, 'FFB71C1C');
    
    worksheet.addRow([]);
    const finalRowData = ["FINAL BUDGET ESTIMATE", grandTotal, grandTotal];
    if (hasSecondary) {
      finalRowData.push(grandTotal * rate, grandTotal * rate);
    }
    const finalRow = worksheet.addRow(finalRowData);
    finalRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 14 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      if (colNumber === 2 || colNumber === 3) cell.numFmt = primaryFormat;
      if (hasSecondary && (colNumber === 4 || colNumber === 5)) cell.numFmt = secondaryFormat;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cost_Simulation_${Date.now()}.xlsx`;
    a.click();
  };

  const formatValue = (val: number, currencyCode: string) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currencyCode,
      maximumFractionDigits: 0
    }).format(val);
  };

  const getDualDisplay = (valInPrimary: number) => {
    const primaryStr = formatValue(valInPrimary, primaryCurrency);
    if (secondaryCurrency === 'NONE' || !rates[secondaryCurrency]) {
      return <span>{primaryStr}</span>;
    }
    const converted = valInPrimary * rates[secondaryCurrency];
    return (
      <div className="flex flex-col items-end">
        <span className="font-bold">{primaryStr}</span>
        <span className="text-[10px] text-gray-500 font-normal">[{formatValue(converted, secondaryCurrency)}]</span>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6 font-serif text-black">
      <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          💰 Cost Simulator v1.6
        </h2>
        <div className="text-[9px] font-mono text-right win95-bg p-1 retro-inset px-2">
          STATUS: {isFetching ? "SYNCHRONIZING..." : "ONLINE"}<br/>
          RATES: {lastUpdate || "PENDING"}
        </div>
      </div>

      <div className="win95-bg p-4 retro-beveled grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 border-2 border-gray-400 items-end">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-black leading-tight">Primary Currency</label>
          <select 
            className="w-full p-1 retro-inset font-mono text-xs bg-white text-black outline-none"
            value={primaryCurrency}
            onChange={(e) => setPrimaryCurrency(e.target.value)}
          >
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-black leading-tight">Secondary Currency</label>
          <select 
            className="w-full p-1 retro-inset font-mono text-xs bg-white text-black outline-none"
            value={secondaryCurrency}
            onChange={(e) => setSecondaryCurrency(e.target.value)}
          >
            <option value="NONE">None (Disabled)</option>
            {CURRENCIES.filter(c => c.code !== primaryCurrency).map(c => (
              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-black leading-tight">Duration (Months)</label>
          <input 
            type="number"
            className="w-full p-1 retro-inset font-mono text-xs bg-white text-black"
            value={months}
            onChange={(e) => setMonths(Math.max(1, parseInt(e.target.value) || 0))}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-black leading-tight">Default Cost / Mo</label>
          <input 
            type="number"
            className="w-full p-1 retro-inset font-mono text-xs bg-white text-black"
            value={avgCost}
            onChange={(e) => setAvgCost(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-black leading-tight">Profit Margin %</label>
          <input 
            type="number"
            className="w-full p-1 retro-inset font-mono text-xs bg-white text-black"
            value={margin}
            onChange={(e) => setMargin(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase text-black leading-tight">Contingency %</label>
          <input 
            type="number"
            className="w-full p-1 retro-inset font-mono text-xs bg-white text-black"
            value={contingency}
            onChange={(e) => setContingency(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-grow space-y-2">
          <div className="win95-bg p-1 retro-beveled text-[10px] font-bold px-2 flex justify-between uppercase border-2 border-gray-400 text-black">
            <span>Personnel Registry</span>
            <span>Headcount: {resources.length}</span>
          </div>
          <div className="retro-inset bg-white overflow-hidden overflow-x-auto border-2 border-gray-400">
            <table className="w-full text-sm font-mono border-collapse">
              <thead className="bg-gray-200 border-b-2 border-gray-600">
                <tr className="text-black font-bold">
                  <th className="p-2 text-left border-r border-gray-400 uppercase text-[10px] tracking-tight">Resource Name</th>
                  <th className="p-2 text-right border-r border-gray-400 uppercase text-[10px] tracking-tight">Cost / Mo ({primaryCurrency})</th>
                  <th className="p-2 text-right w-24 uppercase text-[10px] tracking-tight text-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((res) => (
                  <tr key={res.id} className="border-b border-gray-300 hover:bg-blue-50">
                    <td className="p-1 border-r border-gray-400">
                      <input 
                        className="w-full p-1 bg-transparent border-none focus:outline-none text-black font-bold"
                        value={res.name}
                        onChange={(e) => updateResourceName(res.id, e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-r border-gray-400 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {res.isOverride && <span className="text-[9px] text-blue-700 font-bold uppercase">[Override]</span>}
                        <input 
                          type="number"
                          className={`w-28 text-right p-1 bg-transparent border-none focus:outline-none ${res.isOverride ? 'font-bold text-black' : 'text-gray-900 font-normal'}`}
                          value={res.monthlyCost}
                          onChange={(e) => updateResourceCost(res.id, parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </td>
                    <td className="p-1 text-center space-x-1">
                      {res.isOverride && (
                        <button onClick={() => resetOverride(res.id)} className="text-[10px] text-gray-500 hover:text-black">🔄</button>
                      )}
                      <button onClick={() => removeResource(res.id)} className="text-red-700 font-bold hover:bg-red-100 px-2">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RetroButton onClick={addResource} className="mt-2 text-xs font-bold text-black">➕ Add Resource</RetroButton>
        </div>

        <div className="w-full lg:w-96 shrink-0">
          <div className="win95-bg p-4 retro-beveled space-y-4 border-2 border-gray-400 h-full">
            <h3 className="text-center font-bold border-b border-gray-600 pb-2 uppercase text-sm text-black">Budget Analysis</h3>
            
            <div className="space-y-4 font-mono text-sm text-black">
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-bold">Base Project Cost:</span>
                {getDualDisplay(baseCost)}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-bold">Profit Margin ({margin}%):</span>
                <div className="text-blue-900">{getDualDisplay(profitAmount)}</div>
              </div>
              <div className="border-t border-gray-500 pt-2 flex justify-between items-center font-bold">
                <span className="uppercase text-xs tracking-tighter text-black font-black">Gross Subtotal:</span>
                {getDualDisplay(subtotalWithMargin)}
              </div>
              <div className="flex justify-between items-center italic text-red-900">
                <span className="font-bold">Buffer ({contingency}%):</span>
                {getDualDisplay(contingencyAmount)}
              </div>
            </div>

            <div className="mt-6 p-4 border-2 border-black bg-[#ffffa0] text-black text-center shadow-[3px_3px_0px_rgba(0,0,0,1)]">
              <div className="text-[10px] uppercase font-bold tracking-widest mb-1 border-b border-black/20 pb-1 italic">Consolidated Total Estimate</div>
              <div className="py-2">
                <div className="text-3xl font-black tracking-tighter leading-none">
                  {formatValue(grandTotal, primaryCurrency)}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <RetroButton className="w-full text-xs font-bold text-black" onClick={handleGenerateExcel}>
                💾 Generate Excel Report
              </RetroButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolCostSimulator;