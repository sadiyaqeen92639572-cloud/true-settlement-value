const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://truesettlementvalue.com';
const SITE_NAME = 'True Settlement Value';
const YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().split('T')[0];

const DATA = require('./data/calculators.json');
const STATUTES = require('./data/statute-of-limitations.json');
const NEGLIGENCE = require('./data/comparative-negligence.json');
const DAMAGE_CAPS = require('./data/damage-caps.json');
const EEOC_CAPS = require('./data/eeoc-caps.json');

const US_STATES = NEGLIGENCE.states.map(s => s.state).sort();

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
        <label for="state">State (optional — enables state-specific fault rules and caps)</label>
        <select id="state" name="state">
          <option value="">Select a state (optional)</option>
          ${US_STATES.map(s => `<option value="${s}">${s}</option>`).join('\n          ')}
        </select>
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
    <p>If you select a state, this tool applies that state's actual comparative/contributory
    negligence rule and, where researched, its noneconomic-damages cap for this claim type — see
    the <a href="/methodology/">methodology page</a> for exactly which states and rules are
    currently covered. If your state's rule bars recovery at your entered fault percentage, this
    tool shows an explanation instead of a dollar amount — that percentage is your own estimate,
    not a legal finding, and several of these rules have real exceptions.</p>
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
<script src="/assets/state-data.js"></script>
<script src="/assets/calc-engine.js"></script>
<script>initSettlementCalculator('calc-form', 'calc-result', '${entry.slug}');</script>`;

  return page({
    title: entry.title,
    description: entry.metaDescription,
    canonicalPath,
    jsonLd: moneyPageJsonLd(entry, canonicalPath),
    bodyHtml
  });
}

// ---------- eeoc money page (statutory-cap calculator, distinct from the injury multiplier engine) ----------

function renderEeocMoneyPage(entry) {
  const canonicalPath = `/${entry.slug}/`;
  const lawTypeOptions = Object.entries(EEOC_CAPS.lawTypes)
    .map(([value, cfg]) => `<option value="${value}"${value === 'title-vii' ? ' selected' : ''}>${cfg.label}</option>`)
    .join('\n          ');
  const capTable = EEOC_CAPS.titleViiAdaCaps
    .map(t => `<tr><td>${t.minEmployees}–${t.maxEmployees ?? '+'}</td><td>${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(t.cap)}</td></tr>`)
    .join('\n          ');

  const bodyHtml = `<section class="hero">
  <div class="container">
    <h1>${entry.h1}</h1>
    <p>${entry.intro}</p>
  </div>
