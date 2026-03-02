import React, { useState, useRef } from 'react';
import RetroButton from './RetroButton.tsx';
import { Document, Packer, Paragraph, Run, HeadingLevel } from 'docx';
import { ICONS } from '../src/icons.ts';

interface ScanItem {
  name: string;
  level: number;
  isDir: boolean;
  path: string; // Used for sorting and identification
}

const ToolFileList: React.FC = () => {
  const [report, setReport] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fullFileNames, setFullFileNames] = useState(false);
  const [keepUnderscores, setKeepUnderscores] = useState(false);
  const [ignoreDocuments, setIgnoreDocuments] = useState(true);
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
    const items: ScanItem[] = [];
    const seenDirs = new Set<string>();

    const fileArray = Array.from(files) as any[];
    
    fileArray.forEach(file => {
      const fullPath = file.webkitRelativePath || '';
      const parts = fullPath.split('/');
      
      // Ignore 'documents' folder if enabled
      if (ignoreDocuments && parts.some((part: string) => part === 'documents')) {
        return;
      }

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

  const triggerPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const copyToClipboard = () => {
    const milestones = Array.from(new Set(report.filter(item => item.isDir).map(item => item.name)));
    const milestoneText = milestones.length > 0 ? `Milestone items:\n${milestones.map(m => `• ${m}`).join("\n")}\n\n` : "";
    const treeText = report.map(item => "  ".repeat(item.level) + (item.isDir ? `[${item.name}]` : `• ${item.name}`)).join("\n");
    
    navigator.clipboard.writeText(milestoneText + treeText);
    alert("Report copied to clipboard!");
  };

  const exportToWord = async () => {
    try {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const milestones = Array.from(new Set(report.filter(item => item.isDir).map(item => item.name)));

      const children: any[] = [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
          children: [
            new Run({
              text: `Folder Scan Report - ${dateStr}`,
              color: "000000",
              font: "Calibri",
              size: 28, 
            })
          ],
        })
      ];

      if (milestones.length > 0) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
            children: [
              new Run({
                text: "Milestone items:",
                bold: true,
                font: "Calibri",
                size: 24,
              })
            ],
          })
        );
        milestones.forEach(m => {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              children: [
                new Run({
                  text: m,
                  font: "Cambria",
                  size: 22,
                })
              ],
            })
          );
        });
        children.push(new Paragraph({ spacing: { after: 200 } })); // Spacer
      }

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: [
            new Run({
              text: "Detailed Inventory:",
              bold: true,
              font: "Calibri",
              size: 24,
            })
          ],
        })
      );

      report.forEach(item => {
        children.push(
          new Paragraph({
            bullet: {
              level: item.level,
            },
            children: [
              new Run({
                text: item.name,
                font: "Cambria",
                size: 22,
              })
            ],
          })
        );
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: children
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
    <div className="p-4 space-y-4 font-serif text-black">
      <h2 className="text-2xl font-bold border-b-2 border-black mb-4 flex items-center gap-2 text-black">
        <img src={ICONS.FOLDER} alt="folder" className="w-6 h-6" />
        Files to Documents List
      </h2>

      {/* High Contrast Privacy Box - Sharp Black/White Contrast */}
      <div className="retro-inset bg-white p-4 mb-4 text-xs border-l-8 border-black shadow-sm">
        <p className="font-black text-black mb-1 uppercase tracking-tighter text-sm flex items-center gap-2">
          <img src={ICONS.SHIELD} alt="shield" className="w-4 h-4" />
          LOCAL PRIVACY PROTOCOL ACTIVE
        </p>
        <p className="text-black font-medium leading-relaxed">
          SECURITY ALERT: Although your browser uses the term "upload," your source files <strong>NEVER LEAVE YOUR LOCAL MACHINE</strong>. 
          The Produce-o-tron 3000 logic executes purely within your workstation's memory to generate this metadata inventory. 
        </p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        {...{ webkitdirectory: "", directory: "" } as any}
      />

      <div className="win95-bg p-6 retro-inset space-y-4 border-2 border-gray-400">
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-3 cursor-pointer font-black text-sm text-black group">
            <input 
              type="checkbox" 
              checked={fullFileNames} 
              onChange={(e) => setFullFileNames(e.target.checked)}
              className="w-5 h-5 accent-black border-2 border-black"
            />
            <span className="group-hover:underline uppercase tracking-tight">Full File Names (No Cleanup)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer font-black text-sm text-black group">
            <input 
              type="checkbox" 
              checked={keepUnderscores} 
              onChange={(e) => setKeepUnderscores(e.target.checked)}
              className="w-5 h-5 accent-black border-2 border-black"
            />
            <span className="group-hover:underline uppercase tracking-tight">Preserve Underscores (_)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer font-black text-sm text-black group">
            <input 
              type="checkbox" 
              checked={ignoreDocuments} 
              onChange={(e) => setIgnoreDocuments(e.target.checked)}
              className="w-5 h-5 accent-black border-2 border-black"
            />
            <span className="group-hover:underline uppercase tracking-tight">Ignore "documents" folder</span>
          </label>
        </div>

        <div className="flex gap-2 flex-wrap pt-2">
          <RetroButton onClick={triggerPicker} active={loading} className="text-black font-black bg-white hover:bg-gray-100">
            {loading ? 'ANALYZING DISK...' : (
              <span className="flex items-center gap-2">
                <img src={ICONS.ROCKET} alt="rocket" className="w-4 h-4" />
                SCAN LOCAL DIRECTORY
              </span>
            )}
          </RetroButton>
          
          {report.length > 0 && (
            <>
              <RetroButton onClick={copyToClipboard} className="text-black font-black">
                <img src={ICONS.DUPLICATE} alt="copy" className="w-4 h-4" />
                COPY TEXT
              </RetroButton>
              <RetroButton onClick={exportToWord} className="text-black font-black">
                <img src={ICONS.SAVE} alt="save" className="w-4 h-4" />
                EXPORT .DOCX
              </RetroButton>
            </>
          )}
        </div>
      </div>

      {report.length > 0 && (
        <div className="mt-6 p-6 retro-inset bg-white min-h-[300px] font-mono text-sm overflow-auto max-h-[50vh] border-2 border-black">
          <div className="text-black font-black mb-6 border-b-4 border-black pb-2 flex justify-between items-end uppercase">
            <span>Local Inventory Manifest</span>
            <span className="text-xs font-normal">TIMESTAMP: {new Date().toLocaleString()}</span>
          </div>

          {/* Milestone Items Section */}
          <div className="mb-8 p-4 bg-gray-50 border-2 border-black/10">
            <h3 className="text-black font-black uppercase text-sm mb-3 underline decoration-2 underline-offset-4">Milestone items:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              {Array.from(new Set(report.filter(item => item.isDir).map(item => item.name))).map((milestone, mIdx) => (
                <div key={mIdx} className="text-black font-bold text-xs flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-black rounded-full shrink-0" />
                  {milestone}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {report.map((item, idx) => (
              <div 
                key={idx} 
                style={{ marginLeft: `${item.level * 24}px` }}
                className={`${item.isDir ? 'font-black text-black text-base flex items-center gap-2' : 'text-black font-medium'}`}
              >
                {item.isDir ? (
                  <>
                    <img src={ICONS.FOLDER} alt="folder" className="w-4 h-4" />
                    {item.name.toUpperCase()}
                  </>
                ) : `• ${item.name}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.length === 0 && !loading && (
        <div className="text-center p-12 opacity-40 italic text-black font-bold uppercase tracking-widest">
          SYSTEM IDLE: PLEASE SELECT A DIRECTORY TO INVENTORY
        </div>
      )}
    </div>
  );
};

export default ToolFileList;