function errCopy(e) {
  const c = e && e.code;
  const detail = e?.message ? ` (${e.message})` : "";
  return ({
    no_key: "Nenhuma chave cadastrada para esta IA. Abra \"Configurar IA\" e cole a chave.",
    bad_key: "A chave foi recusada. Confira em \"Configurar IA\" se ela foi colada inteira." + detail,
    bad_model: "Esse modelo não existe ou não está liberado para a sua chave" + detail + ". Escolha outro em \"Configurar IA\".",
    rate_limited: "Limite de uso da IA atingido (no Gemini grátis há um limite por minuto e por dia). Espere um pouco e tente de novo.",
    refused: "A IA recusou este ato. Reescreva a ação de outra forma.",
    invalid_json: "A IA respondeu fora do formato esperado. Tente de novo.",
    empty_completion: "A IA não devolveu texto. Tente de novo.",
    upstream_error: "O serviço da IA está sobrecarregado ou fora do ar. Tente de novo em instantes.",
    network: "Sem conexão com a IA. Confira a internet e tente de novo.",
  })[c] || ("A IA devolveu um erro: " + (e?.message || "desconhecido") + ".");
}

/* ---------------- storage (db privado do jogador, com reserva local) ---------------- */
const Store = {
  local: {
    list() { try { return JSON.parse(localStorage.getItem("faixa.games") || "[]"); } catch { return []; } },
    putList(l) { try { localStorage.setItem("faixa.games", JSON.stringify(l)); } catch {} },
    async listGames() { return this.list(); },
    async saveGame(g) { const l = this.list().filter(x => x.id !== g.id); l.unshift(g); this.putList(l); },
    async saveTurn(gid, t) { try { const k = "faixa.t." + gid; const a = JSON.parse(localStorage.getItem(k) || "[]").filter(x => x.n !== t.n); a.push(t); localStorage.setItem(k, JSON.stringify(a)); } catch {} },
    async loadTurns(gid) { try { return JSON.parse(localStorage.getItem("faixa.t." + gid) || "[]"); } catch { return []; } },
    async deleteGame(gid) { this.putList(this.list().filter(x => x.id !== gid)); try { localStorage.removeItem("faixa.t." + gid); } catch {} },
  },
  get impl() { return this.local; },
  async save(g, t) { await this.local.saveGame(g); if (t) await this.local.saveTurn(g.id, t); },
};

