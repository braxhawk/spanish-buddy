export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { pin } = req.body ?? {}
  if (String(pin) === process.env.APP_PIN) {
    res.json({ ok: true })
  } else {
    res.status(401).json({ ok: false })
  }
}
