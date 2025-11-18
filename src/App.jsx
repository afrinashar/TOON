import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import "./App.css";

/**
 * Upgraded TokenCompare app — UI styled to match your screenshot.
 * - Multi-column, neon-dark theme
 * - Token visualizer (outlined small boxes)
 * - All-permutations table with green/red % vs baseline
 * - Cheatsheet with a simple cache demo & explanation
 *
 * Paste this into App.jsx (or App.js) and keep App.css from below.
 */

// --- presets
const PRESETS = {
  "small-simple-uniform-flat": [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob", age: 25 },
    { id: 3, name: "Charlie", age: 35 },
  ],
  "small-simple-nonuniform-flat": [
    { id: 1, text: "hello" },
    { id: 2, value: 123, active: true },
    { id: 3, name: "C" },
  ],
  "medium-complex": (() => {
    const arr = [];
    for (let i = 0; i < 50; i++)
      arr.push({
        id: i + 1,
        text: `item-${i + 1}`,
        meta: { nested: true, idx: i },
        values: [i, i * 2, i * 3],
      });
    return arr;
  })(),
  "large-complex": (() => {
    const arr = [];
    for (let i = 0; i < 500; i++)
      arr.push({
        id: i + 1,
        text: `row-${i + 1}`,
        meta: { nested: true, idx: i },
        values: [i, i + 1, i + 2],
        flag: i % 3 === 0,
      });
    return arr;
  })(),
};

// --- serializers (lightweight demo)
const serializeJSON = (data, pretty = false) =>
  pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

const serializeTOON = (data) => {
  if (Array.isArray(data)) {
    return (
      "[array:" +
      data.length +
      "]\n" +
      data
        .slice(0, 3)
        .map((d, i) => `[${i}] ${Object.entries(d).map(([k, v]) => `${k}:${typeof v}(${v})`).join(", ")}`)
        .join("\n") +
      (data.length > 3 ? `\n... (${data.length - 3} more)` : "")
    );
  }
  return Object.entries(data).map(([k, v]) => `${k}:${typeof v}(${String(v)})`).join(";");
};

const serializeCSV = (arr) => {
  if (!Array.isArray(arr)) return String(arr);
  const keys = Array.from(new Set(arr.flatMap((r) => Object.keys(r))));
  const rows = [keys.join(",")];
  for (const r of arr) rows.push(keys.map((k) => (r[k] == null ? "" : String(r[k]))).join(","));
  return rows.join("\n");
};

const serializeTSON = (d) => `/* TSON */\n${JSON.stringify(d, null, 2)}\n/* types */`;
const serializeXML = (d) => `<root>${typeof d}</root>`; // simplified demo

// --- tokenizer (lexical demo)
const tokenize = (str) => {
  if (!str) return [];
  const tokens = [];
  const regex = /(".*?(?<!\\)")|([A-Za-z0-9_\-:\/\.]+)|(\{|\}|\[|\]|:|,|<|>|=)|\s+/g;
  let m;
  while ((m = regex.exec(String(str))) !== null) {
    if (m[1]) tokens.push({ type: "string", value: m[1] });
    else if (m[2]) tokens.push({ type: "word", value: m[2] });
    else if (m[3]) tokens.push({ type: "punct", value: m[3] });
  }
  return tokens;
};
const bytes = (s) => new TextEncoder().encode(String(s)).length;

// --- formats registry
const FORMATS = [
  { key: "Pretty JSON", fn: (d) => serializeJSON(d, true) },
  { key: "JSON", fn: (d) => serializeJSON(d, false) },
  { key: "YAML", fn: (d) => serializeJSON(d, true).replace(/\{/g, "").replace(/\}/g, "") },
  { key: "TOON", fn: (d) => serializeTOON(d) },
  { key: "CSV", fn: (d) => serializeCSV(d) },
  { key: "TSON", fn: (d) => serializeTSON(d) },
  { key: "XML", fn: (d) => serializeXML(d) },
];

