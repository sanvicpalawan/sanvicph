'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { OnboardingOption, SiteCopy } from '@/lib/cms-types';

type Stage = OnboardingOption['stage'];
type Selection = { audience:string; choices:string[] };

export default function Onboarding({open,options,copy,onComplete,onDismiss}:{open:boolean;options:OnboardingOption[];copy:SiteCopy;onComplete:(route:string,selection:Selection)=>void;onDismiss:()=>void}){
  const [index,setIndex]=useState(0);
  const [audience,setAudience]=useState('');
  const [choices,setChoices]=useState<string[]>([]);
  const stages=useMemo(()=>{
    const ordered:Stage[]=['identity','mood','interest'];
    return ordered.filter(stage=>options.some(option=>option.stage===stage&&(option.audience==='all'||!audience||option.audience===audience)));
  },[options,audience]);
  const stage=stages[Math.min(index,Math.max(0,stages.length-1))]||'identity';
  const visible=options.filter(option=>option.stage===stage&&(option.audience==='all'||!audience||option.audience===audience));
  const selected=stage==='identity'?audience:choices;
  const heading=copy[`onboarding.${stage}.heading`]||({identity:'Are you visiting or do you live here?',mood:'What feels right today?',interest:'Where should we begin?'} as Record<Stage,string>)[stage];
  const body=copy[`onboarding.${stage}.body`]||({identity:'We’ll shape SANVIC around the way you know the coast.',mood:'Choose one or more. There is no wrong kind of day.',interest:'Pick a starting point and we’ll take you there.'} as Record<Stage,string>)[stage];
  const choose=(option:OnboardingOption)=>{
    if(stage==='identity'){setAudience(option.id);return;}
    if(stage==='mood'){setChoices(current=>current.includes(option.id)?current.filter(id=>id!==option.id):[...current,option.id]);return;}
    setChoices(current=>[...current.filter(id=>!visible.some(item=>item.id===id)),option.id]);
  };
  const canContinue=stage==='identity'?Boolean(audience):stage==='mood'?choices.some(id=>visible.some(option=>option.id===id)):choices.some(id=>visible.some(option=>option.id===id));
  const finish=()=>{
    const chosen=[...choices].reverse().map(id=>options.find(option=>option.id===id)).find(Boolean);
    onComplete(chosen?.route||'discover',{audience,choices});
  };
  return <Dialog open={open} onOpenChange={next=>{if(!next)onDismiss()}}><DialogContent className="onboarding-dialog translate-x-0 translate-y-0" showCloseButton={false}>
    <div className="onboarding-top"><img src="/sanvic-logo.png" alt="SANVIC" width="515" height="65"/><button type="button" onClick={onDismiss} aria-label={copy['onboarding.skip']||'Skip for now'}><X/></button></div>
    <div className="onboarding-progress" aria-label={`Step ${index+1} of ${stages.length}`}>{stages.map((item,step)=><span key={item} className={step<=index?'active':''}/>)}</div>
    <div className="onboarding-heading"><p className="eyebrow">{copy['onboarding.eyebrow']||'Welcome to San Vicente'}</p><DialogTitle>{heading}</DialogTitle><DialogDescription>{body}</DialogDescription></div>
    <div className={`onboarding-options onboarding-${stage}`}>{visible.map(option=>{const active=stage==='identity'?audience===option.id:choices.includes(option.id);return <button type="button" key={option.id} className={active?'selected':''} onClick={()=>choose(option)} aria-pressed={active}><img src={option.image||'/images/beach.webp'} alt=""/><span><strong>{option.title}</strong><small>{option.description}</small></span>{active&&<Check/>}</button>})}</div>
    <div className="onboarding-actions">{index>0?<button type="button" className="onboarding-back" onClick={()=>setIndex(value=>value-1)}><ArrowLeft/>{copy['onboarding.back']||'Back'}</button>:<button type="button" className="onboarding-skip" onClick={onDismiss}>{copy['onboarding.skip']||'Skip for now'}</button>}<button type="button" className="primary-button" disabled={!canContinue} onClick={()=>index<stages.length-1?setIndex(value=>value+1):finish()}>{index<stages.length-1?(copy['onboarding.next']||'Continue'):(copy['onboarding.finish']||'Show me San Vicente')}<ArrowRight/></button></div>
  </DialogContent></Dialog>;
}
