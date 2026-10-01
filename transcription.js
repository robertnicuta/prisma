const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const root = path.join(__dirname, '.transcription');
const python = path.join(root, 'Scripts', 'python.exe');
const ready = () => fs.existsSync(python) && fs.existsSync(path.join(root, 'ready'));
function time(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2,'0')}:${String(Math.floor(ms / 60000) % 60).padStart(2,'0')}:${String(Math.floor(ms / 1000) % 60).padStart(2,'0')},${String(ms % 1000).padStart(3,'0')}`;
}
function srt(segments) { return segments.map((s,i) => `${i+1}\n${time(s.start)} --> ${time(s.end)}\n${s.text}\n`).join('\n'); }
function saveTranscript(file, result) {
  const text = result.text ?? result.segments.map(s=>s.text).join('\n');
  const stem = file.replace(/\.[^.]+$/, '');
  let base = stem + '.transcript', i = 1;
  while (fs.existsSync(base+'.txt') || fs.existsSync(base+'.srt')) base = stem + `.transcript-${i++}`;
  fs.writeFileSync(base+'.txt', text, {encoding:'utf8', flag:'wx'});
  const hasTimestamps = Array.isArray(result.segments) && result.segments.length > 0;
  if (hasTimestamps) fs.writeFileSync(base+'.srt', srt(result.segments), {encoding:'utf8', flag:'wx'});
  return {text, txt:base+'.txt', srt:hasTimestamps ? base+'.srt' : null, language:result.language};
}
function transcribe(file, language, progress) {
  if (!ready()) throw new Error('Prepara primero el motor local con el botón Preparar transcripción.');
  if (!['auto','es','en'].includes(language)) throw new Error('Idioma no válido.');
  if (!fs.existsSync(file) || !/\.(mp4|webm|mkv|mov|wav|mp3|m4a|ogg)$/i.test(file)) throw new Error('Selecciona una grabación o un archivo de audio válido.');
  const process = spawn(python, ['-u', path.join(__dirname, 'transcribe.py'), '--models', path.join(root,'models'), '--input', file, '--language', language], {
    windowsHide: true, env: {...global.process.env, PYTHONIOENCODING:'utf-8', HF_HUB_OFFLINE:'1', HF_HUB_DISABLE_TELEMETRY:'1'}
  });
  const promise = new Promise((resolve,reject) => {
    let buffer = '', result, failure = '', stderr = '';
    process.stdout.on('data', data => {
      buffer += data.toString('utf8');
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        try {
          const value = JSON.parse(line);
          if (value.type === 'progress') progress(value.percent);
          else if (value.type === 'result') result = value;
          else if (value.type === 'error') failure = value.message;
        } catch (_) {}
      }
    });
    process.stderr.on('data', d => stderr = (stderr + d).slice(-3000));
    process.on('error', reject);
    process.on('close', code => {
      if (code !== 0 || !result) return reject(new Error(failure || stderr || 'Transcripción cancelada.'));
      try {
        resolve(saveTranscript(file,result));
      } catch (e) { reject(e); }
    });
  });
  return {process, promise, cancel:()=>process.kill()};
}
module.exports = {ready, transcribe, time, srt, saveTranscript};
