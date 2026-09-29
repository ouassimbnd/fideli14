"use client";
import { useEffect,useState,type FormEvent } from "react";
import { configured,supabase,errorMessage } from "@/lib/supabase";
export default function NewBusiness(){
 const [name,setName]=useState("");const [slug,setSlug]=useState("");const [reward,setReward]=useState("");const [visits,setVisits]=useState(8);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 useEffect(()=>{if(!configured)return;void supabase().auth.getUser().then(({data})=>{if(!data.user)location.replace("/business/login");});},[]);
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setMessage("");try{const client=supabase();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error("Connectez-vous d’abord.");
 const {data:existing}=await client.from("businesses").select("id").eq("owner_id",user.id).maybeSingle();if(existing){location.assign("/business");return;}
 const {error}=await client.rpc("create_business",{p_name:name.trim(),p_slug:slug.trim().toLowerCase(),p_reward:reward.trim(),p_visits:visits});if(error)throw error;
 location.assign("/business");}catch(error){setMessage(errorMessage(error));}finally{setBusy(false);}};
 return <div className="container page narrow auth-card"><span className="kicker">CRÉER VOTRE PROGRAMME</span><h1>Votre commerce, votre carte.</h1><p>Choisissez le nom visible par vos clients et la récompense à atteindre.</p>{!configured?<p role="alert">Configurez Supabase avant de créer un programme.</p>:<form onSubmit={submit}><label>Nom du commerce<input required maxLength={80} value={name} onChange={e=>{setName(e.target.value);if(!slug)setSlug(e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""));}}/></label><label>Adresse de votre page (slug)<input required minLength={3} maxLength={50} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/></label><label>Récompense<input required maxLength={100} value={reward} onChange={e=>setReward(e.target.value)} placeholder="Ex. Un café offert"/></label><label>Nombre de visites nécessaires<input required type="number" min="1" max="100" value={visits} onChange={e=>setVisits(Number(e.target.value))}/></label><button className="button dark" disabled={busy}>Créer mon programme</button></form>}{message&&<p role="alert">{message}</p>}</div>;
}
