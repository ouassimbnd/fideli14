"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { configured, supabase, errorMessage } from "@/lib/supabase";
import { TrendChart, DowChart, Gauge } from "@/components/charts";

type Business = { id: string; name: string; slug: string };
type Point = { date: string; visits: number; members: number };
type TopMember = { name: string; points: number };
type Dow = { dow: number; visits: number };
type Analytics = {
  totalMembers: number;
  totalVisits: number;
  totalRedemptions: number;
  returningMembers: number;
  retentionRate: number;
  avgVisits: number;
  redemptionRate: number;
  series: Point[];
  topMembers: TopMember[];
  dayOfWeek: Dow[];
};

const DOW_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export default function BusinessAnalytics() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    try {
      const client = supabase();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) {
        location.replace("/business/login");
        return;
      }
      const { data: b, error } = await client.from("businesses").select("id,name,slug").eq("owner_id", user.id).maybeSingle();
      if (error) throw error;
      if (!b) {
        location.replace("/business/new");
        return;
      }
      setBusiness(b);
      const { data: analytics, error: analyticsError } = await client.rpc("business_analytics", { p_business: b.id });
      if (analyticsError) throw analyticsError;
      setData(analytics as Analytics);
      setLoading(false);
    } catch (error) {
      setMessage(errorMessage(error));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!configured) return <div className="container page"><h1>Configuration requise</h1><p>Ajoutez les variables Supabase pour accéder aux analyses.</p></div>;
  if (loading) return <div className="container page"><p>Chargement de vos analyses…</p></div>;
  if (!business || !data) return <div className="container page"><h1>Analyses</h1>{message && <p role="alert">{message}</p>}</div>;

  const labels = data.series.map((p) => {
    const d = new Date(p.date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  return (
    <div className="container page dashboard">
      <div className="dashboard-header">
        <div>
          <span className="kicker">ANALYSES · {business.name.toUpperCase()}</span>
          <h1>Ce qui fait revenir<br /><em>vos clients.</em></h1>
          <p>Une vue d’ensemble pensée pour décider vite : tendance, fidélisation et meilleurs clients.</p>
        </div>
        <div className="panel-actions">
          <Link className="button outline" href="/business">← Tableau de bord</Link>
          <button className="button outline" onClick={() => void load()}>Actualiser</button>
        </div>
      </div>

      <div className="analytics-kpis">
        <Gauge value={data.retentionRate} label="Clients fidélisés (2+ visites)" color="#6aaf59" />
        <Gauge value={data.redemptionRate} label="Visites converties en récompense" color="#dc8d67" />
        <div className="kpi-card">
          <span>VISITES MOYENNES</span>
          <strong>{data.avgVisits}</strong>
          <small>par client inscrit</small>
        </div>
        <div className="kpi-card">
          <span>CLIENTS ACTIFS</span>
          <strong>{data.returningMembers}</strong>
          <small>sur {data.totalMembers} inscrits au total</small>
        </div>
      </div>

      <div className="analytics-grid">
        <section className="panel chart-card">
          <span className="kicker">30 DERNIERS JOURS</span>
          <h2>Visites et nouvelles cartes</h2>
          <p>Repérez les pics de fréquentation et l’effet de vos campagnes ou de votre QR code en vitrine.</p>
          <TrendChart
            labels={labels}
            series={[
              { name: "Visites", color: "#6aaf59", values: data.series.map((p) => p.visits) },
              { name: "Nouveaux clients", color: "#dc8d67", values: data.series.map((p) => p.members) },
            ]}
          />
        </section>
        <section className="panel chart-card">
          <span className="kicker">RYTHME HEBDOMADAIRE</span>
          <h2>Vos meilleurs jours</h2>
          <p>Utile pour caler vos relances ou vos promotions ponctuelles sur les jours les plus calmes.</p>
          <DowChart color="#6aaf59" data={data.dayOfWeek.map((d) => ({ label: DOW_LABELS[d.dow], value: d.visits }))} />
        </section>
      </div>

      <section className="panel top-members-panel">
        <span className="kicker">CLASSEMENT</span>
        <h2>Vos 5 clients les plus fidèles</h2>
        {!data.topMembers.length ? (
          <p>Pas encore assez de données. Le classement apparaît dès les premières visites.</p>
        ) : (
          <div className="top-members-list">
            {data.topMembers.map((m, i) => {
              const max = data.topMembers[0]?.points || 1;
              return (
                <div className="top-member-row" key={m.name + i}>
                  <span className="top-rank">{i + 1}</span>
                  <span className="top-name">{m.name}</span>
                  <div className="top-bar-track"><div className="top-bar" style={{ width: `${Math.max(6, (m.points / max) * 100)}%` }} /></div>
                  <span className="top-points">{m.points} pts</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {message && <p role="status">{message}</p>}
      <p className="notice">Les analyses se recalculent à chaque chargement à partir de vos visites, points et récompenses réels dans Supabase.</p>
    </div>
  );
}
