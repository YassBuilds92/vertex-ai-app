import { createHash } from 'node:crypto';

export type LatexCompiler = 'pdflatex' | 'xelatex' | 'lualatex';
export type LatexProvider = 'ytotech' | 'latexonline';
export type LatexTheme = 'legal' | 'news' | 'report';

export type LatexSectionInput = {
  heading?: string;
  body: string;
  visualTheme?: string;
  accentColor?: string;
  mood?: string;
  motif?: string;
  pageStyle?: 'standard' | 'feature' | 'hero';
  pageBreakBefore?: boolean;
  flagHints?: string[];
};

export type LatexCompileSuccess = {
  success: true;
  provider: LatexProvider;
  compiler: LatexCompiler;
  pdfBuffer: Buffer;
  compileLog: string;
  status: number;
  baseUrl: string;
};

export type LatexCompileFailure = {
  success: false;
  provider: LatexProvider;
  compiler: LatexCompiler;
  error: string;
  compileLog: string;
  status: number;
  transient: boolean;
  baseUrl: string;
};

export type LatexCompileResult = LatexCompileSuccess | LatexCompileFailure;

export type LatexValidationResult = {
  ok: boolean;
  unsupportedPackages: string[];
  dangerousCommands: string[];
  missingDocumentStructure: string[];
  usedPackages: string[];
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_YTOTECH_BASE_URL = 'https://latex.ytotech.com';
const DEFAULT_LATEXONLINE_BASE_URL = 'https://latexonline.cc';

export const ALLOWED_LATEX_PACKAGES = [
  'babel',
  'xcolor',
  'geometry',
  'titlesec',
  'fancyhdr',
  'graphicx',
  'tcolorbox',
  'hyperref',
  'fontenc',
  'inputenc',
  'enumitem',
  'tabularx',
  'multicol',
  'tikz',
  'fontspec',
  'setspace',
  'eso-pic',
  'microtype',
  'ragged2e',
  'parskip',
  'caption',
  'float',
  'fontawesome5',
  'lettrine',
  'etoolbox',
  'calc',
  'transparent',
  'fancybox',
  'array',
  'booktabs',
  'pifont',
  'lmodern',
  'charter',
  'helvet',
] as const;

const DANGEROUS_COMMAND_PATTERNS = [
  /\\write18\b/i,
  /\\openout\b/i,
  /\\immediate\s*\\write\b/i,
  /\\read\b/i,
];

const SPECIAL_LATEX_CHARS = /([#$%&_{}])/g;

type LatexSectionPalette = {
  accent: string;
  bg: string;
  deep: string;
  soft: string;
  line: string;
  label: string;
  moodLabel: string;
  motif: 'forest' | 'conflict' | 'football' | 'trophy' | 'finance' | 'tech' | 'climate' | 'culture' | 'legal' | 'generic';
};

type FlagSpec = {
  key: string;
  label: string;
  mode: 'vertical' | 'horizontal' | 'triangle';
  colors: string[];
  textColor?: string;
};

const SECTION_THEME_PRESETS: Record<string, LatexSectionPalette> = {
  forest: {
    accent: '166534',
    bg: 'F0FDF4',
    deep: '14532D',
    soft: 'DCFCE7',
    line: '86EFAC',
    label: 'FOREST DOSSIER',
    moodLabel: 'Calme organique',
    motif: 'forest',
  },
  conflict: {
    accent: '991B1B',
    bg: 'FEF2F2',
    deep: '450A0A',
    soft: 'FECACA',
    line: 'FCA5A5',
    label: 'ZONE DE TENSION',
    moodLabel: 'Gravite geopolitique',
    motif: 'conflict',
  },
  football: {
    accent: '15803D',
    bg: 'F0FDF4',
    deep: '14532D',
    soft: 'BBF7D0',
    line: '86EFAC',
    label: 'TEMPO FOOT',
    moodLabel: 'Energie stadium',
    motif: 'football',
  },
  trophy: {
    accent: 'B45309',
    bg: 'FFFBEB',
    deep: '78350F',
    soft: 'FDE68A',
    line: 'FCD34D',
    label: 'GRAND RENDEZ-VOUS',
    moodLabel: 'Tension de finale',
    motif: 'trophy',
  },
  finance: {
    accent: '1D4ED8',
    bg: 'EFF6FF',
    deep: '1E3A8A',
    soft: 'BFDBFE',
    line: '93C5FD',
    label: 'MARCHE & ECONOMIE',
    moodLabel: 'Lecture strategique',
    motif: 'finance',
  },
  tech: {
    accent: '7C3AED',
    bg: 'F5F3FF',
    deep: '4C1D95',
    soft: 'DDD6FE',
    line: 'C4B5FD',
    label: 'TECH & IA',
    moodLabel: 'Precision futuriste',
    motif: 'tech',
  },
  climate: {
    accent: '0F766E',
    bg: 'F0FDFA',
    deep: '134E4A',
    soft: '99F6E4',
    line: '5EEAD4',
    label: 'CLIMAT & PLANETE',
    moodLabel: 'Souffle environnemental',
    motif: 'climate',
  },
  culture: {
    accent: 'C026D3',
    bg: 'FDF4FF',
    deep: '86198F',
    soft: 'F5D0FE',
    line: 'E9A8FD',
    label: 'CULTURE & RECIT',
    moodLabel: 'Tonalite editoriale',
    motif: 'culture',
  },
  legal: {
    accent: '1E3A8A',
    bg: 'EFF6FF',
    deep: '172554',
    soft: 'DBEAFE',
    line: '93C5FD',
    label: 'CADRE FORMEL',
    moodLabel: 'Rigueur documentaire',
    motif: 'legal',
  },
  generic: {
    accent: '1D4ED8',
    bg: 'F8FAFC',
    deep: '0F172A',
    soft: 'E2E8F0',
    line: 'CBD5E1',
    label: 'ANGLE VISUEL',
    moodLabel: 'Lecture premium',
    motif: 'generic',
  },
};

const FLAG_LIBRARY: FlagSpec[] = [
  { key: 'france', label: 'France', mode: 'vertical', colors: ['0055A4', 'FFFFFF', 'EF4135'] },
  { key: 'italie', label: 'Italie', mode: 'vertical', colors: ['009246', 'FFFFFF', 'CE2B37'] },
  { key: 'belgique', label: 'Belgique', mode: 'vertical', colors: ['000000', 'FDD023', 'EF3340'], textColor: 'Black' },
  { key: 'allemagne', label: 'Allemagne', mode: 'horizontal', colors: ['000000', 'DD0000', 'FFCE00'] },
  { key: 'paysbas', label: 'Pays-Bas', mode: 'horizontal', colors: ['AE1C28', 'FFFFFF', '21468B'] },
  { key: 'russie', label: 'Russie', mode: 'horizontal', colors: ['FFFFFF', '0039A6', 'D52B1E'] },
  { key: 'ukraine', label: 'Ukraine', mode: 'horizontal', colors: ['005BBB', 'FFD500'] },
  { key: 'pologne', label: 'Pologne', mode: 'horizontal', colors: ['FFFFFF', 'DC143C'] },
  { key: 'autriche', label: 'Autriche', mode: 'horizontal', colors: ['ED2939', 'FFFFFF', 'ED2939'] },
  { key: 'irlande', label: 'Irlande', mode: 'vertical', colors: ['169B62', 'FFFFFF', 'FF883E'] },
  { key: 'roumanie', label: 'Roumanie', mode: 'vertical', colors: ['002B7F', 'FCD116', 'CE1126'], textColor: 'Black' },
  { key: 'yemen', label: 'Yemen', mode: 'horizontal', colors: ['CE1126', 'FFFFFF', '000000'] },
  { key: 'palestine', label: 'Palestine', mode: 'triangle', colors: ['000000', 'FFFFFF', '009736', 'CE1126'] },
  { key: 'usa', label: 'USA', mode: 'horizontal', colors: ['B22234', 'FFFFFF', '3C3B6E'] },
  { key: 'etatsunis', label: 'USA', mode: 'horizontal', colors: ['B22234', 'FFFFFF', '3C3B6E'] },
  { key: 'bresil', label: 'Bresil', mode: 'horizontal', colors: ['009B3A', 'FFDF00', '002776'] },
  { key: 'argentine', label: 'Argentine', mode: 'horizontal', colors: ['6CB4EE', 'FFFFFF', '6CB4EE'] },
  { key: 'maroc', label: 'Maroc', mode: 'horizontal', colors: ['C1272D', 'C1272D'] },
  { key: 'algerie', label: 'Algerie', mode: 'vertical', colors: ['006233', 'FFFFFF'] },
  { key: 'senegal', label: 'Senegal', mode: 'vertical', colors: ['00853F', 'FDEF42', 'E31B23'], textColor: 'Black' },
  { key: 'espagne', label: 'Espagne', mode: 'horizontal', colors: ['AA151B', 'F1BF00', 'AA151B'] },
  { key: 'portugal', label: 'Portugal', mode: 'vertical', colors: ['006600', 'FF0000'] },
];

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeLatexCompiler(value?: string | null): LatexCompiler {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pdflatex' || normalized === 'lualatex') return normalized;
  return 'xelatex';
}

export function normalizeLatexProvider(value?: string | null): LatexProvider {
  return String(value || '').trim().toLowerCase() === 'latexonline' ? 'latexonline' : 'ytotech';
}

export function resolveLatexProviderBaseUrl(provider: LatexProvider, explicitBaseUrl?: string | null): string {
  if (explicitBaseUrl?.trim()) return normalizeBaseUrl(explicitBaseUrl.trim());
  return provider === 'latexonline' ? DEFAULT_LATEXONLINE_BASE_URL : DEFAULT_YTOTECH_BASE_URL;
}

export function normalizeHexColor(value?: string | null, fallback = '#1d4ed8'): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

export function escapeLatexText(value?: string | null): string {
  return String(value || '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(SPECIAL_LATEX_CHARS, '\\$1')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\r\n/g, '\n');
}

function renderLatexParagraphs(body: string): string {
  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    paragraphs.push(escapeLatexText(currentParagraph.join(' ')));
    currentParagraph = [];
  };

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (/^(?:[-*]\s+)/.test(line)) {
      flushParagraph();
      const item = escapeLatexText(line.replace(/^(?:[-*]\s+)/, ''));
      paragraphs.push(`\\begin{itemize}\n\\item ${item}\n\\end{itemize}`);
      continue;
    }
    currentParagraph.push(line);
  }

  flushParagraph();
  return paragraphs.join('\n\n');
}

function normalizeDesignToken(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function inferSectionPreset(section: LatexSectionInput, documentTheme: LatexTheme): LatexSectionPalette {
  const rawSignals = [
    section.visualTheme,
    section.motif,
    section.mood,
    section.heading,
  ].filter(Boolean).join(' ');
  const token = normalizeDesignToken(rawSignals);

  if (/(tree|trees|arbre|arbres|forest|foret|nature|wood|woods|jungle|canopy|leaf|leafs|feuille|feuilles)/.test(token)) {
    return SECTION_THEME_PRESETS.forest;
  }
  if (/(war|guerre|conflict|conflit|battle|front|defense|military|missile|bomb|attaque|attaque|tension|geopolit|crise)/.test(token)) {
    return SECTION_THEME_PRESETS.conflict;
  }
  if (/(football|foot|soccer|ligue|match|stade|stadium|goal|ballon)/.test(token)) {
    return SECTION_THEME_PRESETS.football;
  }
  if (/(world cup|coupe du monde|trophy|trophee|finale|championnat|champions?)/.test(token)) {
    return SECTION_THEME_PRESETS.trophy;
  }
  if (/(econom|finance|market|marche|bourse|inflation|trade|business|cac 40|wall street)/.test(token)) {
    return SECTION_THEME_PRESETS.finance;
  }
  if (/(tech|ia|ai|code|robot|software|cloud|data|cyber|startup|start up)/.test(token)) {
    return SECTION_THEME_PRESETS.tech;
  }
  if (/(climat|climate|planet|planete|ocean|wave|energie|environment|environnement)/.test(token)) {
    return SECTION_THEME_PRESETS.climate;
  }
  if (/(culture|cinema|film|music|musique|serie|theatre|art|festival)/.test(token)) {
    return SECTION_THEME_PRESETS.culture;
  }
  if (documentTheme === 'legal') return SECTION_THEME_PRESETS.legal;
  if (documentTheme === 'news') return SECTION_THEME_PRESETS.conflict;
  return SECTION_THEME_PRESETS.generic;
}

function buildPaletteDefinitions(name: string, palette: LatexSectionPalette, accentOverride?: string | null): string {
  const accent = normalizeHexColor(accentOverride, `#${palette.accent}`).slice(1);
  return [
    `\\definecolor{${name}Accent}{HTML}{${accent}}`,
    `\\definecolor{${name}Bg}{HTML}{${palette.bg}}`,
    `\\definecolor{${name}Deep}{HTML}{${palette.deep}}`,
    `\\definecolor{${name}Soft}{HTML}{${palette.soft}}`,
    `\\definecolor{${name}Line}{HTML}{${palette.line}}`,
  ].join('\n');
}

function resolveFlagSpec(flagHint: string): FlagSpec | null {
  const token = normalizeDesignToken(flagHint).replace(/\s+/g, '');
  return FLAG_LIBRARY.find((flag) => token.includes(flag.key)) || null;
}

function toLatexHtmlColor(color: string): string {
  return `{[HTML]${color.replace(/^#/, '').toUpperCase()}}`;
}

function buildFlagBadge(flagHint: string): string {
  const spec = resolveFlagSpec(flagHint);
  if (!spec) {
    const fallbackLabel = escapeLatexText(flagHint).slice(0, 22);
    return `\\tcbox[
      on line,
      boxrule=0pt,
      arc=6pt,
      colback=white!92!black,
      colframe=white!92!black,
      left=6pt,right=6pt,top=3pt,bottom=3pt
    ]{\\scriptsize\\bfseries ${fallbackLabel}}`;
  }

  const label = escapeLatexText(spec.label);
  if (spec.mode === 'vertical') {
    const width = 0.6 / spec.colors.length;
    return `\\begin{tikzpicture}[baseline=-0.65ex,x=1cm,y=1cm]
\\draw[rounded corners=0.04cm, line width=0.25pt, draw=black!12] (0,0) rectangle (0.9,0.56);
${spec.colors.map((color, index) => `\\fill[fill=${toLatexHtmlColor(color)}] (${(index * width).toFixed(3)},0) rectangle (${((index + 1) * width).toFixed(3)},0.56);`).join('\n')}
\\node[anchor=west, font=\\scriptsize\\bfseries, text=${spec.textColor || 'white'}] at (1.02,0.28) {${label}};
\\end{tikzpicture}`;
  }

  if (spec.mode === 'triangle') {
    return `\\begin{tikzpicture}[baseline=-0.65ex,x=1cm,y=1cm]
\\draw[rounded corners=0.04cm, line width=0.25pt, draw=black!12] (0,0) rectangle (0.9,0.56);
\\fill[fill=${toLatexHtmlColor(spec.colors[0])}] (0,0.373) rectangle (0.9,0.56);
\\fill[fill=${toLatexHtmlColor(spec.colors[1])}] (0,0.187) rectangle (0.9,0.373);
\\fill[fill=${toLatexHtmlColor(spec.colors[2])}] (0,0) rectangle (0.9,0.187);
\\fill[fill=${toLatexHtmlColor(spec.colors[3])}] (0,0.28) -- (0.28,0.56) -- (0.28,0) -- cycle;
\\node[anchor=west, font=\\scriptsize\\bfseries, text=white] at (1.02,0.28) {${label}};
\\end{tikzpicture}`;
  }

  if (spec.key === 'usa' || spec.key === 'etatsunis') {
    return `\\begin{tikzpicture}[baseline=-0.65ex,x=1cm,y=1cm]
\\draw[rounded corners=0.04cm, line width=0.25pt, draw=black!12] (0,0) rectangle (0.9,0.56);
\\fill[fill=${toLatexHtmlColor(spec.colors[0])}] (0,0.43) rectangle (0.9,0.56);
\\fill[fill=${toLatexHtmlColor(spec.colors[1])}] (0,0.30) rectangle (0.9,0.43);
\\fill[fill=${toLatexHtmlColor(spec.colors[0])}] (0,0.17) rectangle (0.9,0.30);
\\fill[fill=${toLatexHtmlColor(spec.colors[1])}] (0,0.04) rectangle (0.9,0.17);
\\fill[fill=${toLatexHtmlColor(spec.colors[2])}] (0,0.30) rectangle (0.34,0.56);
\\node[anchor=west, font=\\scriptsize\\bfseries, text=white] at (1.02,0.28) {${label}};
\\end{tikzpicture}`;
  }

  if (spec.key === 'bresil') {
    return `\\begin{tikzpicture}[baseline=-0.65ex,x=1cm,y=1cm]
\\draw[rounded corners=0.04cm, line width=0.25pt, draw=black!12] (0,0) rectangle (0.9,0.56);
\\fill[fill=${toLatexHtmlColor(spec.colors[0])}] (0,0) rectangle (0.9,0.56);
\\fill[fill=${toLatexHtmlColor(spec.colors[1])}] (0.45,0.46) -- (0.78,0.28) -- (0.45,0.10) -- (0.12,0.28) -- cycle;
\\fill[fill=${toLatexHtmlColor(spec.colors[2])}] (0.45,0.28) circle (0.10);
\\node[anchor=west, font=\\scriptsize\\bfseries, text=white] at (1.02,0.28) {${label}};
\\end{tikzpicture}`;
  }

  return `\\begin{tikzpicture}[baseline=-0.65ex,x=1cm,y=1cm]
\\draw[rounded corners=0.04cm, line width=0.25pt, draw=black!12] (0,0) rectangle (0.9,0.56);
${spec.colors.map((color, index) => {
  const start = (0.56 / spec.colors.length) * index;
  const end = (0.56 / spec.colors.length) * (index + 1);
  return `\\fill[fill=${toLatexHtmlColor(color)}] (0,${start.toFixed(3)}) rectangle (0.9,${end.toFixed(3)});`;
}).join('\n')}
\\node[anchor=west, font=\\scriptsize\\bfseries, text=${spec.textColor || 'white'}] at (1.02,0.28) {${label}};
\\end{tikzpicture}`;
}

function buildFlagBadgeRow(flagHints?: string[]): string {
  const uniqueFlags = Array.from(new Set((flagHints || []).map((flag) => flag.trim()).filter(Boolean))).slice(0, 4);
  if (uniqueFlags.length === 0) return '';
  return `{\\small ${uniqueFlags.map((flag) => buildFlagBadge(flag)).join('\\hspace{0.7em}')}}`;
}

function buildMotifArtwork(name: string, palette: LatexSectionPalette, motifHint?: string, headingHint?: string): string {
  const motifToken = normalizeDesignToken([motifHint, headingHint].filter(Boolean).join(' '));
  const motif = motifToken
    ? inferSectionPreset({ body: '', motif: motifToken }, 'report').motif
    : palette.motif;
  switch (motif) {
    case 'forest':
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\fill[${name}Soft] (0,0) circle (0.34);
\\fill[${name}Accent] (-0.18,-0.48) rectangle (-0.10,-0.08);
\\fill[${name}Accent] (0.02,-0.5) rectangle (0.10,-0.14);
\\fill[${name}Deep] (-0.14,0.06) circle (0.20);
\\fill[${name}Accent] (0.12,0.12) circle (0.24);
\\fill[${name}Line] (0.32,-0.08) circle (0.14);
\\end{tikzpicture}`;
    case 'conflict':
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\fill[${name}Soft] (-0.36,-0.4) rectangle (0.38,0.36);
\\draw[${name}Accent, line width=1.4pt] (-0.3,0.26) -- (0.3,-0.26);
\\draw[${name}Deep, line width=1.1pt] (-0.35,-0.05) -- (0.35,-0.05);
\\draw[${name}Line, line width=1.1pt] (-0.28,-0.3) -- (0.28,0.22);
\\end{tikzpicture}`;
    case 'football':
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\draw[${name}Accent, line width=1.2pt] (-0.42,-0.42) rectangle (0.42,0.42);
\\draw[${name}Line, line width=1pt] (-0.42,0) -- (0.42,0);
\\fill[white] (0,0) circle (0.17);
\\draw[${name}Deep, line width=0.9pt] (0,0) circle (0.17);
\\draw[${name}Deep, line width=0.7pt] (0,0.17) -- (-0.14,0.05) -- (-0.08,-0.12) -- (0.08,-0.12) -- (0.14,0.05) -- cycle;
\\end{tikzpicture}`;
    case 'trophy':
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\fill[${name}Accent] (-0.16,-0.46) rectangle (0.16,-0.30);
\\fill[${name}Deep] (-0.06,-0.30) rectangle (0.06,0.02);
\\fill[${name}Accent] (-0.20,0.02) .. controls (-0.34,0.20) and (-0.26,0.40) .. (-0.08,0.40) -- (0.08,0.40) .. controls (0.26,0.40) and (0.34,0.20) .. (0.20,0.02) -- cycle;
\\draw[${name}Line, line width=0.9pt] (-0.20,0.18) .. controls (-0.42,0.18) and (-0.42,-0.04) .. (-0.26,-0.08);
\\draw[${name}Line, line width=0.9pt] (0.20,0.18) .. controls (0.42,0.18) and (0.42,-0.04) .. (0.26,-0.08);
\\end{tikzpicture}`;
    case 'finance':
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\draw[${name}Line, line width=0.8pt] (-0.38,-0.42) -- (-0.38,0.42);
\\draw[${name}Line, line width=0.8pt] (-0.42,-0.38) -- (0.42,-0.38);
\\fill[${name}Accent] (-0.28,-0.18) rectangle (-0.16,0.24);
\\fill[${name}Deep] (-0.04,-0.04) rectangle (0.08,0.34);
\\fill[${name}Line] (0.20,-0.12) rectangle (0.32,0.12);
\\draw[${name}Accent, line width=1pt, -{Latex[length=3mm]}] (-0.32,0.02) -- (-0.05,0.20) -- (0.10,0.10) -- (0.34,0.28);
\\end{tikzpicture}`;
    case 'tech':
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\fill[${name}Accent] (0,0) circle (0.08);
\\foreach \\x/\\y in {-0.26/0.22,0.28/0.24,-0.30/-0.18,0.30/-0.22} {
  \\fill[${name}Deep] (\\x,\\y) circle (0.06);
  \\draw[${name}Line, line width=0.9pt] (0,0) -- (\\x,\\y);
}
\\draw[${name}Accent, line width=0.8pt] (-0.14,0.34) rectangle (0.16,-0.34);
\\end{tikzpicture}`;
    case 'climate':
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\draw[${name}Accent, line width=1.3pt] (-0.38,-0.18) .. controls (-0.24,-0.30) and (-0.08,-0.02) .. (0.08,-0.16) .. controls (0.22,-0.28) and (0.30,-0.06) .. (0.40,-0.14);
\\fill[${name}Soft] (0.02,0.08) .. controls (0.24,0.08) and (0.28,0.34) .. (0.06,0.40) .. controls (-0.10,0.44) and (-0.20,0.26) .. (-0.10,0.10) .. controls (-0.06,0.04) and (-0.02,0.02) .. (0.02,0.08) -- cycle;
\\draw[${name}Deep, line width=0.9pt] (-0.10,0.10) -- (0.12,0.34);
\\end{tikzpicture}`;
    case 'culture':
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\fill[${name}Accent] (-0.34,0.30) rectangle (-0.16,-0.30);
\\fill[${name}Deep] (-0.08,0.30) rectangle (0.10,-0.30);
\\fill[${name}Line] (0.18,0.30) rectangle (0.36,-0.30);
\\foreach \\y in {0.22,0.06,-0.10,-0.26} {
  \\fill[white] (-0.30,\\y) circle (0.018);
  \\fill[white] (-0.20,\\y) circle (0.018);
}
\\end{tikzpicture}`;
    case 'legal':
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\draw[${name}Accent, line width=1pt] (0,0.36) -- (0,-0.28);
\\draw[${name}Line, line width=1pt] (-0.26,0.22) -- (0.26,0.22);
\\draw[${name}Deep, line width=0.9pt] (-0.18,0.14) -- (-0.28,-0.10);
\\draw[${name}Deep, line width=0.9pt] (0.18,0.14) -- (0.28,-0.10);
\\draw[${name}Accent, line width=0.9pt] (-0.34,-0.14) arc[start angle=180,end angle=0,radius=0.12];
\\draw[${name}Accent, line width=0.9pt] (0.10,-0.14) arc[start angle=180,end angle=0,radius=0.12];
\\end{tikzpicture}`;
    default:
      return `\\begin{tikzpicture}[x=1cm,y=1cm]
\\fill[${name}Soft] (-0.34,-0.34) rectangle (0.34,0.34);
\\draw[${name}Accent, line width=1pt] (-0.26,-0.18) -- (0,-0.02) -- (0.24,0.22);
\\fill[${name}Deep] (-0.20,0.22) circle (0.05);
\\fill[${name}Accent] (0.02,-0.02) circle (0.05);
\\fill[${name}Line] (0.24,0.22) circle (0.05);
\\end{tikzpicture}`;
  }
}

export function buildLatexFragment(input: {
  sections?: LatexSectionInput[];
  sources?: string[];
}): string {
  const blocks: string[] = [];

  for (const section of input.sections || []) {
    const heading = section.heading?.trim();
    const body = String(section.body || '').trim();
    if (!heading && !body) continue;
    if (heading) blocks.push(`\\section*{${escapeLatexText(heading)}}`);
    if (body) blocks.push(renderLatexParagraphs(body));
  }

  const sources = (input.sources || []).map(source => source.trim()).filter(Boolean);
  if (sources.length > 0) {
    blocks.push('\\section*{Sources}');
    blocks.push('\\begin{itemize}');
    for (const source of sources) {
      blocks.push(`\\item \\url{${source}}`);
    }
    blocks.push('\\end{itemize}');
  }

  return blocks.filter(Boolean).join('\n\n');
}

export function buildLatexDocument(input: {
  compiler?: LatexCompiler | null;
  theme: LatexTheme;
  title: string;
  subtitle?: string;
  summary?: string;
  author?: string;
  accentColor?: string;
  sections: LatexSectionInput[];
  sources: string[];
  absoluteDateTimeLabel?: string;
  dateLabel?: string;
}): string {
  const compiler = normalizeLatexCompiler(input.compiler);

  if (input.theme === 'news') {
    return buildNewsLatexDocumentV2(input, compiler);
  }
  if (input.theme === 'report') {
    return buildReportLatexDocument(input, compiler);
  }

  return buildLegalLatexDocument(input, compiler);
}

function buildLegalLatexDocument(input: {
  compiler?: LatexCompiler | null;
  title: string;
  subtitle?: string;
  summary?: string;
  author?: string;
  accentColor?: string;
  sections: LatexSectionInput[];
  sources: string[];
  absoluteDateTimeLabel?: string;
  dateLabel?: string;
}, compiler: LatexCompiler): string {
  const accentHex = normalizeHexColor(input.accentColor, '#1e3a8a').slice(1);
  const fontBlock = compiler === 'pdflatex'
    ? '\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}'
    : '\\usepackage{fontspec}';
  const summaryBlock = input.summary?.trim()
    ? `\\begin{tcolorbox}[colback=Accent!6,colframe=Accent,title=Introduction]\n${renderLatexParagraphs(input.summary)}\n\\end{tcolorbox}`
    : '';
  const body = buildLatexFragment({ sections: input.sections, sources: input.sources });

  return `\\documentclass[11pt,a4paper]{article}
${fontBlock}
\\usepackage[french]{babel}
\\usepackage{xcolor}
\\usepackage[a4paper,margin=2cm]{geometry}
\\usepackage{titlesec}
\\usepackage{fancyhdr}
\\usepackage[most]{tcolorbox}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{tikz}
\\usepackage{microtype}
\\definecolor{Accent}{HTML}{${accentHex}}
\\definecolor{BlackInk}{HTML}{0F172A}
\\definecolor{Muted}{HTML}{475569}
\\hypersetup{
  colorlinks=true,
  linkcolor=Accent,
  urlcolor=Accent,
  pdftitle={${escapeLatexText(input.title)}},
  pdfauthor={${escapeLatexText(input.author || 'Studio Pro Agent')}}
}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\textcolor{Muted}{DOCUMENT OFFICIEL}}
\\fancyhead[R]{\\textcolor{Muted}{${escapeLatexText(input.dateLabel || '')}}}
\\fancyfoot[C]{\\textcolor{Muted}{\\thepage}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.8em}
\\titleformat{\\section}{\\large\\bfseries\\color{BlackInk}}{}{0em}{}
\\begin{document}
\\begin{center}
{\\small\\textcolor{Accent}{DOCUMENT OFFICIEL}}\\\\[0.7cm]
{\\fontsize{28}{34}\\selectfont\\bfseries\\color{BlackInk}${escapeLatexText(input.title)}}\\\\[0.4cm]
${input.subtitle?.trim() ? `{\\Large\\color{Muted}${escapeLatexText(input.subtitle)}}\\\\[0.6cm]` : ''}
${input.author?.trim() ? `{\\normalsize\\textbf{${escapeLatexText(input.author)}}}\\\\[0.35cm]` : ''}
${input.absoluteDateTimeLabel?.trim()
    ? `{\\small\\color{Muted}${escapeLatexText(input.absoluteDateTimeLabel)}}\\\\[1.2cm]`
    : input.dateLabel?.trim()
      ? `{\\small\\color{Muted}${escapeLatexText(input.dateLabel)}}\\\\[1.2cm]`
      : ''}
\\end{center}
${summaryBlock}
${body}
\\end{document}`;
}

function buildPremiumSectionBlock(
  section: LatexSectionInput,
  index: number,
  documentTheme: 'news' | 'report',
  colorName: string
): string {
  const palette = inferSectionPreset(section, documentTheme);
  const heading = section.heading?.trim() || `Section ${index + 1}`;
  const body = String(section.body || '').trim();
  const renderedBody = body ? renderLatexParagraphs(body) : '';
  const displayLabel = section.visualTheme?.trim()
    ? escapeLatexText(section.visualTheme.toUpperCase())
    : escapeLatexText(palette.label);
  const moodLabel = section.mood?.trim()
    ? escapeLatexText(section.mood)
    : escapeLatexText(palette.moodLabel);
  const motifLabel = section.motif?.trim()
    ? `\\\\[-0.05em]{\\small\\color{${colorName}Deep}${escapeLatexText(section.motif)}}`
    : '';
  const flags = buildFlagBadgeRow(section.flagHints);
  const wantsFeature = section.pageStyle === 'hero'
    || section.pageStyle === 'feature'
    || Boolean(section.visualTheme?.trim() || section.motif?.trim() || flags);
  const shouldBreak = Boolean(section.pageBreakBefore || (wantsFeature && index > 0));
  const separator = index === 0 ? '' : '\\vspace{0.8em}';

  return `${shouldBreak ? '\\clearpage\n' : ''}${separator}
\\begin{tcolorbox}[
  enhanced,
  colback=${colorName}Bg,
  colframe=${colorName}Bg,
  boxrule=0pt,
  arc=${wantsFeature ? '8pt' : '5pt'},
  left=${wantsFeature ? '18pt' : '14pt'}, right=${wantsFeature ? '18pt' : '14pt'}, top=16pt, bottom=16pt,
  borderline west={5pt}{0pt}{${colorName}Accent},
  overlay={
    \\fill[${colorName}Soft, opacity=0.65] ([xshift=-0.2cm,yshift=0.1cm]frame.north east) circle (1.1cm);
    \\fill[${colorName}Line, opacity=0.6] ([xshift=-1.1cm,yshift=-1.0cm]frame.north east) circle (0.38cm);
  }
]
\\begin{minipage}[t]{0.71\\textwidth}
{\\small\\bfseries\\color{${colorName}Accent}${displayLabel}}\\\\[0.35em]
{\\fontsize{24}{28}\\selectfont\\bfseries\\color{BlackInk}${escapeLatexText(heading)}}\\\\[0.25em]
{\\small\\color{${colorName}Deep}${moodLabel}}${motifLabel}
${flags ? `\\\\[0.6em]\n${flags}` : ''}
\\end{minipage}
\\hfill
\\begin{minipage}[t]{0.23\\textwidth}
\\raggedleft
${buildMotifArtwork(colorName, palette, section.motif || section.visualTheme, heading)}
\\end{minipage}
\\end{tcolorbox}
${renderedBody ? `\n\\begin{tcolorbox}[
  enhanced,
  colback=white,
  colframe=${colorName}Line,
  boxrule=0.4pt,
  arc=6pt,
  left=14pt, right=14pt, top=12pt, bottom=12pt
]
{\\color{BlackInk}${renderedBody}}
\\end{tcolorbox}` : ''}`;
}

function buildPremiumLatexDocument(
  input: {
    compiler?: LatexCompiler | null;
    title: string;
    subtitle?: string;
    summary?: string;
    author?: string;
    accentColor?: string;
    sections: LatexSectionInput[];
    sources: string[];
    absoluteDateTimeLabel?: string;
    dateLabel?: string;
  },
  compiler: LatexCompiler,
  variant: 'news' | 'report'
): string {
  const fontBlock = compiler === 'pdflatex'
    ? '\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}'
    : '\\usepackage{fontspec}';
  const dateLabel = input.absoluteDateTimeLabel?.trim() || input.dateLabel?.trim() || '';
  const coverPalette = inferSectionPreset(input.sections[0] || { body: input.title, heading: input.title }, variant);
  const coverAccent = normalizeHexColor(input.accentColor, `#${coverPalette.accent}`);
  const coverDefs = buildPaletteDefinitions('Cover', coverPalette, coverAccent);
  const sectionColorDefs = input.sections
    .map((section, index) => buildPaletteDefinitions(`Section${index + 1}`, inferSectionPreset(section, variant), section.accentColor))
    .join('\n');
  const sectionBlocks = input.sections
    .map((section, index) => {
      const heading = section.heading?.trim();
      const body = String(section.body || '').trim();
      if (!heading && !body) return '';
      return buildPremiumSectionBlock(section, index, variant, `Section${index + 1}`);
    })
    .filter(Boolean)
    .join('\n\n');
  const summaryBlock = input.summary?.trim()
    ? `\\begin{tcolorbox}[
  enhanced,
  colback=white,
  colframe=CoverAccent,
  boxrule=0pt,
  arc=6pt,
  borderline west={4pt}{0pt}{CoverAccent},
  left=14pt,right=14pt,top=12pt,bottom=12pt
]
{\\small\\bfseries\\color{CoverAccent}${variant === 'news' ? 'OUVERTURE' : 'DIRECTION EDITORIALE'}}\\\\[0.35em]
{\\color{BlackInk}${renderLatexParagraphs(input.summary)}}
\\end{tcolorbox}
\\vspace{0.8em}`
    : '';
  const sources = (input.sources || []).map((source) => source.trim()).filter(Boolean);
  const sourcesBlock = sources.length > 0
    ? `\\clearpage
\\begin{tcolorbox}[
  enhanced,
  colback=Panel,
  colframe=CoverLine,
  boxrule=0.4pt,
  arc=6pt,
  left=12pt,right=12pt,top=10pt,bottom=10pt
]
{\\small\\bfseries\\color{CoverAccent}SOURCES ET LIENS}\\\\[0.5em]
\\begin{itemize}[leftmargin=1.2em,itemsep=3pt]
${sources.map((source) => `\\item \\url{${source}}`).join('\n')}
\\end{itemize}
\\end{tcolorbox}`
    : '';
  const coverArtwork = buildMotifArtwork('Cover', coverPalette, input.sections[0]?.motif || input.sections[0]?.visualTheme, input.title);

  return `\\documentclass[11pt,a4paper]{article}
${fontBlock}
\\usepackage[french]{babel}
\\usepackage{xcolor}
\\usepackage[a4paper,top=0pt,bottom=2cm,left=1.8cm,right=1.8cm]{geometry}
\\usepackage{titlesec}
\\usepackage{fancyhdr}
\\usepackage[most]{tcolorbox}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{tikz}
\\usepackage{calc}
\\usepackage{setspace}
\\usepackage{eso-pic}
\\usepackage{microtype}
\\usepackage{ragged2e}
\\usetikzlibrary{arrows.meta,calc,positioning}
\\definecolor{BlackInk}{HTML}{0F172A}
\\definecolor{Muted}{HTML}{64748B}
\\definecolor{Panel}{HTML}{F8FAFC}
${coverDefs}
${sectionColorDefs}
\\hypersetup{
  colorlinks=true,
  linkcolor=CoverAccent,
  urlcolor=CoverAccent,
  pdftitle={${escapeLatexText(input.title)}},
  pdfauthor={${escapeLatexText(input.author || 'Cowork Premium')}}
}
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\textcolor{Muted}{\\small\\bfseries ${variant === 'news' ? 'COWORK NEWS' : 'STUDIO PRO REPORT'}}}
\\fancyhead[R]{\\textcolor{Muted}{\\small ${escapeLatexText(dateLabel)}}}
\\fancyfoot[C]{\\textcolor{Muted}{\\small\\thepage}}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.6em}
\\setlist[itemize]{leftmargin=1.3em,itemsep=3pt}
\\setstretch{1.12}
\\begin{document}
\\thispagestyle{empty}
\\newgeometry{margin=0pt}
\\AddToShipoutPictureBG*{%
  \\AtPageLowerLeft{%
    \\begin{tikzpicture}[remember picture, overlay]
      ${variant === 'news'
        ? '\\fill[BlackInk] (0,0) rectangle (\\paperwidth,\\paperheight);\n      \\fill[CoverAccent] (0,\\paperheight-0.55cm) rectangle (\\paperwidth,\\paperheight);\n      \\fill[CoverAccent!16] (1.4cm,3.2cm) rectangle (\\paperwidth-1.4cm,3.3cm);'
        : '\\fill[Panel] (0,0) rectangle (\\paperwidth,\\paperheight);\n      \\fill[CoverAccent] (0,\\paperheight-3.6cm) rectangle (\\paperwidth,\\paperheight);\n      \\fill[CoverSoft, opacity=0.92] (2.2cm,4.2cm) circle (1.6cm);\n      \\fill[CoverLine, opacity=0.55] (\\paperwidth-2.4cm,\\paperheight-5.1cm) circle (1.1cm);'}
    \\end{tikzpicture}%
  }%
}
\\vspace*{${variant === 'news' ? '5.2cm' : '4.9cm'}}
\\begin{center}
{\\fontsize{12}{14}\\selectfont\\bfseries\\color{${variant === 'news' ? 'CoverAccent' : 'CoverAccent'}}${variant === 'news' ? 'COWORK NEWS' : 'STUDIO PRO REPORT'}}\\\\[1.0cm]
{\\fontsize{34}{40}\\selectfont\\bfseries\\color{${variant === 'news' ? 'white' : 'BlackInk'}}${escapeLatexText(input.title)}}\\\\[0.7cm]
${input.subtitle?.trim() ? `{\\fontsize{16}{20}\\selectfont\\color{${variant === 'news' ? 'white!72' : 'Muted'}}${escapeLatexText(input.subtitle)}}\\\\[0.8cm]` : ''}
${input.author?.trim() ? `{\\normalsize\\color{${variant === 'news' ? 'white!62' : 'Muted'}}${escapeLatexText(input.author)}}\\\\[0.35cm]` : ''}
{\\normalsize\\color{${variant === 'news' ? 'CoverAccent' : 'Muted'}}${escapeLatexText(dateLabel)}}
\\end{center}
\\vfill
\\begin{center}
${coverArtwork}
\\end{center}
\\vfill
\\begin{center}
{\\small\\color{${variant === 'news' ? 'white!42' : 'Muted'}}Genere par Cowork pour Studio Pro}
\\end{center}
\\vspace{1.4cm}
\\restoregeometry
\\newpage
${summaryBlock}
${sectionBlocks}
${sourcesBlock}
\\end{document}`;
}

function buildReportLatexDocument(input: {
  compiler?: LatexCompiler | null;
  title: string;
  subtitle?: string;
  summary?: string;
  author?: string;
  accentColor?: string;
  sections: LatexSectionInput[];
  sources: string[];
  absoluteDateTimeLabel?: string;
  dateLabel?: string;
}, compiler: LatexCompiler): string {
  return buildPremiumLatexDocument(input, compiler, 'report');
}

function buildNewsLatexDocumentV2(input: {
  compiler?: LatexCompiler | null;
  title: string;
  subtitle?: string;
  summary?: string;
  author?: string;
  accentColor?: string;
  sections: LatexSectionInput[];
  sources: string[];
  absoluteDateTimeLabel?: string;
  dateLabel?: string;
}, compiler: LatexCompiler): string {
  return buildPremiumLatexDocument(input, compiler, 'news');
}

const NEWS_SECTION_COLORS = [
  { accent: 'DC2626', bg: 'FEF2F2', label: 'NewsRed', bgLabel: 'NewsRedBg' },
  { accent: '2563EB', bg: 'EFF6FF', label: 'NewsBlue', bgLabel: 'NewsBlueBg' },
  { accent: '059669', bg: 'ECFDF5', label: 'NewsGreen', bgLabel: 'NewsGreenBg' },
  { accent: 'D97706', bg: 'FFFBEB', label: 'NewsAmber', bgLabel: 'NewsAmberBg' },
  { accent: '7C3AED', bg: 'F5F3FF', label: 'NewsPurple', bgLabel: 'NewsPurpleBg' },
  { accent: '0891B2', bg: 'ECFEFF', label: 'NewsCyan', bgLabel: 'NewsCyanBg' },
  { accent: 'E11D48', bg: 'FFF1F2', label: 'NewsRose', bgLabel: 'NewsRoseBg' },
  { accent: '4F46E5', bg: 'EEF2FF', label: 'NewsIndigo', bgLabel: 'NewsIndigoBg' },
];

function buildNewsLatexDocument(input: {
  compiler?: LatexCompiler | null;
  title: string;
  subtitle?: string;
  summary?: string;
  author?: string;
  accentColor?: string;
  sections: LatexSectionInput[];
  sources: string[];
  absoluteDateTimeLabel?: string;
  dateLabel?: string;
}, compiler: LatexCompiler): string {
  const babelLocale = 'french';
  const fontBlock = compiler === 'pdflatex'
    ? '\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}'
    : '\\usepackage{fontspec}';
  const dateLabel = input.absoluteDateTimeLabel?.trim() || input.dateLabel?.trim() || '';

  const colorDefs = NEWS_SECTION_COLORS.map(c =>
    `\\definecolor{${c.label}}{HTML}{${c.accent}}\n\\definecolor{${c.bgLabel}}{HTML}{${c.bg}}`
  ).join('\n');

  const sectionBlocks: string[] = [];
  for (let i = 0; i < input.sections.length; i++) {
    const section = input.sections[i];
    const heading = section.heading?.trim();
    const body = String(section.body || '').trim();
    if (!heading && !body) continue;
    const color = NEWS_SECTION_COLORS[i % NEWS_SECTION_COLORS.length];
    sectionBlocks.push(buildNewsSectionBlock(heading || '', body, color, i === 0));
  }

  const sources = (input.sources || []).map(s => s.trim()).filter(Boolean);
  const sourcesBlock = sources.length > 0
    ? `\\vspace{1em}
\\begin{tcolorbox}[
  colback=Panel,
  colframe=Muted!30,
  boxrule=0.3pt,
  arc=2pt,
  left=8pt, right=8pt, top=6pt, bottom=6pt,
  title={\\color{Muted}\\small\\bfseries SOURCES}
]
\\small\\color{Muted}
\\begin{itemize}[leftmargin=1em,itemsep=2pt]
${sources.map(s => `\\item \\url{${s}}`).join('\n')}
\\end{itemize}
\\end{tcolorbox}`
    : '';

  const summaryBlock = input.summary?.trim()
    ? `\\begin{tcolorbox}[
  colback=white,
  colframe=NewsRed,
  boxrule=0pt,
  borderline west={3pt}{0pt}{NewsRed},
  arc=0pt,
  left=12pt, right=12pt, top=10pt, bottom=10pt
]
{\\large\\color{BlackInk}${renderLatexParagraphs(input.summary)}}
\\end{tcolorbox}
\\vspace{0.8em}`
    : '';

  return `\\documentclass[11pt,a4paper]{article}
${fontBlock}
\\usepackage[${babelLocale}]{babel}
\\usepackage{xcolor}
\\usepackage[a4paper,top=0pt,bottom=2cm,left=1.8cm,right=1.8cm]{geometry}
\\usepackage{titlesec}
\\usepackage{fancyhdr}
\\usepackage{graphicx}
\\usepackage[most]{tcolorbox}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{tabularx}
\\usepackage{multicol}
\\usepackage{tikz}
\\usepackage{setspace}
\\usepackage{eso-pic}
\\usepackage{ragged2e}

\\definecolor{BlackInk}{HTML}{0F172A}
\\definecolor{Muted}{HTML}{64748B}
\\definecolor{Panel}{HTML}{F1F5F9}
\\definecolor{CoverBg}{HTML}{0F172A}
\\definecolor{CoverAccent}{HTML}{EF4444}
\\definecolor{LightRule}{HTML}{E2E8F0}
${colorDefs}

\\hypersetup{
  colorlinks=true,
  linkcolor=NewsRed,
  urlcolor=NewsBlue,
  pdftitle={${escapeLatexText(input.title)}},
  pdfauthor={${escapeLatexText(input.author || 'Cowork News')}}
}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\textcolor{Muted}{\\small\\bfseries COWORK NEWS}}
\\fancyhead[R]{\\textcolor{Muted}{\\small ${escapeLatexText(dateLabel)}}}
\\fancyfoot[C]{%
  \\begin{tikzpicture}[overlay]
    \\fill[NewsRed] (-0.3,0) rectangle (0.3,0.15);
  \\end{tikzpicture}%
  \\hspace{0.8em}\\textcolor{Muted}{\\small\\thepage}\\hspace{0.8em}%
  \\begin{tikzpicture}[overlay]
    \\fill[NewsRed] (-0.3,0) rectangle (0.3,0.15);
  \\end{tikzpicture}%
}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.6em}
\\setlist[itemize]{leftmargin=1.2em,itemsep=3pt}
\\setstretch{1.15}

\\begin{document}

% ─── COVER PAGE ───
\\thispagestyle{empty}
\\newgeometry{margin=0pt}
\\AddToShipoutPictureBG*{%
  \\AtPageLowerLeft{%
    \\begin{tikzpicture}[remember picture, overlay]
      \\fill[CoverBg] (0,0) rectangle (\\paperwidth,\\paperheight);
      \\fill[CoverAccent] (0,\\paperheight-0.5cm) rectangle (\\paperwidth,\\paperheight);
      \\fill[CoverAccent!15] (1.5cm,3cm) rectangle (\\paperwidth-1.5cm,3.08cm);
    \\end{tikzpicture}%
  }%
}
\\vspace*{6cm}
\\begin{center}
{\\fontsize{12}{14}\\selectfont\\bfseries\\color{CoverAccent}\\textls[200]{COWORK NEWS}}\\\\[1.2cm]
{\\fontsize{36}{42}\\selectfont\\bfseries\\color{white}${escapeLatexText(input.title)}}\\\\[0.8cm]
${input.subtitle?.trim() ? `{\\fontsize{16}{20}\\selectfont\\color{white!70}${escapeLatexText(input.subtitle)}}\\\\[1cm]` : ''}
${input.author?.trim() ? `{\\normalsize\\color{white!60}${escapeLatexText(input.author)}}\\\\[0.4cm]` : ''}
{\\normalsize\\color{CoverAccent}${escapeLatexText(dateLabel)}}
\\end{center}
\\vfill
\\begin{center}
{\\small\\color{white!40}Genere par Cowork News --- Studio Pro}
\\end{center}
\\vspace{1.5cm}
\\restoregeometry
\\newpage

% ─── SUMMARY ───
${summaryBlock}

% ─── SECTIONS ───
${sectionBlocks.join('\n\n\\vspace{0.6em}\n\n')}

% ─── SOURCES ───
${sourcesBlock}

\\end{document}`;
}

function buildNewsSectionBlock(heading: string, body: string, color: typeof NEWS_SECTION_COLORS[number], isFirst: boolean): string {
  const renderedBody = renderLatexParagraphs(body);
  const separator = isFirst ? '' : `{\\color{LightRule}\\rule{\\textwidth}{0.4pt}}\\vspace{0.4em}`;

  return `${separator}
\\begin{tcolorbox}[
  enhanced,
  colback=${color.bgLabel},
  colframe=${color.bgLabel},
  boxrule=0pt,
  borderline west={4pt}{0pt}{${color.label}},
  arc=3pt,
  left=14pt, right=14pt, top=12pt, bottom=12pt,
  shadow={1pt}{-1pt}{0pt}{black!6}
]
{\\Large\\bfseries\\color{${color.label}}${heading ? escapeLatexText(heading) : ''}}

\\vspace{0.3em}
{\\color{BlackInk}${renderedBody}}
\\end{tcolorbox}`;
}

export function appendLatexFragmentToDocument(source: string, fragment: string): string {
  if (!fragment.trim()) return source;
  const endDocumentPattern = /\\end\{document\}/i;
  if (!endDocumentPattern.test(source)) {
    return `${source.trim()}\n\n${fragment.trim()}\n`;
  }
  return source.replace(endDocumentPattern, `${fragment.trim()}\n\n\\end{document}`);
}

export function extractLatexCommandValue(source: string, command: string): string {
  const pattern = new RegExp(String.raw`\\${command}\{([^}]*)\}`, 'i');
  return (source.match(pattern)?.[1] || '').trim();
}

export function stripLatexToPlainText(source: string): string {
  return source
    .replace(/(^|[^\\])%.*$/gm, '$1')
    .replace(/\\(?:section|subsection|subsubsection|paragraph|title|subtitle|author)\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, ' $1 ')
    .replace(/\\(?:begin|end)\{[^}]+\}/g, ' ')
    .replace(/\\[a-zA-Z@]+(?:\*?)\[[^\]]*\]\{([^}]*)\}/g, ' $1 ')
    .replace(/\\[a-zA-Z@]+(?:\*?)\{([^}]*)\}/g, ' $1 ')
    .replace(/\\[a-zA-Z@]+(?:\*?)\[[^\]]*\]/g, ' ')
    .replace(/\\[a-zA-Z@]+(?:\*?)/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/~/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countLatexSections(source: string): number {
  const matches = source.match(/\\(?:section|subsection|subsubsection)\*?\{/g);
  return matches?.length || 0;
}

export function buildLatexSourceSignature(source: string, compiler?: LatexCompiler | null): string {
  return createHash('sha1')
    .update(JSON.stringify({
      compiler: normalizeLatexCompiler(compiler),
      source,
    }))
    .digest('hex')
    .slice(0, 16);
}

export function validateLatexSource(source: string): LatexValidationResult {
  const usedPackages = Array.from(source.matchAll(/\\(?:usepackage|RequirePackage)(?:\[[^\]]*\])?\{([^}]+)\}/g))
    .flatMap(match => match[1].split(','))
    .map(pkg => pkg.trim())
    .filter(Boolean);

  const unsupportedPackages = Array.from(new Set(usedPackages.filter(pkg => !ALLOWED_LATEX_PACKAGES.includes(pkg as (typeof ALLOWED_LATEX_PACKAGES)[number]))));
  const dangerousCommands = DANGEROUS_COMMAND_PATTERNS
    .filter(pattern => pattern.test(source))
    .map(pattern => pattern.source.replace(/\\\\/g, '\\'));
  const missingDocumentStructure: string[] = [];

  if (!/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/i.test(source)) {
    missingDocumentStructure.push('\\documentclass{...}');
  }
  if (!/\\begin\{document\}/i.test(source)) {
    missingDocumentStructure.push('\\begin{document}');
  }
  if (!/\\end\{document\}/i.test(source)) {
    missingDocumentStructure.push('\\end{document}');
  }

  return {
    ok: unsupportedPackages.length === 0 && dangerousCommands.length === 0 && missingDocumentStructure.length === 0,
    unsupportedPackages,
    dangerousCommands,
    missingDocumentStructure,
    usedPackages: Array.from(new Set(usedPackages)),
  };
}

