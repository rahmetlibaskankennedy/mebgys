// supabase/functions/explain-answer/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Tarayıcının preflight isteğine cevap
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) Kullanıcının Supabase oturumunu doğrula (anonim istekleri engelle)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Giriş yapmalısın." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Oturum geçersiz." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) İstek gövdesini al
    const { prompt, options, correctAnswer, selectedAnswer } = await req.json();

    if (!prompt || !options || correctAnswer === undefined) {
      return new Response(JSON.stringify({ error: "Eksik veri." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Claude için "sadece verilen bilgiyle sınırlı kal" talimatı prompt
    const explainPrompt = `Sen bir MEB (Milli Eğitim Bakanlığı) personel sınavı hazırlık asistanısın.
Aşağıda bir çoktan seçmeli soru, seçenekleri ve doğru cevap var. Görevin, adayın neden yanlış seçeneği işaretlemiş olabileceğini ve doğru cevabın neden doğru olduğunu, KISA ve ANLAŞILIR şekilde açıklamak.

KURALLAR:
- Sadece aşağıda verilen soru ve seçeneklere dayan. Verilmeyen bir kanun maddesi numarası, tarih veya kaynak UYDURMA.
- Emin olmadığın bir detayı kesin bilgiymiş gibi sunma.
- Türkçe, sade, 3-5 cümle ile açıkla.
- SADECE DÜZ METİN yaz. Markdown kullanma: yıldız (**), tire madde işareti, başlık gibi hiçbir biçimlendirme ekleme.
- Sonunda madde numarası vermek istersen sadece genel bilgin kesinse ver, değilse hiç verme.

SORU: ${prompt}
SEÇENEKLER: ${options.map((o: string, i: number) => `${i + 1}) ${o}`).join(" | ")}
DOĞRU CEVAP: ${correctAnswer}
${selectedAnswer ? `ADAYIN İŞARETLEDİĞİ (YANLIŞ) CEVAP: ${selectedAnswer}` : ""}`;

    // 4) OpenAI Chat Completions API çağır
    const openaiApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const claudeResponse = await fetch("https://pixrouter.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey!}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        max_tokens: 600,
        temperature: 0.3,
        messages: [{ role: "user", content: explainPrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("OpenAI error:", errText);
      return new Response(JSON.stringify({ error: "Açıklama alınamadı, tekrar dene." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeResponse.json();
    const explanation =
      claudeData?.choices?.[0]?.message?.content?.trim() || "Açıklama üretilemedi.";

    return new Response(JSON.stringify({ explanation }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Beklenmeyen bir hata oluştu." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});