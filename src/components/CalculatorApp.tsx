"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateExpression,
  formatResult,
  withAnswer,
  type AngleMode,
} from "@/lib/calculator";
import { copy, type Language } from "@/lib/i18n";
import { GraphCanvas, type GraphFunction } from "./GraphCanvas";

type Tab = "calculator" | "graph" | "history";
type HistoryItem = { id: string; expression: string; result: string };
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type KeyKind = "fn" | "digit" | "op" | "action" | "equals" | "danger";
type Key = { label: string; value: string; kind: KeyKind; wide?: boolean };

const colors = ["#ff7a2e", "#9cc08a", "#ef6f9a", "#e9c46a"];
// Oude (blauwe) kleuren uit opgeslagen functies omzetten naar het nieuwe palet.
const legacyColors = ["#6ee7f2", "#fb7185", "#fbbf24", "#a78bfa"];
const defaultFunctions: GraphFunction[] = [
  { id: "1", expression: "sin(x)", color: colors[0], visible: true },
  { id: "2", expression: "0.1x^2 - 2", color: colors[1], visible: true },
];

const fn = (label: string, value = label): Key => ({ label, value, kind: "fn" });
const digit = (label: string): Key => ({ label, value: label, kind: "digit" });
const op = (label: string): Key => ({ label, value: label, kind: "op" });

const keys: Key[] = [
  fn("sin", "sin("), fn("cos", "cos("), fn("tan", "tan("), fn("ln", "ln("), fn("log", "log("),
  fn("sin⁻¹", "asin("), fn("cos⁻¹", "acos("), fn("tan⁻¹", "atan("), fn("√", "√("), fn("x²", "^2"),
  fn("("), fn(")"), fn("xʸ", "^"), fn("π"), fn("e"),
  digit("7"), digit("8"), digit("9"), { label: "⌫", value: "⌫", kind: "action" }, { label: "AC", value: "AC", kind: "danger" },
  digit("4"), digit("5"), digit("6"), op("×"), op("÷"),
  digit("1"), digit("2"), digit("3"), op("+"), op("−"),
  digit("0"), digit("."), { label: "Ans", value: "Ans", kind: "action" }, { label: "=", value: "=", kind: "equals", wide: true },
];

const startsWithOperator = /^[×÷+^]/;

