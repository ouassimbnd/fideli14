import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PKPass } from "passkit-generator";
import path from "node:path";

export const runtime = "nodejs";

function walletCertificates() {
  const signerCert = process.env.APPLE_WALLET_SIGNER_CERT_BASE64;
  const signerKey = process.env.APPLE_WALLET_SIGNER_KEY_BASE64;
  const wwdr = process.env.APPLE_WALLET_WWDR_BASE64;
  const passTypeIdentifier = process.env.APPLE_WALLET_PASS_TYPE_IDENTIFIER;
  const teamIdentifier = process.env.APPLE_WALLET_TEAM_IDENTIFIER;
  if (!signerCert || !signerKey || !wwdr || !passTypeIdentifier || !teamIdentifier) return null;
  return {
    signerCert: Buffer.from(signerCert, "base64"),
    signerKey: Buffer.from(signerKey, "base64"),
    wwdr: Buffer.from(wwdr, "base64"),
    signerKeyPassphrase: process.env.APPLE_WALLET_KEY_PASSPHRASE || undefined,
    passTypeIdentifier,
    teamIdentifier,
  };
}

type MembershipRow = {
  id: string;
  program: {
    reward_name: string;
    required_visits: number;
    business: { name: string; slug: string };
  };
};

// Génère et sert le fichier .pkpass d'une carte cliente. Nécessite les certificats
// Apple Developer (voir README, section "Apple Wallet") : sans eux, renvoie 503
// plutôt que d'échouer silencieusement, pour rester clair côté interface.
export async function GET(request: NextRequest, context: { params: Promise<{ membership: string }> }) {
  const certificates = walletCertificates();
  if (!certificates) {
    return NextResponse.json({ error: "Apple Wallet n'est pas encore configuré pour ce commerce." }, { status: 503 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) return NextResponse.json({ error: "Configuration requise." }, { status: 503 });

  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const { membership } = await context.params;

  // Un client authentifié via son propre jeton : RLS et les RPC vérifient qu'il
  // s'agit bien de sa carte, exactement comme pour les appels faits côté navigateur.
  const scoped = createClient(url, publishable, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const [{ data: summary, error: summaryError }, { data: item, error: itemError }] = await Promise.all([
    scoped.rpc("customer_card_summary", { p_membership: membership }),
    scoped
      .from("memberships")
      .select("id,program:programs(reward_name,required_visits,business:businesses(name,slug))")
      .eq("id", membership)
      .maybeSingle(),
  ]);
  if (summaryError || itemError || !item) {
    return NextResponse.json({ error: "Carte introuvable ou accès refusé." }, { status: 404 });
  }

  const counts = summary as { visits: number; feedback: number; redeemed: number };
  const row = item as unknown as MembershipRow;
  const required = row.program.required_visits * 10;
  const points = Math.max(0, counts.visits * 10 + counts.feedback * 5 - counts.redeemed * required);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  try {
    const pass = await PKPass.from(
      {
        model: path.join(process.cwd(), "wallet", "fideli.pass"),
        certificates,
      },
      {
        serialNumber: row.id,
        description: `Carte de fidélité ${row.program.business.name}`,
        organizationName: row.program.business.name,
      },
    );
    pass.setBarcodes({
      message: `${siteUrl}/customer?membership=${row.id}`,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: row.program.business.name,
    });
    pass.headerFields.push({ key: "business", label: row.program.business.name.toUpperCase(), value: "" });
    pass.primaryFields.push({ key: "points", label: "POINTS", value: points });
    pass.secondaryFields.push({ key: "reward", label: "RÉCOMPENSE", value: row.program.reward_name });
    pass.auxiliaryFields.push({
      key: "progress",
      label: "PROGRESSION",
      value: `${Math.min(points, required)} / ${required}`,
    });

    const buffer = pass.getAsBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": pass.mimeType,
        "Content-Disposition": `attachment; filename="fideli-${row.program.business.slug}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Génération du pass impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
