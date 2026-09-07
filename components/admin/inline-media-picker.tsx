"use client";

import { Download, FileVideo, LoaderCircle, Upload } from "lucide-react";
import { useState } from "react";
import type { MediaAsset } from "@/lib/cms-types";

export default function InlineMediaPicker({ media, selectedIds, onChange, reload, setMessage, label = "Photos & video" }: { media: MediaAsset[]; selectedIds: string[]; onChange: (ids: string[]) => void; reload: () => void | Promise<void>; setMessage: (message: string) => void; label?: string }) {
  const [uploading, setUploading] = useState(false);
  const active = media.filter((asset) => asset.status === "active");
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData(); form.append("file", file);
        const response = await fetch("/api/admin/media", { method: "POST", body: form }); const body = await response.json();
        if (!response.ok) throw new Error(body.error || `Could not upload ${file.name}`); uploaded.push(body.media.id);
      }
      onChange([...new Set([...selectedIds, ...uploaded])]); await reload(); setMessage(`${files.length} media file${files.length === 1 ? "" : "s"} uploaded and attached.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setUploading(false); }
  };
  return <section className="inline-media-picker">
    <div className="inline-media-title"><div><p className="admin-kicker">Media for this entry</p><h3>{label}</h3><span>Upload here, choose existing files, or download the original. Selected media appears on the public page.</span></div><label className="inline-upload"><input type="file" multiple accept="image/*,video/*" onChange={(event) => upload(event.target.files)}/>{uploading ? <LoaderCircle className="spin"/> : <Upload/>}{uploading ? "Uploading…" : "Upload from device"}</label></div>
    {active.length ? <div className="inline-media-grid">{active.map((asset) => {
      const selected = selectedIds.includes(asset.id);
      return <article key={asset.id} className={selected ? "selected" : ""}><label><input type="checkbox" checked={selected} onChange={(event) => onChange(event.target.checked ? [...selectedIds, asset.id] : selectedIds.filter((id) => id !== asset.id))}/>{asset.contentType.startsWith("video/") ? <div className="inline-video"><video src={asset.url} muted preload="metadata"/><FileVideo/></div> : <img src={asset.url} alt={asset.altText || ""}/>}<span>{asset.filename}</span></label><a href={asset.downloadUrl} aria-label={`Download ${asset.filename}`}><Download/>Download</a></article>;
    })}</div> : <p className="admin-empty">No media yet. Upload the first photo or video for this entry.</p>}
  </section>;
}

