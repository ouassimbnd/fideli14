"use client";

import { useState } from "react";

const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

export function ImpactCalculator() {
  const [clients, setClients] = useState(35);
  const [basket, setBasket] = useState(18);
  const [days, setDays] = useState(24);
  const [change, setChange] = useState(5);
  const base = clients * basket * days;
  const additional = base * change / 100;
  return <div className="impact-grid">
    <div className="impact-controls">
      <span className="kicker">SIMULATION LIBRE</span>
      <h3>Et si quelques clients revenaient plus souvent ?</h3>
      <p>Adaptez les chiffres à votre commerce. Le résultat est une simple simulation de chiffre d’affaires, sans garantie de résultat.</p>
      <label>Clients par jour <strong>{clients}</strong><input type="range" min="5" max="250" value={clients} onChange={e => setClients(Number(e.target.value))}/></label>
      <label>Panier moyen <strong>{money(basket)}</strong><input type="range" min="5" max="150" value={basket} onChange={e => setBasket(Number(e.target.value))}/></label>
      <label>Jours ouverts par mois <strong>{days}</strong><input type="range" min="5" max="31" value={days} onChange={e => setDays(Number(e.target.value))}/></label>
      <label>Hausse hypothétique des visites <strong>{change} %</strong><input type="range" min="0" max="20" value={change} onChange={e => setChange(Number(e.target.value))}/></label>
    </div>
    <div className="impact-result" aria-live="polite">
      <span className="kicker">VOTRE HYPOTHÈSE</span>
      <p>Chiffre d’affaires mensuel actuel estimé</p><strong>{money(base)}</strong>
      <div className="impact-divider"/>
      <p>Chiffre d’affaires supplémentaire simulé</p><div className="impact-number">+{money(additional)}<small>/ mois</small></div>
      <p className="impact-disclaimer">Calcul : clients par jour × panier moyen × jours ouverts × hausse choisie. Il ne tient pas compte des marges, des récompenses ni de l’abonnement.</p>
    </div>
  </div>;
}
