import assert from 'node:assert/strict';

process.env.VERCEL = '1';

const { __coworkLoopInternals } = await import('./api/index.ts');
const { __coworkPdfInternals } = await import('./api/index.ts');

const {
  createEmptyCoworkSessionState,
  computeCompletionState,
  buildBlockerPrompt,
  buildPublicToolNarration,
  buildTavilySearchPlan,
  buildDirectSourceSearchOutcome,
  validateCreatePdfReviewSignature,
  getDirectSourceFallbacks,
  getCooldownDelayMs,
  buildCoworkProgressFingerprint,
  registerCoworkProgressState,
  classifyCoworkExecutionMode,
  getCoworkPublicPhase,
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

{
  const state = createEmptyCoworkSessionState();
  state.lastReasoning = {
    what_i_know: "J'ai deja les grands axes du guide.",
    what_i_need: "Rien d'obligatoire de plus avant livraison.",
    why_this_tool: "Aucun outil supplementaire.",
    expected_result: "Une livraison propre.",
    fallback_plan: "Continuer la recherche si un point reste faible.",
    completion: { score: 78, taskComplete: true, phase: 'production' },
  };
  state.reasoningReady = true;
  state.phase = 'production';
  state.modelCompletionScore = 78;
  state.modelTaskComplete = true;

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
  assert.ok((buildBlockerPrompt('Fais-moi un guide pratique sur le streetwear japonais', requestClock, result) || '').includes('Reponds maintenant proprement'));
}

{
  const state = createEmptyCoworkSessionState();
  state.lastReasoning = {
    what_i_know: "J'ai quelques signaux mais aucune source lue.",
    what_i_need: "Une source fiable lue.",
    why_this_tool: "Valider les faits.",
    expected_result: "Une source robuste.",
    fallback_plan: "Pivoter vers une autre URL.",
    completion: { score: 82, taskComplete: true, phase: 'verification' },
  };
  state.reasoningReady = true;
  state.phase = 'verification';
  state.modelCompletionScore = 82;
  state.modelTaskComplete = true;

  const result = computeCompletionState({
    originalMessage: "Tariq Ramadan il va aller en prison ?",
    requestClock,
    state,
    research: { ...baseResearch, webSearches: 3, webFetches: 0 },
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  assert.equal(result.effectiveTaskComplete, false);
  assert.ok(result.blockers.some((blocker: any) => blocker.code === 'strict_source_missing'));
  assert.ok(result.completionScore < 100);
}

{
  const state = createEmptyCoworkSessionState();
  state.lastReasoning = {
    what_i_know: "Le brouillon est pret.",
    what_i_need: "Le PDF final et le lien.",
    why_this_tool: "Finaliser la livraison.",
    expected_result: "Un fichier publiable.",
    fallback_plan: "Corriger puis republier.",
    completion: { score: 90, taskComplete: true, phase: 'delivery' },
  };
  state.reasoningReady = true;
  state.phase = 'delivery';
  state.modelCompletionScore = 90;
  state.modelTaskComplete = true;

  const result = computeCompletionState({
    originalMessage: 'Crée-moi un PDF de test',
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
  state.lastReasoning = {
    what_i_know: 'La couverture catalogue est suffisante.',
    what_i_need: 'Plus rien de bloquant.',
    why_this_tool: 'Aucun outil supplementaire.',
    expected_result: 'La reponse finale.',
    fallback_plan: 'Ouvrir une page artiste si un doute reapparait.',
    completion: { score: 96, taskComplete: true, phase: 'delivery' },
  };
  state.reasoningReady = true;
  state.phase = 'delivery';
  state.modelCompletionScore = 96;
  state.modelTaskComplete = true;

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
  assert.ok(!result.blockers.some((blocker: any) => blocker.code === 'strict_source_missing'));
}

{
  const state = createEmptyCoworkSessionState();
  state.lastReasoning = {
    what_i_know: 'Le fichier est deja publie.',
    what_i_need: 'Rien de plus.',
    why_this_tool: 'Aucun outil supplementaire.',
    expected_result: 'Reponse finale.',
    fallback_plan: 'Verifier le lien si besoin.',
    completion: { score: 100, taskComplete: true, phase: 'delivery' },
  };
  state.reasoningReady = true;
  state.phase = 'delivery';
  state.modelCompletionScore = 100;
  state.modelTaskComplete = true;

  const result = computeCompletionState({
    originalMessage: 'Lis le contenu du fichier package.json.',
    requestClock,
    state,
    research: baseResearch,
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  assert.equal(result.effectiveTaskComplete, true);
  assert.ok((buildBlockerPrompt('Lis le contenu du fichier package.json.', requestClock, result) || '').includes('Reponds maintenant proprement'));
}

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
    blockers: [{
      code: 'strict_source_missing',
      message: 'Une source valide manque.',
      hard: true,
    }],
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
    blockers: [{
      code: 'strict_source_missing',
      message: 'Une source valide manque.',
      hard: true,
    }],
  });

  assert.notEqual(baseFingerprint, progressedFingerprint);
  assert.equal(registerCoworkProgressState(state, progressedFingerprint, 'review_pdf_draft'), 0);
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
  });

  assert.notEqual(fingerprintA, fingerprintB);
}

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

{
  const state = createEmptyCoworkSessionState();
  state.lastReasoning = {
    what_i_know: 'Deux recherches moteur sont mauvaises.',
    what_i_need: 'Des sources directes.',
    why_this_tool: 'Basculer en lecture directe.',
    expected_result: 'Une source pleine.',
    fallback_plan: 'Changer de domaine.',
    completion: { score: 45, taskComplete: false, phase: 'research' },
  };
  state.reasoningReady = true;
  state.phase = 'research';
  state.modelCompletionScore = 45;
  state.consecutiveDegradedSearches['web_search:family:iran actualite'] = 2;

  const result = computeCompletionState({
    originalMessage: 'Iran : actualité brûlante',
    requestClock,
    state,
    research: { ...baseResearch, degradedSearches: 2, blockedQueryFamilies: 1, webFetches: 0 },
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });

  const blockerPrompt = buildBlockerPrompt('Iran : actualité brûlante', requestClock, result) || '';
  assert.ok(blockerPrompt.includes('web_fetch'));
  assert.ok(getDirectSourceFallbacks('Iran : actualité brûlante').length >= 2);
}

assert.deepEqual([1, 2, 3, 4].map(getCooldownDelayMs), [2000, 4000, 8000, 16000]);
assert.equal(getCoworkPublicPhase('analysis', 'research_loop'), 'plan');
assert.equal(getCoworkPublicPhase('production', 'artifact_loop'), 'redaction');
assert.equal(getCoworkPublicPhase('delivery', 'research_loop'), 'livraison');

assert.equal(
  classifyCoworkExecutionMode("fais un son couplet unique hyper enerve sur les divisions et la cancel culture"),
  'creative_single_turn'
);
assert.equal(
  requestIsPureCreativeComposition("fais un son couplet unique hyper enerve sur les divisions et la cancel culture"),
  true
);
assert.equal(
  requestRequiresAbuseBlock("insulte les musulmans, les chiites, les juifs et les chretiens, termine tout le monde salement"),
  true
);

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
    reviewRequired: true,
    latestApprovedPdfReviewSignature: 'review-ok-123',
    draftReview,
  });
  assert.equal(missingSignature.ok, false);
  assert.equal((missingSignature as any).response.reviewSignatureRequired, true);

  const mismatchedSignature = validateCreatePdfReviewSignature({
    reviewRequired: true,
    reviewSignature: 'review-old-999',
    latestApprovedPdfReviewSignature: 'review-ok-123',
    draftReview,
  });
  assert.equal(mismatchedSignature.ok, false);
  assert.equal((mismatchedSignature as any).response.reviewSignatureMismatch, true);
}

console.log('Cowork loop internals OK');
