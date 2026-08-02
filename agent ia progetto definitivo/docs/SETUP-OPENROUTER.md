# Tutorial: OpenRouter

OpenRouter è il gateway che ci dà **tutti** i modelli testuali con una chiave sola: GPT,
Claude, Gemini, Llama, Mistral, DeepSeek, Qwen, Grok, Perplexity. Invece di aprire dieci
account e gestire dieci fatture, ne apri uno.

Tempo richiesto: **10 minuti.**

---

## Passo 1 — Crea l'account

1. Vai su **[openrouter.ai](https://openrouter.ai)**
2. In alto a destra: **Sign in**
3. Accedi con Google o GitHub (è la via più rapida, niente password da inventare)

---

## Passo 2 — Carica il credito

OpenRouter funziona a consumo: paghi i token che usi, senza abbonamento fisso.

1. Vai su **[openrouter.ai/credits](https://openrouter.ai/credits)**
2. **Add credits**
3. Per iniziare bastano **10 €**. Con i modelli economici ci fai migliaia di messaggi di
   prova — non serve caricare di più adesso.

> **Consiglio:** attiva anche il limite di spesa nelle impostazioni dell'account. Così se
> qualcosa va in loop, il danno massimo è quello che hai caricato.

---

## Passo 3 — Genera la chiave

1. Vai su **[openrouter.ai/keys](https://openrouter.ai/keys)**
2. **Create Key**
3. Nome: `corpagent-dev` (così se un giorno la revochi sai quale stai revocando)
4. **Credit limit:** metti un tetto, per esempio 10. È una protezione in più.
5. **Create**

⚠️ **La chiave si vede una volta sola.** Non incollarla in una chat, in un file di testo o
nel codice. Va direttamente dove ti dico al Passo 5.

---

## Passo 4 — Controlla i modelli disponibili

Questo puoi farlo subito, senza chiave: apri nel browser

```
https://openrouter.ai/api/v1/models
```

Vedi un elenco enorme in formato JSON, con l'identificativo esatto di ogni modello (per
esempio `anthropic/claude-3.5-sonnet`) e il prezzo per milione di token.

**Perché conta:** gli identificativi cambiano spesso quando escono modelli nuovi. Per
questo in `src/data/models.ts` il campo `slug` è volutamente vuoto — lo leggiamo da questo
endpoint invece di scriverlo a memoria e ritrovarci con errori 404.

Guardando i prezzi qui capisci anche quali modelli usare per cosa:
- risposte veloci e ripetitive → i modelli "mini" o "flash", costano pochissimo
- ragionamenti complessi → i modelli grandi, costano 10-30 volte tanto

È esattamente la logica della **scelta automatica del modello** che dobbiamo costruire.

---

## Passo 5 — Dove va la chiave

**Non nel codice.** Una chiave nel frontend è visibile a chiunque apra il sito col tasto
destro → Ispeziona, e i bot che scansionano GitHub la trovano in pochi minuti.

La chiave va nel pannello di Supabase:

1. Progetto Supabase → **Project Settings**
2. **Edge Functions** → **Secrets** (o **Environment variables**)
3. **Add new secret**
   - Nome: `OPENROUTER_API_KEY`
   - Valore: la chiave
4. Salva

Da lì la legge solo il codice che gira sul server. Il browser non la vede mai.

---

## Come la useremo (per tua informazione)

L'API di OpenRouter è compatibile con quella di OpenAI, quindi il codice è semplice:

```
POST https://openrouter.ai/api/v1/chat/completions

Authorization: Bearer <OPENROUTER_API_KEY>
Content-Type: application/json

{
  "model": "anthropic/claude-3.5-sonnet",
  "messages": [
    { "role": "system", "content": "Sei l'Addetto Sala di un ristorante..." },
    { "role": "user", "content": "Avete posto per 4 stasera?" }
  ],
  "stream": true
}
```

`stream: true` fa arrivare la risposta parola per parola, come in ChatGPT, invece di far
aspettare l'utente davanti a uno schermo fermo.

Il campo `model` è quello che cambieremo in automatico in base a quanto è impegnativa la
richiesta: un "che orari fate?" non merita il modello da 20 volte tanto.

---

## Quando hai finito

Scrivimi **"OpenRouter fatto"** e passiamo al database.

Non serve che mi dica la chiave. Serve solo che sia dentro Supabase.