// --- simple cache class (for cheatsheet demonstration)
class SimpleCache {
  constructor() {
    this.map = new Map();
    this.hits = 0;
    this.requests = 0;
  }
  key(datasetName, formatKey) {
    return `${datasetName}::${formatKey}`;
  }
  get(datasetName, formatKey) {
    this.requests++;
    const k = this.key(datasetName, formatKey);
    if (this.map.has(k)) {
      this.hits++;
      return this.map.get(k);
    }
    return null;
  }
  set(datasetName, formatKey, value) {
    const k = this.key(datasetName, formatKey);
    this.map.set(k, value);
  }
}

// --- small components
function TokenVisualizer({ text }) {
  const toks = tokenize(text);
  return (
    <div className="token-visualizer">
      {toks.slice(0, 240).map((t, i) => (
        <span key={i} className="token-box" title={t.type}>
          {t.value}
        </span>
      ))}
      {toks.length > 240 && <span className="text-xs text-neutral-400">... +{toks.length - 240} tokens</span>}
    </div>
  );
}

function FormatCard({ title, output, stats }) {
  return (
    <motion.div className="card result-card neon-border" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className="card-head">
        <strong>{title}</strong>
        <div className="text-sm text-neutral-300">{stats.tokens} tokens</div>
      </div>
      <div className="card-body">
        <TokenVisualizer text={output} />
        <pre className="syntax-block small-pre mt-3">{String(output).slice(0, 1200)}</pre>
      </div>
    </motion.div>
  );
}

