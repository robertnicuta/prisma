const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const {randomBytes} = require('crypto');
const {saveTranscript} = require('./transcription');
function localURL(value) {
  const url = new URL(value);
  if (!['http:','https:'].includes(url.protocol) || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.username || url.password)
    throw new Error('Speaches debe estar en este PC: usa localhost o 127.0.0.1.');
  url.pathname = url.pathname.replace(/\/?v1\/?$/, '').replace(/\/$/, '');
  url.search = ''; url.hash = '';
  return url.href.replace(/\/$/, '');
}
async function models(base) {
  try {
    const response = await fetch(localURL(base) + '/v1/models', {signal:AbortSignal.timeout(5000), redirect:'error'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value = await response.json();
    return (value.data || []).filter(m=>m.task === 'automatic-speech-recognition' || (!m.task && /whisper|parakeet/i.test(m.id))).map(m=>m.id);
  } catch(e) { throw new Error('No se pudo conectar con Speaches. Comprueba Docker y el puerto del servidor. ' + e.message); }
}
function transcribe(file, language, config, progress) {
  if (!fs.existsSync(file) || !/\.(mp4|webm|mkv|mov|wav|mp3|m4a|ogg)$/i.test(file)) throw new Error('Selecciona un vídeo o audio válido.');
  if (!config.model) throw new Error('Conecta con Speaches y selecciona un modelo.');
  if (!['auto','es','en'].includes(language)) throw new Error('Idioma no válido.');
  const url = new URL(localURL(config.url) + '/v1/audio/transcriptions');
  const boundary = 'Loom' + randomBytes(18).toString('hex');
  const field = (key,value) => `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
  const filename = path.basename(file).replace(/["\r\n\\]/g,'_');
  const fields = field('model',config.model) + field('response_format','verbose_json') + field('timestamp_granularities[]','segment') + (language === 'auto' ? '' : field('language',language));
  const head = Buffer.from(fields + `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  let request, stream;
  const promise = new Promise((resolve,reject) => {
    request = (url.protocol === 'https:' ? https : http).request(url, {method:'POST',headers:{
      'Content-Type':`multipart/form-data; boundary=${boundary}`,'Content-Length':head.length+fs.statSync(file).size+tail.length
    }}, response => {
      let content = ''; response.setEncoding('utf8');
      response.on('data',chunk=>{content += chunk; if(content.length>16e6)request.destroy(new Error('La transcripción es demasiado grande.'));});
      response.on('error',reject);
      response.on('end',()=>{
        try {
          const value = JSON.parse(content);
          if (response.statusCode !== 200) throw new Error(typeof value.detail === 'string' ? value.detail : JSON.stringify(value.detail || value.error || `HTTP ${response.statusCode}`));
          if (typeof value.text !== 'string') throw new Error('Speaches devolvió una respuesta sin texto.');
          if (value.segments) value.segments = value.segments.map(s=>({start:s.start,end:s.end,text:s.text.trim()}));
          resolve(saveTranscript(file,value));
        } catch(e) {reject(e);}
      });
    });
    request.on('error',reject);
    request.setTimeout(30*60*1000,()=>request.destroy(new Error('Speaches ha tardado demasiado en responder.')));
    progress({message:'Enviando la grabación a Speaches en este PC…'});
    request.write(head); stream = fs.createReadStream(file); stream.on('error',e=>request.destroy(e));
    stream.pipe(request,{end:false});
    stream.on('end',()=>{request.end(tail);progress({message:'Speaches está transcribiendo en este PC…'});});
  });
  return {promise,cancel:()=>{stream?.destroy();request?.destroy(new Error('Transcripción cancelada.'));}};
}
module.exports = {models,transcribe,localURL};
