import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

const GENRES = {
  Racing: { icon: '🏎️', title: 'Racing Night', tagline: 'Ready, set, GO!' },
  Action: { icon: '⚔️', title: 'Action Night', tagline: 'Time to take the challenge.' },
  Adventure: { icon: '🗺️', title: 'Adventure Night', tagline: 'Your journey starts here.' },
  Horror: { icon: '👻', title: 'Horror Night', tagline: 'Are you brave enough?' },
  Strategy: { icon: '♟️', title: 'Strategy Night', tagline: 'Think smart. Play smarter.' },
}
const PLAYERS = ['1 Player', '2 Players', '3–4 Players', '5+ Players']
const DURATIONS = ['30 Minutes', '1 Hour', '2 Hours', 'All Night']
const LOAD_MS = 2000
const JOY = { R: 60, PY: 72, L: 54, MAX_TILT: 0.62 }

export default function App() {
  const [players, setPlayers] = useState('')
  const [genre, setGenre] = useState('')
  const [duration, setDuration] = useState('')
  const [errors, setErrors] = useState([])
  const [phase, setPhase] = useState('form') // form | loading | result
  const [progress, setProgress] = useState(0)

  // arcade interaction state
  const [joyActive, setJoyActive] = useState(false)
  const joyBox = useRef(null)
  const joyRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, dragging: false, raf: 0, last: 0 })
  const [pressed, setPressed] = useState([false, false, false])
  const [btn1Glow, setBtn1Glow] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const [burstKey, setBurstKey] = useState(0)

  const stickRef = useRef(null)
  const ballRef = useRef(null)
  const timers = useRef({})
  const loadTimer = useRef(null)

  const later = useCallback((name, fn, ms) => {
    clearTimeout(timers.current[name])
    timers.current[name] = setTimeout(fn, ms)
  }, [])

  useEffect(() => {
    const t = timers.current
    return () => {
      Object.values(t).forEach(clearTimeout)
      clearInterval(loadTimer.current)
      cancelAnimationFrame(joyRef.current.raf)
    }
  }, [])

  // ---- joystick 360° (drag ke arah mana pun, lepas = pegas kembali ke tengah) ----
  const renderJoy = (x, y) => {
    const mag = Math.min(1, Math.hypot(x, y))
    const theta = mag * JOY.MAX_TILT
    const phi = Math.atan2(y, x)
    const bx = JOY.L * Math.sin(theta) * Math.cos(phi)
    const by = -JOY.L * Math.cos(theta) + JOY.L * Math.sin(theta) * Math.sin(phi) * 0.55
    const len = Math.hypot(bx, by)
    const ang = (Math.atan2(bx, -by) * 180) / Math.PI
    const scale = 1 + y * 0.1 * mag
    if (stickRef.current) stickRef.current.style.transform = `rotate(${ang}deg) scaleY(${len / JOY.L})`
    if (ballRef.current) ballRef.current.style.transform = `translate(${bx}px, ${by}px) scale(${scale})`
  }

  const joyTick = (now) => {
    const s = joyRef.current
    const dt = Math.min(0.032, (now - s.last) / 1000)
    s.last = now
    if (s.dragging) {
      const k = 1 - Math.exp(-dt * 22)
      s.x += (s.tx - s.x) * k
      s.y += (s.ty - s.y) * k
      s.vx = s.vy = 0
    } else {
      s.vx += (-170 * s.x - 11 * s.vx) * dt
      s.vy += (-170 * s.y - 11 * s.vy) * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      if (Math.hypot(s.x, s.y) < 0.003 && Math.hypot(s.vx, s.vy) < 0.02) {
        s.x = s.y = s.vx = s.vy = 0
        renderJoy(0, 0)
        s.raf = 0
        setJoyActive(false)
        return
      }
    }
    renderJoy(s.x, s.y)
    s.raf = requestAnimationFrame(joyTick)
  }

  const joyStart = () => {
    const s = joyRef.current
    if (!s.raf) {
      s.last = performance.now()
      s.raf = requestAnimationFrame(joyTick)
    }
  }

  const joyAim = (e) => {
    const r = joyBox.current.getBoundingClientRect()
    const dx = (e.clientX - (r.left + r.width / 2)) / JOY.R
    const dy = (e.clientY - (r.top + JOY.PY)) / JOY.R
    const m = Math.hypot(dx, dy)
    const k = m > 1 ? 1 / m : 1
    joyRef.current.tx = dx * k
    joyRef.current.ty = dy * k
  }

  const joyDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    joyRef.current.dragging = true
    setJoyActive(true)
    joyAim(e)
    joyStart()
  }
  const joyMove = (e) => { if (joyRef.current.dragging) joyAim(e) }
  const joyRelease = () => {
    const s = joyRef.current
    s.dragging = false
    s.tx = s.ty = 0
    joyStart()
  }
  const joyKey = (e) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!dir) return
    e.preventDefault()
    const s = joyRef.current
    s.dragging = true
    s.tx = dir[0]
    s.ty = dir[1]
    setJoyActive(true)
    joyStart()
  }
  const joyKeyUp = (e) => { if (e.key.startsWith('Arrow')) joyRelease() }

  const pressButton = (i) => {
    setPressed((p) => p.map((v, k) => (k === i ? true : v)))
    later(`press${i}`, () => setPressed((p) => p.map((v, k) => (k === i ? false : v))), 220)
    if (i === 0) {
      setBtn1Glow(true)
      later('b1', () => setBtn1Glow(false), 900)
    }
    if (i === 1) {
      setSpeakerOn(false)
      requestAnimationFrame(() => setSpeakerOn(true))
      later('spk', () => setSpeakerOn(false), 1100)
    }
    if (i === 2) setFlashKey((k) => k + 1)
  }

  const startNight = () => {
    const missing = []
    if (!players) missing.push('players')
    if (!genre) missing.push('genre')
    if (!duration) missing.push('duration')
    setErrors(missing)
    if (missing.length) return

    setPhase('loading')
    setProgress(0)
    // joystick wiggle saat boot
    const js = joyRef.current
    js.dragging = true
    js.tx = 1
    js.ty = 0.3
    setJoyActive(true)
    joyStart()
    later('boot1', () => { js.tx = -1; js.ty = 0.3 }, 380)
    later('boot2', joyRelease, 780)
    const t0 = performance.now()
    clearInterval(loadTimer.current)
    loadTimer.current = setInterval(() => {
      const t = Math.min(1, (performance.now() - t0) / LOAD_MS)
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      setProgress(Math.min(99, Math.round(eased * 100)))
    }, 50)
    // selesai tepat 2 detik, apa pun kondisi frame rate-nya
    later('done', () => {
      clearInterval(loadTimer.current)
      setProgress(100)
      setPhase('result')
      setFlashKey((k) => k + 1)
      setBurstKey((k) => k + 1)
      setSpeakerOn(true)
      later('spk', () => setSpeakerOn(false), 1100)
    }, LOAD_MS)
  }

  const reset = () => {
    if (phase !== 'result') return
    // animasi penutup: koin keluar, layar mati seperti CRT, kartu memudar
    setPhase('closing')
    setSpeakerOn(true)
    later('spk', () => setSpeakerOn(false), 700)
    later('closeDone', () => {
      setPlayers('')
      setGenre('')
      setDuration('')
      setErrors([])
      setProgress(0)
      setPhase('form')
      setFlashKey((k) => k + 1) // layar menyala lagi
    }, 1000)
  }

  const result = GENRES[genre]
  const errMsg = errors.length
    ? `Please select ${errors.length === 3 ? 'players, genre and duration' : errors.join(' and ')} to continue.`
    : ''

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />

      <header className="header">
        <p className="status"><span className="status-dot" />GAME ROOM ONLINE</p>
        <h1>Choose Your <span className="glow-text">Game Night</span></h1>
        <p className="subtitle">Build your perfect gaming session.</p>
      </header>

      <main className="stage">
        {/* ARCADE */}
        <section className={`arcade ${phase === 'loading' ? 'running' : ''}`} aria-label="NEXUS arcade machine">
          <div className="arcade-top">
            <span className="arcade-label">◆ NEXUS</span>
            <span className="power-light" aria-hidden="true" />
          </div>

          <div className="screen">
            <div className="screen-ambient" />
            <div key={phase === 'closing' ? 'result' : phase} className={`screen-content ${phase === 'closing' ? 'crt-off' : ''}`}>
              {phase === 'form' && (
                <>
                  <div className="screen-n">N</div>
                  <div className="screen-title">NEXUS ARCADE</div>
                  <div className="screen-sub">SELECT YOUR SESSION</div>
                </>
              )}
              {phase === 'loading' && (
                <>
                  <div className="spinner" />
                  <div className="screen-sub">{loadingText(progress)}</div>
                  <div className="load-pct">{progress}%</div>
                  <div className="progress"><div className="progress-bar" style={{ transform: `scaleX(${progress / 100})` }} /></div>
                </>
              )}
              {(phase === 'result' || phase === 'closing') && result && (
                <>
                  <div className="result-icon">{result.icon}</div>
                  <div className="screen-title">{result.title}</div>
                  <div className="screen-sub tagline">{result.tagline}</div>
                </>
              )}
            </div>
            {phase === 'loading' && <div className="screen-beam" />}
            {phase === 'result' && burstKey > 0 && (
              <div key={burstKey} className="burst"><i /><i /><i /></div>
            )}
            {flashKey > 0 && <div key={flashKey} className="screen-flash" />}
            <div className="scanlines" />
          </div>

          <div className="controls">
            <button
              type="button"
              ref={joyBox}
              className={`joystick ${joyActive ? 'active' : ''}`}
              onPointerDown={joyDown}
              onPointerMove={joyMove}
              onPointerUp={joyRelease}
              onPointerCancel={joyRelease}
              onKeyDown={joyKey}
              onKeyUp={joyKeyUp}
              aria-label="Joystick — drag in any direction"
            >
              <span className="joy-base" />
              <span ref={stickRef} className="joy-stick" />
              <span ref={ballRef} className="joy-ball" style={{ transform: 'translate(0px, -54px)' }} />
            </button>

            <div className="buttons">
              {[0, 1, 2].map((i) => (
                <div className="btn-well" key={i}>
                  <button
                    type="button"
                    className={`arc-btn ${pressed[i] ? 'pressed' : ''} ${i === 0 && btn1Glow ? 'glow' : ''}`}
                    onClick={() => pressButton(i)}
                    aria-label={`Arcade button ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={`speaker ${speakerOn ? 'on' : ''}`} aria-hidden="true">
            {Array.from({ length: 30 }).map((_, i) => (
              <span key={i} style={{ '--i': i % 10, transitionDelay: `${(i % 10) * 25}ms` }} />
            ))}
          </div>

          <div className="coin-slot" aria-hidden="true">
            {(phase === 'loading' || phase === 'closing') && <i className={`coin ${phase === 'closing' ? 'eject' : ''}`} />}
            <span />
          </div>
        </section>

        {/* RIGHT CARD */}
        <section className="panel-wrap">
          {phase !== 'result' && phase !== 'closing' ? (
            <div className="panel" key="form">
              <p className="panel-eyebrow">GAME SESSION</p>
              <h2>CONFIGURE YOUR NIGHT</h2>

              <Field num="01" label="PLAYERS" value={players} onChange={setPlayers}
                placeholder="Select number of players" options={PLAYERS}
                invalid={errors.includes('players')} disabled={phase === 'loading'} />
              <Field num="02" label="GAME GENRE" value={genre} onChange={setGenre}
                placeholder="Select game genre" options={Object.keys(GENRES)}
                invalid={errors.includes('genre')} disabled={phase === 'loading'} />
              <Field num="03" label="DURATION" value={duration} onChange={setDuration}
                placeholder="Select gaming duration" options={DURATIONS}
                invalid={errors.includes('duration')} disabled={phase === 'loading'} />

              <p className={`error ${errMsg ? 'show' : ''}`} role="alert">{errMsg}</p>

              <button type="button" className="start-btn" onClick={startNight} disabled={phase === 'loading'}>
                {phase === 'loading' ? (<><span className="mini-spinner" />LOADING...</>) : 'START GAME NIGHT →'}
              </button>
            </div>
          ) : (
            <div className={`panel result-card ${phase === 'closing' ? 'leaving' : ''}`} key="result">
              <div className="result-head">
                <h2>YOUR GAME NIGHT</h2>
                <span className="ready"><span className="status-dot" />READY</span>
              </div>
              <div className="summary">
                <div><span>PLAYERS</span><strong>{players}</strong></div>
                <div><span>GENRE</span><strong>{genre}</strong></div>
                <div><span>DURATION</span><strong>{duration}</strong></div>
              </div>
              <p className="result-note">{result.icon} {result.title} — {result.tagline}</p>
              <button type="button" className="ghost-btn" onClick={reset} disabled={phase === 'closing'}>← CREATE ANOTHER SESSION</button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function loadingText(p) {
  if (p < 25) return 'INSERTING COIN...'
  if (p < 55) return 'SYNCING PLAYERS...'
  if (p < 85) return 'LOADING GAME DATA...'
  return 'ALMOST READY...'
}

function Field({ num, label, value, onChange, placeholder, options, invalid, disabled }) {
  const id = `f-${num}`
  return (
    <div className={`field ${invalid ? 'invalid' : ''}`}>
      <label htmlFor={id}><b>{num}</b>{label}</label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
