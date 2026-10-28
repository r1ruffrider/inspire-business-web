import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react"
import { AlertCircle, Check, CircleCheck, Hexagon, Layers, Monitor, type LucideIcon } from "lucide-react"
import {
  HONEYPOT_FIELD,
  LIMITS,
  buildWireRequest,
  countCodePoints,
  validateField,
  validateServiceRequest,
  type FieldError as FieldErr,
  type FieldName,
} from "@shared/serviceRequest"
import Todo, { SHOW_TODOS } from "@/components/Todo"
import PrivacyNote from "@/components/request/PrivacyNote"
import { PRESELECT_EVENT } from "@/components/ui/actions"
import {
  EMAIL,
  OFFLINE_NOTE,
  STATUS,
  bannerText,
  counterAnnouncement,
  fieldMessage,
  rateLimitText,
  summaryHeading,
  thanksLine,
  type BannerKind,
  type BannerText,
} from "@/components/request/messages"
import { clearDraft, loadDraft, saveDraft, type Draft } from "@/components/request/draft"
import { newIdempotencyKey, sendServiceRequest, type Outcome } from "@/lib/serviceRequestClient"
import {
  TURNSTILE_CONFIGURED,
  ensureTurnstile,
  renderTurnstile,
  type TurnstileHandle,
} from "@/lib/turnstile"

/**
 * The Request services form. ALL form state lives in this file (App holds none).
 * Inputs are uncontrolled and read through FormData, so typing never re-renders
 * the page and a 50,000-character paste does not lag. Component state holds only
 * errors, status, banner and cooldown.
 */

type Errors = Partial<Record<FieldName, FieldErr>>

const SINGLE_FIELDS = ["name", "email", "phone", "business_name", "description", "links", "referral_source"] as const
const FIELD_ORDER: readonly FieldName[] = [
  "name",
  "email",
  "phone",
  "business_name",
  "services",
  "description",
  "links",
  "timeline",
  "referral_source",
  "consent",
]
const FOCUS_ID: Record<FieldName, string> = {
  name: "rs-name",
  email: "rs-email",
  phone: "rs-phone",
  business_name: "rs-business",
  services: "rs-svc-website",
  description: "rs-description",
  links: "rs-links",
  timeline: "rs-timeline",
  referral_source: "rs-heard",
  consent: "rs-consent",
}

const SERVICE_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "website", label: "Website", Icon: Monitor },
  { value: "logo", label: "Logo", Icon: Hexagon },
  { value: "branding", label: "Business branding", Icon: Layers },
]

const TIMELINE_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "asap", label: "As soon as possible" },
  { value: "1-3-months", label: "Within 1 to 3 months" },
  { value: "flexible", label: "Flexible" },
  { value: "unsure", label: "Not sure yet" },
]

interface Values {
  name: string
  email: string
  phone: string
  business_name: string
  services: string[]
  description: string
  links: string
  timeline: string
  referral_source: string
  consent: boolean
}

function readValues(form: HTMLFormElement): Values {
  const fd = new FormData(form)
  const s = (k: string) => {
    const v = fd.get(k)
    return typeof v === "string" ? v : ""
  }
  const consent = form.elements.namedItem("consent")
  return {
    name: s("name"),
    email: s("email"),
    phone: s("phone"),
    business_name: s("business_name"),
    services: fd.getAll("services").filter((v): v is string => typeof v === "string"),
    description: s("description"),
    links: s("links"),
    timeline: s("timeline"),
    referral_source: s("referral_source"),
    consent: consent instanceof HTMLInputElement ? consent.checked : false,
  }
}

const messageOf = (e: FieldErr) => fieldMessage(e) ?? "Some details need fixing"

/** Splits text around the company address and makes the address a mailto link. */
function withMailto(text: string): ReactNode {
  const parts = text.split(EMAIL)
  return parts.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && <a href={`mailto:${EMAIL}`}>{EMAIL}</a>}
      {p}
    </Fragment>
  ))
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                          */
/* ------------------------------------------------------------------ */
function Err({ id, message }: { id: string; message: string }) {
  return (
    <p className="err" id={id}>
      <AlertCircle aria-hidden="true" />
      <span>
        <span className="sr-only">Error: </span>
        {message}
      </span>
    </p>
  )
}

