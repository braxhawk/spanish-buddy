import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

function isAuthed(req) {
  return req.headers.authorization === process.env.APP_PIN
}

export default async function handler(req, res) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const learned = (await redis.get('learned')) ?? []
    return res.json({ learned })
  }

  if (req.method === 'POST') {
    const { learned } = req.body ?? {}
    if (!Array.isArray(learned)) return res.status(400).json({ error: 'invalid' })
    await redis.set('learned', JSON.stringify(learned))
    return res.json({ ok: true })
  }

  res.status(405).end()
}