function readCompileErrorPayload(contentType: string, bodyText: string): string {
  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(bodyText);
      return JSON.stringify(parsed);
    } catch {}
  }
  return bodyText.trim();
}

export async function compileLatexDocument(input: {
  source: string;
  compiler?: string | null;
  provider?: string | null;
  baseUrl?: string | null;
  timeoutMs?: number | null;
}): Promise<LatexCompileResult> {
  const compiler = normalizeLatexCompiler(input.compiler);
  const provider = normalizeLatexProvider(input.provider);
  const baseUrl = resolveLatexProviderBaseUrl(provider, input.baseUrl);
  const timeoutMs = Math.max(1_000, Number(input.timeoutMs || DEFAULT_TIMEOUT_MS));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = provider === 'latexonline'
      ? await fetch(`${baseUrl}/compile?text=${encodeURIComponent(input.source)}&command=${compiler}&force=true`, {
          method: 'GET',
          headers: { Accept: 'application/pdf, text/plain, application/json' },
          signal: controller.signal,
        })
      : await fetch(`${baseUrl}/builds/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/pdf, application/json, text/plain',
          },
          body: JSON.stringify({
            compiler,
            resources: [{ main: true, content: input.source }],
            options: {
              compiler: {
                halt_on_error: true,
                silent: false,
              },
              response: {
                log_files_on_failure: true,
              },
            },
          }),
          signal: controller.signal,
        });

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (response.ok && contentType.includes('application/pdf')) {
      const pdfBuffer = Buffer.from(await response.arrayBuffer());
      return {
        success: true,
        provider,
        compiler,
        pdfBuffer,
        compileLog: '',
        status: response.status,
        baseUrl,
      };
    }

    const bodyText = await response.text();
    const compileLog = readCompileErrorPayload(contentType, bodyText);
    return {
      success: false,
      provider,
      compiler,
      error: compileLog || `Compilation LaTeX echouee (${response.status}).`,
      compileLog,
      status: response.status,
      transient: response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500,
      baseUrl,
    };
  } catch (error: any) {
    const aborted = error?.name === 'AbortError';
    return {
      success: false,
      provider,
      compiler,
      error: aborted
        ? `Compilation LaTeX interrompue apres ${timeoutMs} ms.`
        : `Echec reseau pendant la compilation LaTeX: ${String(error?.message || error || 'erreur inconnue')}`,
      compileLog: aborted
        ? `Timeout ${timeoutMs} ms`
        : String(error?.stack || error?.message || error || ''),
      status: 0,
      transient: true,
      baseUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}
