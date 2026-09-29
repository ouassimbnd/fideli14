import Link from "next/link";
export default function NotFound() { return <div className="container page narrow"><span className="kicker">PAGE INTROUVABLE</span><h1>Cette page n’existe pas<span className="brand-period">.</span></h1><p>Vérifiez le lien ou revenez à l’accueil.</p><Link className="button dark" href="/">Retour à l’accueil ↗</Link></div>; }
