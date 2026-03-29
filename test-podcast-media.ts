import assert from 'node:assert/strict';

const {
  DEFAULT_PODCAST_TTS_MODEL,
  __podcastMediaInternals,
} = await import('./server/lib/media-generation.ts');

const {
  buildPodcastNarrationPrompt,
  buildPodcastScriptPrompt,
  buildPodcastMusicPrompt,
  buildFallbackPodcastMusicPrompt,
  cleanGeneratedPodcastScript,
  extractDialogSpeakerNames,
  getWaveDurationSeconds,
  mixPodcastEpisodeWavFallback,
  remapDialogueSpeakerLabelsForTts,
  resolvePodcastSpeakers,
  normalizeGeminiTtsSpeakers,
  validateDialogueScriptAgainstSpeakers,
} = __podcastMediaInternals;

function buildSineWaveWavBuffer({
  sampleRate,
  channels,
  durationSeconds,
  frequencyHz,
  amplitude,
}: {
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  frequencyHz: number;
  amplitude: number;
}): Buffer {
  const frameCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  const pcm = Buffer.alloc(frameCount * channels * 2);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const value = Math.sin((2 * Math.PI * frequencyHz * frame) / sampleRate) * amplitude;
    const intValue = value < 0
      ? Math.round(value * 32768)
      : Math.round(value * 32767);

    for (let channel = 0; channel < channels; channel += 1) {
      pcm.writeInt16LE(intValue, ((frame * channels) + channel) * 2);
    }
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 4, 'ascii');
  header.write('fmt ', 12, 4, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 4, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

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
  assert.ok(prompt.includes('Style instructions: calme, intelligent, immersif'));
  assert.ok(prompt.includes('original script'));
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
  const prompt = buildPodcastScriptPrompt({
    brief: "Explique les trois infos du jour dans un ton de magazine radio, sans recopier des titres.",
    title: 'Flash actu',
    languageCode: 'fr-FR',
    hostStyle: 'calme, editorial, pose',
    approxDurationSeconds: 65,
  });

  assert.ok(prompt.includes('Write an original single-host podcast script'));
  assert.ok(prompt.includes('Flash actu'));
  assert.ok(prompt.includes('65 seconds'));
  assert.ok(prompt.includes('Do not quote headlines'));
  assert.ok(prompt.includes('Style instructions: calme, editorial, pose'));
  assert.ok(prompt.includes('original script'));
}

{
  const speakers = [
    { name: 'Yemma', voice: 'Kore', styleInstructions: 'calm but authoritarian, warm and relentless' },
    { name: 'Simohamed', voice: 'Puck', styleInstructions: 'breathless, comic panic, overwhelmed' },
  ];

  const prompt = buildPodcastNarrationPrompt({
    brief: "Sketch comique autour d'un couscous beaucoup trop copieux.",
    title: 'La Bataille de la Kssriya',
    languageCode: 'fr-FR',
    styleInstructions: 'Darija marocaine, timing comique tres vivant.',
    speakers,
    approxDurationSeconds: 80,
  });

  assert.ok(prompt.includes('two-speaker podcast dialogue'));
  assert.ok(prompt.includes('La Bataille de la Kssriya'));
  assert.ok(prompt.includes('Yemma'));
  assert.ok(prompt.includes('Simohamed'));
  assert.ok(prompt.includes('Darija marocaine, timing comique tres vivant'));
  assert.ok(prompt.includes('Every spoken line must start'));
  assert.ok(prompt.includes('routing labels'));
}

{
  const speakers = [
    { name: 'Yemma', voice: 'Kore', styleInstructions: 'warm and relentless' },
    { name: 'Simohamed', voice: 'Puck', styleInstructions: 'comic panic' },
  ];

  const prompt = buildPodcastScriptPrompt({
    brief: "Sketch comique autour d'un couscous beaucoup trop copieux.",
    title: 'La Bataille de la Kssriya',
    languageCode: 'fr-FR',
    hostStyle: 'editorial radio-theatre',
    speakers,
    approxDurationSeconds: 80,
  });

  assert.ok(prompt.includes('Write an original two-speaker podcast dialogue'));
  assert.ok(prompt.includes('Yemma'));
  assert.ok(prompt.includes('Simohamed'));
  assert.ok(prompt.includes('Every spoken line must start'));
  assert.ok(prompt.includes('clearly contrasted'));
}

{
  const cleaned = cleanGeneratedPodcastScript("```text\nTitre: Mon test\n- Salut a tous.\n- Aujourd'hui on parle d'arbres.\n```");
  assert.ok(!cleaned.includes('```'));
  assert.ok(!cleaned.toLowerCase().includes('titre:'));
  assert.ok(cleaned.includes('Salut a tous.'));
}

