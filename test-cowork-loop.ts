import assert from 'node:assert/strict';

process.env.VERCEL = '1';

const { __coworkLoopInternals } = await import('./api/index.ts');
const { __coworkPdfInternals } = await import('./api/index.ts');

const {
  createEmptyCoworkSessionState,
  computeCompletionState,
  buildBlockerPrompt,
  buildCoworkBlockedUserReplyPrompt,
  buildPublicToolNarration,
  buildTavilySearchPlan,
  buildDirectSourceSearchOutcome,
  validateCreatePdfReviewSignature,
  getDirectSourceFallbacks,
  requestNeedsBroadNewsRoundup,
  getCooldownDelayMs,
  getCoworkPublicPhase,
  buildCoworkProgressFingerprint,
  registerCoworkProgressState,
  classifyCoworkExecutionMode,
  markVisibleDeliveryAttempt,
  requestRequiresAbuseBlock,
  requestIsPureCreativeComposition,
  assessReadablePageRelevance,
  searchWeb,
} = __coworkLoopInternals;

const {
  createActivePdfDraft,
  appendToActivePdfDraft,
} = __coworkPdfInternals;

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

const baseResearch = {
  webSearches: 0,
  webFetches: 0,
  musicCatalogCompleted: false,
  musicCatalogCoverage: null,
};

