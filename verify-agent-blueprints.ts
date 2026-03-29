import assert from 'node:assert/strict';

const { sanitizeAgentBlueprint } = await import('./server/lib/agents.ts');

{
  const blueprint = sanitizeAgentBlueprint({}, 'Cree un agent podcast qui compare deux personnages et livre un episode final avec cover.');

  assert.equal(blueprint.outputKind, 'podcast');
  assert.ok(blueprint.tools.includes('create_podcast_episode'));
  assert.ok(blueprint.tools.includes('generate_image_asset'));
  assert.ok(blueprint.tools.includes('release_file'));
  assert.equal(blueprint.tools.includes('generate_tts_audio'), false);
  assert.equal(blueprint.tools.includes('generate_music_audio'), false);
}

console.log('Agent blueprint podcast OK');