</section>
<div class="container">
  <div class="calc-card">
    <form id="eeoc-calc-form">
      <div>
        <label for="lawType">Which law applies to your claim?</label>
        <select id="lawType" name="lawType">
          ${lawTypeOptions}
        </select>
      </div>
      <div>
        <label for="backPay">Back pay owed ($)</label>
        <input type="number" id="backPay" name="backPay" min="0" step="1" placeholder="e.g. 30000" required>
      </div>
      <div>
        <label for="frontPay">Front pay, if any ($)</label>
        <input type="number" id="frontPay" name="frontPay" min="0" step="1" value="0">
      </div>
      <div>
        <label for="compensatoryRequested">Compensatory damages requested ($)</label>
        <input type="number" id="compensatoryRequested" name="compensatoryRequested" min="0" step="1" value="0">
        <p class="field-hint">Not used for ADEA claims — the ADEA has no compensatory damages.</p>
      </div>
      <div>
        <label for="punitiveRequested">Punitive damages requested ($)</label>
        <input type="number" id="punitiveRequested" name="punitiveRequested" min="0" step="1" value="0">
        <p class="field-hint">Not used for ADEA claims, and excluded automatically against public employers.</p>
      </div>
      <div>
        <label for="employeeCount">Employer's number of employees</label>
        <input type="number" id="employeeCount" name="employeeCount" min="0" step="1" placeholder="e.g. 60">
        <p class="field-hint">Determines the Title VII/ADA cap tier. Not used for ADEA or FEHA.</p>
      </div>
      <label class="consent-row">
        <input type="checkbox" id="isPublicEmployer" name="isPublicEmployer">
        <span>Employer is a government/public entity</span>
      </label>
      <label class="consent-row">
        <input type="checkbox" id="willfulViolation" name="willfulViolation">
        <span>Violation was willful (ADEA only — doubles back pay via liquidated damages)</span>
      </label>
      <label class="consent-row">
        <input type="checkbox" required>
        <span>I understand this is an educational estimate only, not legal advice, and I've read
        the <a href="/privacy/">privacy policy</a>.</span>
      </label>
      <button type="submit" class="submit-btn">Calculate estimated settlement</button>
    </form>
    <div class="result-block" id="eeoc-calc-result" hidden>
      <div class="result-total"></div>
      <div class="result-row"><span>Back pay + front pay (uncapped)</span><span class="result-uncapped"></span></div>
      <div class="result-row result-capped-row" hidden><span>Compensatory + punitive</span><span class="result-capped"></span></div>
      <p class="result-cap-note" hidden></p>
    </div>
  </div>

  <section class="content-section">
    <h2>How It's Calculated</h2>
    <p>This tool splits your estimate into two buckets: an <strong>uncapped</strong> bucket (back pay
    and front pay, never subject to any statutory cap) and a <strong>capped</strong> bucket
    (compensatory + punitive damages, which the law limits depending on which statute applies and,
    for Title VII/ADA claims, employer size). The two buckets are calculated separately and added
    together — the cap never applies to the total.</p>
    <div class="table-scroll" style="margin-top:12px">
      <table class="data-table">
        <thead><tr><th>Employees</th><th>Title VII / ADA cap (compensatory + punitive combined)</th></tr></thead>
        <tbody>
          ${capTable}
        </tbody>
      </table>
    </div>
    <p style="font-size:0.85rem;color:var(--text-light)">Caps fixed by the Civil Rights Act of 1991 —
    never indexed for inflation. Source: 42 U.S.C. § 1981a.</p>
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
<script src="/assets/eeoc-calc-engine.js"></script>
<script>initEeocCalculator('eeoc-calc-form', 'eeoc-calc-result');</script>`;

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

  <section class="content-section">
    <h2>Sources</h2>
    <ul class="sources-list">
      ${entry.sources.map(s => `<li><a href="${s.url}" rel="nofollow noopener" target="_blank">${s.name}</a></li>`).join('\n      ')}
    </ul>
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
  ${(DATA.eeocMoneyPages || []).length ? `<section class="content-section">
    <h2>Employment Discrimination Calculators</h2>
    <p style="font-size:0.9rem;color:var(--text-light);margin-top:-6px">These use a different
    method than the injury calculators above — statutory back pay/front pay plus damages caps,
    not the multiplier method. See <a href="/methodology/">methodology</a>.</p>
    <div class="hub-grid">
      ${DATA.eeocMoneyPages.map(m => `<a class="hub-card" href="/${m.slug}/"><h3>${m.h1}</h3><p>${m.metaDescription}</p></a>`).join('\n      ')}
    </div>
  </section>` : ''}
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
    <h2>The multiplier method (injury calculators)</h2>
    <p>Every injury calculator on this site uses the multiplier method: (medical bills + lost wages)
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
    <h2>The statutory-cap method (EEOC / employment discrimination calculator)</h2>
    <p>The EEOC settlement calculator does not use the multiplier method at all — it follows the
    statutory structure of the applicable law instead. Back pay and front pay are calculated as
    uncapped amounts; compensatory and punitive damages (where available) are capped by employer
    size for Title VII/ADA claims, follow a back-pay-plus-liquidated-damages structure for ADEA
    claims, and are uncapped for California FEHA claims. See the calculator page itself for the
    full breakdown and legal sources.</p>
    <h2>State-specific rules (comparative/contributory negligence and damage caps)</h2>
    <p>If you select a state, the calculator applies that state's actual fault-bar rule — pure
    comparative, modified comparative (with that state's own 50% or 51% threshold), pure
    contributory negligence, or (for South Dakota specifically) a note that its slight/gross rule
    doesn't reduce to an automatic calculation. All 50 states plus D.C. are covered for this part,
    each sourced to two independent references (see <code>data/comparative-negligence.json</code>
    in the site's public repository for the full list and citations).</p>
    <p>Where a fault percentage would bar recovery under a state's rule, this tool shows an
    explanation instead of a dollar figure — the entered fault percentage is a self-reported
    estimate, not a judge or jury's finding, and several of these rules carry real exceptions
    this tool doesn't attempt to evaluate.</p>
    <p><strong>Damage caps are currently researched for a starting set of states only</strong> —
    California, Texas, North Carolina, Florida, Georgia, and Illinois — not all states that may
    have one. A missing entry for a state means "not yet researched," not "confirmed no cap."
    Coverage will expand over time; check with a local attorney for any state not yet listed.</p>
    <h2>What this tool still does not do</h2>
    <p>It does not account for insurance policy limits, disputed liability, or the strength of
    your evidence — all of which materially affect real settlements regardless of which state
    rules apply. Treat the result as a starting point for your own research, not a number to
    expect from an insurer.</p>
    <h2>Sources</h2>
    <p>Each calculator page cites its own sources. General references used across this site
    include the Insurance Information Institute, Nolo/AllLaw's legal encyclopedia, the American
    Medical Association's state medical liability reform tracking, the American Tort Reform
    Association, and the National Conference of State Legislatures.</p>
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
(DATA.eeocMoneyPages || []).forEach(entry => { writePage(entry.slug, renderEeocMoneyPage(entry)); count++; });

// robots.txt
fs.writeFileSync(path.join(__dirname, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${DOMAIN}/sitemap.xml\n`, 'utf8');

// state-data.js — regenerated from data/comparative-negligence.json + data/damage-caps.json
// on every run, so those JSON files stay the single source of truth (never hand-edit this file).
fs.writeFileSync(path.join(__dirname, 'assets', 'state-data.js'),
  `// Generated by generate-pages.js from data/comparative-negligence.json + data/damage-caps.json — do not hand-edit.\n` +
  `window.STATE_DATA = ${JSON.stringify({ comparativeNegligence: NEGLIGENCE.states, damageCaps: DAMAGE_CAPS.caps })};\n`,
  'utf8');

console.log(`Generated ${count} pages + robots.txt + assets/state-data.js`);
