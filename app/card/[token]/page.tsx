"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import {configured,supabase,errorMessage} from "@/lib/supabase";
export default function PhysicalCard(){const {token}=useParams<{token:string}>();const [slug,setSlug]=useState("");const [membership,setMembership]=useState("");const [merchant,setMerchant]=useState(false);const [message,setMessage]=useState("");
 useEffect(()=>{if(!configured)return;const run=async()=>{const client=supabase();const {data,error}=await client.rpc("card_destination",{p_token:token});if(error||!data){setMessage("Carte introuvable ou désactivée.");return;}setSlug(data);const {data:card}=await client.from("physical_cards").select("membership_id,business_id").eq("token",token).maybeSingle();if(card?.membership_id){setMembership(card.membership_id);const {data:{user}}=await client.auth.getUser();if(user){const {data:owner}=await client.from("businesses").select("id").eq("id",card.business_id).eq("owner_id",user.id).maybeSingle();setMerchant(Boolean(owner));}}};void run();},[token]);
 const visit=async()=>{const {error}=await supabase().rpc("record_visit",{p_membership:membership});setMessage(error?errorMessage(error):"Visite ajoutée au compte du client.");};
 return <div className="container page narrow"><span className="kicker">CARTE PHYSIQUE FIDELI</span><h1>Votre carte, votre fidélité.</h1>{message&&<p role="status">{message}</p>}{slug&&<><p>Vous êtes client ? Connectez cette carte à votre compte chez {slug}.</p><Link className="button dark" href={`/join/${slug}?card=${encodeURIComponent(token)}`}>Associer ma carte →</Link>{merchant&&membership&&<div className="scan-action"><p>Vous gérez cet établissement ? Connectez-vous à l’espace commerçant pour enregistrer la visite.</p><button className="button outline" onClick={visit}>Enregistrer la visite</button></div>}</>}</div>;
}
