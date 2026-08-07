// Edge Function: lembretes-diarios
// Disparada automaticamente 1x por dia (via pg_cron ou cron externo — ver migracao_notificacoes_email.sql).
// Busca os agendamentos de HOJE que ainda não tiveram lembrete enviado e manda o e-mail.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // já disponível automaticamente nas Edge Functions
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const BREVO_FROM_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") ?? "barbeariaprieto@gmail.com";
const BREVO_FROM_NOME = Deno.env.get("BREVO_FROM_NOME") ?? "Prieto Barbearia";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function formatarDataBR(dataISO: string): string {
  const [y, m, d] = dataISO.split("-");
  return `${d}/${m}/${y}`;
}

function hojeISO(): string {
  // usa o fuso de Mato Grosso do Sul (UTC-4) para decidir o que é "hoje"
  const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Campo_Grande" }));
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function enviarEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY) { console.error("BREVO_API_KEY não configurada."); return false; }
  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        sender: { name: BREVO_FROM_NOME, email: BREVO_FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!resp.ok) { console.error("Falha ao enviar lembrete:", await resp.text()); return false; }
    return true;
  } catch (e) {
    console.error("Erro de rede ao enviar lembrete:", e);
    return false;
  }
}

function bloco(label: string, valor: string) {
  return `<tr><td style="padding:6px 0;color:#8b8b8b;font-size:13px;">${label}</td></tr>
          <tr><td style="padding:0 0 14px;color:#1c1c1e;font-size:15px;font-weight:600;">${valor}</td></tr>`;
}

function templateLembrete(cliente_nome: string, barbeiro_nome: string, dataBR: string, horario: string) {
  return `
  <div style="background:#f4f3ef;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2ded3;">
      <div style="background:#0b0b0c;padding:22px 28px;">
        <div style="color:#c9a463;font-size:20px;font-weight:700;letter-spacing:.5px;">PRIETO BARBEARIA</div>
      </div>
      <div style="padding:28px;">
        <h2 style="margin:0 0 14px;color:#1c1c1e;font-size:19px;">Olá, ${cliente_nome}!</h2>
        <p style="color:#4a4a4a;font-size:14.5px;line-height:1.5;margin:0 0 20px;">
          Passando para lembrar que seu atendimento na Prieto Barbearia está agendado para hoje.
        </p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;padding:10px 0;">
          ${bloco("💇 Barbeiro", barbeiro_nome)}
          ${bloco("📅 Data", dataBR)}
          ${bloco("🕒 Horário", horario)}
        </table>
        <p style="color:#4a4a4a;font-size:14px;line-height:1.5;margin:20px 0 0;">
          Estamos esperando por você.<br><br>Até mais!<br>Equipe Prieto Barbearia
        </p>
      </div>
    </div>
  </div>`;
}

serve(async (_req: Request) => {
  const hoje = hojeISO();
  let enviados = 0;
  let falhas = 0;

  try {
    const { data: agendamentosHoje, error } = await sb
      .from("agendamentos")
      .select("id, cliente_nome, cliente_email, horario, barbeiros(nome)")
      .eq("data", hoje)
      .eq("lembrete_enviado", false)
      .neq("status", "cancelado");

    if (error) throw error;

    for (const ag of agendamentosHoje ?? []) {
      if (!ag.cliente_email) { continue; } // sem e-mail, não tem para quem enviar

      const barbeiroNome = (ag as any).barbeiros?.nome ?? "";
      const html = templateLembrete(ag.cliente_nome, barbeiroNome, formatarDataBR(hoje), String(ag.horario).slice(0, 5));
      const ok = await enviarEmail(ag.cliente_email, "📅 Lembrete de Agendamento - Seu atendimento é hoje", html);

      if (ok) {
        enviados++;
        await sb.from("agendamentos").update({ lembrete_enviado: true }).eq("id", ag.id);
      } else {
        falhas++;
      }
    }
  } catch (e) {
    console.error("Erro em lembretes-diarios:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 200 });
  }

  return new Response(JSON.stringify({ ok: true, enviados, falhas }), {
    headers: { "Content-Type": "application/json" },
  });
});
