import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.VERCEL = '1';

const { __coworkPdfInternals } = await import('./api/index.ts');

const {
  extractRequestedWordCount,
  resolvePdfTheme,
  requestNeedsFormalDocument,
  requestNeedsFictionalDetails,
  requestNeedsPdfArtifact,
  getPdfQualityTargets,
  createActivePdfDraft,
  appendToActivePdfDraft,
  buildPdfDraftStats,
  renderPdfArtifact,
  countTemplatePlaceholders,
  countFormalDocumentSignals
} = __coworkPdfInternals;

const attestationPrompt = 'fais moi une attestation de stage fictive de bts 2eme annee';

assert.equal(requestNeedsFormalDocument(attestationPrompt), true);
assert.equal(requestNeedsFictionalDetails(attestationPrompt), true);
assert.equal(requestNeedsPdfArtifact(attestationPrompt), true);

const targets = getPdfQualityTargets(attestationPrompt);
assert.ok(targets, 'formal document prompt should get PDF quality targets');
assert.equal(targets?.formalDocument, true);
assert.equal(targets?.requireInventedDetails, true);
assert.ok((targets?.minSections || 0) >= 3);
assert.ok((targets?.minWords || 0) >= 200);

assert.equal(extractRequestedWordCount('fais un pdf de 9000 mots sur l actu'), 9000);
const cappedTargets = getPdfQualityTargets('fais un pdf sublime de 9000 mots sur l actu du jour');
assert.ok(cappedTargets, 'capped long-form prompt should get PDF quality targets');
assert.equal(cappedTargets?.requestedWordCount, 9000);
assert.equal(cappedTargets?.cappedWordCount, true);
assert.equal(cappedTargets?.minWords, 3000);
assert.equal(cappedTargets?.theme, 'news');

assert.equal(resolvePdfTheme(attestationPrompt, { formalDocument: true }), 'legal');
assert.equal(resolvePdfTheme('fais un dossier news sur l actu du jour'), 'news');
assert.equal(resolvePdfTheme('fais un beau rapport de synthese produit'), 'report');

const draft = createActivePdfDraft(
  'fais un pdf sublime de 9000 mots sur l actu du jour',
  {
    title: 'Panorama justice',
    summary: 'Synthese initiale.',
    sections: [{ heading: 'Introduction', body: 'Un premier bloc de texte relativement court pour amorcer le brouillon.' }]
  },
  cappedTargets
);
assert.equal(draft.targetWords, 3000);
assert.equal(draft.cappedWords, true);
assert.equal(draft.theme, 'news');

const reviewedDraft = {
  ...draft,
  approvedReviewSignature: 'review-ok-123'
};
const appendedDraft = appendToActivePdfDraft(
  'fais un pdf sublime de 9000 mots sur l actu du jour',
  reviewedDraft,
  {
    sections: [{ heading: 'Section 2', body: 'Deuxieme bloc de contenu suffisamment dense pour invalider la signature precedente et faire grossir le brouillon.' }]
  }
);
const appendedStats = buildPdfDraftStats(appendedDraft);
assert.equal(appendedDraft.approvedReviewSignature, null);
assert.ok(appendedStats.wordCount > draft.wordCount);
assert.ok(appendedStats.sectionCount >= 2);

assert.equal(countTemplatePlaceholders('[NOM DU TUTEUR] <DATE> ____'), 3);
assert.ok(
  countFormalDocumentSignals(
    'Je soussigne certifie que la societe accueille un stagiaire BTS pour une periode du 1er avril au 31 mai. Fait a Paris, signature et cachet.'
  ) >= 4
);

const requestClock = {
  now: new Date('2026-03-27T10:00:00.000Z'),
  locale: 'fr-FR',
  timeZone: 'Europe/Paris',
  absoluteDateTimeLabel: 'vendredi 27 mars 2026 11:00',
  dateLabel: '27 mars 2026',
  footerDateLabel: '27/03/2026',
  searchDateLabel: '27 mars 2026',
  yearLabel: '2026',
};

const tmpShort = path.join(os.tmpdir(), 'cowork-short-test.pdf');
const tmpNews = path.join(os.tmpdir(), 'cowork-news-test.pdf');
const tmpLegal = path.join(os.tmpdir(), 'cowork-legal-test.pdf');

const shortRender = await renderPdfArtifact({
  outputPath: tmpShort,
  title: 'PDF court',
  subtitle: 'Test simple',
  summary: 'Resume court.',
  sections: [
    { heading: 'Bloc 1', body: 'Un petit contenu utile mais sans longueur artificielle.' },
    { heading: 'Bloc 2', body: 'Une seconde section breve pour verifier un rendu propre.' },
  ],
  sources: [],
  requestClock,
  message: 'cree moi un pdf court de test',
  pdfQualityTargets: null,
  theme: 'report',
});
assert.equal(shortRender.blankBodyPageCount, 0);
assert.equal(shortRender.usedCoverPage, false);

const longSection = 'Ce paragraphe developpe des faits, du contexte, des implications et des points de vigilance de maniere detaillee. '.repeat(18);
const newsRender = await renderPdfArtifact({
  outputPath: tmpNews,
  title: 'Panorama actualite',
  subtitle: 'Edition du jour',
  summary: 'Un chapo editorial qui situe les enjeux majeurs avant le detail du dossier.',
  sections: [
    { heading: 'Ouverture', body: longSection },
    { heading: 'Faits clefs', body: longSection },
    { heading: 'Reactions', body: longSection },
    { heading: 'Ce qu il faut retenir', body: longSection },
  ],
  sources: ['https://www.franceinfo.fr/', 'https://www.france24.com/fr/'],
  requestClock,
  message: 'fais un pdf sublime de 9000 mots sur l actu du jour',
  pdfQualityTargets: cappedTargets,
  theme: 'news',
});
assert.equal(newsRender.blankBodyPageCount, 0);
assert.equal(newsRender.theme, 'news');

const legalRender = await renderPdfArtifact({
  outputPath: tmpLegal,
  title: 'Attestation de stage',
  subtitle: 'Document fictif',
  summary: 'Attestation officielle emise pour verification de rendu.',
  author: 'Direction RH',
  sections: [
    { heading: 'Emetteur', body: 'La societe Example certifie accueillir un stagiaire BTS au sein du service produit.' },
    { heading: 'Periode', body: 'Le stage se deroule du 1er avril 2026 au 31 mai 2026 a Paris.' },
    { heading: 'Validation', body: 'Fait a Paris le 27 mars 2026. Signature de la direction RH et cachet de l entreprise.' },
  ],
  sources: [],
  requestClock,
  message: attestationPrompt,
  pdfQualityTargets: targets,
  theme: 'legal',
});
assert.equal(legalRender.blankBodyPageCount, 0);
assert.equal(legalRender.theme, 'legal');
assert.equal(legalRender.usedCoverPage, false);

for (const filePath of [tmpShort, tmpNews, tmpLegal]) {
  fs.rmSync(filePath, { force: true });
}

console.log('PDF heuristics OK');
