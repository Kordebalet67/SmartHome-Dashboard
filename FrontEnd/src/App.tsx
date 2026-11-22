import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

/* ------------------------------------------------------------------ */
/*  Grid model                                                         */
/* ------------------------------------------------------------------ */

const COLS = 6
const ROW_H = 132
const GAP = 16
const IDLE_TIMEOUT = 60_000
const STARTUP_STAGGER = 240
const STARTUP_FLICKER_DURATION = 620

type Category = 'home' | 'balance' | 'currency' | 'weather' | 'subscriptions' | 'payments'

type TileState = {
  id: string
  category: Category
  w: number
  h: number
  minW: number
  minH: number
  maxW: number
  maxH: number
}

const CATEGORY_META: Record<Category, { label: string; accent: string; icon: string }> = {
  home: { label: 'Умный дом', accent: '#ffdb4d', icon: '🏠' },
  balance: { label: 'Счета и связь', accent: '#7b61ff', icon: '💳' },
  currency: { label: 'Курсы валют', accent: '#00c07f', icon: '💱' },
  weather: { label: 'Погода', accent: '#4d9cff', icon: '⛅' },
  subscriptions: { label: 'Подписки', accent: '#ff6b9d', icon: '🔁' },
  payments: { label: 'Платежи', accent: '#ff9f45', icon: '🧾' },
}

const DEFAULT_SIZE: Record<Category, { w: number; h: number }> = {
  home: { w: 4, h: 3 },
  balance: { w: 3, h: 2 },
  currency: { w: 3, h: 2 },
  weather: { w: 2, h: 3 },
  subscriptions: { w: 3, h: 3 },
  payments: { w: 4, h: 3 },
}

const SIZE_LIMITS: Record<Category, Pick<TileState, 'minW' | 'minH' | 'maxW' | 'maxH'>> = {
  home: { minW: 2, minH: 2, maxW: 6, maxH: 4 },
  balance: { minW: 2, minH: 2, maxW: 4, maxH: 4 },
  currency: { minW: 2, minH: 2, maxW: 4, maxH: 4 },
  weather: { minW: 2, minH: 2, maxW: 4, maxH: 4 },
  subscriptions: { minW: 2, minH: 2, maxW: 4, maxH: 5 },
  payments: { minW: 3, minH: 2, maxW: 6, maxH: 5 },
}

