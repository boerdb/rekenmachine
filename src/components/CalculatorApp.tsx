"use client";

import { useEffect, useRef, useState } from "react";
import { evaluateExpression, formatResult, type AngleMode } from "@/lib/calculator";
import { copy, type Language } from "@/lib/i18n";
import { GraphCanvas, type GraphFunction } from "./GraphCanvas";

type Tab = "calculator" | "graph" | "history";
type HistoryItem = { id: string; expression: string; result: string };
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const colors = ["#6ee7f2", "#fb7185", "#fbbf24", "#a78bfa"];
const defaultFunctions: GraphFunction[] = [
  { id: "1", expression: "sin(x)", color: colors[0], visible: true },
  { id: "2", expression: "0.1x^2 - 2", color: colors[1], visible: true },
];

const keys = [
  ["sin(", "cos(", "tan(", "π", "⌫"],
  ["asin(", "acos(", "atan(", "(", ")"],
  ["7", "8", "9", "÷", "√("],
  ["4", "5", "6", "×", "^"],
  ["1", "2", "3", "−", "log("],
  ["0", ".", "e", "+", "="],
];

export function CalculatorApp() {
  const [tab, setTab] = useState<Tab>("calculator");
  const [language, setLanguage] = useState<Language>("nl");
  const [angleMode, setAngleMode] = useState<AngleMode>("deg");
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("0");
  const [error, setError] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [functions, setFunctions] = useState<GraphFunction[]>(defaultFunctions);
  const [resetSignal, setResetSignal] = useState(0);
  const [dark, setDark] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = copy[language];

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      const storedHistory = localStorage.getItem("nova-history");
      const storedFunctions = localStorage.getItem("nova-functions");
      const storedLanguage = localStorage.getItem("nova-language") as Language | null;
      const storedMode = localStorage.getItem("nova-angle") as AngleMode | null;
      const storedTheme = localStorage.getItem("nova-theme");
      if (storedHistory) {
        try { setHistory(JSON.parse(storedHistory)); } catch {}
      }
      if (storedFunctions) {
        try { setFunctions(JSON.parse(storedFunctions)); } catch {}
      }
      if (storedLanguage === "nl" || storedLanguage === "en") setLanguage(storedLanguage);
      if (storedMode === "deg" || storedMode === "rad") setAngleMode(storedMode);
      if (storedTheme) setDark(storedTheme === "dark");
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
    localStorage.setItem("nova-theme", dark ? "dark" : "light");
  }, [dark]);

  const saveHistory = (items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem("nova-history", JSON.stringify(items));
  };

  const saveFunctions = (items: GraphFunction[]) => {
    setFunctions(items);
    localStorage.setItem("nova-functions", JSON.stringify(items));
  };

  const calculate = () => {
    try {
      const value = evaluateExpression(expression, angleMode);
      const formatted = formatResult(value);
      setResult(formatted);
      setError(false);
      saveHistory([
        { id: crypto.randomUUID(), expression, result: formatted },
        ...history.filter((item) => item.expression !== expression),
      ].slice(0, 30));
    } catch {
      setError(true);
    }
  };

  const insert = (key: string) => {
    if (key === "=") {
      calculate();
      return;
    }
    if (key === "⌫") {
      setExpression((value) => value.slice(0, -1));
      return;
    }
    const value = key === "√(" ? "sqrt(" : key;
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? expression.length;
    const next = expression.slice(0, start) + value + expression.slice(end);
    setExpression(next);
    setError(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + value.length, start + value.length);
    });
  };

  const setMode = (mode: AngleMode) => {
    setAngleMode(mode);
    localStorage.setItem("nova-angle", mode);
  };

  const switchLanguage = () => {
    const next = language === "nl" ? "en" : "nl";
    setLanguage(next);
    localStorage.setItem("nova-language", next);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">N</div>
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
            <span aria-hidden="true">⌗</span>{t.calculator}
          </button>
          <button className={tab === "graph" ? "active" : ""} onClick={() => setTab("graph")}>
            <span aria-hidden="true">⌁</span>{t.graph}
          </button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
            <span aria-hidden="true">↶</span>{t.history}
          </button>
        </nav>

        {tab === "calculator" && (
          <section className="calculator-layout">
            <div className="calculator-card">
              <div className="display">
                <div className="display-meta">
                  <div className="segment-control">
                    <button className={angleMode === "deg" ? "active" : ""} onClick={() => setMode("deg")}>DEG</button>
                    <button className={angleMode === "rad" ? "active" : ""} onClick={() => setMode("rad")}>RAD</button>
                  </div>
                  <button className="clear-button" onClick={() => { setExpression(""); setResult("0"); setError(false); }}>AC</button>
                </div>
                <input
                  ref={inputRef}
                  value={expression}
                  onChange={(event) => { setExpression(event.target.value); setError(false); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") calculate();
                    if (event.key === "Escape") setExpression("");
                  }}
                  placeholder={t.expression}
                  aria-label={t.expression}
                  spellCheck={false}
                  autoComplete="off"
                />
                <div className={`result ${error ? "error" : ""}`} aria-live="polite">
                  <span>{error ? t.invalid : t.result}</span>
                  <strong>{error ? "—" : result}</strong>
                </div>
              </div>
              <div className="keypad">
                {keys.flat().map((key, index) => (
                  <button
                    key={`${key}-${index}`}
                    onClick={() => insert(key)}
                    className={[
                      "key",
                      key === "=" ? "equals" : "",
                      ["÷", "×", "−", "+", "^"].includes(key) ? "operator" : "",
                      index < 10 ? "function" : "",
                    ].join(" ")}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
            <HistoryPanel
              t={t}
              history={history.slice(0, 5)}
              onSelect={(item) => { setExpression(item.expression); setResult(item.result); }}
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
                  onClick={() => {
                    if (functions.length >= 4) return;
                    saveFunctions([...functions, {
                      id: crypto.randomUUID(),
                      expression: "",
                      color: colors[functions.length],
                      visible: true,
                    }]);
                  }}
                >+</button>
              </div>
              <div className="function-list">
                {functions.map((item, index) => (
                  <div className="function-row" key={item.id}>
                    <button
                      className={`color-dot ${item.visible ? "" : "off"}`}
                      style={{ background: item.color }}
                      aria-label={`Toggle function ${index + 1}`}
                      onClick={() => saveFunctions(functions.map((fn) =>
                        fn.id === item.id ? { ...fn, visible: !fn.visible } : fn
                      ))}
                    />
                    <span>y{index + 1}=</span>
                    <input
                      value={item.expression}
                      placeholder="sin(x)"
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
                <div className="segment-control wide">
                  <button className={angleMode === "deg" ? "active" : ""} onClick={() => setMode("deg")}>DEG</button>
                  <button className={angleMode === "rad" ? "active" : ""} onClick={() => setMode("rad")}>RAD</button>
                </div>
                <button className="reset-button" onClick={() => setResetSignal((value) => value + 1)}>
                  ⊙ {t.resetView}
                </button>
              </div>
            </aside>
            <div className="graph-card">
              <GraphCanvas functions={functions} angleMode={angleMode} resetSignal={resetSignal} />
              <p className="graph-hint">{t.graphHint}</p>
            </div>
          </section>
        )}

        {tab === "history" && (
          <HistoryPanel
            t={t}
            history={history}
            onSelect={(item) => { setExpression(item.expression); setResult(item.result); setTab("calculator"); }}
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