// --- comparison table
function ComparisonTable({ baselineKey, datasets, cache }) {
  const rows = datasets.map((name) => {
    const d = PRESETS[name];
    const row = { dataset: name };
    for (const f of FORMATS) {
      const c = cache.get(name, f.key);
      if (c) {
        row[f.key] = c;
        continue;
      }
      const out = f.fn(d);
      const toks = tokenize(out);
      const entry = { tokens: toks.length, bytes: bytes(out) };
      cache.set(name, f.key, entry);
      row[f.key] = entry;
    }
    return row;
  });

  return (
    <div className="output-card wide-card">
      <div className="table-head">
        <h3>All Permutations Comparison</h3>
        <div className="text-sm text-neutral-400">Baseline: <strong>{baselineKey}</strong></div>
      </div>
      <div className="table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>Dataset</th>
              {FORMATS.map((f) => <th key={f.key}>{f.key}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const base = r[baselineKey].tokens || 1;
              return (
                <tr key={r.dataset}>
                  <td className="dataset-col">
                    <div className="dataset-title">{r.dataset}</div>
                    <div className="dataset-sub">preset</div>
                  </td>
                  {FORMATS.map((f) => {
                    const v = r[f.key];
                    const pct = Math.round(((v.tokens - base) / base) * 1000) / 10;
                    const green = pct <= 0;
                    return (
                      <td key={f.key}>
                        <div className="num">{v.tokens}</div>
                        <div className={`pct ${green ? "good" : "bad"}`}>{pct > 0 ? `+${pct}%` : `${pct}%`}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- cheatsheet component (cache visual)
function Cheatsheet({ cache }) {
  const hitRate = cache.requests ? Math.round((cache.hits / cache.requests) * 100) : 0;
  return (
    <div className="cheatsheet result-card neon-sweep">
      <h3>Cheatsheet — quick guide + caching</h3>
      <div className="cheats-grid">
        <div>
          <h4>Why token counts differ</h4>
          <ul>
            <li><strong>Whitespace</strong> – pretty formatting increases tokens.</li>
            <li><strong>Structure</strong> – CSV/TSV flatten rows; compact for uniform arrays.</li>
            <li><strong>Typing</strong> – TOON/TSON add metadata (helpful but may increase tokens).</li>
            <li><strong>XML</strong> – tags add verbosity.</li>
          </ul>
        </div>

        <div>
          <h4>Simple cache (visual)</h4>
          <p>When you compare many datasets repeatedly, cache results keyed by <code>datasetName::formatKey</code> to avoid recomputing serializations & tokenization.</p>
          <div className="cache-stats">
            <div>Cache entries: <strong>{cache.map.size}</strong></div>
            <div>Requests: <strong>{cache.requests}</strong></div>
            <div>Hits: <strong>{cache.hits}</strong> ({hitRate}% hit rate)</div>
          </div>
        </div>

        <div className="hint full">
          <h4>Quick rules</h4>
          <div className="rule-grid">
            <div className="brief">CSV/TSV — best for uniform tables</div>
            <div className="brief">Pretty JSON — best for humans</div>
            <div className="brief">TOON/TSON — type clarity</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main App
export default function App() {
  const [presetName, setPresetName] = useState(Object.keys(PRESETS)[0]);
  const [customText, setCustomText] = useState(JSON.stringify(PRESETS[presetName], null, 2));
  const [data, setData] = useState(PRESETS[presetName]);
  const [baseline, setBaseline] = useState("Pretty JSON");
  const [showCheatsheet, setShowCheatsheet] = useState(true);

  const [cache] = useState(() => new SimpleCache());

  useEffect(() => {
    setCustomText(JSON.stringify(PRESETS[presetName], null, 2));
    setData(PRESETS[presetName]);
  }, [presetName]);

  const loadCustom = () => {
    try {
      const parsed = JSON.parse(customText);
      setData(parsed);
      alert("Custom dataset loaded");
    } catch (e) {
      alert("Invalid JSON — fix and try again");
    }
  };

  const outputs = useMemo(() => {
    const m = {};
    for (const f of FORMATS) {
      try {
        const out = f.fn(data);
        const toks = tokenize(out);
        m[f.key] = { output: out, tokens: toks.length, bytes: bytes(out) };
      } catch (e) {
        m[f.key] = { output: `Error: ${e.message}`, tokens: 0, bytes: 0 };
      }
    }
    return m;
  }, [data]);

  // Named dataset list for the table
  const datasetList = Object.keys(PRESETS);

  return (
    <div className="app-root neon-grid">
      <header className="topbar">
        <div>
          <h1>Tokenization Comparison</h1>
          <div className="subtitle">Compare tokens & bytes across formats — visual & interactive</div>
        </div>

        <div className="controls">
          <select value={presetName} onChange={(e) => setPresetName(e.target.value)} className="select">
            {Object.keys(PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>

          <select value={baseline} onChange={(e) => setBaseline(e.target.value)} className="select ml">
            {FORMATS.map((f) => <option key={f.key} value={f.key}>{f.key}</option>)}
          </select>

          <button onClick={() => setShowCheatsheet(s => !s)} className="btn"> {showCheatsheet ? "Hide" : "Show"} Cheatsheet </button>
        </div>
      </header>

      <main className="main-grid">
        <section className="left-col">
          <div className="result-card">
            <h3>Dataset / Custom JSON</h3>
            <textarea value={customText} onChange={(e) => setCustomText(e.target.value)} className="custom-area" rows={10} />
            <div className="row gap">
              <button onClick={loadCustom} className="btn primary">Load</button>
              <button onClick={() => setCustomText(JSON.stringify(data, null, 2))} className="btn">Reset</button>
            </div>
          </div>

          <div className="stack-cards">
            {FORMATS.slice(0, 3).map((f) => (
              <div key={f.key} className="result-card small">
                <div className="card-head">
                  <strong>{f.key}</strong>
                  <div className="text-sm text-neutral-400">{outputs[f.key]?.tokens ?? "-" } tokens</div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <TokenVisualizer text={outputs[f.key]?.output ?? ""} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="right-col">
          <div className="grid-cards">
            {FORMATS.map((f) => (
              <FormatCard key={f.key} title={f.key} output={outputs[f.key]?.output ?? ""} stats={outputs[f.key] ?? { tokens: 0 }} />
            ))}
          </div>

          <ComparisonTable baselineKey={baseline} datasets={datasetList} cache={cache} />

          {showCheatsheet && <Cheatsheet cache={cache} />}
        </section>
      </main>

      <footer className="footer">Demo • Visual token explorer • Cache demo included</footer>
    </div>
  );
}
