import { existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

const root = process.cwd()

/**
 * Fa funzionare la cartella `/api` anche in locale.
 *
 * Su Vercel ogni file di `/api` diventa una funzione da sé. In locale `vite`
 * servirebbe solo la parte visibile, e la chat risponderebbe "404": questo
 * innesto instrada le chiamate `/api/...` agli stessi file, senza modificarli.
 *
 * Un comando solo — `npm run dev` — e funziona tutto, come dice CLAUDE.md.
 */
function apiRoutes(): Plugin {
  return {
    name: 'corpagent-api',

    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/'
        if (!url.startsWith('/api/')) return next()

        void handle(server, req, res, url).catch((error) => {
          server.config.logger.error(`[api] ${url}\n${String(error?.stack ?? error)}`)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
          }
          res.end(JSON.stringify({ error: String(error?.message ?? error) }))
        })
      })
    },
  }
}

/** Da `/api/chat` al file `api/chat.ts`, gestendo anche le cartelle jolly. */
function resolveHandlerFile(pathname: string): string | null {
  const clean = pathname.replace(/^\/api\//, '').replace(/\/+$/, '')
  if (clean === '') return null

  const direct = resolve(root, 'api', `${clean}.ts`)
  if (existsSync(direct)) return direct

  // Nessun file esatto: si risale cercando un `[...all].ts`, come fa Vercel.
  const parts = clean.split('/')
  while (parts.length > 0) {
    parts.pop()
    const candidate = resolve(root, 'api', ...parts, '[...all].ts')
    if (existsSync(candidate)) return candidate
  }
  return null
}

async function handle(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
): Promise<void> {
  const pathname = url.split('?')[0]
  const file = resolveHandlerFile(pathname)

  if (!file) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: `Nessuna funzione per ${pathname}` }))
    return
  }

  // Vite compila il TypeScript e risolve gli import: gli stessi file che
  // finiranno su Vercel, senza una riga di differenza.
  const module = (await server.ssrLoadModule(file)) as {
    default?: { fetch?: (request: Request) => Promise<Response> | Response }
  }
  const fetchHandler = module.default?.fetch
  if (typeof fetchHandler !== 'function') {
    throw new Error(`${file} non esporta \`export default { fetch }\``)
  }

  const response = await fetchHandler(toWebRequest(req, url))

  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))

  if (!response.body) {
    res.end()
    return
  }

  // Si scrive pezzo per pezzo: è quello che fa "scrivere" l'agente sotto gli
  // occhi dell'utente invece di farlo aspettare davanti a uno schermo fermo.
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(value)
  }
  res.end()
}

function toWebRequest(req: IncomingMessage, url: string): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else if (typeof value === 'string') headers.set(key, value)
  }

  const method = req.method ?? 'GET'
  const host = headers.get('host') ?? 'localhost:5173'
  const absolute = `http://${host}${url}`

  if (method === 'GET' || method === 'HEAD') {
    return new Request(absolute, { method, headers })
  }

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      req.on('data', (chunk) => controller.enqueue(chunk as Uint8Array))
      req.on('end', () => controller.close())
      req.on('error', (error) => controller.error(error))
    },
  })

  return new Request(absolute, {
    method,
    headers,
    body,
    // Richiesto dalle specifiche quando il corpo è uno stream.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Le variabili di .env.local devono arrivare al codice del backend, che le
  // legge da `process.env`. Il terzo argomento vuoto carica anche quelle senza
  // il prefisso VITE_ — che restano lato server e non finiscono nel browser.
  Object.assign(process.env, loadEnv(mode, root, ''))

  return {
    plugins: [react(), apiRoutes()],
  }
})