let uid = 0
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${uid++}`

function makeTile(category: Category): TileState {
  return { id: nextId(category), category, ...DEFAULT_SIZE[category], ...SIZE_LIMITS[category] }
}

/* ------------------------------------------------------------------ */
/*  Domain data + catalogs                                             */
/* ------------------------------------------------------------------ */

type DeviceKind = 'light' | 'thermostat' | 'socket' | 'lock' | 'humidifier' | 'blinds'
type Device = { id: string; name: string; room: string; kind: DeviceKind; on: boolean; value?: string }

const deviceIcon: Record<DeviceKind, string> = {
  light: '💡',
  thermostat: '🌡️',
  socket: '🔌',
  lock: '🔐',
  humidifier: '💧',
  blinds: '🪟',
}

const deviceCatalog: { kind: DeviceKind; name: string; room: string; value?: string }[] = [
  { kind: 'light', name: 'Свет', room: 'Комната', value: '100%' },
  { kind: 'thermostat', name: 'Термостат', room: 'Комната', value: '22°' },
  { kind: 'socket', name: 'Розетка', room: 'Комната' },
  { kind: 'lock', name: 'Замок', room: 'Дверь' },
  { kind: 'humidifier', name: 'Увлажнитель', room: 'Комната', value: '45%' },
  { kind: 'blinds', name: 'Шторы', room: 'Окно' },
]

const initialDevices: Device[] = [
  { id: nextId('d'), name: 'Люстра', room: 'Гостиная', kind: 'light', on: true, value: '80%' },
  { id: nextId('d'), name: 'Термостат', room: 'Спальня', kind: 'thermostat', on: true, value: '22°' },
  { id: nextId('d'), name: 'Розетка', room: 'Кухня', kind: 'socket', on: false },
  { id: nextId('d'), name: 'Замок', room: 'Прихожая', kind: 'lock', on: true },
  { id: nextId('d'), name: 'Увлажнитель', room: 'Детская', kind: 'humidifier', on: true, value: '45%' },
  { id: nextId('d'), name: 'Шторы', room: 'Кабинет', kind: 'blinds', on: false },
]

type Balance = { id: string; operator: string; kind: string; amount: number; detail: string; tint: string }

const balanceCatalog: Omit<Balance, 'id'>[] = [
  { operator: 'МТС', kind: 'Мобильная связь', amount: 312.5, detail: 'Тариф «Нетариф»', tint: '#ff3b30' },
  { operator: 'Билайн', kind: 'Мобильная связь', amount: 87.2, detail: '4 дня до списания', tint: '#111214' },
  { operator: 'Дом.ru', kind: 'Домашний интернет', amount: 640.0, detail: '500 Мбит/с', tint: '#7b61ff' },
  { operator: 'Мегафон', kind: 'Мобильная связь', amount: 205.0, detail: 'Безлимит', tint: '#00b956' },
  { operator: 'Tele2', kind: 'Мобильная связь', amount: 44.9, detail: 'Мой онлайн', tint: '#1a1a1a' },
  { operator: 'Ростелеком', kind: 'Домашний интернет', amount: 890.0, detail: '1 Гбит/с', tint: '#ff4f12' },
]

const initialBalances: Balance[] = balanceCatalog.slice(0, 3).map((b) => ({ ...b, id: nextId('b') }))

type Rate = { id: string; code: string; name: string; value: number; change: number; flag: string }

const rateCatalog: Omit<Rate, 'id'>[] = [
  { code: 'USD', name: 'Доллар США', value: 91.34, change: -0.42, flag: '🇺🇸' },
  { code: 'EUR', name: 'Евро', value: 99.18, change: 0.31, flag: '🇪🇺' },
  { code: 'CNY', name: 'Юань', value: 12.57, change: 0.08, flag: '🇨🇳' },
  { code: 'GBP', name: 'Фунт', value: 115.72, change: -0.19, flag: '🇬🇧' },
  { code: 'JPY', name: 'Иена (100)', value: 60.42, change: 0.12, flag: '🇯🇵' },
  { code: 'CHF', name: 'Франк', value: 103.5, change: -0.27, flag: '🇨🇭' },
  { code: 'KZT', name: 'Тенге (100)', value: 19.05, change: 0.03, flag: '🇰🇿' },
  { code: 'TRY', name: 'Лира', value: 2.71, change: -0.05, flag: '🇹🇷' },
]

const initialRates: Rate[] = rateCatalog.slice(0, 4).map((r) => ({ ...r, id: nextId('r') }))

type Weather = {
  id: string
  city: string
  temp: number
  cond: string
  icon: string
  high: number
  low: number
  hourly: { t: string; v: number }[]
}

function hourly(base: number): { t: string; v: number }[] {
  const labels = ['Сейчас', '15:00', '16:00', '17:00', '18:00', '19:00']
  const deltas = [0, 1, 2, 1, -1, -3]
  return labels.map((t, i) => ({ t, v: base + deltas[i] }))
}

const weatherCatalog: Omit<Weather, 'id' | 'hourly'>[] = [
  { city: 'Москва', temp: 18, cond: 'Переменная облачность', icon: '⛅', high: 21, low: 12 },
  { city: 'Санкт-Петербург', temp: 14, cond: 'Небольшой дождь', icon: '🌧️', high: 16, low: 10 },
  { city: 'Сочи', temp: 27, cond: 'Ясно', icon: '☀️', high: 29, low: 22 },
  { city: 'Казань', temp: 16, cond: 'Облачно', icon: '☁️', high: 18, low: 11 },
  { city: 'Екатеринбург', temp: 12, cond: 'Дождь', icon: '🌧️', high: 14, low: 8 },
  { city: 'Калининград', temp: 19, cond: 'Ветрено', icon: '🌬️', high: 20, low: 14 },
]

const initialWeather: Weather[] = weatherCatalog.slice(0, 3).map((w) => ({
  ...w,
  id: nextId('w'),
  hourly: hourly(w.temp),
}))

const CURRENCIES = ['₽', '$', '€', '¥', '₸']

type Subscription = { id: string; name: string; day: number; amount: number; currency: string }

const initialSubscriptions: Subscription[] = [
  { id: nextId('s'), name: 'Яндекс Плюс', day: 5, amount: 399, currency: '₽' },
  { id: nextId('s'), name: 'Spotify', day: 12, amount: 9.99, currency: '$' },
  { id: nextId('s'), name: 'iCloud+ 200 ГБ', day: 20, amount: 149, currency: '₽' },
]

type Payment = {
  id: string
  purpose: string
  day: number
  amount: number
  currency: string
  lastPaid: string | null
  fileName: string | null
}

const nowMonthPaid = () => new Date().toISOString()
const prevMonthPaid = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString()
}

const initialPayments: Payment[] = [
  { id: nextId('p'), purpose: 'Квартплата (ЖКХ)', day: 10, amount: 6200, currency: '₽', lastPaid: prevMonthPaid(), fileName: null },
  { id: nextId('p'), purpose: 'Интернет и ТВ', day: 15, amount: 640, currency: '₽', lastPaid: nowMonthPaid(), fileName: 'kvitanciya-avgust.pdf' },
  { id: nextId('p'), purpose: 'Детский сад', day: 25, amount: 4500, currency: '₽', lastPaid: null, fileName: null },
]

function paidThisMonth(p: Payment) {
  if (!p.lastPaid || !p.fileName) return false
  const d = new Date(p.lastPaid)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

/* ------------------------------------------------------------------ */
/*  Initial layout                                                     */
/* ------------------------------------------------------------------ */

const initialTiles: TileState[] = [
  makeTile('home'),
  makeTile('weather'),
  makeTile('currency'),
  makeTile('balance'),
]

/* ------------------------------------------------------------------ */
/*  App                                                                */
/* ------------------------------------------------------------------ */

export default function App() {
  const [dark, setDark] = useState(true)
  const [tiles, setTiles] = useState<TileState[]>(initialTiles)
  const [isIdle, setIsIdle] = useState(false)
  const [isStartingUp, setIsStartingUp] = useState(true)
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [balances, setBalances] = useState<Balance[]>(initialBalances)
  const [ratesList, setRatesList] = useState<Rate[]>(initialRates)
  const [weatherList, setWeatherList] = useState<Weather[]>(initialWeather)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initialSubscriptions)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)

  const [userName, setUserName] = useState('Алексей')
  const [homeName, setHomeName] = useState('Моя квартира')

  const [colWidth, setColWidth] = useState(160)
  const gridRef = useRef<HTMLDivElement>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startupDelays = useRef<Record<string, number> | null>(null)

  if (!startupDelays.current) {
    const shuffledIds = initialTiles
      .map((tile) => tile.id)
      .sort(() => Math.random() - 0.5)
    startupDelays.current = Object.fromEntries(
      shuffledIds.map((id, index) => [id, index * STARTUP_STAGGER]),
    )
  }

  const dragId = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const onDragStartTile = (id: string) => {
    dragId.current = id
    setDraggingId(id)
  }
  const onEnterTile = (id: string) => {
    const from = dragId.current
    if (!from || from === id) return
    setTiles((prev) => {
      const fromIdx = prev.findIndex((t) => t.id === from)
      const toIdx = prev.findIndex((t) => t.id === id)
      if (fromIdx < 0 || toIdx < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }
  const onDragEndTile = () => {
    dragId.current = null
    setDraggingId(null)
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  useEffect(() => {
    const lastDelay = Math.max(0, ...Object.values(startupDelays.current ?? {}))
    const timer = window.setTimeout(
      () => setIsStartingUp(false),
      lastDelay + STARTUP_FLICKER_DURATION,
    )
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const resetIdleTimer = () => {
      setIsIdle(false)
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => setIsIdle(true), IDLE_TIMEOUT)
    }

    const events: (keyof WindowEventMap)[] = [
      'pointermove',
      'pointerdown',
      'keydown',
      'wheel',
      'touchstart',
    ]

    resetIdleTimer()
    events.forEach((event) => window.addEventListener(event, resetIdleTimer, { passive: true }))

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetIdleTimer))
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
    }
  }, [])

  const measure = useCallback(() => {
    const el = gridRef.current
    if (!el) return
    setColWidth((el.clientWidth - GAP * (COLS - 1)) / COLS)
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const resize = (id: string, w: number, h: number) =>
    setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, w, h } : t)))
  const addTile = (c: Category) => setTiles((prev) => [...prev, makeTile(c)])
  const removeTile = (id: string) => setTiles((prev) => prev.filter((t) => t.id !== id))

  const activeCount = devices.filter((d) => d.on).length

  const handlers = {
    devices,
    balances,
    ratesList,
    weatherList,
    toggleDevice: (id: string) =>
      setDevices((p) => p.map((d) => (d.id === id ? { ...d, on: !d.on } : d))),
    addDevice: (kind: DeviceKind) => {
      const c = deviceCatalog.find((x) => x.kind === kind)!
      setDevices((p) => [...p, { ...c, id: nextId('d'), on: false }])
    },
    removeDevice: (id: string) => setDevices((p) => p.filter((d) => d.id !== id)),
    addBalance: (operator: string) => {
      const c = balanceCatalog.find((x) => x.operator === operator)!
      setBalances((p) => [...p, { ...c, id: nextId('b') }])
    },
    removeBalance: (id: string) => setBalances((p) => p.filter((b) => b.id !== id)),
    addRate: (code: string) => {
      const c = rateCatalog.find((x) => x.code === code)!
      setRatesList((p) => [...p, { ...c, id: nextId('r') }])
    },
    removeRate: (id: string) => setRatesList((p) => p.filter((r) => r.id !== id)),
    addCity: (city: string) => {
      const c = weatherCatalog.find((x) => x.city === city)!
      setWeatherList((p) => [...p, { ...c, id: nextId('w'), hourly: hourly(c.temp) }])
    },
    removeCity: (id: string) => setWeatherList((p) => p.filter((w) => w.id !== id)),
    subscriptions,
    payments,
    addSubscription: (s: Omit<Subscription, 'id'>) =>
      setSubscriptions((p) => [...p, { ...s, id: nextId('s') }]),
    removeSubscription: (id: string) => setSubscriptions((p) => p.filter((s) => s.id !== id)),
    addPayment: (pay: Omit<Payment, 'id' | 'lastPaid' | 'fileName'>) =>
      setPayments((p) => [...p, { ...pay, id: nextId('p'), lastPaid: null, fileName: null }]),
    removePayment: (id: string) => setPayments((p) => p.filter((x) => x.id !== id)),
    payPayment: (id: string, fileName: string) =>
      setPayments((p) =>
        p.map((x) => (x.id === id ? { ...x, fileName, lastPaid: new Date().toISOString() } : x)),
      ),
    clearPayment: (id: string) =>
      setPayments((p) => p.map((x) => (x.id === id ? { ...x, fileName: null, lastPaid: null } : x))),
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto max-w-[1360px] px-6 py-8 sm:px-10 sm:py-12">
        <Header
          activeCount={activeCount}
          dark={dark}
          onToggleTheme={() => setDark((d) => !d)}
          onAddTile={addTile}
          userName={userName}
          onUserName={setUserName}
          homeName={homeName}
          onHomeName={setHomeName}
        />

        <div
          ref={gridRef}
          className="mt-10 grid w-full"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            gridAutoRows: `${ROW_H}px`,
            gridAutoFlow: 'dense',
            gap: `${GAP}px`,
          }}
        >
          {tiles.map((tile) => (
            <Tile
              key={tile.id}
              tile={tile}
              colWidth={colWidth}
              isResizing={resizingId === tile.id}
              onResizeStart={() => setResizingId(tile.id)}
              onResizeEnd={() => setResizingId(null)}
              onResize={resize}
              onRemove={() => removeTile(tile.id)}
              dragging={draggingId === tile.id}
              onDragStartTile={onDragStartTile}
              onEnterTile={onEnterTile}
              onDragEndTile={onDragEndTile}
              idleBlurred={isIdle && tile.category !== 'weather' && tile.category !== 'currency'}
              startupDelay={isStartingUp ? startupDelays.current?.[tile.id] : undefined}
            >
              <TileBody tile={tile} h={handlers} />
            </Tile>
          ))}

          {tiles.length === 0 && (
            <div className="col-span-full grid place-items-center rounded-[28px] border border-dashed border-border py-16 text-sm text-muted-foreground">
              Нет плиток. Добавьте плитку кнопкой сверху.
            </div>
          )}
        </div>

        <p className="mt-8 text-center font-mono text-xs text-muted-foreground">
          Потяните за уголок, чтобы изменить размер · наведите на плитку для управления · сетка {COLS} колонок
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function Header({
  activeCount,
  dark,
  onToggleTheme,
  onAddTile,
  userName,
  onUserName,
  homeName,
  onHomeName,
}: {
  activeCount: number
  dark: boolean
  onToggleTheme: () => void
  onAddTile: (c: Category) => void
  userName: string
  onUserName: (v: string) => void
  homeName: string
  onHomeName: (v: string) => void
}) {
  const now = new Date()
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <header className="flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl text-lg" style={{ background: '#ffdb4d' }}>
            🏠
          </span>
          <EditableText
            value={homeName}
            onChange={onHomeName}
            placeholder="Название квартиры"
            className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground"
          />
        </div>
        <h1 className="mt-4 flex flex-wrap items-baseline gap-x-2 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl" style={{ fontFamily: 'var(--font-display)' }}>
          <span>Добрый день,</span>
          <EditableText value={userName} onChange={onUserName} placeholder="Имя" />
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground first-letter:uppercase">
          {date} · {activeCount} устройств активны
        </p>
      </div>

      <div className="flex flex-col items-end gap-4">
        <div className="font-mono text-4xl font-bold tabular-nums tracking-tight sm:text-5xl" style={{ fontFamily: 'var(--font-mono)' }}>
          {time}
        </div>
        <div className="flex items-center gap-2">
          <AddTileMenu onAddTile={onAddTile} />
          <button
            onClick={onToggleTheme}
            aria-label="Переключить тему"
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-lg transition-colors hover:bg-muted"
          >
            {dark ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
    </header>
  )
}

function AddTileMenu({ onAddTile }: { onAddTile: (c: Category) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-transform hover:scale-[1.02]"
        style={{ background: '#ffdb4d', color: '#1b1c1f', fontFamily: 'var(--font-display)' }}
      >
        <span className="text-base leading-none">＋</span> Добавить плитку
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.4)]">
          {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => {
                onAddTile(c)
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: CATEGORY_META[c].accent + '30' }}>
                {CATEGORY_META[c].icon}
              </span>
              <span className="font-medium">{CATEGORY_META[c].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tile shell + resize handle                                        */
/* ------------------------------------------------------------------ */

function Tile({
  tile,
  colWidth,
  isResizing,
  onResize,
  onResizeStart,
  onResizeEnd,
  onRemove,
  dragging,
  onDragStartTile,
  onEnterTile,
  onDragEndTile,
  idleBlurred,
  startupDelay,
  children,
}: {
  tile: TileState
  colWidth: number
  isResizing: boolean
  onResize: (id: string, w: number, h: number) => void
  onResizeStart: () => void
  onResizeEnd: () => void
  onRemove: () => void
  dragging: boolean
  onDragStartTile: (id: string) => void
  onEnterTile: (id: string) => void
  onDragEndTile: () => void
  idleBlurred: boolean
  startupDelay?: number
  children: ReactNode
}) {
  const start = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const [canDrag, setCanDrag] = useState(false)

  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY, w: tile.w, h: tile.h }
    onResizeStart()
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!start.current) return
    const dCols = Math.round((e.clientX - start.current.x) / (colWidth + GAP))
    const dRows = Math.round((e.clientY - start.current.y) / (ROW_H + GAP))
    const w = clamp(start.current.w + dCols, tile.minW, tile.maxW)
    const h = clamp(start.current.h + dRows, tile.minH, tile.maxH)
    if (w !== tile.w || h !== tile.h) onResize(tile.id, w, h)
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    start.current = null
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    onResizeEnd()
  }

  const meta = CATEGORY_META[tile.category]
  const style: CSSProperties = {
    gridColumn: `span ${tile.w}`,
    gridRow: `span ${tile.h}`,
    borderRadius: 'var(--radius)',
    transition: isResizing
      ? 'none'
      : 'box-shadow .25s ease, opacity .45s ease, filter .45s ease',
    opacity: dragging ? 0.4 : 1,
    animationDelay: startupDelay === undefined ? undefined : `${startupDelay}ms`,
  }

  return (
    <section
      draggable={canDrag}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStartTile(tile.id)
      }}
      onDragEnter={() => onEnterTile(tile.id)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={() => {
        setCanDrag(false)
        onDragEndTile()
      }}
      className={`group relative flex flex-col overflow-hidden border border-border bg-card shadow-[0_1px_2px_rgba(20,20,25,0.04)] hover:shadow-[0_12px_40px_-12px_rgba(20,20,25,0.28)] ${
        startupDelay !== undefined ? 'tile-startup-reveal' : ''
      } ${idleBlurred ? 'tile-idle-blurred' : ''}`}
      style={style}
    >
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <button
            aria-label="Переместить плитку"
            onPointerDown={() => setCanDrag(true)}
            onPointerUp={() => setCanDrag(false)}
            className="-ml-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4"><circle cx="9" cy="6" r="1.4" fill="currentColor" /><circle cx="15" cy="6" r="1.4" fill="currentColor" /><circle cx="9" cy="12" r="1.4" fill="currentColor" /><circle cx="15" cy="12" r="1.4" fill="currentColor" /><circle cx="9" cy="18" r="1.4" fill="currentColor" /><circle cx="15" cy="18" r="1.4" fill="currentColor" /></svg>
          </button>
          <span className="h-2 w-2 rounded-full" style={{ background: meta.accent }} />
          {meta.label}
        </span>
        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {tile.w}×{tile.h}
          </span>
          <button
            onClick={onRemove}
            aria-label="Удалить плитку"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-[#ff3b30]"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-5 pb-5 pt-3">{children}</div>

      <button
        aria-label="Изменить размер"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute bottom-1.5 right-1.5 h-6 w-6 cursor-nwse-resize touch-none rounded-md opacity-0 transition-opacity focus:opacity-100 focus:outline-none group-hover:opacity-100"
        style={{ touchAction: 'none' }}
      >
        <svg viewBox="0 0 24 24" className="h-full w-full text-muted-foreground">
          <path d="M20 8 L8 20 M20 14 L14 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
      </button>
    </section>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/* ------------------------------------------------------------------ */
/*  Shared: outside-click + AddButton popover                         */
/* ------------------------------------------------------------------ */

function useOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, cb])
}

function EditableText({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    onChange(draft.trim() || value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        placeholder={placeholder}
        className={`w-[min(100%,16ch)] max-w-full rounded-lg border-b-2 border-[#ffdb4d] bg-transparent px-1 outline-none ${className ?? ''}`}
        style={{ font: 'inherit', color: 'inherit' }}
      />
    )
  }

  return (
    <button
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={`group/edit inline-flex items-center gap-1.5 rounded-lg px-1 text-left transition-colors hover:bg-muted ${className ?? ''}`}
    >
      <span>{value || placeholder}</span>
      <svg viewBox="0 0 24 24" className="h-[0.7em] w-[0.7em] shrink-0 opacity-0 transition-opacity group-hover/edit:opacity-60">
        <path d="M4 20h4L18 10l-4-4L4 16v4zM14 6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </button>
  )
}

