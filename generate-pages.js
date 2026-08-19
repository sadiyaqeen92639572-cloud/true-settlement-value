const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://truesettlementvalue.com';
const SITE_NAME = 'True Settlement Value';
const YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().split('T')[0];

const DATA = require('./data/calculators.json');
const STATUTES = require('./data/statute-of-limitations.json');
const NEGLIGENCE = require('./data/negligence-rules.json');
const US_STATES = Object.keys(NEGLIGENCE.states);

const ORG = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: DOMAIN
};

// ---------- shared layout ----------

function head({ title, description, canonicalPath, jsonLd }) {
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${DOMAIN}${canonicalPath}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/assets/styles.css">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${DOMAIN}${canonicalPath}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}`;
}

function headerNav() {
  return `<header class="site-header">
  <div class="container">
    <a class="logo" href="/">${SITE_NAME}</a>
    <nav class="site-nav">
      <a href="/#calculators">Calculators</a>
      <a href="/statute-of-limitations-by-state/">Statutes</a>
      <a href="/methodology/">Methodology</a>
      <a href="/about/">About</a>
    </nav>
  </div>
</header>`;
}

function disclaimerBanner() {
  return `<div class="disclaimer-banner">
  <div class="container">
    ${SITE_NAME} is not a law firm and does not provide legal advice. Calculator results are
    educational estimates only, not a guarantee of any settlement value. Consult a licensed
    attorney in your state before making legal decisions.
  </div>
</div>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-links">
      <a href="/">Home</a>
      <a href="/statute-of-limitations-by-state/">Statute of Limitations by State</a>
      <a href="/methodology/">Methodology</a>
      <a href="/about/">About</a>
      <a href="/privacy/">Privacy Policy</a>
    </div>
    <p class="footer-disclaimer">
      &copy; ${YEAR} ${SITE_NAME}. Estimates are for educational purposes only and do not
      constitute legal advice or a guarantee of outcome. ${SITE_NAME} is not a law firm and is
      not affiliated with any court or government agency.
    </p>
  </div>
</footer>`;
}

function page({ title, description, canonicalPath, jsonLd, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ title, description, canonicalPath, jsonLd })}
</head>
<body>
${headerNav()}
${disclaimerBanner()}
${bodyHtml}
${footer()}
</body>
</html>
`;
}

// ---------- JSON-LD ----------

function moneyPageJsonLd(entry, canonicalPath) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: entry.title,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        dateModified: TODAY,
        author: ORG,
        publisher: ORG
      },
      {
        '@type': 'FAQPage',
        mainEntity: entry.faq.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a }
        }))
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` },
          { '@type': 'ListItem', position: 2, name: entry.h1, item: `${DOMAIN}${canonicalPath}` }
        ]
      }
    ]
  };
}

// ---------- money page (calculator) ----------

