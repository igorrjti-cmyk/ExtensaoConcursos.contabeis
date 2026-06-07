// API intermediária — o calendário chama esta rota, que chama o cron com o secret
// Assim o CRON_SECRET nunca fica exposto no JavaScript do cliente

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { simulacao } = await req.json().catch(() => ({ simulacao: true }));

  const baseUrl  = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const secret   = process.env.CRON_SECRET || "";
  const params   = simulacao ? "?test=1" : "";

  try {
    const res = await fetch(`${baseUrl}/api/cron/publicar-agendados${params}`, {
      headers: { "Authorization": `Bearer ${secret}` },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
