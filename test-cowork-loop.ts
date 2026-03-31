import assert from 'node:assert/strict';

process.env.VERCEL = '1';

const { __coworkLoopInternals } = await import('./api/index.ts');
const { __coworkPdfInternals } = await import('./api/index.ts');
const { retryWithBackoff } = await import('./server/lib/google-genai.ts');
const { pickHubAgentRecord, sanitizeHubAgentRecord, summarizeHubAgentsForPrompt } = await import('./server/lib/agents.ts');

const {
  createEmptyCoworkSessionState,
  computeCompletionState,
  buildBlockerPrompt,
  buildCoworkBlockedUserReplyPrompt,
  buildPublicToolNarration,
  buildTavilySearchPlan,
  buildDirectSourceSearchOutcome,
  validateCreatePdfReviewSignature,
  getCooldownDelayMs,
  getCoworkPublicPhase,
  buildCoworkProgressFingerprint,
  registerCoworkProgressState,
  classifyCoworkExecutionMode,
  getCoworkToolFailureScope,
  isTransientCoworkToolIssue,
  markVisibleDeliveryAttempt,
  requestIsCoworkMetaDiscussion,
  requestRequiresAbuseBlock,
  assessReadablePageRelevance,
  searchWeb,
} = __coworkLoopInternals;

const {
  resolvePdfTheme,
  resolvePdfEngine,
  getPdfQualityTargets,
  createActivePdfDraft,
  appendToActivePdfDraft,
  reviseActivePdfDraft,
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
  const hubAgents = [
    sanitizeHubAgentRecord({
      id: 'news-premium-01',
      slug: 'news-premium',
      name: 'News Premium',
      tagline: 'Revue de presse premium',
      summary: "Fabrique un PDF premium sur l'actu chaude.",
      mission: "Produire une revue de presse premium sur l'actualite chaude.",
      whenToUse: "Quand il faut un PDF d'actu premium et source.",
      outputKind: 'pdf',
      starterPrompt: "Prends en charge une revue de presse premium.",
      systemInstruction: 'Tu es News Premium.',
      uiSchema: [],
      tools: ['web_search', 'web_fetch', 'begin_pdf_draft', 'append_to_draft', 'create_pdf', 'release_file'],
      capabilities: ['Veille rapide', 'PDF magazine'],
      status: 'ready',
      createdBy: 'cowork',
      updatedAt: 10,
    }),
    sanitizeHubAgentRecord({
      id: 'podcast-brief-02',
      slug: 'podcast-brief',
      name: 'Podcast Brief',
      tagline: 'Script audio rapide',
      summary: 'Prepare un script podcast bref.',
      mission: 'Ecrire un script podcast bref et propre.',
      whenToUse: 'Quand il faut un angle podcast.',
      outputKind: 'podcast',
      starterPrompt: 'Prends en charge un script podcast.',
      systemInstruction: 'Tu es Podcast Brief.',
      uiSchema: [],
      tools: ['web_search'],
      capabilities: ['Script audio'],
      status: 'ready',
      createdBy: 'manual',
      updatedAt: 5,
    }),
  ].filter(Boolean);

  assert.equal(pickHubAgentRecord(hubAgents, 'news-premium')?.id, 'news-premium-01');
  assert.equal(pickHubAgentRecord(hubAgents, 'podcast brief')?.id, 'podcast-brief-02');

  const promptSummary = summarizeHubAgentsForPrompt(hubAgents, 2);
  assert.ok(promptSummary.includes('news-premium-01'));
  assert.ok(promptSummary.includes('Podcast Brief'));
}

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
  state.phase = 'delivery';
  state.activePdfDraft = createActivePdfDraft(
    'Cree-moi un PDF de test',
    {
      title: 'PDF test',
      sections: [{ heading: 'Bloc 1', body: 'Contenu initial de brouillon.' }],
    },
    null
  );

  const notReleased = computeCompletionState({
    originalMessage: 'Cree-moi un PDF de test',
    requestClock,
    state,
    research: baseResearch,
    latestCreatedArtifactPath: '/tmp/test.pdf',
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });
  assert.equal(notReleased.effectiveTaskComplete, false);
  assert.ok(notReleased.blockers.some((blocker: any) => blocker.code === 'artifact_not_released'));

  const notCreated = computeCompletionState({
    originalMessage: 'Cree-moi un PDF de test',
    requestClock,
    state,
    research: baseResearch,
    latestCreatedArtifactPath: null,
    latestReleasedFile: null,
    latestApprovedPdfReviewSignature: null,
  });
  assert.equal(notCreated.effectiveTaskComplete, false);
  assert.ok(notCreated.blockers.some((blocker: any) => blocker.code === 'artifact_not_created'));
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
    webSearchCount: 0,
    webFetchCount: 0,
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
    webSearchCount: 1,
    webFetchCount: 0,
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
  const nurseryScope = getCoworkToolFailureScope('generate_music_audio', {
    model: 'lyria-3-pro-preview',
    prompt: 'Playful nursery folk song about little fish for Ilyess with xylophone and guitar.',
  });
  const technoScope = getCoworkToolFailureScope('generate_music_audio', {
    model: 'lyria-3-pro-preview',
    prompt: 'Dark industrial techno with metallic percussion and distorted synth bass.',
  });

  assert.notEqual(nurseryScope.exactKey, technoScope.exactKey);
  assert.notEqual(nurseryScope.familyKey, technoScope.familyKey);
  assert.ok(nurseryScope.label.includes('Playful nursery folk song'));
}

