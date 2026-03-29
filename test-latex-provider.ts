import assert from 'node:assert/strict';
import http from 'node:http';

import {
  ALLOWED_LATEX_PACKAGES,
  buildLatexDocument,
  compileLatexDocument,
  validateLatexSource,
} from './server/pdf/latex.ts';

function startMockLatexServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/builds/sync') {
      res.writeHead(404).end('Not found');
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const source = String(payload?.resources?.[0]?.content || '');

    if (source.includes('TIMEOUT_LATEX')) {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        res.end(Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF', 'latin1'));
      }, 1500);
      return;
    }

    if (source.includes('FAIL_LATEX')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Undefined control sequence',
        log: '! Undefined control sequence.\nl.42 \\FAIL_LATEX'
      }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/pdf' });
    res.end(Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF', 'latin1'));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`
      });
    });
  });
}

const { server, baseUrl } = await startMockLatexServer();

try {
  const source = buildLatexDocument({
    compiler: 'xelatex',
    theme: 'report',
    title: 'Rapport de test',
    subtitle: 'Pipeline LaTeX',
    summary: 'Un rapport de controle pour le provider HTTP mocke.',
    author: 'Cowork',
    sections: [
      {
        heading: 'Constat',
        body: 'Le document compile via un provider externe compatible YtoTech.',
        visualTheme: 'arbres',
        mood: 'calme organique',
        motif: 'canopee',
        pageStyle: 'feature',
      },
      {
        heading: 'Verification',
        body: 'La compilation doit renvoyer un flux PDF binaire exploitable.',
        visualTheme: 'guerre',
        mood: 'gravite geopolitique',
        motif: 'front',
        pageStyle: 'hero',
        pageBreakBefore: true,
        flagHints: ['Ukraine', 'France'],
      },
    ],
    sources: ['https://example.com/source'],
    dateLabel: '27 mars 2026',
    absoluteDateTimeLabel: 'vendredi 27 mars 2026 11:00',
  });

  assert.ok(source.includes('\\usetikzlibrary{arrows.meta,calc,positioning}'));
  assert.ok(source.includes('Section1Accent'));
  assert.ok(source.includes('Ukraine'));
  assert.ok(source.includes('\\clearpage'));
  assert.equal(validateLatexSource(source).ok, true);

  const success = await compileLatexDocument({
    source,
    provider: 'ytotech',
    baseUrl,
    timeoutMs: 1500,
  });
  assert.equal(success.success, true);
  if (success.success) {
    assert.equal(success.provider, 'ytotech');
    assert.equal(success.compiler, 'xelatex');
    assert.ok(success.pdfBuffer.length > 8);
  }

  const failure = await compileLatexDocument({
    source: `${source}\n\\FAIL_LATEX`,
    provider: 'ytotech',
    baseUrl,
    timeoutMs: 1500,
  });
  assert.equal(failure.success, false);
  if (!failure.success) {
    assert.equal(failure.transient, false);
    assert.ok(failure.error.includes('Undefined control sequence'));
    assert.ok(failure.compileLog.includes('FAIL_LATEX'));
  }

  const timeout = await compileLatexDocument({
    source: `${source}\n% TIMEOUT_LATEX`,
    provider: 'ytotech',
    baseUrl,
    timeoutMs: 5,
  });
  assert.equal(timeout.success, false);
  if (!timeout.success) {
    assert.equal(timeout.transient, true);
    assert.ok(timeout.error.includes('interrompue') || timeout.error.includes('Timeout'));
  }

  const validation = validateLatexSource(String.raw`\documentclass{article}
\usepackage{geometry,foo}
\begin{document}
\write18{rm -rf /}
Texte
\end{document}`);
  assert.equal(validation.ok, false);
  assert.ok(validation.unsupportedPackages.includes('foo'));
  assert.ok(validation.dangerousCommands.length >= 1);
  assert.ok(ALLOWED_LATEX_PACKAGES.includes('geometry'));
  assert.ok(ALLOWED_LATEX_PACKAGES.includes('calc'));
  assert.ok(ALLOWED_LATEX_PACKAGES.includes('fontawesome5'));
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

console.log('Latex provider OK');