function AddButton({
  label,
  options,
  onPick,
}: {
  label: string
  options: { value: string; label: string; icon?: string }[]
  onPick: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={options.length === 0}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-[#ffdb4d] hover:text-foreground disabled:opacity-40"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <span className="text-sm leading-none">＋</span> {label}
      </button>
      {open && options.length > 0 && (
        <div className="absolute bottom-11 left-0 z-30 max-h-52 w-full min-w-44 overflow-auto rounded-2xl border border-border bg-card p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)]">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onPick(o.value)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              {o.icon && <span>{o.icon}</span>}
              <span className="truncate font-medium">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DeleteDot({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Удалить"
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-[#ff3b30] group-hover/item:opacity-100"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Tile bodies                                                        */
/* ------------------------------------------------------------------ */

type Handlers = {
  devices: Device[]
  balances: Balance[]
  ratesList: Rate[]
  weatherList: Weather[]
  toggleDevice: (id: string) => void
  addDevice: (k: DeviceKind) => void
  removeDevice: (id: string) => void
  addBalance: (op: string) => void
  removeBalance: (id: string) => void
  addRate: (code: string) => void
  removeRate: (id: string) => void
  addCity: (city: string) => void
  removeCity: (id: string) => void
  subscriptions: Subscription[]
  payments: Payment[]
  addSubscription: (s: Omit<Subscription, 'id'>) => void
  removeSubscription: (id: string) => void
  addPayment: (p: Omit<Payment, 'id' | 'lastPaid' | 'fileName'>) => void
  removePayment: (id: string) => void
  payPayment: (id: string, fileName: string) => void
  clearPayment: (id: string) => void
}

function TileBody({ tile, h }: { tile: TileState; h: Handlers }) {
  switch (tile.category) {
    case 'home':
      return <HomeBody tile={tile} h={h} />
    case 'balance':
      return <BalanceBody h={h} />
    case 'currency':
      return <CurrencyBody h={h} />
    case 'weather':
      return <WeatherBody h={h} />
    case 'subscriptions':
      return <SubscriptionsBody h={h} />
    case 'payments':
      return <PaymentsBody h={h} />
  }
}

function HomeBody({ tile, h }: { tile: TileState; h: Handlers }) {
  const cols = tile.w >= 4 ? 3 : tile.w >= 3 ? 2 : 1
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div
        className="grid min-h-0 flex-1 content-start gap-2.5 overflow-auto"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {h.devices.map((d) => (
          <div
            key={d.id}
            className="group/item flex items-center gap-3 rounded-2xl border border-border p-3 text-left"
            style={{ background: d.on ? 'var(--on-surface)' : 'var(--muted)' }}
          >
            <button
              onClick={() => h.toggleDevice(d.id)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
              style={{ background: d.on ? '#ffdb4d' : 'var(--card)', filter: d.on ? 'none' : 'grayscale(1) opacity(.7)' }}
            >
              {deviceIcon[d.kind]}
            </button>
            <button onClick={() => h.toggleDevice(d.id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{d.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{d.value ? `${d.room} · ${d.value}` : d.room}</span>
            </button>
            <DeleteDot onClick={() => h.removeDevice(d.id)} />
          </div>
        ))}
        {h.devices.length === 0 && (
          <div className="col-span-full py-4 text-center text-xs text-muted-foreground">Нет устройств</div>
        )}
      </div>
      <AddButton
        label="Устройство"
        options={deviceCatalog.map((c) => ({ value: c.kind, label: c.name, icon: deviceIcon[c.kind] }))}
        onPick={(v) => h.addDevice(v as DeviceKind)}
      />
    </div>
  )
}

function BalanceBody({ h }: { h: Handlers }) {
  const used = new Set(h.balances.map((b) => b.operator))
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto">
        {h.balances.map((b) => (
          <div key={b.id} className="group/item flex items-center gap-3 rounded-2xl border border-border p-3" style={{ background: 'var(--muted)' }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold text-white" style={{ background: b.tint, fontFamily: 'var(--font-display)' }}>
              {b.operator.slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{b.operator}</div>
              <div className="truncate text-xs text-muted-foreground">{b.detail}</div>
            </div>
            <div className="font-mono text-base font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: b.amount < 100 ? '#ff3b30' : undefined }}>
              {b.amount.toFixed(2)}₽
            </div>
            <DeleteDot onClick={() => h.removeBalance(b.id)} />
          </div>
        ))}
        {h.balances.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">Нет счетов</div>}
      </div>
      <AddButton
        label="Оператор"
        options={balanceCatalog.filter((c) => !used.has(c.operator)).map((c) => ({ value: c.operator, label: c.operator }))}
        onPick={h.addBalance}
      />
    </div>
  )
}

function CurrencyBody({ h }: { h: Handlers }) {
  const used = new Set(h.ratesList.map((r) => r.code))
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {h.ratesList.map((r) => {
          const up = r.change >= 0
          return (
            <div key={r.id} className="group/item flex items-center gap-3 border-b border-border py-2.5 last:border-0">
              <span className="text-xl">{r.flag}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{r.code}</div>
                <div className="truncate text-xs text-muted-foreground">{r.name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-base font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{r.value.toFixed(2)} ₽</div>
                <div className="font-mono text-xs font-medium tabular-nums" style={{ color: up ? '#00a86b' : '#ff3b30' }}>
                  {up ? '▲' : '▼'} {Math.abs(r.change).toFixed(2)}
                </div>
              </div>
              <DeleteDot onClick={() => h.removeRate(r.id)} />
            </div>
          )
        })}
        {h.ratesList.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">Нет валют</div>}
      </div>
      <AddButton
        label="Валюта"
        options={rateCatalog.filter((c) => !used.has(c.code)).map((c) => ({ value: c.code, label: `${c.flag} ${c.code} — ${c.name}` }))}
        onPick={h.addRate}
      />
    </div>
  )
}

function WeatherBody({ h }: { h: Handlers }) {
  const [active, setActive] = useState(0)
  const list = h.weatherList
  const used = new Set(list.map((w) => w.city))
  const idx = Math.min(active, Math.max(0, list.length - 1))
  const w = list[idx]

  if (!w) {
    return (
      <div className="flex h-full flex-col justify-between gap-2">
        <div className="grid flex-1 place-items-center text-xs text-muted-foreground">Нет городов</div>
        <AddButton label="Город" options={weatherCatalog.map((c) => ({ value: c.city, label: c.city, icon: c.icon }))} onPick={h.addCity} />
      </div>
    )
  }

  const max = Math.max(...w.hourly.map((x) => x.v))
  const min = Math.min(...w.hourly.map((x) => x.v))

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1.5">
        {list.map((c, i) => (
          <span
            key={c.id}
            className="group/tab flex items-center rounded-full transition-colors"
            style={{ background: i === idx ? '#1b1c1f' : 'var(--muted)' }}
          >
            <button
              onClick={() => setActive(i)}
              className="py-1 pl-2.5 font-mono text-[10px] uppercase tracking-wide"
              style={{ color: i === idx ? '#fff' : 'var(--muted-foreground)' }}
            >
              {c.city.split('-')[0].slice(0, 4)}
            </button>
            <button
              onClick={() => h.removeCity(c.id)}
              aria-label="Удалить город"
              className="px-1.5 text-[10px] leading-none"
              style={{ color: i === idx ? 'rgba(255,255,255,.6)' : 'var(--muted-foreground)' }}
            >
              ✕
            </button>
          </span>
        ))}
        <AddCityInline used={used} onAdd={h.addCity} />
      </div>

      <div className="mt-3 flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{w.city}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{w.cond}</div>
        </div>
        <span className="text-3xl leading-none">{w.icon}</span>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-5xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{w.temp}°</span>
        <span className="font-mono text-xs text-muted-foreground">↑{w.high}° ↓{w.low}°</span>
      </div>

      <div className="mt-auto flex items-end justify-between gap-1.5 pt-3">
        {w.hourly.map((x) => {
          const pct = max === min ? 0.5 : (x.v - min) / (max - min)
          return (
            <div key={x.t} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{x.v}°</span>
              <span className="w-full rounded-full" style={{ height: `${8 + pct * 30}px`, background: '#4d9cff', opacity: 0.35 + pct * 0.5 }} />
              <span className="font-mono text-[9px] text-muted-foreground">{x.t.replace(':00', '')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Subscriptions & Payments                                          */
/* ------------------------------------------------------------------ */

const inputCls =
  'w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none transition-colors focus:border-[#ffdb4d]'

type RowDraft = { name: string; day: string; amount: string; currency: string }

function RowForm({
  nameLabel,
  namePlaceholder,
  dayLabel,
  accent,
  onSave,
}: {
  nameLabel: string
  namePlaceholder: string
  dayLabel: string
  accent: string
  onSave: (d: { name: string; day: number; amount: number; currency: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [d, setD] = useState<RowDraft>({ name: '', day: '1', amount: '', currency: '₽' })

  const reset = () => setD({ name: '', day: '1', amount: '', currency: '₽' })
  const day = clamp(parseInt(d.day, 10) || 1, 1, 31)
  const amount = parseFloat(d.amount.replace(',', '.'))
  const valid = d.name.trim().length > 0 && amount > 0

  const save = () => {
    if (!valid) return
    onSave({ name: d.name.trim(), day, amount, currency: d.currency })
    reset()
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-[#ffdb4d] hover:text-foreground"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <span className="text-sm leading-none">＋</span> {nameLabel}
      </button>
    )
  }

  return (
    <div className="shrink-0 rounded-2xl border border-border p-3" style={{ background: 'var(--muted)' }}>
      <input
        autoFocus
        value={d.name}
        onChange={(e) => setD({ ...d, name: e.target.value })}
        placeholder={namePlaceholder}
        className={inputCls}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{dayLabel}</span>
          <input
            type="number"
            min={1}
            max={31}
            value={d.day}
            onChange={(e) => setD({ ...d, day: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Сумма</span>
          <input
            inputMode="decimal"
            value={d.amount}
            onChange={(e) => setD({ ...d, amount: e.target.value })}
            placeholder="0"
            className={inputCls}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Валюта</span>
          <select
            value={d.currency}
            onChange={(e) => setD({ ...d, currency: e.target.value })}
            className={`${inputCls} appearance-none pr-2`}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={!valid}
          className="flex-1 rounded-xl py-2 text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: accent, color: '#1b1c1f', fontFamily: 'var(--font-display)' }}
        >
          Сохранить
        </button>
        <button
          onClick={() => {
            reset()
            setOpen(false)
          }}
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-card"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function SubscriptionsBody({ h }: { h: Handlers }) {
  const total = h.subscriptions.reduce((sum, s) => sum + (s.currency === '₽' ? s.amount : 0), 0)
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
        {h.subscriptions.map((s) => (
          <div key={s.id} className="group/item flex items-center gap-3 rounded-2xl border border-border p-3" style={{ background: 'var(--muted)' }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold" style={{ background: '#ff6b9d22', color: '#ff6b9d', fontFamily: 'var(--font-display)' }}>
              {s.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{s.name}</div>
              <div className="truncate text-xs text-muted-foreground">Списание {s.day} числа</div>
            </div>
            <div className="font-mono text-base font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
              {s.amount.toFixed(2)} {s.currency}
            </div>
            <DeleteDot onClick={() => h.removeSubscription(s.id)} />
          </div>
        ))}
        {h.subscriptions.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">Нет подписок</div>}
      </div>
      {total > 0 && (
        <div className="flex shrink-0 items-center justify-between px-1 text-xs">
          <span className="text-muted-foreground">В месяц (₽)</span>
          <span className="font-mono font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{total.toFixed(2)} ₽</span>
        </div>
      )}
      <RowForm
        nameLabel="Подписка"
        namePlaceholder="Название подписки"
        dayLabel="День списания"
        accent="#ff6b9d"
        onSave={h.addSubscription}
      />
    </div>
  )
}

function PaymentsBody({ h }: { h: Handlers }) {
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
        {h.payments.map((p) => {
          const paid = paidThisMonth(p)
          return (
            <div
              key={p.id}
              className="group/item flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl p-3"
              style={{
                background: 'var(--muted)',
                boxShadow: `inset 0 0 0 1.5px ${paid ? '#00a86b' : '#ff3b30'}`,
              }}
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base"
                style={{ background: paid ? '#00a86b22' : '#ff3b3022', color: paid ? '#00a86b' : '#ff3b30' }}
              >
                {paid ? '✓' : '!'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{p.purpose}</div>
                <div className="truncate text-xs text-muted-foreground">
                  Оплатить до {p.day} числа
                  {p.lastPaid && p.fileName ? ` · оплачено ${fmtDate(p.lastPaid)}` : ' · не оплачено'}
                </div>
              </div>
              <div className="font-mono text-base font-bold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {p.amount.toFixed(2)} {p.currency}
              </div>
              <div className="flex items-center gap-2">
                {p.fileName ? (
                  <button
                    onClick={() => h.clearPayment(p.id)}
                    title={p.fileName}
                    className="flex max-w-[140px] items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs transition-colors hover:text-[#ff3b30]"
                  >
                    <span>📎</span>
                    <span className="truncate">{p.fileName}</span>
                  </button>
                ) : (
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-[#ffdb4d] hover:text-foreground">
                    <span>📎</span> Прикрепить оплату
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) h.payPayment(p.id, f.name)
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}
                <DeleteDot onClick={() => h.removePayment(p.id)} />
              </div>
            </div>
          )
        })}
        {h.payments.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">Нет платежей</div>}
      </div>
      <RowForm
        nameLabel="Платёж"
        namePlaceholder="Назначение платежа"
        dayLabel="Оплатить до"
        accent="#ff9f45"
        onSave={({ name, day, amount, currency }) => h.addPayment({ purpose: name, day, amount, currency })}
      />
    </div>
  )
}

function AddCityInline({ used, onAdd }: { used: Set<string>; onAdd: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const options = weatherCatalog.filter((c) => !used.has(c.city))
  if (options.length === 0) return null
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-[22px] w-6 place-items-center rounded-full border border-dashed border-border text-[11px] text-muted-foreground transition-colors hover:border-[#ffdb4d] hover:text-foreground"
      >
        ＋
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 w-40 overflow-auto rounded-2xl border border-border bg-card p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)]">
          {options.map((c) => (
            <button
              key={c.city}
              onClick={() => {
                onAdd(c.city)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span>{c.icon}</span>
              <span className="truncate">{c.city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
