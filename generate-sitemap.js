const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://truesettlementvalue.com';
const DATA = require('./data/calculators.json');
const today = new Date().toISOString().split('T')[0];

let urls = [];
urls.push({ loc: `${DOMAIN}/`, changefreq: 'weekly', priority: '1.0' });
urls.push({ loc: `${DOMAIN}/methodology/`, changefreq: 'monthly', priority: '0.5' });
urls.push({ loc: `${DOMAIN}/about/`, changefreq: 'yearly', priority: '0.3' });
urls.push({ loc: `${DOMAIN}/privacy/`, changefreq: 'yearly', priority: '0.3' });
urls.push({ loc: `${DOMAIN}/statute-of-limitations-by-state/`, changefreq: 'yearly', priority: '0.6' });

DATA.moneyPages.forEach(m => {
  if (!fs.existsSync(path.join(__dirname, m.slug, 'index.html'))) return;
  urls.push({ loc: `${DOMAIN}/${m.slug}/`, changefreq: 'monthly', priority: '0.9' });
});
DATA.infoPages.forEach(i => {
  if (!fs.existsSync(path.join(__dirname, i.slug, 'index.html'))) return;
  urls.push({ loc: `${DOMAIN}/${i.slug}/`, changefreq: 'monthly', priority: '0.7' });
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xml, 'utf8');
console.log(`sitemap.xml written: ${urls.length} URLs`);
