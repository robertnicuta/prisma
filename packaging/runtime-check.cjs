'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const transcription = require('../transcription');

// Exercise the installed resource layout and the one-time model preparation.
// Test audio is generated locally by Windows speech synthesis, never recorded.
async function main() {
  const workspace = path.resolve(__dirname, '..');
  const resources = path.join(workspace, 'release', 'win-unpacked', 'resources', 'transcription');
  const profile = path.join(workspace, 'test-output', 'runtime-check');
  const audio = path.join(profile, 'synthetic-speech.wav');
  fs.mkdirSync(profile, {recursive:true});
  const generated = spawnSync('powershell', ['-NoProfile', '-Command',
    "Add-Type -AssemblyName System.Speech; $prismaTestVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer; $prismaTestVoice.SetOutputToWaveFile($env:PRISMA_TEST_AUDIO); $prismaTestVoice.Speak('This is a local transcription test. Prisma records your screen, camera, and voice.'); $prismaTestVoice.Dispose()"],
    {windowsHide:true, env:{...process.env, PRISMA_TEST_AUDIO:audio}, encoding:'utf8'});
  assert.equal(generated.status, 0, generated.stderr);
  transcription.configureRuntime({root:path.join(profile, '.transcription'), python:path.join(resources, 'python', 'python.exe'), script:path.join(resources, 'transcribe.py')});
  console.log('Preparing the model using the bundled Python runtime…');
  await transcription.prepare().promise;
  assert(transcription.ready(), 'Model preparation did not create a ready marker.');
  // transcribe() explicitly sets offline mode; preparation is the only network step.
  const result = await transcription.transcribe(audio, 'en', () => {}).promise;
  assert(result.text.trim().length > 20, 'Synthetic speech was not transcribed.');
  assert.match(result.text, /transcription|Prisma|screen|camera/i);
  assert(fs.existsSync(result.txt));
  assert(fs.existsSync(result.srt));
  assert.match(fs.readFileSync(result.srt, 'utf8'), /\d{2}:\d{2}:\d{2},\d{3} -->/);
  console.log(JSON.stringify({ok:true, runtime:resources, prepared:true, offlineTranscription:true, txt:true, srt:true}));
}
main().catch(error => {console.error(error.message); process.exitCode=1;});