function renderMoneyPage(entry) {
  const canonicalPath = `/${entry.slug}/`;
  const bodyHtml = `<section class="hero">
  <div class="container">
    <h1>${entry.h1}</h1>
    <p>${entry.intro}</p>
  </div>
</section>
<div class="container">
  <div class="calc-card">
    <form id="calc-form">
      <div>
        <label for="medicalBills">Medical bills ($)</label>
        <input type="number" id="medicalBills" name="medicalBills" min="0" step="1" placeholder="e.g. 8000" required>
      </div>
      <div>
        <label for="lostWages">Lost wages ($)</label>
        <input type="number" id="lostWages" name="lostWages" min="0" step="1" placeholder="e.g. 2000" required>
      </div>
      <div>
        <label for="severity">Injury severity</label>
        <select id="severity" name="severity">
          <option value="minor">Minor (full recovery, no lasting effects)</option>
          <option value="moderate" selected>Moderate (extended treatment, some lasting effects)</option>
          <option value="severe">Severe (permanent injury or disability)</option>
        </select>
      </div>
      <div>
        <label for="faultPercent">Your percentage of fault, if any (%)</label>
        <input type="number" id="faultPercent" name="faultPercent" min="0" max="100" step="1" value="0">
      </div>
      <div>
        <label for="state">State (affects fault rule)</label>
        <select id="state" name="state">
          <option value="">Select your state (optional)</option>
          ${US_STATES.map(s => `<option value="${s}">${s}</option>`).join('\n          ')}
        </select>
        <p class="field-hint">Some states bar recovery entirely above a fault threshold, or with any
        fault at all. Selecting your state applies the correct rule instead of a flat reduction.</p>
      </div>
      <label class="consent-row">
        <input type="checkbox" required>
        <span>I understand this is an educational estimate only, not legal advice, and I've read
        the <a href="/privacy/">privacy policy</a>.</span>
      </label>
      <button type="submit" class="submit-btn">Calculate estimated settlement</button>
    </form>
    <div class="result-block" id="calc-result" hidden>
      <div class="result-total"></div>
      <div class="result-row"><span>Economic damages</span><span class="result-economic"></span></div>
      <div class="result-row"><span>Pain &amp; suffering</span><span class="result-pain"></span></div>
      <div class="result-row result-fault-row" hidden><span>Fault reduction</span><span class="result-fault"></span></div>
      <p class="result-barred-note" hidden></p>
    </div>
  </div>

  <section class="content-section">
    <h2>How It's Calculated</h2>
    <p>This tool uses the multiplier method: (medical bills + lost wages) &times; a pain-and-suffering
    multiplier based on injury severity (1.5x for minor, 3x for moderate, 5x for severe), minus
    any reduction for your percentage of fault. It's the same starting-point approach insurance
    adjusters commonly use in negotiations — not a guaranteed outcome.</p>
    <p>Fault reduction depends on your state's rule, not a flat percentage everywhere. Most states
    use modified comparative negligence (you lose the right to recover once your fault reaches
    50% or crosses 50%, depending on the state). A handful of pure comparative states (including
    California and New York) reduce your award by your fault percentage with no cutoff, even at
    high fault. A small group of states — Alabama, Maryland, North Carolina, Virginia, and
    Washington D.C. — use contributory negligence, where any fault on your part, even 1%, bars
    recovery entirely. Select your state above to apply the correct rule.</p>
  </section>

  <section class="content-section">
    <h2>Frequently Asked Questions</h2>
    ${entry.faq.map(item => `<div class="faq-item"><h3>${item.q}</h3><p>${item.a}</p></div>`).join('\n    ')}
  </section>

  <section class="content-section">
    <h2>Sources</h2>
    <ul class="sources-list">
      ${entry.sources.map(s => `<li><a href="${s.url}" rel="nofollow noopener" target="_blank">${s.name}</a></li>`).join('\n      ')}
    </ul>
  </section>
</div>
<script src="/assets/calc-engine.js"></script>
<script>initSettlementCalculator('calc-form', 'calc-result');</script>`;

  return page({
    title: entry.title,
    description: entry.metaDescription,
    canonicalPath,
    jsonLd: moneyPageJsonLd(entry, canonicalPath),
    bodyHtml
  });
}

// ---------- info page ----------

function renderInfoPage(entry) {
  const canonicalPath = `/${entry.slug}/`;
  const linked = DATA.moneyPages.find(m => m.slug === entry.linksTo);
  const bodyHtml = `<section class="hero">
  <div class="container">
    <h1>${entry.h1}</h1>
  </div>
</section>
<div class="container">
  <section class="content-section">
    <p>${entry.body}</p>
    ${linked ? `<p><a href="/${linked.slug}/">Use the ${linked.h1} &rarr;</a></p>` : ''}
  </section>
</div>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: entry.h1,
        dateModified: TODAY,
        author: ORG,
        publisher: ORG
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` },
          { '@type': 'ListItem', position: 2, name: entry.h1, item: `${DOMAIN}${canonicalPath}` }
        ]
      }
    ]
  };

  return page({ title: entry.title, description: entry.metaDescription, canonicalPath, jsonLd, bodyHtml });
}

// ---------- homepage ----------