/* ---------------- IA: Gemini ou Claude, com a chave guardada só neste navegador ---------------- */
const CFG_KEY = "faixa.cfg";
const AI = {
  cfg: {provider: "gemini", gemKey: "", gemModel: "gemini-2.5-flash", claKey: "", claModel: "claude-opus-5-5"},
  load() { try { Object.assign(this.cfg, JSON.parse(localStorage.getItem(CFG_KEY) || "{}")); } catch {} },
  persist() { try { localStorage.setItem(CFG_KEY, JSON.stringify(this.cfg)); } catch {} },
  key(p = this.cfg.provider) { return p === "claude" ? this.cfg.claKey : this.cfg.gemKey; },
  model(p = this.cfg.provider) { return (p === "claude" ? this.cfg.claModel : this.cfg.gemModel).replace(/^models\//, "").trim(); },
  ready() { return !!this.key(); },
  label() { return (this.cfg.provider === "claude" ? "Claude" : "Gemini") + " · " + this.model(); },

  async sse(res, onEvent) {
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      buf += dec.decode(value, {stream: true});
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try { onEvent(JSON.parse(data)); } catch (e) { if (e && e.code) throw e; }
      }
    }
  },
  async httpError(res) {
    let msg = ""; try { const j = await res.json(); msg = j.error?.message || ""; } catch {}
    const code = res.status === 401 || res.status === 403 ? "bad_key"
      : res.status === 429 ? "rate_limited"
      : res.status === 404 ? "bad_model"
      : res.status === 400 && /api key|API_KEY/i.test(msg) ? "bad_key"
      : res.status >= 500 || res.status === 529 ? "upstream_error" : "http_error";
    return {code, message: msg || ("HTTP " + res.status)};
  },

  // Tenta chamar o Gemini com fallback automático caso o modelo retorne 404
  async fetchGemini(endpointSuffix, body, signal) {
    const key = this.key("gemini");
    const primary = this.model("gemini");
    const candidates = [...new Set([primary, "gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"])];
    let lastRes = null;
    for (const m of candidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}${endpointSuffix}${endpointSuffix.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {"content-type": "application/json", "x-goog-api-key": key},
        body: JSON.stringify(body),
        signal
      });
      if (res.ok) {
        if (m !== primary) { this.cfg.gemModel = m; this.persist(); }
        return res;
      }
      lastRes = res;
      if (res.status !== 404) break;
    }
    throw await this.httpError(lastRes);
  },

  async stream(prompt, {onText, signal, json = false} = {}) {
    const p = this.cfg.provider, key = this.key(p), model = this.model(p);
    if (!key) throw {code: "no_key"};
    let text = "", truncated = false, refused = false;
    const push = t => { if (!t) return; text += t; onText && onText({text}); };
    let res;
    try {
      if (p === "claude") {
        const fb = /^claude-(opus|sonnet)-5-5$/.test(model);
        const headers = {
          "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        };
        if (fb) headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
        const body = {model, max_tokens: 32000, stream: true, messages: [{role: "user", content: prompt}]};
        if (fb) body.fallbacks = "default";
        res = await fetch("https://api.anthropic.com/v1/messages", {method: "POST", headers, body: JSON.stringify(body), signal});
        if (!res.ok) throw await this.httpError(res);
        await this.sse(res, ev => {
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") push(ev.delta.text);
          else if (ev.type === "message_delta") {
            if (ev.delta?.stop_reason === "max_tokens") truncated = true;
            if (ev.delta?.stop_reason === "refusal") refused = true;
          } else if (ev.type === "error") throw {code: ev.error?.type === "overloaded_error" ? "upstream_error" : "http_error", message: ev.error?.message};
        });
      } else {
        const body = {contents: [{role: "user", parts: [{text: prompt}]}], generationConfig: {maxOutputTokens: 32000}};
        if (json) body.generationConfig.responseMimeType = "application/json";
        res = await this.fetchGemini(":streamGenerateContent?alt=sse", body, signal);
        await this.sse(res, ev => {
          const c = ev.candidates?.[0];
          (c?.content?.parts || []).forEach(pt => { if (!pt.thought) push(pt.text); });
          if (c?.finishReason === "MAX_TOKENS") truncated = true;
          if (["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION"].includes(c?.finishReason)) refused = true;
          if (ev.promptFeedback?.blockReason) refused = true;
        });
      }
    } catch (e) {
      if (e?.name === "AbortError" || signal?.aborted) throw {code: "cancelled", text};
      if (e?.code) throw {...e, text};
      throw {code: "network", message: String(e?.message || e), text};
    }
    if (refused && !text.trim()) throw {code: "refused"};
    if (!text.trim()) throw {code: "empty_completion"};
    return {text, truncated};
  },

  async json(prompt, opts = {}) {
    const p = this.cfg.provider, key = this.key(p);
    if (!key) throw {code: "no_key"};
    let text = "";
    if (p === "gemini") {
      try {
        const body = {
          contents: [{role: "user", parts: [{text: prompt}]}],
          generationConfig: {maxOutputTokens: 8192, responseMimeType: "application/json"}
        };
        const res = await this.fetchGemini(":generateContent", body, opts.signal);
        const data = await res.json();
        text = (data.candidates?.[0]?.content?.parts || []).filter(pt => !pt.thought).map(pt => pt.text || "").join("");
      } catch (e) {
        if (e?.name === "AbortError" || opts.signal?.aborted) throw {code: "cancelled"};
        if (e?.code) throw e;
        throw {code: "network", message: String(e?.message || e)};
      }
    } else {
      const r = await this.stream(prompt, {...opts, json: true});
      text = r.text;
    }
    const tryParse = s => { try { return JSON.parse(s); } catch { return undefined; } };
    let v = tryParse(text.trim());
    if (v === undefined) { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) v = tryParse(m[1]); }
    if (v === undefined) { const a = text.indexOf("{"), b = text.lastIndexOf("}"); if (a >= 0 && b > a) v = tryParse(text.slice(a, b + 1)); }
    if (v === undefined) throw {code: "invalid_json", text};
    return v;
  },

  async listModels(p, key) {
    if (p === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {headers: {
        "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true"}});
      if (!res.ok) throw await this.httpError(res);
      return (await res.json()).data.map(m => m.id);
    }
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, {headers: {"x-goog-api-key": key}});
    if (!res.ok) throw await this.httpError(res);
    return ((await res.json()).models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name))
      .map(m => m.name.replace(/^models\//, ""));
  },
};
AI.load();