const ICON_PATHS = {
screen:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M12 17v4M8 21h8"/>',
phone:'<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 18h2"/>',
keyboard:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.1M10 9h.1M14 9h.1M18 9h.1M6 13h.1M10 13h.1M14 13h.1M18 13h.1M8 16h8"/>',
shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
refresh:'<path d="M3 10a9 9 0 0 1 15-6l3 3M21 3v4h-4M21 14a9 9 0 0 1-15 6l-3-3M3 21v-4h4"/>',
folder:'<path d="M3 7V5a2 2 0 0 1 2-2h4l3 4h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
record:'<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
pause:'<path d="M9 5v14M15 5v14"/>',play:'<path d="m8 5 11 7-11 7z"/>',
mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
micOff:'<path d="m3 3 18 18M9 9v3a3 3 0 0 0 5 2M9 5a3 3 0 0 1 6 1v4M5 10v2a7 7 0 0 0 12 5M19 10v2M12 19v3M8 22h8"/>',
camera:'<rect x="3" y="5" width="12" height="14" rx="3"/><path d="m15 9 6-3v12l-6-3"/>',cameraOff:'<path d="m3 3 18 18M3 7v9a3 3 0 0 0 3 3h7M7 5h5a3 3 0 0 1 3 3v3M15 9l6-3v10"/>',
text:'<path d="M8 4h8M12 4v16M8 20h8M4 8V4h16v4"/>',zoom:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/>',
trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#191d28"/><circle cx="15" cy="12" r="2" fill="#191d28"/><circle cx="8" cy="18" r="2" fill="#191d28"/>',
app:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 9v11"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',prompt:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 8h10M7 12h6M12 18v3M8 21h8"/>',
grip:'<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>'};
function icon(name){return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]||''}</svg>`;}
function buttonIcon(el,name,label){el.innerHTML=icon(name)+(label?`<span>${label}</span>`:'');}
