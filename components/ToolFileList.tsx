import React, { useState, useRef } from 'react';
import RetroButton from './RetroButton.tsx';
import { Document, Packer, Paragraph, Run, HeadingLevel } from 'docx';
import { processFileListAI } from '../services/gemini.ts';

interface ScanItem {
  name: string;
  level: number;
  isDir: boolean;
  path: string; // Used for sorting and identification
}

const ToolFileList: React.FC = () => {
  const [report, setReport] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [fullFileNames, setFullFileNames] = useState(false);
  const [keepUnderscores, setKeepUnderscores] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const REMOVE_LIST = [
    "SFX_AMB_", "SFX_AMB_EP", "EP_", "HH_", "SFX_MG_", 
    "SFX_INT_", "SFX_IT_", "SFX_SHOP_", "TT_", "01.wav", 
    "02.wav", "bloxburg_MS4_UI_", "bburg_desktop_", 
    "bburg_desktop_", "Bloxburg MS4 BG ", "Bloxburg_MS4_"
  ];

  const cleanFileName = (name: string) => {
    let newName = name;
    if (!fullFileNames) {
      REMOVE_LIST.forEach(str => {
        newName = newName.split(str).join("");
      });
    }
    if (!keepUnderscores) {
      newName = newName.split("_").join(" ");
    }
    return newName;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setAiResult(null);
    const items: ScanItem[] = [];
    const seenDirs = new Set<string>();

    const fileArray = Array.from(files) as any[];
    
    fileArray.forEach(file => {
      const fullPath = file.webkitRelativePath || '';
      const parts = fullPath.split('/');
      
      let currentPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i];
        currentPath += (currentPath ? '/' : '') + dirName;
        
        if (!seenDirs.has(currentPath)) {
          seenDirs.add(currentPath);
          items.push({
            name: dirName,
            level: i,
            isDir: true,
            path: currentPath
          });
        }
      }

      const fileName = parts[parts.length - 1];
      const cleanedName = cleanFileName(fileName);
      items.push({
        name: cleanedName,
        level: parts.length - 1,
        isDir: false,
        path: fullPath
      });
    });

    items.sort((a, b) => a.path.localeCompare(b.path));

    setReport(items);
    setLoading(false);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAIProcess = async () => {
    if (report.length === 0) return;
    setAiLoading(true);
    const textList = report.map(item => "  ".repeat(item.level) + (item.isDir ? `[${item.name}]` : `• ${item.name}`)).join("\n");
    const result = await processFileListAI(textList);
    setAiResult(result);
    setAiLoading(false);
  };

  const triggerPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const copyToClipboard = () => {
    const text = report.map(item => "  ".repeat(item.level) + (item.isDir ? `[${item.name}]` : `• ${item.name}`)).join("\n");
    navigator.clipboard.writeText(text);
    alert("Report copied to clipboard!");
  };

  const exportToWord = async () => {
    try {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 200 },
              children: [
                new Run({
                  text: `Folder Scan Report - ${dateStr}`,
                  color: "365F91",
                  font: "Calibri",
                  size: 28, // 14pt (Word uses half-points)
                })
              ],
            }),
            ...report.map(item => new Paragraph({
              bullet: {
                level: item.level,
              },
              children: [
                new Run({
                  text: item.name,
                  font: "Cambria",
                  size: 22, // 11pt (Word uses half-points)
                })
              ],
            }))
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "items in folders list.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export Error:", err);
      alert("Failed to generate Word document. Please ensure your data is valid.");
    }
  };

  return (
    <div className="p-4 space-y-4 font-serif">
      <h2 className="text-2xl font-bold border-b-2 border-black mb-4 flex items-center gap-2">
        📂 Files to Documents List
      </h2>

      <div className="retro-inset bg-blue-50 p-3 mb-4 text-xs border-l-4 border-blue-800">
        <p className="font-bold text-blue-900 mb-1">🛡️ LOCAL PRIVACY SECURED</p>
        <p className="text-blue-800">
          Note: Although your browser may say "upload," your files <strong>never leave your computer</strong>. 
          This tool only reads the file names and paths locally to generate the report. 
        </p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        {...{ webkitdirectory: "", directory: "" } as any}
      />

      <div className="win95-bg p-4 retro-inset space-y-4">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
            <input 
              type="checkbox" 
              checked={fullFileNames} 
              onChange={(e) => setFullFileNames(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Full File Names?</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-bold text-sm">
            <input 
              type="checkbox" 
              checked={keepUnderscores} 
              onChange={(e) => setKeepUnderscores(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Keep Underscores (_)?</span>
          </label>
        </div>

        <div className="flex gap-2 flex-wrap">
          <RetroButton onClick={triggerPicker} active={loading}>
            {loading ? 'Processing...' : '🚀 Select Directory to Scan'}
          </RetroButton>
          
          {report.length > 0 && (
            <>
              <RetroButton onClick={handleAIProcess} active={aiLoading}>
                {aiLoading ? '🤖 Analyzing...' : '🤖 AI Organize & Inventory'}
              </RetroButton>
              <RetroButton onClick={copyToClipboard}>
                📋 Copy List
              </RetroButton>
              <RetroButton onClick={exportToWord}>
                💾 Export .DOCX
              </RetroButton>
            </>
          )}
        </div>
      </div>

      {aiResult && (
        <div className="mt-4 space-y-2">
          <div className="win95-bg p-1 retro-beveled text-[10px] font-bold px-2 flex justify-between">
            <span>AI ARCHIVIST OUTPUT - INVENTORY_ANALYSIS.LOG</span>
            <span>PROCESSED VIA GEMINI-3</span>
          </div>
          <div className="retro-inset p-4 bg-white font-mono text-xs whitespace-pre-wrap border-2 border-blue-900 shadow-inner max-h-[40vh] overflow-auto">
            {aiResult}
          </div>
        </div>
      )}

      {report.length > 0 && (
        <div className="mt-4 p-4 retro-inset bg-white min-h-[200px] font-mono text-sm overflow-auto max-h-[40vh]">
          <p className="text-blue-900 font-bold mb-4 border-b border-blue-900 pb-1 uppercase">
            LOCAL FOLDER SCAN - {new Date().toLocaleString()}
          </p>
          <div className="space-y-1">
            {report.map((item, idx) => (
              <div 
                key={idx} 
                style={{ marginLeft: `${item.level * 20}px` }}
                className={`${item.isDir ? 'font-bold text-gray-800' : 'text-gray-600'}`}
              >
                {item.isDir ? `📂 ${item.name}` : `• ${item.name}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.length === 0 && !loading && (
        <div className="text-center p-8 opacity-50 italic">
          No directory selected. Click the button above to start the local scan.
        </div>
      )}
    </div>
  );
};

export default ToolFileList;