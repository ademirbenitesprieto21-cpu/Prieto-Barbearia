// Edge Function: enviar-notificacoes-agendamento
// Chamada pelo site (Agendamento Online) logo após salvar o agendamento no Supabase.
// Envia: (1) e-mail para a barbearia  (2) e-mail de confirmação para o cliente.
// Nunca deve travar o agendamento do cliente: qualquer erro aqui é só logado.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const BREVO_FROM_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") ?? "barbeariaprieto@gmail.com";
const BREVO_FROM_NOME = Deno.env.get("BREVO_FROM_NOME") ?? "Prieto Barbearia";
const EMAIL_BARBEARIA = Deno.env.get("EMAIL_BARBEARIA") ?? "barbeariaprieto@gmail.com";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://prieto-barbearia.vercel.app/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatarDataBR(dataISO: string): string {
  const [y, m, d] = dataISO.split("-");
  return `${d}/${m}/${y}`;
}

async function enviarEmail(to: string, subject: string, html: string) {
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY não configurada — e-mail não enviado:", subject, "para", to);
    return;
  }
  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: BREVO_FROM_NOME, email: BREVO_FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!resp.ok) {
      console.error("Falha ao enviar e-mail:", subject, "para", to, "-", await resp.text());
    }
  } catch (e) {
    console.error("Erro de rede ao enviar e-mail:", subject, "para", to, "-", e);
  }
}

function bloco(label: string, valor: string) {
  return `<tr><td style="padding:6px 0;color:#8b8b8b;font-size:13px;">${label}</td></tr>
          <tr><td style="padding:0 0 14px;color:#1c1c1e;font-size:15px;font-weight:600;">${valor}</td></tr>`;
}

function templateEmail(titulo: string, introHtml: string, linhasHtml: string, rodapeHtml: string) {
  return `
  <div style="background:#f4f3ef;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2ded3;">
      <div style="background:#0b0b0c;padding:22px 28px;">
        <div style="color:#c9a463;font-size:20px;font-weight:700;letter-spacing:.5px;">PRIETO BARBEARIA</div>
      </div>
      <div style="padding:28px;">
        <h2 style="margin:0 0 14px;color:#1c1c1e;font-size:19px;">${titulo}</h2>
        <p style="color:#4a4a4a;font-size:14.5px;line-height:1.5;margin:0 0 20px;">${introHtml}</p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;padding:10px 0;">
          ${linhasHtml}
        </table>
        <p style="color:#4a4a4a;font-size:14px;line-height:1.5;margin:20px 0 0;">${rodapeHtml}</p>
      </div>
    </div>
  </div>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      cliente_nome, cliente_email, cliente_telefone,
      barbeiro_nome, data, horario,
    } = body;

    if (!cliente_nome || !barbeiro_nome || !data || !horario) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataBR = formatarDataBR(data);

    // 1) e-mail para a barbearia
    const htmlBarbearia = templateEmail(
      "🔔 Novo Agendamento",
      "Um novo cliente acabou de realizar um agendamento na Prieto Barbearia.",
      bloco("👤 Cliente", cliente_nome) +
      bloco("💇 Barbeiro", barbeiro_nome) +
      bloco("📅 Data", dataBR) +
      bloco("🕒 Horário", horario) +
      bloco("📞 Telefone", cliente_telefone || "não informado") +
      bloco("📧 E-mail", cliente_email || "não informado"),
      `Acesse a Área Restrita para visualizar ou gerenciar este agendamento: <a href="${SITE_URL}">${SITE_URL}</a><br><br>Atenciosamente,<br>Sistema de Agendamento — Prieto Barbearia`
    );
    await enviarEmail(EMAIL_BARBEARIA, "🔔 Novo Agendamento - Prieto Barbearia", htmlBarbearia);

    // 2) e-mail de confirmação para o cliente
    if (cliente_email) {
      const htmlCliente = templateEmail(
        `Olá, ${cliente_nome}!`,
        "Seu agendamento foi confirmado com sucesso. Confira os dados do seu atendimento:",
        bloco("💇 Barbeiro", barbeiro_nome) +
        bloco("📅 Data", dataBR) +
        bloco("🕒 Horário", horario) +
        bloco("📞 Telefone informado", cliente_telefone || "não informado"),
        "Obrigado por escolher a Prieto Barbearia. Esperamos você no dia e horário agendados.<br><br>Caso precise alterar ou cancelar seu agendamento, entre em contato conosco.<br><br>Até breve!<br>Equipe Prieto Barbearia"
      );
      await enviarEmail(cliente_email, "✅ Agendamento Confirmado - Prieto Barbearia", htmlCliente);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro em enviar-notificacoes-agendamento:", e);
    // nunca retorna erro "duro" — o front-end ignora o resultado mesmo assim
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