{
  assert.deepEqual(
    extractDialogSpeakerNames("Yemma: Koul.\nSimohamed: Mliit.\nYemma: Mazal."),
    ['Yemma', 'Simohamed'],
  );
}

{
  const speakers = resolvePodcastSpeakers({
    script: "Yemma: Koul.\nSimohamed: Mliit.\nYemma: Mazal.",
  });

  assert.equal(speakers.length, 2);
  assert.equal(speakers[0].name, 'Yemma');
  assert.equal(speakers[1].name, 'Simohamed');
  assert.equal(speakers[0].ttsAlias, 'Yemma');
  assert.equal(speakers[1].ttsAlias, 'Simohamed');
}

{
  assert.throws(() => resolvePodcastSpeakers({
    script: "Yemma: Koul.\nSimohamed: Mliit.\nWalid: Hsseb lia.",
  }));
}

{
  const speakers = normalizeGeminiTtsSpeakers([
    { name: 'Voix A', voice: 'Kore' },
    { name: 'Voix B', voice: 'Kore' },
  ]);

  assert.equal(speakers.length, 2);
  assert.notEqual(speakers[0].voice, speakers[1].voice);
  assert.equal(speakers[0].ttsAlias, 'VoixA');
  assert.equal(speakers[1].ttsAlias, 'VoixB');
}

{
  const routed = remapDialogueSpeakerLabelsForTts(
    "Voix A: Salut.\nVoix B: Bonjour.",
    [
      { name: 'Voix A', voice: 'Kore', ttsAlias: 'VoixA' },
      { name: 'Voix B', voice: 'Puck', ttsAlias: 'VoixB' },
    ],
  );

  assert.equal(routed, "VoixA: Salut.\nVoixB: Bonjour.");
}

{
  validateDialogueScriptAgainstSpeakers(
    "Yemma: Koul.\nSimohamed: Mliit.",
    [
      { name: 'Yemma', voice: 'Kore' },
      { name: 'Simohamed', voice: 'Puck' },
    ],
  );

  assert.throws(() => validateDialogueScriptAgainstSpeakers(
    "Maman: Koul.\nSimohamed: Mliit.",
    [
      { name: 'Yemma', voice: 'Kore' },
      { name: 'Simohamed', voice: 'Puck' },
    ],
  ));
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
  assert.ok(prompt.includes('Loop-friendly'));
  assert.ok(prompt.includes('energetic but elegant'));
  assert.ok(!prompt.includes('culture foot'));
}

{
  const prompt = buildFallbackPodcastMusicPrompt({
    hostStyle: 'serious, elegant, modern',
  });

  assert.ok(prompt.includes('Original instrumental podcast background bed'));
  assert.ok(prompt.includes('no recognizable melody'));
  assert.ok(prompt.includes('serious, elegant, modern'));
}

{
  const voiceBuffer = buildSineWaveWavBuffer({
    sampleRate: 24_000,
    channels: 1,
    durationSeconds: 1.1,
    frequencyHz: 220,
    amplitude: 0.32,
  });
  const musicBuffer = buildSineWaveWavBuffer({
    sampleRate: 48_000,
    channels: 2,
    durationSeconds: 0.35,
    frequencyHz: 110,
    amplitude: 0.4,
  });

  const mixed = mixPodcastEpisodeWavFallback({
    voiceBuffer,
    musicBuffer,
    introSeconds: 0.4,
    outroSeconds: 0.6,
    musicVolume: 0.12,
  });

  assert.ok(mixed.buffer.length > voiceBuffer.length);
  assert.ok(Math.abs(mixed.durationSeconds - 2.1) < 0.03);
  assert.ok(Math.abs(getWaveDurationSeconds(mixed.buffer) - mixed.durationSeconds) < 0.01);
}

{
  const voiceBuffer = buildSineWaveWavBuffer({
    sampleRate: 24_000,
    channels: 1,
    durationSeconds: 0.8,
    frequencyHz: 220,
    amplitude: 0.3,
  });
  const musicBuffer = buildSineWaveWavBuffer({
    sampleRate: 48_000,
    channels: 2,
    durationSeconds: 0.4,
    frequencyHz: 110,
    amplitude: 0.25,
  });
  musicBuffer.writeUInt32LE(musicBuffer.length * 3, 40);

  const mixed = mixPodcastEpisodeWavFallback({
    voiceBuffer,
    musicBuffer,
    introSeconds: 0.3,
    outroSeconds: 0.4,
    musicVolume: 0.1,
  });

  assert.ok(mixed.buffer.length > voiceBuffer.length);
  assert.ok(mixed.durationSeconds > 1.4);
}

console.log('Podcast media OK');
