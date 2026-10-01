// Only a single VDO.Ninja viewer is accepted; never load arbitrary remote pages.
function viewerURL(input) {
  const value = String(input || '').trim();
  if (!value) throw new Error('Pega un enlace de VDO.Ninja o un ID de emisión.');
  const url = /^[\w-]+$/.test(value)
    ? new URL('https://vdo.ninja/?view=' + value)
    : new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'vdo.ninja' || url.port || url.username || url.password)
    throw new Error('El enlace debe ser de https://vdo.ninja/.');
  const id = url.searchParams.get('view') || url.searchParams.get('push');
  if (!id || !/^[\w-]+$/.test(id)) throw new Error('El enlace debe contener un único ID de emisión (view o push).');
  url.searchParams.delete('push');
  url.searchParams.set('view', id);
  for (const key of ['webcam', 'screenshare', 'room', 'director', 'scene', 'novideo', 'noaudio', 'mute', 'muted', 'deaf', 'audiodevice', 'videodevice']) url.searchParams.delete(key);
  url.searchParams.set('cleanoutput', '');
  url.searchParams.set('autostart', '');
  return url.href;
}
module.exports = { viewerURL };
