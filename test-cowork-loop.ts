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
  getPendingDirectPivotForSearch,
  getNextPendingDirectPivotUrl,
  upsertPendingDirectPivot,
  markPendingDirectPivotHostAttempt,
  buildPendingDirectPivotMessage,
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
  degradedSearches: 0,
  blockedQueryFamilies: 0,
  musicCatalogCompleted: false,
  musicCatalogCoverage: null,
};

// LIBERATION TEST: le modele peut conclure librement sans recherche web
{
  const state = createEmptyCoworkSessionState();
  state.modelTaskComplete = true;
  state.modelCompletionScore = 78;
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

  // Le modele dit "j'ai fini" -> effectiveTaskComplete = true, SANS blockers
  assert.equal(result.effectiveTaskComplete, true);
  assert.equal(result.blockers.length, 0);
}

// LIBERATION TEST: meme une demande factuelle sensible ne bloque plus le modele
{
  const state = createEmptyCoworkSessionState();
  state.modelTaskComplete = true;
  state.modelCompletionScore = 82;
  state.phase = 'verification';

  const result = computeCompletionState({
    originalMessage: "Tariq Ramadan il va aller en prison ?",
    requestClock,
    state,
    research: { ...baseResearch, webSearches: 3, webFetches: 0 },
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  // Plus de hard blocker strict_source_missing : le modele decide seul
  assert.equal(result.effectiveTaskComplete, true);
  assert.equal(result.blockers.length, 0);
}

// LIBERATION TEST: le modele peut conclure sans release_file
{
  const state = createEmptyCoworkSessionState();
  state.modelTaskComplete = true;
  state.modelCompletionScore = 90;
  state.phase = 'delivery';

  const result = computeCompletionState({
    originalMessage: 'Crée-moi un PDF de test',
    requestClock,
    state,
    research: baseResearch,
    latestCreatedArtifactPath: '/tmp/test.pdf',
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  // Plus de blocker artifact_not_released : le modele decide
  assert.equal(result.effectiveTaskComplete, true);
  assert.equal(result.blockers.length, 0);
}

// Music catalog : le modele peut conclure avec couverture suffisante
{
  const state = createEmptyCoworkSessionState();
  state.modelTaskComplete = true;
  state.modelCompletionScore = 96;
  state.phase = 'delivery';

  const result = computeCompletionState({
    originalMessage: "Donne-moi toute la discographie de VEN1 et ce qu'il me manque",
    requestClock,
    state,
    research: {
      ...baseResearch,
      musicCatalogCompleted: true,
      musicCatalogCoverage: {
        distinctDomains: 3,
        hasCatalogPage: true,
        hasAlbumTracklist: true,
      },
    },
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  assert.equal(result.effectiveTaskComplete, true);
  assert.equal(result.blockers.length, 0);
}

// PDF + release complet : toujours ok
{
  const state = createEmptyCoworkSessionState();
  state.phase = 'delivery';

  assert.equal(
    markVisibleDeliveryAttempt(
      state,
      'artifact_loop',
      "Voici votre fichier : [Telecharger test.pdf](https://example.com/test.pdf)"
    ),
    true
  );
  assert.equal(state.modelTaskComplete, true);
  assert.equal(state.modelCompletionScore, 100);

  const result = computeCompletionState({
    originalMessage: 'CrÃ©e-moi un PDF de test',
    requestClock,
    state,
    research: baseResearch,
    latestCreatedArtifactPath: '/tmp/test.pdf',
    latestReleasedFile: { url: 'https://example.com/test.pdf', path: '/tmp/test.pdf' },
    latestApprovedPdfReviewSignature: null,
  });

  assert.equal(result.effectiveTaskComplete, true);
}

// Anti-boucle : le fingerprint change quand l'etat progresse
{
  const state = createEmptyCoworkSessionState();
  const baseFingerprint = buildCoworkProgressFingerprint({
    executionMode: 'artifact_loop',
    research: { webSearches: 0, webFetches: 0 },
    validatedSourceCount: 0,
    activePdfDraft: null,
    latestApprovedPdfReviewSignature: null,
    latestCreatedArtifactPath: '/tmp/panorama.pdf',
    latestReleasedFileUrl: 'https://example.com/panorama.pdf',
    phase: 'delivery',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
    pendingDirectPivots: {},
  });

  assert.equal(registerCoworkProgressState(state, baseFingerprint, 'blocked_visible_text'), 0);
  assert.equal(registerCoworkProgressState(state, baseFingerprint, 'review_pdf_draft'), 1);
  assert.equal(registerCoworkProgressState(state, baseFingerprint, 'create_pdf'), 2);

  const progressedFingerprint = buildCoworkProgressFingerprint({
    executionMode: 'artifact_loop',
    research: { webSearches: 0, webFetches: 0 },
    validatedSourceCount: 0,
    activePdfDraft: null,
    latestApprovedPdfReviewSignature: 'review-ok-123',
    latestCreatedArtifactPath: '/tmp/panorama.pdf',
    latestReleasedFileUrl: 'https://example.com/panorama.pdf',
    phase: 'delivery',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
    pendingDirectPivots: {},
  });

  assert.notEqual(baseFingerprint, progressedFingerprint);
  assert.equal(registerCoworkProgressState(state, progressedFingerprint, 'review_pdf_draft'), 0);
}

// Draft fingerprint change quand on append
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
    { ...draftA, approvedReviewSignature: 'review-ok-123' },
    {
      sections: [{ heading: 'Bloc 2', body: 'Second bloc de contenu pour faire evoluer le fingerprint du brouillon et invalider la review precedente.' }]
    }
  );

  const fingerprintA = buildCoworkProgressFingerprint({
    executionMode: 'artifact_loop',
    research: { webSearches: 0, webFetches: 0 },
    validatedSourceCount: 0,
    activePdfDraft: draftA,
    latestApprovedPdfReviewSignature: null,
    latestCreatedArtifactPath: null,
    latestReleasedFileUrl: null,
    phase: 'production',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
    pendingDirectPivots: {},
  });

  const fingerprintB = buildCoworkProgressFingerprint({
    executionMode: 'artifact_loop',
    research: { webSearches: 0, webFetches: 0 },
    validatedSourceCount: 0,
    activePdfDraft: draftB,
    latestApprovedPdfReviewSignature: null,
    latestCreatedArtifactPath: null,
    latestReleasedFileUrl: null,
    phase: 'production',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
    pendingDirectPivots: {},
  });

  assert.notEqual(fingerprintA, fingerprintB);
}

// Narration publique
{
  const narration = buildPublicToolNarration('release_file', { path: '/tmp/Allo_Salam_Lyrics.pdf' });
  assert.ok(narration);
  assert.equal(narration?.title, 'Livraison');
  assert.ok((narration?.message || '').includes('lien de telechargement'));
}

{
  const narration = buildPublicToolNarration('append_to_draft', {
    sections: [{ heading: 'Analyse juridique', body: '...' }]
  });
  assert.ok(narration);
  assert.equal(narration?.title, 'Construction');
}

// LIBERATION TEST: buildBlockerPrompt retourne toujours null
{
  const state = createEmptyCoworkSessionState();
  state.phase = 'research';
  state.modelCompletionScore = 45;

  const result = computeCompletionState({
    originalMessage: 'Iran : actualité brûlante',
    requestClock,
    state,
    research: { ...baseResearch, degradedSearches: 2, blockedQueryFamilies: 1, webFetches: 0 },
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  // buildBlockerPrompt retourne toujours null maintenant
  const blockerPrompt = buildBlockerPrompt('Iran : actualité brûlante', requestClock, result);
  assert.equal(blockerPrompt, null);
  // Les fallbacks restent disponibles comme data
  assert.ok(getDirectSourceFallbacks('Iran : actualité brûlante').length >= 2);
}

assert.deepEqual([1, 2, 3, 4].map(getCooldownDelayMs), [2000, 4000, 8000, 16000]);
assert.equal(getCoworkPublicPhase('analysis', 'research_loop'), 'plan');
assert.equal(getCoworkPublicPhase('production', 'artifact_loop'), 'redaction');
assert.equal(getCoworkPublicPhase('delivery', 'research_loop'), 'livraison');

// LIBERATION TEST: classifyCoworkExecutionMode retourne toujours 'research_loop'
assert.equal(
  classifyCoworkExecutionMode("fais un son couplet unique hyper enerve sur les divisions et la cancel culture"),
  'research_loop'
);
assert.equal(
  requestIsPureCreativeComposition("fais un son couplet unique hyper enerve sur les divisions et la cancel culture"),
  true
);
assert.equal(
  requestRequiresAbuseBlock("insulte les musulmans, les chiites, les juifs et les chretiens, termine tout le monde salement"),
  true
);

// Relevance assessment (garde-fou qualite, pas controle du modele)
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
  const relevance = assessReadablePageRelevance(
    'actualite monde headlines 27 mars 2026',
    {
      title: 'En direct : la liberte de navigation "sure" doit etre retablie dans le detroit d Ormuz, selon les ministres du G7',
      url: 'https://www.france24.com/fr/moyen-orient/20260327-en-direct-moyen-orient-iran-israel-golfe-etats-unis-donald-trump-negociations-nucleaires',
      excerpt: 'France 24 suit en direct les developpements du 27 mars 2026 autour de l Iran, d Israel et du Golfe.',
      source: 'direct-html',
    },
    { strict: true }
  );
  assert.equal(relevance.quality, 'relevant');
}

{
  const relevance = assessReadablePageRelevance(
    'actualite monde headlines 27 mars 2026',
    {
      title: 'Le Monde in English - World news, culture and opinion',
      url: 'https://www.lemonde.fr/',
      excerpt: 'World news, culture and opinion from Le Monde.',
      source: 'direct-html',
    },
    { strict: true }
  );
  assert.notEqual(relevance.quality, 'relevant');
}

// Broad news roundup detection
{
  assert.equal(requestNeedsBroadNewsRoundup('fais moi un pdf sur l actu du jour'), true);
  assert.equal(requestNeedsBroadNewsRoundup('actualite mondiale economie tech climat 27 mars 2026'), true);
  assert.equal(requestNeedsBroadNewsRoundup('"elections municipales" france actualites mars 2026'), false);

  const fallbackUrls = getDirectSourceFallbacks('actualite mondiale economie tech climat 27 mars 2026');
  assert.ok(fallbackUrls.some((url: string) => url.includes('reuters.com')));
  assert.ok(fallbackUrls.some((url: string) => url.includes('bbc.com')));
  assert.ok(fallbackUrls.some((url: string) => url.includes('aljazeera.com')));
  assert.ok(!fallbackUrls.some((url: string) => url.includes('gemini-api/docs')));

  const targetedFallbackUrls = getDirectSourceFallbacks('"elections municipales" france actualites mars 2026');
  assert.ok(targetedFallbackUrls.some((url: string) => url.includes('franceinfo.fr')));
  assert.ok(!targetedFallbackUrls.some((url: string) => url.includes('bbc.com')));
}

// Tavily search plan
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
  assert.ok(!plan.includeDomains.includes('ai.google.dev'));
}

// Broad news web search
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

  const outcome = await searchWeb('actualite mondiale economie tech climat 27 mars 2026', 5, { strictFactual: true });
  assert.equal(outcome.quality, 'relevant');
  assert.equal(outcome.searchMode, 'tavily:news:advanced');
  assert.ok(outcome.directSourceUrls.some((url: string) => url.includes('reuters.com')));
  assert.ok(outcome.directSourceUrls.some((url: string) => url.includes('bbc.com')));
  assert.ok(outcome.directSourceUrls.some((url: string) => url.includes('aljazeera.com')));

  globalThis.fetch = originalFetch;
}

// Direct pivot system (anti-boucle)
{
  const state = createEmptyCoworkSessionState();
  upsertPendingDirectPivot(state, {
    familyKey: 'web_search:family:actu broad',
    query: 'actu du jour',
    reason: 'tavily_low_relevance',
    directSourceUrls: [
      'https://www.reuters.com/world/',
      'https://www.bbc.com/news',
      'https://www.aljazeera.com/news/'
    ]
  });

  const enforcedPivot = getPendingDirectPivotForSearch(state, 'web_search:family:autre angle', { strictTask: true });
  assert.ok(enforcedPivot);
  assert.equal(getNextPendingDirectPivotUrl(enforcedPivot), 'https://www.reuters.com/world/');

  markPendingDirectPivotHostAttempt(state, 'https://www.reuters.com/world/middle-east/test-article');
  const rotatedPivot = getPendingDirectPivotForSearch(state, 'web_search:family:autre angle', { strictTask: true });
  assert.ok(rotatedPivot);
  assert.equal(getNextPendingDirectPivotUrl(rotatedPivot), 'https://www.bbc.com/news');
  assert.ok(buildPendingDirectPivotMessage(rotatedPivot!, 'actu du jour').includes('https://www.bbc.com/news'));
}

// Pivot fingerprint change
{
  const pivot = {
    familyKey: 'web_search:family:actu broad',
    query: 'actu du jour',
    reason: 'tavily_low_relevance',
    directSourceUrls: ['https://www.reuters.com/world/', 'https://www.bbc.com/news'],
    attemptedHosts: [],
  };
  const fingerprintBefore = buildCoworkProgressFingerprint({
    executionMode: 'research_loop',
    research: { webSearches: 0, webFetches: 0 },
    validatedSourceCount: 0,
    activePdfDraft: null,
    latestApprovedPdfReviewSignature: null,
    latestCreatedArtifactPath: null,
    latestReleasedFileUrl: null,
    phase: 'research',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
    pendingDirectPivots: {
      [pivot.familyKey]: pivot,
    },
  });

  const fingerprintAfter = buildCoworkProgressFingerprint({
    executionMode: 'research_loop',
    research: { webSearches: 0, webFetches: 0 },
    validatedSourceCount: 0,
    activePdfDraft: null,
    latestApprovedPdfReviewSignature: null,
    latestCreatedArtifactPath: null,
    latestReleasedFileUrl: null,
    phase: 'research',
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    pendingFinalAnswer: false,
    blockers: [],
    pendingDirectPivots: {
      [pivot.familyKey]: {
        ...pivot,
        attemptedHosts: ['reuters.com'],
      },
    },
  });

  assert.notEqual(fingerprintBefore, fingerprintAfter);
}

// Blocked user reply prompt
{
  const state = createEmptyCoworkSessionState();
  upsertPendingDirectPivot(state, {
    familyKey: 'web_search:family:actu broad',
    query: 'actu du jour',
    reason: 'tavily_low_relevance',
    directSourceUrls: ['https://www.reuters.com/world/'],
    attemptedHosts: ['reuters.com'],
  });

  const prompt = buildCoworkBlockedUserReplyPrompt({
    originalMessage: 'fais moi un pdf sur l actu du jour',
    requestClock,
    state,
    research: { ...baseResearch, degradedSearches: 2, blockedQueryFamilies: 1 },
    stopReason: 'Cowork tourne sans progres concret.',
  });

  assert.ok(prompt.includes('fais moi un pdf sur l actu du jour'));
  assert.ok(!prompt.includes("La tache n'est pas encore complete."));
  assert.ok(!prompt.includes('Etat backend:'));
  assert.ok(!prompt.includes('Bloquants a lever:'));
}

// Tavily search plan (France-targeted)
{
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  process.env.ALLOW_PUBLIC_SEARCH_FALLBACKS = 'false';

  const plan = buildTavilySearchPlan('actualite france du jour 27 mars 2026', 6, { strictFactual: true });
  assert.equal(plan.enabled, true);
  assert.equal(plan.topic, 'news');
  assert.equal(plan.searchDepth, 'advanced');
  assert.equal(plan.searchMode, 'tavily:news:advanced');
  assert.ok(plan.includeDomains.includes('franceinfo.fr'));
  assert.ok(plan.includeDomains.includes('lemonde.fr'));
  assert.ok(Array.isArray(plan.requestBody?.include_domains));
}

// Missing Tavily key fallback
{
  delete process.env.TAVILY_API_KEY;
  process.env.ALLOW_PUBLIC_SEARCH_FALLBACKS = 'false';

  const outcome = await searchWeb('Iran actualite brulante', 5, { strictFactual: true });
  assert.equal(outcome.success, false);
  assert.equal(outcome.provider, 'direct-sources');
  assert.equal(outcome.searchMode, 'direct-sources');
  assert.equal(outcome.searchDisabledReason, 'missing_tavily_key');
  assert.equal(outcome.results.length, 0);
  assert.ok(outcome.directSourceUrls.length >= 2);
}

// Direct source fallback outcome
{
  const fallbackOutcome = buildDirectSourceSearchOutcome('Iran actualite brulante', {
    quality: 'transient_error',
    provider: 'tavily',
    searchMode: 'tavily:news:advanced',
    warnings: ['tavily: 429 Too Many Requests'],
    error: "Tavily est temporairement indisponible. Ouvre directement une source fiable via 'web_fetch'.",
    transient: true,
    searchDisabledReason: 'tavily_transient_error',
  });
  assert.equal(fallbackOutcome.quality, 'transient_error');
  assert.equal(fallbackOutcome.searchDisabledReason, 'tavily_transient_error');
  assert.ok(fallbackOutcome.directSourceUrls.some((url: string) => url.includes('france24.com')));
}

// LIBERATION TEST: validateCreatePdfReviewSignature retourne toujours ok
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

  // Plus de signature obligatoire : toujours ok
  const missingSignature = validateCreatePdfReviewSignature({
    reviewRequired: true,
    latestApprovedPdfReviewSignature: 'review-ok-123',
    draftReview,
  });
  assert.equal(missingSignature.ok, true);

  const mismatchedSignature = validateCreatePdfReviewSignature({
    reviewRequired: true,
    reviewSignature: 'review-old-999',
    latestApprovedPdfReviewSignature: 'review-ok-123',
    draftReview,
  });
  assert.equal(mismatchedSignature.ok, true);
}

console.log('Cowork loop internals OK');