/** aria-describedby: error first, then helper, only ids that exist. */
function describedBy(base: string, hasError: boolean, hasHelp: boolean) {
  const ids = [hasError && `${base}-error`, hasHelp && `${base}-help`].filter(Boolean).join(" ")
  return ids || undefined
}

function Counter({ textareaId, initial }: { textareaId: string; initial: number }) {
  const [n, setN] = useState(initial)
  const [spoken, setSpoken] = useState("")
  const last = useRef<string | null>(null)

  useEffect(() => {
    const el = document.getElementById(textareaId) as HTMLTextAreaElement | null
    if (!el) return
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setN(countCodePoints(el.value)))
    }
    el.addEventListener("input", on)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("input", on)
    }
  }, [textareaId])

  // Screen readers hear the count only when a threshold is crossed (debounced),
  // never on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const msg = counterAnnouncement(n)
      const band = n > LIMITS.description.max ? "over" : n === LIMITS.description.max ? "limit" : n >= 1800 ? "near" : "none"
      if (band !== last.current) {
        last.current = band
        setSpoken(msg ?? "")
      }
    }, 800)
    return () => window.clearTimeout(t)
  }, [n])

  const cls = n > LIMITS.description.max ? "counter counter--over" : n >= 1800 ? "counter counter--near" : "counter"
  return (
    <>
      <span className={cls} aria-hidden="true">
        {n.toLocaleString("en-US")} / {LIMITS.description.max.toLocaleString("en-US")}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {spoken}
      </span>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* The form                                                             */
/* ------------------------------------------------------------------ */
function FormBody({
  announce,
  onSuccess,
  preselect,
  focusFirst,
}: {
  announce: (msg: string) => void
  onSuccess: (info: { name: string; id?: string; height: number }) => void
  preselect: { service: string; nonce: number } | null
  focusFirst: boolean
}) {
  const [draft] = useState<Draft>(loadDraft)
  const [errors, setErrors] = useState<Errors>({})
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryNonce, setSummaryNonce] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<{ kind: BannerKind; nonce: number } | null>(null)
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false)

  const formRef = useRef<HTMLFormElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const bannerRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const hpRef = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)
  const keyRef = useRef<string>(newIdempotencyKey())
  const lastPayload = useRef<string>("")
  const widgetPromise = useRef<Promise<TurnstileHandle> | null>(null)
  const widget = useRef<TurnstileHandle | null>(null)
  const draftTimer = useRef(0)
  const unmounted = useRef(false)

  /* ---------- Turnstile: lazy, only on first interaction with the form ---------- */
  const ensureWidget = useCallback((): Promise<TurnstileHandle> => {
    if (widget.current) return Promise.resolve(widget.current)
    if (!widgetPromise.current) {
      widgetPromise.current = ensureTurnstile()
        .then(() => {
          if (!slotRef.current) throw new Error("no_slot")
          const h = renderTurnstile(slotRef.current, () => {})
          widget.current = h
          return h
        })
        .catch((e) => {
          widgetPromise.current = null // allow a retry on the next attempt
          throw e
        })
    }
    return widgetPromise.current
  }, [])

  const arm = () => {
    void ensureWidget().catch(() => {})
  }

  useEffect(() => {
    unmounted.current = false
    return () => {
      unmounted.current = true
      window.clearTimeout(draftTimer.current)
      widget.current?.remove()
      widget.current = null
      widgetPromise.current = null
    }
  }, [])

  /* ---------- online / offline ---------- */
  useEffect(() => {
    const off = () => setOnline(false)
    const on = () => {
      setOnline(true)
      setBanner((b) => (b?.kind === "offline" ? null : b))
      announce(STATUS.backOnline)
    }
    window.addEventListener("offline", off)
    window.addEventListener("online", on)
    return () => {
      window.removeEventListener("offline", off)
      window.removeEventListener("online", on)
    }
  }, [announce])

  /* ---------- 429 cooldown: counts down the TRUE Retry-After ---------- */
  useEffect(() => {
    if (cooldownEnd === null) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= cooldownEnd) {
        window.clearInterval(id)
        setCooldownEnd(null)
        setBanner((b) => (b?.kind === "rate" ? null : b))
        announce(STATUS.cooldownEnded)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [cooldownEnd, announce])

  const remaining = cooldownEnd === null ? 0 : Math.max(0, Math.ceil((cooldownEnd - now) / 1000))
  const cooling = cooldownEnd !== null && remaining > 0

  /* ---------- focus moves: summary heading, banner ---------- */
  useEffect(() => {
    if (summaryNonce > 0) summaryRef.current?.focus()
  }, [summaryNonce])
  useEffect(() => {
    if (banner) bannerRef.current?.focus()
  }, [banner?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusFirst) document.getElementById("rs-name")?.focus()
  }, [focusFirst])

  /* ---------- a service row elsewhere on the page asked to preselect ---------- */
  useEffect(() => {
    if (!preselect) return
    const box = document.getElementById(`rs-svc-${preselect.service}`) as HTMLInputElement | null
    if (!box) return
    box.checked = true
    setErrors((e) => {
      if (!e.services) return e
      const next = { ...e }
      delete next.services
      return next
    })
    scheduleSave()
  }, [preselect?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- draft ---------- */
  const scheduleSave = () => {
    window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => {
      const form = formRef.current
      if (!form) return
      const v = readValues(form)
      // consent, honeypot and token are never stored
      saveDraft({
        name: v.name,
        email: v.email,
        phone: v.phone,
        business_name: v.business_name,
        services: v.services as Draft["services"],
        description: v.description,
        links: v.links,
        timeline: v.timeline,
        referral_source: v.referral_source,
      })
    }, 500)
  }

  /* ---------- validation timing (UX-SPEC 5.1) ---------- */
  const setFieldError = (field: FieldName, err: FieldErr | null) => {
    setErrors((prev) => {
      const cur = prev[field]
      if (!err) {
        if (!cur) return prev
        const next = { ...prev }
        delete next[field]
        return next
      }
      if (cur && cur.code === err.code && cur.count === err.count && cur.line === err.line) return prev
      return { ...prev, [field]: err }
    })
  }

  const valueOf = (field: FieldName): unknown => {
    const form = formRef.current
    if (!form) return ""
    return readValues(form)[field]
  }

  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    const t = e.target as unknown as HTMLInputElement
    const name = t.name as FieldName
    if ((SINGLE_FIELDS as readonly string[]).includes(name)) {
      setFieldError(name, validateField(name, valueOf(name)))
    } else if (name === "services") {
      const group = document.getElementById("rs-services")
      if (!group || !group.contains(e.relatedTarget as Node | null)) {
        setFieldError("services", validateField("services", valueOf("services")))
      }
    }
  }

  const onChange = (e: ChangeEvent<HTMLFormElement>) => {
    const name = (e.target as unknown as HTMLInputElement).name as FieldName
    if (name && errors[name]) setFieldError(name, validateField(name, valueOf(name)))
    scheduleSave()
  }

  /* ---------- banners ---------- */
  const showBanner = (kind: BannerKind) => setBanner({ kind, nonce: Date.now() })

  const applyFieldErrors = (list: FieldErr[]) => {
    const next: Errors = {}
    for (const e of list) if (e.field !== "_form" && !next[e.field]) next[e.field] = e
    setErrors(next)
    return Object.keys(next).length
  }

  /* ---------- submit ---------- */
  const handleSubmit = async () => {
    const form = formRef.current
    if (!form || inFlight.current) return
    if (cooldownEnd !== null && Date.now() < cooldownEnd) return

    const values = readValues(form)
    const hp = hpRef.current?.value ?? ""

    // Validating: synchronous, shared with the server.
    const check = validateServiceRequest(
      buildWireRequest(values, { homepage_url: hp, turnstile_token: "" }),
      { exact: true },
    )
    if (!check.ok) {
      const n = applyFieldErrors(check.errors)
      if (n === 0) {
        showBanner("fields")
      } else {
        setBanner(null)
        setSummaryOpen(true)
        setSummaryNonce((x) => x + 1)
      }
      return
    }
    setErrors({})
    setSummaryOpen(false)

    if (navigator.onLine === false) {
      showBanner("offline")
      return
    }

    inFlight.current = true
    setSubmitting(true)
    setBanner(null)
    announce(STATUS.sending)
    const height = form.offsetHeight

    let outcome: Outcome
    try {
      const handle = await ensureWidget()
      const token = await handle.getToken()
      const wire = buildWireRequest(values, { homepage_url: hp, turnstile_token: token })
      // A retry of unchanged data reuses the key; any edit gets a new one.
      const sig = JSON.stringify({ ...wire, turnstile_token: "" })
      if (sig !== lastPayload.current) {
        keyRef.current = newIdempotencyKey()
        lastPayload.current = sig
      }
      outcome = await sendServiceRequest(wire, keyRef.current)
    } catch {
      // Turnstile blocked, failed or timed out: nothing was sent.
      outcome = { kind: "verification" }
    }

    if (unmounted.current) return
    let success = false
    switch (outcome.kind) {
      case "success":
        success = true
        clearDraft()
        window.clearTimeout(draftTimer.current)
        keyRef.current = newIdempotencyKey()
        lastPayload.current = ""
        onSuccess({ name: values.name, id: outcome.id, height })
        break
      case "field_errors": {
        // Our own strings by code. Counts come from re-validating locally; a pair we
        // cannot reproduce or message gets the generic "Some details need fixing".
        const mine: FieldErr[] = []
        let unknown = outcome.errors.length === 0
        for (const e of outcome.errors) {
          const local = e.field === "_form" ? null : validateField(e.field, values[e.field])
          if (local && fieldMessage(local)) mine.push(local)
          else unknown = true
        }
        const n = applyFieldErrors(mine)
        if (n > 0) {
          setSummaryOpen(true)
          setSummaryNonce((x) => x + 1)
          setBanner(null)
        } else if (unknown) showBanner("fields")
        break
      }
      case "too_large": {
        const mine = (["description", "links"] as const)
          .map((f) => validateField(f, values[f]))
          .filter((e): e is FieldErr => !!e)
        if (applyFieldErrors(mine) > 0) {
          setSummaryOpen(true)
          setSummaryNonce((x) => x + 1)
        } else showBanner("generic")
        break
      }
      case "verification":
        showBanner("verify")
        break
      case "rate_limited":
        setCooldownEnd(Date.now() + outcome.retryAfterSeconds * 1000)
        setNow(Date.now())
        showBanner("rate")
        break
      case "offline":
        showBanner("offline")
        break
      case "unknown":
        showBanner("unknown")
        break
      default:
        showBanner("generic")
    }
    inFlight.current = false
    setSubmitting(false)
    // The token is single use: every attempt that is not a success gets a fresh one.
    if (!success) widget.current?.reset()
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault() // FIRST: a failed handler must never put field values in a GET URL (T16)
    void handleSubmit()
  }

  /* ---------- derived view state ---------- */
  const summaryItems = FIELD_ORDER.filter((f) => errors[f]).map((f) => ({
    field: f,
    message: messageOf(errors[f]!),
  }))
  useEffect(() => {
    if (summaryOpen && summaryItems.length === 0) setSummaryOpen(false)
  }, [summaryOpen, summaryItems.length])

  let bannerView: BannerText | null = null
  if (banner) bannerView = banner.kind === "rate" ? rateLimitText(remaining || 1) : bannerText(banner.kind)

  const msg = (f: FieldName) => (errors[f] ? messageOf(errors[f]!) : null)

  const jump = (f: FieldName) => (e: ReactMouseEvent) => {
    e.preventDefault()
    document.getElementById(FOCUS_ID[f])?.focus()
  }

  const bad = (f: FieldName) => !!errors[f]

  return (
    <form
      ref={formRef}
      method="post"
      noValidate
      autoComplete="on"
      aria-busy={submitting}
      onSubmit={onSubmit}
      onBlur={onBlur}
      onChange={onChange}
      onFocusCapture={arm}
      onPointerDownCapture={arm}
    >
      {summaryOpen && summaryItems.length > 0 && (
        <div className="summary" ref={summaryRef} tabIndex={-1}>
          <h3>
            <AlertCircle aria-hidden="true" />
            <span>{summaryHeading(summaryItems.length)}</span>
          </h3>
          <ul>
            {summaryItems.map((it) => (
              <li key={it.field}>
                <a href={`#${FOCUS_ID[it.field]}`} onClick={jump(it.field)}>
                  {it.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="formnote">All fields are required unless marked optional.</p>

      <div className="group">
        <h3 className="group__h">
          <span>01 About you</span>
        </h3>
        <div className="pair">
          <div className={`field${bad("name") ? " is-bad" : ""}`}>
            <label htmlFor="rs-name">Your name</label>
            <input
              className="ctl"
              id="rs-name"
              name="name"
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              defaultValue={draft.name}
              aria-invalid={bad("name") || undefined}
              aria-describedby={describedBy("rs-name", bad("name"), false)}
            />
            {msg("name") && <Err id="rs-name-error" message={msg("name")!} />}
          </div>
          <div className={`field${bad("email") ? " is-bad" : ""}`}>
            <label htmlFor="rs-email">Email</label>
            <input
              className="ctl"
              id="rs-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={"name@example.com…"}
              enterKeyHint="next"
              defaultValue={draft.email}
              aria-invalid={bad("email") || undefined}
              aria-describedby={describedBy("rs-email", bad("email"), true)}
            />
            {msg("email") && <Err id="rs-email-error" message={msg("email")!} />}
            <p className="help" id="rs-email-help">
              We use this address to contact you about your request.
            </p>
          </div>
        </div>
        <div className="pair">
          <div className={`field${bad("phone") ? " is-bad" : ""}`}>
            <label htmlFor="rs-phone">
              Phone <span className="opt">(optional)</span>
            </label>
            <input
              className="ctl"
              id="rs-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              defaultValue={draft.phone}
              aria-invalid={bad("phone") || undefined}
              aria-describedby={describedBy("rs-phone", bad("phone"), true)}
            />
            {msg("phone") && <Err id="rs-phone-error" message={msg("phone")!} />}
            <p className="help" id="rs-phone-help">
              Optional. Include the country code if you can.
            </p>
          </div>
          <div className={`field${bad("business_name") ? " is-bad" : ""}`}>
            <label htmlFor="rs-business">Business name</label>
            <input
              className="ctl"
              id="rs-business"
              name="business_name"
              type="text"
              autoComplete="organization"
              enterKeyHint="next"
              defaultValue={draft.business_name}
              aria-invalid={bad("business_name") || undefined}
              aria-describedby={describedBy("rs-business", bad("business_name"), true)}
            />
            {msg("business_name") && <Err id="rs-business-error" message={msg("business_name")!} />}
            <p className="help" id="rs-business-help">
              The name you use, or plan to use, for your business.
            </p>
          </div>
        </div>
      </div>

      <div className="group">
        <h3 className="group__h">
          <span>02 Your project</span>
        </h3>
        <fieldset
          className={`field${bad("services") ? " is-bad" : ""}`}
          id="rs-services"
          aria-describedby={describedBy("rs-services", bad("services"), true)}
        >
          <legend>Services needed</legend>
          <div className="svcs">
            {SERVICE_OPTIONS.map(({ value, label, Icon }) => (
              <label className="svc" key={value}>
                <input
                  type="checkbox"
                  name="services"
                  value={value}
                  id={`rs-svc-${value}`}
                  defaultChecked={draft.services.includes(value as Draft["services"][number])}
                />
                <span className="box">
                  <Check aria-hidden="true" strokeWidth={3} />
                </span>
                <Icon className="ic" strokeWidth={1.6} aria-hidden="true" />
                <span className="nm">{label}</span>
              </label>
            ))}
          </div>
          {msg("services") && <Err id="rs-services-error" message={msg("services")!} />}
          <p className="help" id="rs-services-help">
            Select all that apply.
          </p>
        </fieldset>

        <div className={`field${bad("description") ? " is-bad" : ""}`}>
          <label htmlFor="rs-description">Project description</label>
          <textarea
            className="ctl"
            id="rs-description"
            name="description"
            rows={6}
            autoComplete="off"
            defaultValue={draft.description}
            aria-invalid={bad("description") || undefined}
            aria-describedby={describedBy("rs-description", bad("description"), true)}
          />
          <div className="field__meta">
            <div className="field__msgs">
              {msg("description") && <Err id="rs-description-error" message={msg("description")!} />}
              <p className="help" id="rs-description-help">
                What do you need, who is it for, and what should it achieve? Use 20 to 2,000 characters.
              </p>
            </div>
            <Counter textareaId="rs-description" initial={countCodePoints(draft.description)} />
          </div>
        </div>
      </div>

      <div className="group">
        <h3 className="group__h">
          <span>03 Details</span>
        </h3>
        <div className={`field${bad("links") ? " is-bad" : ""}`}>
          <label htmlFor="rs-links">
            Existing website or reference links <span className="opt">(optional)</span>
          </label>
          <textarea
            className="ctl sm"
            id="rs-links"
            name="links"
            rows={3}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={"example.com…"}
            defaultValue={draft.links}
            aria-invalid={bad("links") || undefined}
            aria-describedby={describedBy("rs-links", bad("links"), true)}
          />
          {msg("links") && <Err id="rs-links-error" message={msg("links")!} />}
          <p className="help" id="rs-links-help">
            One link per line, up to 5.
          </p>
        </div>
        <div className="field">
          <label htmlFor="rs-timeline">
            Desired timeline <span className="opt">(optional)</span>
          </label>
          <select
            className="ctl"
            id="rs-timeline"
            name="timeline"
            autoComplete="off"
            defaultValue={draft.timeline}
          >
            {TIMELINE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className={`field${bad("referral_source") ? " is-bad" : ""}`}>
          <label htmlFor="rs-heard">
            How did you hear about us? <span className="opt">(optional)</span>
          </label>
          <input
            className="ctl"
            id="rs-heard"
            name="referral_source"
            type="text"
            autoComplete="off"
            placeholder={"Search, a friend, social media…"}
            enterKeyHint="next"
            defaultValue={draft.referral_source}
            aria-invalid={bad("referral_source") || undefined}
            aria-describedby={describedBy("rs-heard", bad("referral_source"), false)}
          />
          {msg("referral_source") && <Err id="rs-heard-error" message={msg("referral_source")!} />}
        </div>
      </div>

      {/* Honeypot: off-screen (not display:none), hidden from assistive tech and the keyboard
          by aria-hidden + inert + tabIndex -1, never required, never stored in the draft. */}
      <div className="hp" aria-hidden="true" inert>
        <label htmlFor="rs-hp">Leave this field empty</label>
        <input
          ref={hpRef}
          id="rs-hp"
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
        />
      </div>

      <div className={`field${bad("consent") ? " is-bad" : ""}`}>
        <label className="cons" htmlFor="rs-consent">
          <input
            type="checkbox"
            id="rs-consent"
            name="consent"
            required
            aria-invalid={bad("consent") || undefined}
            aria-describedby={describedBy("rs-consent", bad("consent"), false)}
          />
          <span>
            I have read the privacy note and agree that Inspire Business Group may use these details
            to reply to my request and discuss my project.
          </span>
        </label>
        {msg("consent") && (
          <div className="indent">
            <Err id="rs-consent-error" message={msg("consent")!} />
          </div>
        )}
      </div>
      <div className="indent">
        <PrivacyNote />
      </div>

      {!online && <p className="offline-note">{OFFLINE_NOTE}</p>}

      {bannerView && (
        <div className="banner" ref={bannerRef} tabIndex={-1} role="group" aria-label="Notice">
          <AlertCircle aria-hidden="true" />
          <div>
            <h3>{bannerView.title}</h3>
            {bannerView.body && <p>{withMailto(bannerView.body)}</p>}
          </div>
        </div>
      )}

      {/* Reserved slot for the managed Turnstile widget (empty unless Cloudflare needs the visitor). */}
      <div className="ts-slot" ref={slotRef} />

      <div className="submitrow">
        <button
          type="submit"
          className={`btn btn--primary btn--block-sm${cooling ? " btn--wait" : ""}`}
          aria-disabled={submitting || cooling}
        >
          {submitting && <span className="spin" aria-hidden="true" />}
          {submitting ? (
            "Sending…"
          ) : cooling ? (
            <>
              <span aria-hidden="true">Try again in {remaining}s</span>
              <span className="sr-only">Try again shortly</span>
            </>
          ) : (
            "Send request"
          )}
        </button>
        <span className="alt">
          or email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </span>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Success and the outer shell                                          */
/* ------------------------------------------------------------------ */
function Success({
  name,
  id,
  height,
  onAgain,
}: {
  name: string
  id?: string
  height: number
  onAgain: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])
  return (
    <div className="success" style={{ minHeight: height || undefined }}>
      <CircleCheck className="success__icon" aria-hidden="true" />
      <h3 ref={headingRef} tabIndex={-1}>
        Your request was sent.
      </h3>
      <p>
        {thanksLine(name)} Your request was sent to {EMAIL}. You won&rsquo;t get an automatic
        confirmation email.
      </p>
      {id && <p className="ref">Reference: {id}</p>}
      <div>
        <button type="button" className="btn btn--secondary" onClick={onAgain}>
          Send another request
        </button>
      </div>
      <PrivacyNote />
    </div>
  )
}

export default function RequestForm() {
  const [session, setSession] = useState(0)
  const [success, setSuccess] = useState<{ name: string; id?: string; height: number } | null>(null)
  const [preselect, setPreselect] = useState<{ service: string; nonce: number } | null>(null)
  const [status, setStatus] = useState("")
  const successRef = useRef(false)
  successRef.current = success !== null

  // Persistent status region: announced text only (sending, cooldown ended, back online).
  const announce = useCallback((msg: string) => setStatus(msg), [])

  const reset = useCallback(() => {
    clearDraft()
    setPreselect(null)
    setSuccess(null)
    setSession((s) => s + 1)
  }, [])

  // A "Request" link on a service row asks for that service to be ticked.
  useEffect(() => {
    const on = (e: Event) => {
      const service = (e as CustomEvent<{ service?: unknown }>).detail?.service
      if (typeof service !== "string") return
      if (successRef.current) reset()
      setPreselect({ service, nonce: Date.now() })
    }
    window.addEventListener(PRESELECT_EVENT, on)
    return () => window.removeEventListener(PRESELECT_EVENT, on)
  }, [reset])

  // Fail closed: a production build with no Turnstile site key is not a working form.
  if (!TURNSTILE_CONFIGURED) {
    return (
      <>
        <div className="stub">
          <p>
            Email us at <a className="f-mail" href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </p>
          {SHOW_TODOS && <Todo what="Marlon, Renata: set VITE_TURNSTILE_SITE_KEY for the production build; the form stays hidden (email fallback only) until it is set" />}
        </div>
        <PrivacyNote />
      </>
    )
  }

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>
      {success ? (
        <Success
          name={success.name}
          id={success.id}
          height={success.height}
          onAgain={reset}
        />
      ) : (
        <FormBody
          key={session}
          announce={announce}
          onSuccess={setSuccess}
          preselect={preselect}
          focusFirst={session > 0}
        />
      )}
    </>
  )
}