function renderHomepage() {
  const canonicalPath = '/';
  const bodyHtml = `<section class="hero">
  <div class="container">
    <h1>Free Settlement Value Calculators</h1>
    <p>Estimate what your injury claim could be worth using the multiplier method insurance
    adjusters use — no email, no sign-up. Pick your claim type below.</p>
  </div>
</section>
<div class="container">
  <section class="content-section" id="calculators">
    <h2>Calculators</h2>
    <div class="hub-grid">
      ${DATA.moneyPages.map(m => `<a class="hub-card" href="/${m.slug}/"><h3>${m.h1}</h3><p>${m.metaDescription}</p></a>`).join('\n      ')}
    </div>
  </section>
  <section class="content-section">
    <h2>Guides</h2>
    <div class="hub-grid">
      ${DATA.infoPages.map(i => `<a class="hub-card" href="/${i.slug}/"><h3>${i.h1}</h3><p>${i.metaDescription}</p></a>`).join('\n      ')}
    </div>
  </section>
</div>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: SITE_NAME, url: DOMAIN },
      ORG
    ]
  };

  return page({
    title: `${SITE_NAME} — Free Settlement Value Calculators`,
    description: 'Estimate car accident, personal injury, workers\' comp, and other settlement values with free multiplier-method calculators. No email required.',
    canonicalPath,
    jsonLd,
    bodyHtml
  });
}

// ---------- methodology page ----------
// Reviewer stays generic on launch — a named/credentialed bio is a post-launch
// addition, not a placeholder to be swapped later (see plan: avoid re-attributing
// authorship after Google has indexed a named author).

function renderMethodologyPage() {
  const canonicalPath = '/methodology/';
  const bodyHtml = `<section class="hero">
  <div class="container"><h1>Methodology</h1></div>
</section>
<div class="container">
  <section class="content-section">
    <p><strong>Reviewed by our editorial team.</strong> Last updated ${TODAY}.</p>
    <h2>The multiplier method</h2>
    <p>Every calculator on this site uses the multiplier method: (medical bills + lost wages)
    &times; a pain-and-suffering multiplier based on injury severity. This is a widely used
    negotiation starting point among insurance adjusters and personal injury attorneys — not a
    legal formula, and not a guarantee of any actual settlement.</p>
    <div class="table-scroll" style="margin-top:12px">
      <table class="data-table">
        <thead><tr><th>Severity</th><th>Multiplier</th><th>Typical description</th></tr></thead>
        <tbody>
          <tr><td>Minor</td><td>1.5x</td><td>Full recovery expected, no lasting effects</td></tr>
          <tr><td>Moderate</td><td>3x</td><td>Extended treatment, some lasting effects</td></tr>
          <tr><td>Severe</td><td>5x</td><td>Permanent injury or disability</td></tr>
        </tbody>
      </table>
    </div>
    <h2>What this tool does not do</h2>
    <p>It does not account for policy limits, disputed liability, jurisdiction-specific damage
    caps (e.g. medical malpractice caps, which vary by state), or the strength of your evidence
    — all of which materially affect real settlements. Treat the result as a starting point for
    your own research, not a number to expect from an insurer.</p>
    <h2>Sources</h2>
    <p>Each calculator page cites its own sources. General references used across this site
    include the Insurance Information Institute, Nolo's legal encyclopedia, the U.S. Department
    of Labor, and the National Conference of State Legislatures.</p>
  </section>
</div>`;
  return page({
    title: `Methodology — ${SITE_NAME}`,
    description: 'How our settlement calculators work: the multiplier method, severity scale, and sources.',
    canonicalPath,
    bodyHtml
  });
}

// ---------- about page ----------

function renderAboutPage() {
  const canonicalPath = '/about/';
  const bodyHtml = `<section class="hero">
  <div class="container"><h1>About ${SITE_NAME}</h1></div>
</section>
<div class="container">
  <section class="content-section">
    <p>${SITE_NAME} publishes free, no-signup settlement value calculators covering the most
    common personal injury claim types. We are not a law firm, do not provide legal advice, and
    are not affiliated with any court or government agency. See our <a href="/methodology/">
    methodology</a> for how estimates are calculated.</p>
  </section>
</div>`;
  return page({
    title: `About — ${SITE_NAME}`,
    description: `About ${SITE_NAME} — free settlement value calculators, not a law firm.`,
    canonicalPath,
    bodyHtml
  });
}

// ---------- privacy page ----------

function renderPrivacyPage() {
  const canonicalPath = '/privacy/';
  const bodyHtml = `<section class="hero">
  <div class="container"><h1>Privacy Policy</h1></div>
</section>
<div class="container">
  <section class="content-section">
    <p>Our calculators run entirely in your browser — the numbers you enter (medical bills, lost
    wages, injury severity) are not transmitted to or stored on our servers unless you explicitly
    submit a contact form. We do not sell personal data. If a "free case review" form is added to
    a page in the future, submitting it will require separate, explicit consent before any
    information is shared with a third party.</p>
  </section>
</div>`;
  return page({
    title: `Privacy Policy — ${SITE_NAME}`,
    description: `Privacy policy for ${SITE_NAME}.`,
    canonicalPath,
    bodyHtml
  });
}

// ---------- statute of limitations page ----------

function renderStatutePage() {
  const canonicalPath = '/statute-of-limitations-by-state/';
  const bodyHtml = `<section class="hero">
  <div class="container">
    <h1>Personal Injury Statute of Limitations by State</h1>
    <p>${STATUTES.note}</p>
  </div>
</section>
<div class="container">
  <section class="content-section">
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>State</th><th>Filing deadline</th></tr></thead>
        <tbody>
          ${STATUTES.states.map(s => `<tr><td>${s.state}</td><td>${s.years} year${s.years === 1 ? '' : 's'}</td></tr>`).join('\n          ')}
        </tbody>
      </table>
    </div>
    <p style="font-size:0.85rem;color:var(--text-light)">Last verified ${STATUTES.lastVerified}.</p>
  </section>
  <section class="content-section">
    <h2>Sources</h2>
    <ul class="sources-list">
      ${STATUTES.sources.map(s => `<li><a href="${s.url}" rel="nofollow noopener" target="_blank">${s.name}</a></li>`).join('\n      ')}
    </ul>
  </section>
</div>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', headline: 'Personal Injury Statute of Limitations by State', dateModified: TODAY, author: ORG, publisher: ORG },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Statute of Limitations by State', item: `${DOMAIN}${canonicalPath}` }
        ]
      }
    ]
  };

  return page({
    title: `Personal Injury Statute of Limitations by State — ${SITE_NAME}`,
    description: 'How long you have to file a personal injury claim in each U.S. state.',
    canonicalPath,
    jsonLd,
    bodyHtml
  });
}