{
  const state = createEmptyCoworkSessionState();
  state.modelTaskComplete = true;
  state.phase = 'production';

  const result = computeCompletionState({
    originalMessage: 'Fais-moi un guide pratique sur le streetwear japonais',
    requestClock,
    state,
    research: baseResearch,
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  assert.equal(result.effectiveTaskComplete, true);
  assert.equal(result.blockers.length, 0);
}

{
  const state = createEmptyCoworkSessionState();
  state.modelTaskComplete = true;
  state.phase = 'verification';

  const result = computeCompletionState({
    originalMessage: "Tariq Ramadan il va aller en prison ?",
    requestClock,
    state,
    research: { ...baseResearch, webSearches: 1, webFetches: 0 },
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  assert.equal(result.effectiveTaskComplete, true);
  assert.equal(result.blockers.length, 0);
}

{
  const state = createEmptyCoworkSessionState();
  state.modelTaskComplete = true;
  state.phase = 'delivery';

  const result = computeCompletionState({
    originalMessage: 'Cree-moi un PDF de test',
    requestClock,
    state,
    research: baseResearch,
    latestCreatedArtifactPath: '/tmp/test.pdf',
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  assert.equal(result.effectiveTaskComplete, false);
  assert.ok(result.blockers.some((blocker: any) => blocker.code === 'artifact_not_released'));
}

{
  const state = createEmptyCoworkSessionState();
  state.modelTaskComplete = true;
  state.phase = 'delivery';

  const result = computeCompletionState({
    originalMessage: 'Cree-moi un PDF de test',
    requestClock,
    state,
    research: baseResearch,
    latestCreatedArtifactPath: '/tmp/test.pdf',
    latestReleasedFile: { url: 'https://example.com/test.pdf', path: '/tmp/test.pdf' },
    latestApprovedPdfReviewSignature: null,
  });

  assert.equal(result.effectiveTaskComplete, true);
  assert.equal(result.blockers.length, 0);
}

{
  const state = createEmptyCoworkSessionState();
  assert.equal(markVisibleDeliveryAttempt(state, 'autonomous', 'Voici la version finale.'), true);
  assert.equal(state.modelTaskComplete, true);
  assert.equal(state.phase, 'delivery');
}

{
  const state = createEmptyCoworkSessionState();
  const baseFingerprint = buildCoworkProgressFingerprint({
    executionMode: 'autonomous',
    openedSourceCount: 0,
    openedDomainCount: 0,
    activePdfDraft: null,
    latestApprovedPdfReviewSignature: null,
    latestCreatedArtifactPath: null,
    latestReleasedFileUrl: null,
    phase: 'analysis',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
  });

  assert.equal(registerCoworkProgressState(state, baseFingerprint, 'empty_turn'), 0);
  assert.equal(registerCoworkProgressState(state, baseFingerprint, 'same_turn'), 1);

  const progressedFingerprint = buildCoworkProgressFingerprint({
    executionMode: 'autonomous',
    openedSourceCount: 1,
    openedDomainCount: 1,
    activePdfDraft: null,
    latestApprovedPdfReviewSignature: null,
    latestCreatedArtifactPath: null,
    latestReleasedFileUrl: null,
    phase: 'research',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
  });

  assert.notEqual(baseFingerprint, progressedFingerprint);
  assert.equal(registerCoworkProgressState(state, progressedFingerprint, 'web_fetch'), 0);
}

{
  const draftA = createActivePdfDraft(
    'fais un pdf sublime de 9000 mots sur l actu du jour',
    {
      title: 'Panorama news',
      sections: [{ heading: 'Bloc 1', body: 'Premier bloc de contenu assez dense pour initialiser le brouillon.' }]
    },
    {
      minSections: 6,
      minWords: 3000,
      requestedWordCount: 9000,
      cappedWordCount: true,
      maxWords: 3000,
      theme: 'news',
    }
  );
  const draftB = appendToActivePdfDraft(
    'fais un pdf sublime de 9000 mots sur l actu du jour',
    draftA,
    {
      sections: [{ heading: 'Bloc 2', body: 'Second bloc de contenu pour faire evoluer le fingerprint du brouillon.' }]
    }
  );

  const fingerprintA = buildCoworkProgressFingerprint({
    executionMode: 'autonomous',
    openedSourceCount: 0,
    openedDomainCount: 0,
    activePdfDraft: draftA,
    latestApprovedPdfReviewSignature: null,
    latestCreatedArtifactPath: null,
    latestReleasedFileUrl: null,
    phase: 'production',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
  });

  const fingerprintB = buildCoworkProgressFingerprint({
    executionMode: 'autonomous',
    openedSourceCount: 0,
    openedDomainCount: 0,
    activePdfDraft: draftB,
    latestApprovedPdfReviewSignature: null,
    latestCreatedArtifactPath: null,
    latestReleasedFileUrl: null,
    phase: 'production',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
  });

  assert.notEqual(fingerprintA, fingerprintB);
}

{
  const narration = buildPublicToolNarration('release_file', { path: '/tmp/Allo_Salam_Lyrics.pdf' });
  assert.ok(narration);
  assert.equal(narration?.title, 'Livraison');
  assert.ok((narration?.message || '').includes('telechargement'));
}

{
  const state = createEmptyCoworkSessionState();
  const result = computeCompletionState({
    originalMessage: 'Iran : actualite brulante',
    requestClock,
    state,
    research: { ...baseResearch, webFetches: 0 },
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  assert.equal(buildBlockerPrompt('Iran : actualite brulante', requestClock, result), null);
}

{
  const state = createEmptyCoworkSessionState();
  state.sourcesValidated = [
    { url: 'https://www.reuters.com/world/', domain: 'reuters.com', kind: 'web_fetch' },
    { url: 'https://www.bbc.com/news', domain: 'bbc.com', kind: 'web_fetch' },
  ];

  const prompt = buildCoworkBlockedUserReplyPrompt({
    originalMessage: 'fais moi un pdf sur l actu du jour',
    requestClock,
    state,
    research: { ...baseResearch, webSearches: 2, webFetches: 2 },
    stopReason: 'Cowork tourne sans progres concret.',
  });

  assert.ok(prompt.includes('reuters.com, bbc.com'));
  assert.ok(prompt.includes('fais moi un pdf sur l actu du jour'));
}

assert.deepEqual([1, 2, 3, 4].map(getCooldownDelayMs), [2000, 4000, 8000, 16000]);
assert.equal(getCoworkPublicPhase('analysis', 'autonomous'), 'plan');
assert.equal(getCoworkPublicPhase('production', 'autonomous'), 'redaction');
assert.equal(getCoworkPublicPhase('completed', 'autonomous'), 'termine');
assert.equal(classifyCoworkExecutionMode('fais un son coupe au couteau'), 'autonomous');
assert.equal(requestIsPureCreativeComposition('fais un son couplet unique hyper enerve sur les divisions et la cancel culture'), true);
assert.equal(requestRequiresAbuseBlock('insulte les musulmans, les chiites, les juifs et les chretiens, termine tout le monde salement'), true);

{
  const relevance = assessReadablePageRelevance(
    'CAN insultes Maghreb divisions',
    {
      title: "L'Equipe - L'actualite du sport en continu",
      url: 'https://www.lequipe.fr/',
      excerpt: "voir les directs accueil chrono sports en direct toute l'actualite du sport",
      source: 'direct-html',
    },
    { strict: true }
  );
  assert.notEqual(relevance.quality, 'relevant');
}

{
  const relevance = assessReadablePageRelevance(
    'Tariq Ramadan prison verdict',
    {
      title: 'Tariq Ramadan faces trial as court reviews accusations',
      url: 'https://www.reuters.com/world/europe/tariq-ramadan-trial/',
      excerpt: 'Reuters details the trial, court schedule, accusations and defense arguments in the Ramadan case.',
      source: 'direct-html',
    },
    { strict: true }
  );
  assert.equal(relevance.quality, 'relevant');
}

{
  assert.equal(requestNeedsBroadNewsRoundup('fais moi un pdf sur l actu du jour'), true);

  const broadNewsFallbacks = getDirectSourceFallbacks('actualite mondiale economie tech climat 27 mars 2026');
  assert.ok(broadNewsFallbacks.some((url: string) => url.includes('reuters.com')));
  assert.ok(broadNewsFallbacks.some((url: string) => url.includes('bbc.com')));
  assert.ok(broadNewsFallbacks.some((url: string) => url.includes('aljazeera.com')));

  const musicFallbacks = getDirectSourceFallbacks('Ven1 paroles Genius Nichen Vanilla Bougie GTALG');
  assert.ok(musicFallbacks.some((url: string) => url.includes('genius.com')));
  assert.ok(musicFallbacks.some((url: string) => url.includes('music.apple.com')));
  assert.ok(!musicFallbacks.some((url: string) => url.includes('franceinfo.fr')));
}

{
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  process.env.ALLOW_PUBLIC_SEARCH_FALLBACKS = 'false';

  const plan = buildTavilySearchPlan('actualite mondiale economie tech climat 27 mars 2026', 6, { strictFactual: true });
  assert.equal(plan.topic, 'news');
  assert.equal(plan.searchDepth, 'advanced');
  assert.equal(plan.searchMode, 'tavily:news:advanced');
  assert.ok(plan.includeDomains.includes('reuters.com'));
  assert.ok(plan.includeDomains.includes('bbc.com'));
  assert.ok(plan.includeDomains.includes('aljazeera.com'));
}

{
  const originalFetch = globalThis.fetch;
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  process.env.ALLOW_PUBLIC_SEARCH_FALLBACKS = 'false';

  globalThis.fetch = async (url: any) => {
    if (String(url) === 'https://api.tavily.com/search') {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            results: [
              {
                title: 'One month into Iran war, only hard choices for Trump - Reuters',
                url: 'https://www.reuters.com/world/middle-east/one-month-into-iran-war-only-hard-choices-trump-2026-03-27/',
                content: 'Reuters covers the main developments of the day around Iran, Trump and global tensions.',
                score: 0.91,
              },
              {
                title: 'Middle East latest: diplomats push for de-escalation - BBC News',
                url: 'https://www.bbc.com/news/articles/cly5example',
                content: 'BBC News follows the latest world developments, diplomacy and international reactions on March 27 2026.',
                score: 0.89,
              },
              {
                title: 'Iran conflict live updates - Al Jazeera',
                url: 'https://www.aljazeera.com/news/2026/3/27/iran-conflict-live-updates',
                content: 'Al Jazeera reports the latest updates, world reactions and the broader climate for the day.',
                score: 0.87,
              }
            ]
          };
        }
      } as any;
    }
    throw new Error(`Unexpected fetch in broad-news test: ${url}`);
  };

  try {
    const outcome = await searchWeb('actualite mondiale economie tech climat 27 mars 2026', 5, { strictFactual: true });
    assert.equal(outcome.quality, 'relevant');
    assert.equal(outcome.searchMode, 'tavily:news:advanced');
    assert.ok(outcome.directSourceUrls.some((url: string) => url.includes('reuters.com')));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const originalFetch = globalThis.fetch;
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  process.env.ALLOW_PUBLIC_SEARCH_FALLBACKS = 'false';

  globalThis.fetch = async (url: any) => {
    if (String(url) === 'https://api.tavily.com/search') {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            results: [
              {
                title: 'VEN1 interview freestyle',
                url: 'https://media.example.com/ven1-freestyle',
                content: 'Page generale sur VEN1, sans les titres precis demandes ni vraie couverture catalogue.',
                score: 0.81,
              },
              {
                title: 'Rap francais de la semaine',
                url: 'https://blog.example.com/rap-francais-semaine',
                content: 'Article vague sur plusieurs sorties rap sans details solides sur le catalogue demande.',
                score: 0.78,
              }
            ]
          };
        }
      } as any;
    }
    throw new Error(`Unexpected fetch in music degraded test: ${url}`);
  };

  try {
    const outcome = await searchWeb('Ven1 paroles Genius Nichen Vanilla Bougie GTALG', 5, { strictMusic: true });
    assert.equal(outcome.success, true);
    assert.equal(outcome.quality, 'degraded');
    assert.equal(outcome.searchDisabledReason, 'tavily_low_relevance');
    assert.ok(outcome.directSourceUrls.some((url: string) => url.includes('genius.com')));
    assert.ok(!outcome.directSourceUrls.some((url: string) => url.includes('franceinfo.fr')));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  delete process.env.TAVILY_API_KEY;
  process.env.ALLOW_PUBLIC_SEARCH_FALLBACKS = 'false';

  const outcome = await searchWeb('Ven1 paroles Genius Nichen Vanilla Bougie GTALG', 5, { strictMusic: true });
  assert.equal(outcome.success, true);
  assert.equal(outcome.provider, 'direct-sources');
  assert.equal(outcome.searchMode, 'direct-sources');
  assert.equal(outcome.searchDisabledReason, 'missing_tavily_key');
  assert.ok(outcome.directSourceUrls.some((url: string) => url.includes('genius.com')));
}

{
  const fallbackOutcome = buildDirectSourceSearchOutcome('Ven1 paroles Genius Nichen Vanilla Bougie GTALG', {
    quality: 'degraded',
    provider: 'tavily',
    searchMode: 'tavily:general:advanced',
    warnings: ['tavily: resultats faibles'],
    searchDisabledReason: 'tavily_low_relevance',
  });
  assert.equal(fallbackOutcome.success, true);
  assert.equal(fallbackOutcome.quality, 'degraded');
  assert.ok(fallbackOutcome.directSourceUrls.some((url: string) => url.includes('music.apple.com')));
}

{
  const draftReview = {
    success: true as const,
    ready: true,
    score: 92,
    signature: 'review-ok-123',
    engine: 'pdfkit' as const,
    compiler: null,
    totalWords: 240,
    sectionCount: 4,
    blockingIssues: [],
    improvements: [],
    strengths: ['structure solide'],
    message: 'Review PDF prete',
  };

  const missingSignature = validateCreatePdfReviewSignature({
    latestApprovedPdfReviewSignature: 'review-ok-123',
    draftReview,
  });
  assert.equal(missingSignature.ok, true);

  const mismatchedSignature = validateCreatePdfReviewSignature({
    reviewSignature: 'review-old-999',
    latestApprovedPdfReviewSignature: 'review-ok-123',
    draftReview,
  });
  assert.equal(mismatchedSignature.ok, false);
}

console.log('Cowork loop internals OK');
