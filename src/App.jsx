import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { vocab } from './vocab.js'
import './App.css'

const CHAPTERS = ['All', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
const PIN_KEY = 'sf_pin'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function cardId(card) {
  return card.spanish + '|' + card.chapter
}

// PIN Screen
function PinScreen({ onAuth }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        localStorage.setItem(PIN_KEY, pin)
        onAuth(pin)
      } else {
        setError(true)
        setPin('')
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pin-screen">
      <div className="pin-card">
        <h1>Spanish Flashcards</h1>
        <p>Enter your PIN to continue</p>
        <form onSubmit={handleSubmit}>
          <input
            className={`pin-input${error ? ' pin-error' : ''}`}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(false) }}
            placeholder="••••••"
            autoFocus
          />
          {error && <div className="pin-error-msg">Incorrect PIN</div>}
          <button className="btn btn-primary" type="submit" disabled={!pin || loading}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function App() {
  const savedPin = localStorage.getItem(PIN_KEY)
  const [pin, setPin] = useState(savedPin)
  const [chapter, setChapter] = useState('All')
  const [deck, setDeck] = useState(() => shuffle(vocab))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [learnedIds, setLearnedIds] = useState(new Set())
  const [syncStatus, setSyncStatus] = useState('idle') // idle | saving | saved | error
  const saveTimer = useRef(null)
  const isFirstLoad = useRef(true)

  // Load learned state from server on auth
  useEffect(() => {
    if (!pin) return
    fetch('/api/learned', { headers: { Authorization: pin } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.learned) setLearnedIds(new Set(data.learned))
      })
      .catch(() => {})
  }, [pin])

  // Save learned state to server (debounced 1.5s)
  useEffect(() => {
    if (!pin) return
    if (isFirstLoad.current) { isFirstLoad.current = false; return }
    clearTimeout(saveTimer.current)
    setSyncStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/learned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: pin },
          body: JSON.stringify({ learned: [...learnedIds] }),
        })
        setSyncStatus(res.ok ? 'saved' : 'error')
      } catch {
        setSyncStatus('error')
      }
      setTimeout(() => setSyncStatus('idle'), 2000)
    }, 1500)
    return () => clearTimeout(saveTimer.current)
  }, [learnedIds, pin])

  const filtered = useMemo(() => {
    const base = chapter === 'All' ? vocab : vocab.filter(v => String(v.chapter) === chapter)
    return deck.filter(v => base.includes(v))
  }, [chapter, deck])

  const remaining = filtered.filter(card => !learnedIds.has(cardId(card)))
  const currentCard = remaining[Math.min(index, remaining.length - 1)] ?? null
  const isLearned = currentCard ? learnedIds.has(cardId(currentCard)) : false

  const handleShuffle = useCallback(() => {
    setDeck(shuffle(vocab)); setIndex(0); setFlipped(false)
  }, [])

  const handleReset = useCallback(() => {
    setDeck(shuffle(vocab)); setIndex(0); setFlipped(false); setLearnedIds(new Set())
    isFirstLoad.current = false
  }, [])

  const handleFlip = useCallback(() => setFlipped(f => !f), [])

  const handleChapter = useCallback((ch) => {
    setChapter(ch); setIndex(0); setFlipped(false)
  }, [])

  const handleNext = useCallback(() => {
    setFlipped(false)
    setTimeout(() => setIndex(i => Math.min(i + 1, remaining.length - 1)), 50)
  }, [remaining.length])

  const handleToggleLearned = useCallback(() => {
    if (!currentCard) return
    const id = cardId(currentCard)
    setLearnedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        setTimeout(() => {
          setFlipped(false)
          setIndex(i => Math.min(i, remaining.length - 2))
        }, 300)
      }
      return next
    })
  }, [currentCard, remaining.length])

  const handleUnlearn = useCallback((id) => {
    setLearnedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }, [])

  if (!pin) return <PinScreen onAuth={setPin} />

  const totalInChapter = filtered.length
  const learnedInChapter = filtered.filter(c => learnedIds.has(cardId(c))).length
  const progressPct = totalInChapter > 0 ? (learnedInChapter / totalInChapter) * 100 : 0
  const learnedCards = vocab.filter(c => learnedIds.has(cardId(c)))
  const safeIndex = Math.min(index, Math.max(remaining.length - 1, 0))

  return (
    <div className="app">
      <div className="header">
        <div className="header-row">
          <h1>Spanish Flashcards</h1>
          <div className={`sync-dot sync-${syncStatus}`} title={syncStatus} />
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="progress-text">{learnedInChapter} / {totalInChapter} learned</div>
      </div>

      <div className="filters">
        {CHAPTERS.map(ch => (
          <button
            key={ch}
            className={`filter-btn${chapter === ch ? ' active' : ''}`}
            onClick={() => handleChapter(ch)}
          >
            {ch === 'All' ? 'All' : `Ch ${ch}`}
          </button>
        ))}
      </div>

      <div className="controls">
        <button className="btn btn-primary" onClick={handleShuffle}>Shuffle</button>
        <button className="btn btn-secondary" onClick={handleReset}>Reset All</button>
      </div>

      <div className="card-area">
        {remaining.length === 0 ? (
          <div className="done-card">
            <h2>All done!</h2>
            <p>You've learned all {learnedInChapter} cards in this set.</p>
            <button className="btn btn-primary" onClick={handleReset}>Start Over</button>
          </div>
        ) : (
          <>
            <div className="card-counter">Card {safeIndex + 1} of {remaining.length} remaining</div>
            <div className={`flip-card${flipped ? ' flipped' : ''}`} onClick={handleFlip}>
              <div className="flip-card-inner">
                <div className="flip-card-front">
                  <div className="card-lang-label">Spanish</div>
                  <div className="card-word">{currentCard?.spanish}</div>
                  {currentCard?.partOfSpeech && <div className="card-pos">{currentCard.partOfSpeech}</div>}
                  <div className="card-hint">tap to flip</div>
                </div>
                <div className="flip-card-back">
                  <div className="card-lang-label">English</div>
                  <div className="card-word">{currentCard?.english}</div>
                  {currentCard?.example && <div className="card-example">{currentCard.example}</div>}
                </div>
              </div>
            </div>
            <div className="card-actions">
              <button className={`btn-learned${isLearned ? ' learned' : ''}`} onClick={handleToggleLearned}>
                {isLearned ? '✓ Learned' : 'Mark Learned'}
              </button>
              <button className="btn-next" onClick={handleNext}>Next →</button>
            </div>
          </>
        )}
      </div>

      {learnedCards.length > 0 && (
        <div className="learned-section">
          <h2>Learned ({learnedCards.length})</h2>
          <div className="learned-list">
            {learnedCards.map(card => (
              <span key={cardId(card)} className="learned-chip" onClick={() => handleUnlearn(cardId(card))} title="Tap to unlearn">
                {card.spanish}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