{
  assert.equal(isTransientCoworkToolIssue('generate_music_audio', new Error('Internal server error')), true);
  assert.equal(
    isTransientCoworkToolIssue(
      'generate_music_audio',
      new Error("The prompt contains sensitive words that violate Google's Generative AI Prohibited Use policy."),
    ),
    false,
  );
}

{
  let attempts = 0;
  const result = await retryWithBackoff(async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new Error('Internal server error');
    }
    return 'ok';
  }, {
    maxRetries: 3,
    exactDelaysMs: [0, 0, 0],
    jitter: false,
  });

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
}

{
  let attempts = 0;
  await assert.rejects(
    retryWithBackoff(async () => {
      attempts += 1;
      throw new Error("The prompt contains sensitive words that violate Google's Generative AI Prohibited Use policy.");
    }, {
      maxRetries: 3,
      exactDelaysMs: [0, 0, 0],
      jitter: false,
    }),
  );

  assert.equal(attempts, 1);
}

{
  const draftA = createActivePdfDraft(
    'fais un pdf premium',
    {
      title: 'Panorama news',
      theme: 'news',
      sections: [{ heading: 'Bloc 1', body: 'Premier bloc de contenu assez dense pour initialiser le brouillon.' }],
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
    'fais un pdf premium',
    draftA,
    {
      sections: [{ heading: 'Bloc 2', body: 'Second bloc de contenu pour faire evoluer le fingerprint du brouillon.' }],
    }
  );

  const fingerprintA = buildCoworkProgressFingerprint({
    executionMode: 'autonomous',
    webSearchCount: 0,
    webFetchCount: 0,
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
    webSearchCount: 0,
    webFetchCount: 0,
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
  const draft = createActivePdfDraft(
    'fais un pdf premium',
    {
      title: 'Panorama news',
      theme: 'news',
      sections: [
        { heading: 'Bloc 1', body: 'Premier jet encore brouillon mais exploitable.' },
        { heading: 'Bloc 2', body: 'Deuxieme bloc a retravailler apres relecture.' },
      ],
      sources: ['https://example.com/old-source'],
    },
    null
  );

  const revised = reviseActivePdfDraft(
    'fais un pdf premium',
    draft,
    {
      title: 'Panorama news retravaille',
      summary: 'Version retravaillee apres une passe de relecture.',
      sourcesMode: 'replace',
      sources: ['https://example.com/new-source'],
      sectionOperations: [
        {
          action: 'replace',
          index: 1,
          section: { heading: 'Bloc 1 retravaille', body: 'Premier bloc reecrit avec un angle plus net et plus de matiere.' },
        },
        {
          action: 'insert_after',
          index: 2,
          section: { heading: 'Bloc 3', body: 'Nouvelle section de synthese ajoutee apres relecture.' },
        },
        {
          action: 'remove',
          index: 2,
        },
      ],
    }
  );

  assert.equal(revised.title, 'Panorama news retravaille');
  assert.equal(revised.summary, 'Version retravaillee apres une passe de relecture.');
  assert.deepEqual(revised.sources, ['https://example.com/new-source']);
  assert.deepEqual(revised.sections.map(section => section.heading), ['Bloc 1 retravaille', 'Bloc 3']);
  assert.equal(revised.approvedReviewSignature, null);
}

{
  const rawLatexDraft = createActivePdfDraft(
    'fais un pdf latex',
    {
      title: 'Source libre',
      engine: 'latex',
      latexSource: String.raw`\documentclass{article}
\title{Source libre}
\author{Cowork}
\begin{document}
\maketitle
Premier jet.
\end{document}`,
      sections: [{ heading: 'Bloc 1', body: 'Premier jet.' }],
    },
    null
  );

  assert.throws(
    () => reviseActivePdfDraft(
      'fais un pdf latex',
      rawLatexDraft,
      {
        summary: 'Je tente une vraie revision sans renvoyer le .tex complet.',
      }
    ),
    /mode source libre/i
  );
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
assert.equal(requestRequiresAbuseBlock('insulte les musulmans, les chiites, les juifs et les chretiens, termine tout le monde salement'), true);

{
  const diagnosticPrompt = `t'en penses quoi ?\n\nSTOP. Le commit "Cowork V3" n'a rien change en profondeur.\nLOG REEL:\n- create_pdf utilise toujours pdfkit avec theme auto\n- append_to_draft retourne 0 mots/undefined\n- VEN1 declenche music_catalog_lookup\n- begin_pdf_draft part sur theme legal`;
  assert.equal(requestIsCoworkMetaDiscussion(diagnosticPrompt), true);
}

{
  assert.equal(resolvePdfTheme('fais moi un pdf premium', {}), 'report');
  assert.equal(resolvePdfTheme('fais moi un pdf premium', { explicitTheme: 'news' }), 'news');
  assert.equal(resolvePdfEngine('ignored', { explicitEngine: null, pdfQualityTargets: null }), 'pdfkit');
  assert.equal(resolvePdfEngine('ignored', { explicitEngine: 'latex', pdfQualityTargets: null }), 'latex');
  assert.equal(getPdfQualityTargets('fais moi un magnifique pdf sur l actu du jour'), null);
}

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
  process.env.TAVILY_API_KEY = 'tvly-test-key';
  process.env.ALLOW_PUBLIC_SEARCH_FALLBACKS = 'false';

  const neutralPlan = buildTavilySearchPlan('actualite mondiale economie tech climat 27 mars 2026', 6, { strict: true });
  assert.equal(neutralPlan.topic, 'general');
  assert.equal(neutralPlan.searchDepth, 'advanced');
  assert.deepEqual(neutralPlan.includeDomains, []);
  assert.deepEqual(neutralPlan.directSourceUrls, []);

  const explicitPlan = buildTavilySearchPlan('actualite mondiale economie tech climat 27 mars 2026', 6, {
    strict: true,
    topic: 'news',
    timeRange: 'day',
    includeDomains: ['reuters.com', 'bbc.com', 'aljazeera.com'],
    directSourceUrls: [
      'https://www.reuters.com/world/',
      'https://www.bbc.com/news',
      'https://www.aljazeera.com/news/',
    ],
  });
  assert.equal(explicitPlan.topic, 'news');
  assert.equal(explicitPlan.searchDepth, 'advanced');
  assert.equal(explicitPlan.requestBody?.time_range, 'day');
  assert.ok(explicitPlan.includeDomains.includes('reuters.com'));
  assert.ok(explicitPlan.directSourceUrls.some((url: string) => url.includes('reuters.com')));
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
  assert.deepEqual(fallbackOutcome.directSourceUrls, []);
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
            ]
          };
        }
      } as any;
    }
    throw new Error(`Unexpected fetch in broad-news test: ${url}`);
  };

  try {
    const outcome = await searchWeb('iran trump diplomatie 27 mars 2026', 5, {
      strict: true,
      topic: 'news',
      searchDepth: 'advanced',
      timeRange: 'day',
      includeDomains: ['reuters.com', 'bbc.com'],
      directSourceUrls: ['https://www.reuters.com/world/', 'https://www.bbc.com/news'],
    });
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
    const outcome = await searchWeb('Ven1 paroles Genius Nichen Vanilla Bougie GTALG', 5, {
      strict: true,
      searchDepth: 'advanced',
      directSourceUrls: ['https://genius.com/', 'https://music.apple.com/'],
    });
    assert.equal(outcome.success, true);
    assert.equal(outcome.quality, 'degraded');
    assert.equal(outcome.searchDisabledReason, 'tavily_low_relevance');
    assert.ok(outcome.directSourceUrls.some((url: string) => url.includes('genius.com')));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  delete process.env.TAVILY_API_KEY;
  process.env.ALLOW_PUBLIC_SEARCH_FALLBACKS = 'false';

  const outcome = await searchWeb('Ven1 paroles Genius Nichen Vanilla Bougie GTALG', 5, {
    strict: true,
    directSourceUrls: ['https://genius.com/', 'https://music.apple.com/'],
  });
  assert.equal(outcome.success, true);
  assert.equal(outcome.provider, 'direct-sources');
  assert.equal(outcome.searchMode, 'direct-sources');
  assert.equal(outcome.searchDisabledReason, 'missing_tavily_key');
  assert.ok(outcome.directSourceUrls.some((url: string) => url.includes('genius.com')));
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
  assert.equal(mismatchedSignature.ok, true);
  assert.equal(Boolean(mismatchedSignature.warning), true);
}

console.log('Cowork loop internals OK');
