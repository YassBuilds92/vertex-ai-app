import { createHash } from 'node:crypto';

export type LatexCompiler = 'pdflatex' | 'xelatex' | 'lualatex';
export type LatexProvider = 'ytotech' | 'latexonline';
export type LatexTheme = 'legal' | 'news' | 'report';

export type LatexSectionInput = {
  heading?: string;
  body: string;
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
] as const;

const DANGEROUS_COMMAND_PATTERNS = [
  /\\write18\b/i,
  /\\openout\b/i,
  /\\immediate\s*\\write\b/i,
  /\\read\b/i,
];

const SPECIAL_LATEX_CHARS = /([#$%&_{}])/g;

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
  const accentHex = normalizeHexColor(input.accentColor, input.theme === 'news' ? '#b91c1c' : input.theme === 'legal' ? '#1e3a8a' : '#1d4ed8').slice(1);
  const babelLocale = 'french';
  const fontBlock = compiler === 'pdflatex'
    ? '\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}'
    : '';
  const masthead = input.theme === 'news'
    ? 'COWORK NEWS DESK'
    : input.theme === 'legal'
      ? 'DOCUMENT OFFICIEL'
      : 'STUDIO PRO / COWORK REPORT';
  const summaryLabel = input.theme === 'news'
    ? 'Chapo'
    : input.theme === 'legal'
      ? 'Introduction'
      : 'Resume executif';
  const titleFormat = input.theme === 'news'
    ? '\\titleformat{\\section}{\\Large\\bfseries\\color{Accent}}{}{0em}{}'
    : input.theme === 'legal'
      ? '\\titleformat{\\section}{\\large\\bfseries\\color{BlackInk}}{}{0em}{}'
      : '\\titleformat{\\section}{\\Large\\bfseries\\color{Accent}}{}{0em}{}';
  const summaryBlock = input.summary?.trim()
    ? `\\begin{tcolorbox}[colback=Accent!6,colframe=Accent,title=${escapeLatexText(summaryLabel)}]\n${renderLatexParagraphs(input.summary)}\n\\end{tcolorbox}`
    : '';
  const subtitleBlock = input.subtitle?.trim()
    ? `{\Large\\color{Muted}${escapeLatexText(input.subtitle)}}\\\\[0.6cm]`
    : '';
  const authorBlock = input.author?.trim()
    ? `{\normalsize\\textbf{${escapeLatexText(input.author)}}}\\\\[0.35cm]`
    : '';
  const dateBlock = input.absoluteDateTimeLabel?.trim()
    ? `{\small\\color{Muted}${escapeLatexText(input.absoluteDateTimeLabel)}}\\\\[1.2cm]`
    : input.dateLabel?.trim()
      ? `{\small\\color{Muted}${escapeLatexText(input.dateLabel)}}\\\\[1.2cm]`
      : '';
  const body = buildLatexFragment({
    sections: input.sections,
    sources: input.sources,
  });

  return `\\documentclass[11pt,a4paper]{article}
${fontBlock}
\\usepackage[${babelLocale}]{babel}
\\usepackage{xcolor}
\\usepackage[a4paper,margin=2cm]{geometry}
\\usepackage{titlesec}
\\usepackage{fancyhdr}
\\usepackage{graphicx}
\\usepackage[most]{tcolorbox}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{tabularx}
\\usepackage{multicol}
\\usepackage{tikz}

\\definecolor{Accent}{HTML}{${accentHex}}
\\definecolor{BlackInk}{HTML}{0F172A}
\\definecolor{Muted}{HTML}{475569}
\\definecolor{Panel}{HTML}{F8FAFC}

\\hypersetup{
  colorlinks=true,
  linkcolor=Accent,
  urlcolor=Accent,
  pdftitle={${escapeLatexText(input.title)}},
  pdfauthor={${escapeLatexText(input.author || 'Studio Pro Agent')}}
}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\textcolor{Muted}{${escapeLatexText(masthead)}}}
\\fancyhead[R]{\\textcolor{Muted}{${escapeLatexText(input.dateLabel || '')}}}
\\fancyfoot[C]{\\textcolor{Muted}{\\thepage}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\footrulewidth}{0pt}
${titleFormat}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.8em}
\\setlist[itemize]{leftmargin=1.4em}

\\begin{document}

\\begin{center}
{\\small\\textcolor{Accent}{${escapeLatexText(masthead)}}}\\\\[0.7cm]
{\\fontsize{28}{34}\\selectfont\\bfseries\\color{BlackInk}${escapeLatexText(input.title)}}\\\\[0.4cm]
${subtitleBlock}
${authorBlock}
${dateBlock}
\\end{center}

${summaryBlock}

${body}

\\end{document}`;
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