export function CalculatorApp() {
  const [tab, setTab] = useState<Tab>("calculator");
  const [language, setLanguage] = useState<Language>("nl");
  const [angleMode, setAngleMode] = useState<AngleMode>("deg");
  // Grafieken standaard in radialen: in graden is sin(x) op dit bereik een vlakke lijn.
  const [graphMode, setGraphMode] = useState<AngleMode>("rad");
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [answer, setAnswer] = useState(0);
  const [evaluated, setEvaluated] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [functions, setFunctions] = useState<GraphFunction[]>(defaultFunctions);
  const [resetSignal, setResetSignal] = useState(0);
  const [dark, setDark] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Pas opslaan nadat het bewaarde thema is ingelezen, anders overschrijft de standaardwaarde het.
  const themeLoaded = useRef(false);
  const t = copy[language];

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const storedHistory = localStorage.getItem("nova-history");
      const storedFunctions = localStorage.getItem("nova-functions");
      const storedLanguage = localStorage.getItem("nova-language") as Language | null;
      const storedMode = localStorage.getItem("nova-angle") as AngleMode | null;
      const storedGraphMode = localStorage.getItem("nova-graph-angle") as AngleMode | null;
      const storedTheme = localStorage.getItem("nova-theme");
      if (storedHistory) {
        try { setHistory(JSON.parse(storedHistory)); } catch {}
      }
      if (storedFunctions) {
        try {
          const parsed: GraphFunction[] = JSON.parse(storedFunctions);
          setFunctions(parsed.map((item) => {
            const legacy = legacyColors.indexOf(item.color);
            return legacy === -1 ? item : { ...item, color: colors[legacy] };
          }));
        } catch {}
      }
      if (storedLanguage === "nl" || storedLanguage === "en") setLanguage(storedLanguage);
      if (storedMode === "deg" || storedMode === "rad") setAngleMode(storedMode);
      if (storedGraphMode === "deg" || storedGraphMode === "rad") setGraphMode(storedGraphMode);
      if (storedTheme) setDark(storedTheme === "dark");
      themeLoaded.current = true;
    }, 0);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#161412" : "#efe9df");
    if (themeLoaded.current) localStorage.setItem("nova-theme", dark ? "dark" : "light");
  }, [dark]);

  // Live voorproefje van de uitkomst terwijl je typt.
  const preview = useMemo(() => {
    if (evaluated || !expression.trim()) return null;
    try {
      return formatResult(evaluateExpression(withAnswer(expression), angleMode, { Ans: answer }));
    } catch {
      return null;
    }
  }, [answer, angleMode, evaluated, expression]);

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem("nova-history", JSON.stringify(items));
  };

  const saveFunctions = (items: GraphFunction[]) => {
    setFunctions(items);
    localStorage.setItem("nova-functions", JSON.stringify(items));
  };

  const calculate = () => {
    if (!expression.trim()) return;
    const full = withAnswer(expression);
    try {
      const value = evaluateExpression(full, angleMode, { Ans: answer });
      const formatted = formatResult(value);
      setExpression(full);
      setResult(formatted);
      setAnswer(value);
      setEvaluated(true);
      setError(false);
      // In de geschiedenis Ans vervangen door de waarde, anders zegt de regel later niets meer.
      const previous = formatResult(answer);
      const stored = full.replace(/\bAns\b/g, answer < 0 ? `(${previous})` : previous);
      saveHistory([
        { id: crypto.randomUUID(), expression: stored, result: formatted },
        ...history.filter((item) => item.expression !== stored),
      ].slice(0, 30));
    } catch {
      setError(true);
    }
  };

  const clearAll = () => {
    setExpression("");
    setResult("0");
    setEvaluated(false);
    setError(false);
  };

  const insert = (key: string) => {
    navigator.vibrate?.(6);
    if (key === "=") return calculate();
    if (key === "AC") return clearAll();
    if (key === "⌫") {
      setEvaluated(false);
      setError(false);
      setExpression((value) => value.slice(0, -1));
      return;
    }
    const input = inputRef.current;
    // Na "=": een operator rekent verder met Ans, al het andere begint opnieuw.
    const base = evaluated
      ? startsWithOperator.test(key) || key === "−" ? "Ans" : ""
      : expression;
    const start = evaluated ? base.length : input?.selectionStart ?? base.length;
    const end = evaluated ? base.length : input?.selectionEnd ?? base.length;
    const next = base.slice(0, start) + key + base.slice(end);
    setExpression(next);
    setEvaluated(false);
    setError(false);
    requestAnimationFrame(() => {
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(start + key.length, start + key.length);
    });
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const setMode = (mode: AngleMode) => {
    setAngleMode(mode);
    localStorage.setItem("nova-angle", mode);
  };

  const setGraphAngle = (mode: AngleMode) => {
    setGraphMode(mode);
    localStorage.setItem("nova-graph-angle", mode);
  };

  const switchLanguage = () => {
    const next = language === "nl" ? "en" : "nl";
    setLanguage(next);
    localStorage.setItem("nova-language", next);
  };

  const modeSwitch = (mode: AngleMode, onChange: (mode: AngleMode) => void, wide = false) => (
    <div className={`segment-control ${wide ? "wide" : ""}`}>
      <button className={mode === "deg" ? "active" : ""} onClick={() => onChange("deg")}>DEG</button>
      <button className={mode === "rad" ? "active" : ""} onClick={() => onChange("rad")}>RAD</button>
    </div>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span /></div>
          <div>
            <h1>NOVA</h1>
            <p>{t.subtitle}</p>
          </div>
        </div>
        <div className="header-actions">
          {installPrompt && (
            <button
              className="install-button"
              onClick={async () => {
                await installPrompt.prompt();
                await installPrompt.userChoice;
                setInstallPrompt(null);
              }}
            >
              <span aria-hidden="true">↓</span> {t.install}
            </button>
          )}
          <button className="icon-button language-button" onClick={switchLanguage} title={t.language}>
            {language.toUpperCase()}
          </button>
          <button className="icon-button" onClick={() => setDark((value) => !value)} title={t.theme}>
            <span aria-hidden="true">{dark ? "☼" : "☾"}</span>
          </button>
        </div>
      </header>

      <main className="workspace">
        <nav className="tabs" aria-label="Main navigation">
          <button className={tab === "calculator" ? "active" : ""} onClick={() => setTab("calculator")}>
            <span aria-hidden="true">±</span>{t.calculator}
          </button>
          <button className={tab === "graph" ? "active" : ""} onClick={() => setTab("graph")}>
            <span aria-hidden="true">∿</span>{t.graph}
          </button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
            <span aria-hidden="true">↺</span>{t.history}
          </button>
        </nav>

        {tab === "calculator" && (
          <section className="calculator-layout">
            <div className="calculator-card">
              <div className="display">
                <div className="display-meta">
                  {modeSwitch(angleMode, setMode)}
                  <span className="ans-chip" title="Ans">Ans = {formatResult(answer)}</span>
                </div>
                <input
                  ref={inputRef}
                  value={expression}
                  className={evaluated ? "done" : ""}
                  onChange={(event) => {
                    setExpression(event.target.value);
                    setEvaluated(false);
                    setError(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") calculate();
                    if (event.key === "Escape") clearAll();
                  }}
                  placeholder={t.expression}
                  aria-label={t.expression}
                  spellCheck={false}
                  autoComplete="off"
                  inputMode="text"
                />
                <button
                  className={`result ${error ? "error" : ""} ${evaluated ? "final" : ""}`}
                  onClick={copyResult}
                  title={t.copy}
                  aria-live="polite"
                >
                  <span>{error ? t.undefinedValue : copied ? t.copied : evaluated ? t.result : ""}</span>
                  <strong key={evaluated ? result : "preview"}>
                    {error ? "—" : evaluated ? result : preview !== null ? preview : expression ? "…" : result}
                  </strong>
                </button>
              </div>
              <div className="keypad">
                {keys.map((key, index) => (
                  <button
                    key={`${key.label}-${index}`}
                    onClick={() => insert(key.value)}
                    className={`key ${key.kind} ${key.wide ? "wide" : ""}`}
                    aria-label={key.value === "^2" ? "kwadraat" : undefined}
                  >
                    {key.label}
                  </button>
                ))}
              </div>
            </div>
            <HistoryPanel
              t={t}
              history={history.slice(0, 6)}
              onSelect={(item) => {
                setExpression(item.expression);
                setResult(item.result);
                setEvaluated(true);
                setError(false);
              }}
              onClear={() => saveHistory([])}
              compact
            />
          </section>
        )}

        {tab === "graph" && (
          <section className="graph-layout">
            <aside className="functions-card">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">{t.functions}</span>
                  <h2>y = f(x)</h2>
                </div>
                <button
                  className="round-add"
                  title={t.addFunction}
                  disabled={functions.length >= colors.length}
                  onClick={() => {
                    const free = colors.find((color) => !functions.some((item) => item.color === color));
                    if (!free) return;
                    saveFunctions([...functions, {
                      id: crypto.randomUUID(),
                      expression: "",
                      color: free,
                      visible: true,
                    }]);
                  }}
                >+</button>
              </div>
              <div className="function-list">
                {functions.map((item, index) => (
                  <div className={`function-row ${item.visible ? "" : "hidden"}`} key={item.id}>
                    <button
                      className="color-dot"
                      style={{ "--dot": item.color } as React.CSSProperties}
                      aria-label={`Toggle function ${index + 1}`}
                      onClick={() => saveFunctions(functions.map((fn) =>
                        fn.id === item.id ? { ...fn, visible: !fn.visible } : fn
                      ))}
                    />
                    <span>y{index + 1} =</span>
                    <input
                      value={item.expression}
                      placeholder="sin(x)"
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(event) => saveFunctions(functions.map((fn) =>
                        fn.id === item.id ? { ...fn, expression: event.target.value } : fn
                      ))}
                    />
                    <button
                      className="delete-function"
                      title={t.delete}
                      onClick={() => saveFunctions(functions.filter((fn) => fn.id !== item.id))}
                    >×</button>
                  </div>
                ))}
              </div>
              <div className="graph-settings">
                {modeSwitch(graphMode, setGraphAngle, true)}
                <button className="reset-button" onClick={() => setResetSignal((value) => value + 1)}>
                  ⊙ {t.resetView}
                </button>
              </div>
            </aside>
            <div className="graph-card">
              <GraphCanvas functions={functions} angleMode={graphMode} resetSignal={resetSignal} />
              <p className="graph-hint">{t.graphHint}</p>
            </div>
          </section>
        )}

        {tab === "history" && (
          <HistoryPanel
            t={t}
            history={history}
            onSelect={(item) => {
              setExpression(item.expression);
              setResult(item.result);
              setEvaluated(true);
              setError(false);
              setTab("calculator");
            }}
            onClear={() => saveHistory([])}
          />
        )}
      </main>
      <footer>Nova Calculator · {new Date().getFullYear()}</footer>
    </div>
  );
}

function HistoryPanel({
  t,
  history,
  onSelect,
  onClear,
  compact = false,
}: {
  t: (typeof copy)[Language];
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  return (
    <aside className={`history-card ${compact ? "compact" : "full-history"}`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">NOVA</span>
          <h2>{t.history}</h2>
        </div>
        {history.length > 0 && <button className="text-button" onClick={onClear}>{t.clearHistory}</button>}
      </div>
      {history.length === 0 ? (
        <div className="empty-state"><span aria-hidden="true">∅</span><p>{t.emptyHistory}</p></div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <button key={item.id} onClick={() => onSelect(item)}>
              <span>{item.expression}</span>
              <strong>= {item.result}</strong>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
