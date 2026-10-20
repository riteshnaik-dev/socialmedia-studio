// Text tools for the editor. LinkedIn and X posts are plain text, so "bold" and "italic"
// are made from special Unicode letters that look styled anywhere the text is pasted.

(function () {
  const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const LOWER = "abcdefghijklmnopqrstuvwxyz";
  const DIGITS = "0123456789";

  // Starting code points of each Unicode letter style (Mathematical Sans-Serif family)
  const STYLES = {
    bold:       { upper: 0x1d5d4, lower: 0x1d5ee, digits: 0x1d7ec },
    italic:     { upper: 0x1d608, lower: 0x1d622, digits: null },
    boldItalic: { upper: 0x1d63c, lower: 0x1d656, digits: 0x1d7ec },
    code:       { upper: 0x1d670, lower: 0x1d68a, digits: 0x1d7f6 },
  };
  const UNDERLINE = "̲";
  const STRIKE = "̶";

  // Reverse lookup: styled character -> { plain letter, style name }
  const reverse = new Map();
  for (const [name, s] of Object.entries(STYLES)) {
    [...UPPER].forEach((c, i) => reverse.set(String.fromCodePoint(s.upper + i), { plain: c, style: name }));
    [...LOWER].forEach((c, i) => reverse.set(String.fromCodePoint(s.lower + i), { plain: c, style: name }));
    if (s.digits) [...DIGITS].forEach((c, i) => {
      const ch = String.fromCodePoint(s.digits + i);
      if (!reverse.has(ch)) reverse.set(ch, { plain: c, style: name === "boldItalic" ? "bold" : name });
    });
  }

  function toPlain(text) {
    return [...text].filter((c) => c !== UNDERLINE && c !== STRIKE).map((c) => reverse.get(c)?.plain ?? c).join("");
  }

  function styleOf(text) {
    for (const c of text) {
      const hit = reverse.get(c);
      if (hit) return hit.style;
      if (/[A-Za-z]/.test(c)) return null;
    }
    return null;
  }

  function applyStyle(text, name) {
    const s = STYLES[name];
    return [...toPlain(text)].map((c) => {
      let i = UPPER.indexOf(c);
      if (i >= 0) return String.fromCodePoint(s.upper + i);
      i = LOWER.indexOf(c);
      if (i >= 0) return String.fromCodePoint(s.lower + i);
      i = DIGITS.indexOf(c);
      if (i >= 0 && s.digits) return String.fromCodePoint(s.digits + i);
      return c;
    }).join("");
  }

  // Bold and italic combine (bold + italic = bold italic); pressing the same button again removes it.
  function toggleStyle(text, name) {
    const current = styleOf(text);
    const has = (n) => current === n || (current === "boldItalic" && (n === "bold" || n === "italic"));
    if (name === "code") return current === "code" ? toPlain(text) : applyStyle(text, "code");
    if (has(name)) {
      if (current === "boldItalic") return applyStyle(text, name === "bold" ? "italic" : "bold");
      return toPlain(text);
    }
    if ((name === "bold" && current === "italic") || (name === "italic" && current === "bold")) {
      return applyStyle(text, "boldItalic");
    }
    return applyStyle(text, name);
  }

  function toggleMark(text, mark) {
    const chars = [...text];
    if (chars.includes(mark)) return chars.filter((c) => c !== mark).join("");
    return chars.map((c) => (c === "\n" || c === " " ? c : c + mark)).join("");
  }

  const transforms = {
    bold: (t) => toggleStyle(t, "bold"),
    italic: (t) => toggleStyle(t, "italic"),
    code: (t) => toggleStyle(t, "code"),
    underline: (t) => toggleMark(t, UNDERLINE),
    strike: (t) => toggleMark(t, STRIKE),
    clear: (t) => toPlain(t),
    bullets: (t) => t.split("\n").map((l) => (l.trim() ? (l.startsWith("• ") ? l.slice(2) : "• " + l) : l)).join("\n"),
    numbers: (t) => {
      let n = 0;
      return t.split("\n").map((l) => (l.trim() ? (/^\d+\. /.test(l) ? l.replace(/^\d+\. /, "") : `${++n}. ${l}`) : l)).join("\n");
    },
  };

  // Staircase layouts: rearrange the selected lines by length.
  function staircase(text, pattern) {
    const lines = text.split("\n").filter((l) => l.trim());
    const asc = [...lines].sort((a, b) => [...toPlain(a)].length - [...toPlain(b)].length);
    let out;
    if (pattern === "up") out = asc;
    else if (pattern === "down") out = [...asc].reverse();
    else {
      // "peak": short-long-short, "valley": long-short-long
      const order = pattern === "peak" ? asc : [...asc].reverse();
      const left = [], right = [];
      order.forEach((l, i) => (i % 2 === 0 ? left : right).push(l));
      out = [...left, ...right.reverse()];
    }
    return out.join("\n");
  }

  function syllables(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return 0;
    if (w.length <= 3) return 1;
    const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
    return Math.max(1, groups ? groups.length : 1);
  }

  // Counts used under the editor. Characters are counted the way LinkedIn and X count them.
  function stats(text) {
    const plain = toPlain(text);
    const words = plain.match(/[A-Za-z0-9'’]+/g) || [];
    const sentences = (plain.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/gm) || []).filter((s) => /[A-Za-z0-9]/.test(s)).length;
    const paragraphs = plain.split(/\n\s*\n/).filter((p) => p.trim()).length;
    const syl = words.reduce((sum, w) => sum + syllables(w), 0);
    // Flesch-Kincaid grade level: roughly the US school grade needed to read it easily
    const grade = words.length && sentences
      ? Math.max(0, Math.round(0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59))
      : 0;
    return {
      characters: [...text].length,
      words: words.length,
      sentences,
      paragraphs,
      readingSeconds: Math.round((words.length / 238) * 60),
      grade,
    };
  }

  window.TextKit = { transforms, staircase, stats, toPlain };
})();
