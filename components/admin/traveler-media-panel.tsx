"use client";

import { useState } from "react";
import { Check, Save, Trash2, X } from "lucide-react";
import type { AdminTravelerUpload } from "@/lib/cms-types";

export default function TravelerMediaPanel({ rows, save, remove }: { rows:AdminTravelerUpload[]; save:(resource:string,record:Record<string,unknown>)=>Promise<void>; remove:(id:string)=>Promise<void> }) {
  const [captions,setCaptions]=useState<Record<string,string>>({});
  return <div className="admin-page"><div className="admin-toolbar"><p>Review photos shared by travelers. Edit captions, publish approved moments, reject them, or permanently delete them.</p></div><section className="admin-panel"><div className="admin-panel-head"><div><p className="admin-kicker">Community moderation</p><h2>Traveler photos · {rows.length}</h2></div></div>{rows.length?<div className="admin-media-grid">{rows.map(row=><article key={row.id}><img src={row.url} alt={row.caption||row.filename||"Traveler experience"}/><div><strong>{row.nickname} · {row.opportunityId}</strong><small><span className={`admin-status status-${row.status}`}>{row.status}</span></small><label><span>Caption</span><input value={captions[row.id]??row.caption} onChange={event=>setCaptions(current=>({...current,[row.id]:event.target.value}))}/></label><div className="admin-row-actions"><button onClick={()=>save("traveler_upload",{...row,caption:captions[row.id]??row.caption,status:"published"})}><Check/>Publish</button><button onClick={()=>save("traveler_upload",{...row,caption:captions[row.id]??row.caption,status:"pending"})}><Save/>Save</button><button onClick={()=>save("traveler_upload",{...row,caption:captions[row.id]??row.caption,status:"rejected"})}><X/>Reject</button><button className="danger" onClick={()=>remove(row.id)}><Trash2/>Delete</button></div></div></article>)}</div>:<p className="admin-empty">No traveler photos are waiting for review.</p>}</section></div>;
}