// ---------- 404 page ----------

function render404Page() {
  const bodyHtml = `<section class="hero">
  <div class="container">
    <h1>Page Not Found</h1>
    <p>That page doesn't exist. Try one of the calculators below.</p>
  </div>
</section>
<div class="container">
  <section class="content-section">
    <div class="hub-grid">
      ${DATA.moneyPages.map(m => `<a class="hub-card" href="/${m.slug}/"><h3>${m.h1}</h3></a>`).join('\n      ')}
    </div>
  </section>
</div>`;
  return page({
    title: `Page Not Found — ${SITE_NAME}`,
    description: 'This page could not be found.',
    canonicalPath: '/404.html',
    bodyHtml
  });
}

// ---------- write files ----------

function writePage(slug, html) {
  const dir = slug === '' ? __dirname : path.join(__dirname, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

let count = 0;
fs.writeFileSync(path.join(__dirname, '404.html'), render404Page(), 'utf8'); count++;
writePage('', renderHomepage()); count++;
writePage('methodology', renderMethodologyPage()); count++;
writePage('about', renderAboutPage()); count++;
writePage('privacy', renderPrivacyPage()); count++;
writePage('statute-of-limitations-by-state', renderStatutePage()); count++;

DATA.moneyPages.forEach(entry => { writePage(entry.slug, renderMoneyPage(entry)); count++; });
DATA.infoPages.forEach(entry => { writePage(entry.slug, renderInfoPage(entry)); count++; });

// robots.txt
fs.writeFileSync(path.join(__dirname, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${DOMAIN}/sitemap.xml\n`, 'utf8');

console.log(`Generated ${count} pages + robots.txt`);
