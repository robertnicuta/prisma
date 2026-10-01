const APP_BRAND = Object.freeze({name:'Prisma',appId:'Prisma'});
if (typeof module !== 'undefined' && module.exports) module.exports=APP_BRAND;
else {
  document.querySelectorAll('[data-brand]').forEach(el=>el.textContent=APP_BRAND.name);
  document.title=APP_BRAND.name+(document.body.dataset.window?' · '+document.body.dataset.window:'');
}
