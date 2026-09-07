"use client";

import { useRef, useState } from "react";
import { FileArchive, LoaderCircle, ShieldCheck, Upload } from "lucide-react";
import type { LocationImport } from "@/lib/cms-types";

type ImportResponse = { import: LocationImport; message: string };

export default function KmzImportPanel({ imports, reload, setMessage }: { imports:LocationImport[]; reload:()=>void|Promise<void>; setMessage:(message:string)=>void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file,setFile] = useState<File|null>(null);
  const [importing,setImporting] = useState(false);
  const [result,setResult] = useState<ImportResponse|null>(null);

  const upload = async () => {
    if (!file || importing) return;
    setImporting(true); setResult(null);
    try {
      const form = new FormData(); form.append("file",file);
      const response = await fetch("/api/admin/locations/import-kmz",{method:"POST",body:form});
      const body = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(body.error||"The KMZ import failed.");
      setResult(body); setMessage(body.message); setFile(null); if(inputRef.current)inputRef.current.value=""; await reload();
    } catch(error) { setMessage((error as Error).message); }
    finally { setImporting(false); }
  };

  const latest = result?.import || imports[0];
  return <section className="admin-panel kmz-panel">
    <div className="admin-panel-head"><div><p className="admin-kicker">Bulk location import</p><h2>Import a Google Earth KMZ</h2><p>Point locations are added as unchecked Drafts. Roads and boundaries are ignored.</p></div><span className="kmz-safety"><ShieldCheck/>Admin approval required</span></div>
    <div className="kmz-upload-row">
      <label className="kmz-file"><FileArchive/><span><strong>{file?file.name:"Choose a .kmz file"}</strong><small>Maximum 8 MB · nothing is published on upload</small></span><input ref={inputRef} type="file" accept=".kmz,application/vnd.google-earth.kmz" onChange={event=>setFile(event.target.files?.[0]||null)}/></label>
      <button className="admin-primary" disabled={!file||importing} onClick={upload}>{importing?<LoaderCircle className="spin"/>:<Upload/>}{importing?"Importing drafts…":"Import as Drafts"}</button>
    </div>
    {latest&&<div className="kmz-result" role="status"><div><strong>{latest.importedCount}</strong><span>Drafts added</span></div><div><strong>{latest.duplicateCount}</strong><span>Duplicates skipped</span></div><div><strong>{latest.ignoredCount}</strong><span>Roads/shapes ignored</span></div><div><strong>{latest.pointCount}</strong><span>Point locations found</span></div><p><FileArchive/>{latest.filename} · {new Date(latest.createdAt).toLocaleString()}</p></div>}
  </section>;
}
