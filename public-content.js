document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/content');
    if (!response.ok) return;
    const data = await response.json();
    if (data.siteName) { document.querySelectorAll('.logo, [data-site-name]').forEach(el => { if (el.classList.contains('logo')) el.innerHTML = '<i class="fas fa-bolt"></i> ' + data.siteName.replace(' Pro','') + ' <span>Pro</span>'; }); document.title = `${data.siteName} | مجموعة الصناعيين والحرفيين المتخصصين`; }
    if (data.tagline) { const hero = document.querySelector('.hero h1'); if (hero) hero.innerHTML = data.tagline; }
    if (data.description) { const heroText = document.querySelector('.hero p'); if (heroText) heroText.textContent = data.description; }
    if (data.phone) { document.querySelectorAll('a[href*="wa.me"]').forEach(a => a.href = `https://wa.me/${data.phone}`); }
    if (data.gallery?.length) { const target = document.querySelector('#portfolio .images'); if (target) data.gallery.forEach(item => { const img = document.createElement('img'); img.src = item.url; img.alt = item.name; img.loading = 'lazy'; target.appendChild(img); }); }
  } catch (_) { /* يعمل الموقع أيضًا بدون الخادم المحلي */ }
});
