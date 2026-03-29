import assert from 'node:assert/strict';

const {
  DEFAULT_PODCAST_TTS_MODEL,
  __podcastMediaInternals,
} = await import('./server/lib/media-generation.ts');

const {
  buildPodcastNarrationPrompt,
  buildPodcastMusicPrompt,
} = __podcastMediaInternals;

{
  assert.equal(DEFAULT_PODCAST_TTS_MODEL, 'gemini-2.5-pro-tts');
}

{
  const prompt = buildPodcastNarrationPrompt({
    brief: "Explique pourquoi les arbres urbains rendent les villes plus vivables.",
    title: 'Les arbres en ville',
    languageCode: 'fr-FR',
    hostStyle: 'calme, intelligent, immersif',
    approxDurationSeconds: 55,
  });

  assert.ok(prompt.includes('Create and speak a polished single-host podcast segment'));
  assert.ok(prompt.includes('Les arbres en ville'));
  assert.ok(prompt.includes('55 seconds'));
  assert.ok(prompt.includes('arbres urbains'));
}

{
  const prompt = buildPodcastNarrationPrompt({
    script: "Salut a tous. Aujourd'hui, on parle des arbres et de leur role dans la ville.",
    languageCode: 'fr-FR',
  });

  assert.ok(prompt.includes('Narrate the following single-host podcast script'));
  assert.ok(prompt.includes("Salut a tous."));
  assert.ok(!prompt.includes('Write the spoken script yourself'));
}

{
  const explicitMusicPrompt = 'Warm ambient podcast bed, no vocals, soft piano and pads.';
  assert.equal(
    buildPodcastMusicPrompt({ musicPrompt: explicitMusicPrompt }),
    explicitMusicPrompt
  );
}

{
  const prompt = buildPodcastMusicPrompt({
    brief: 'Podcast sur la coupe du monde et la culture foot.',
    hostStyle: 'energetic but elegant',
  });

  assert.ok(prompt.includes('instrumental podcast background bed'));
  assert.ok(prompt.includes('No vocals'));
  assert.ok(prompt.includes('energetic but elegant'));
}

console.log('Podcast media OK');
