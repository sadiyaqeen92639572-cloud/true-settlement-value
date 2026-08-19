// Shared multiplier-method settlement calculator, now state-aware.
// One severity scale applies across every injury type — the multiplier reflects
// injury severity/duration, not the cause of injury, matching standard practice.
var SEVERITY_MULTIPLIERS = {
  minor: 1.5,
  moderate: 3,
  severe: 5
};

// Which damage-caps.json appliesTo bucket a given money page reads from.
var CAP_ROUTE_BY_SLUG = {
  'medical-malpractice-settlement-calculator': 'medical-malpractice',
  'wrongful-death-settlement-calculator': 'wrongful-death'
};
function capRouteFor(moneyPageSlug) {
  return CAP_ROUTE_BY_SLUG[moneyPageSlug] || 'noneconomic-general';
}

function lookupNegligenceRule(stateName) {
  var states = (window.STATE_DATA && window.STATE_DATA.comparativeNegligence) || [];
  for (var i = 0; i < states.length; i++) {
    if (states[i].state === stateName) return states[i];
  }
  return null;
}

function lookupDamageCap(stateName, appliesTo) {
  var caps = (window.STATE_DATA && window.STATE_DATA.damageCaps) || [];
  for (var i = 0; i < caps.length; i++) {
    if (caps[i].state === stateName && caps[i].appliesTo === appliesTo) return caps[i];
  }
  return null; // no entry — per damage-caps.json's own scopeNote, this means "not yet
               // researched," NOT "confirmed no cap." The UI must not conflate the two.
}

// Resolves an in-force cap's dollar amount for the given year. Returns
// { amount, resolvedYear } on success, or { unavailable: true, reason } when the cap's
// status isn't 'in-force' or its schedule can't be resolved to a number (e.g. Texas's
// wrongful-death cap, which is CPI-indexed with no static lookup table in this data set).
function resolveCapAmount(capEntry, year) {
  if (!capEntry) return { unavailable: true, reason: 'no-data' };
  if (capEntry.status !== 'in-force') return { unavailable: true, reason: capEntry.status, capEntry: capEntry };
  if (typeof capEntry.capAmount === 'number') return { amount: capEntry.capAmount };
  var table = capEntry.schedule && capEntry.schedule['noneconomic-cap-by-year'];
  if (table) {
    var years = Object.keys(table).map(Number).sort(function (a, b) { return a - b; });
    var y = Math.min(Math.max(year, years[0]), years[years.length - 1]);
    return { amount: table[String(y)], resolvedYear: y, clampedToKnownRange: y !== year };
  }
  return { unavailable: true, reason: 'not-resolvable', capEntry: capEntry };
}

// Determines whether a given state/rule combination bars recovery at faultPercent, per
// that state's own barAt/barOperator — never a hardcoded threshold in this file.
function isBarred(stateEntry, faultPercent) {
  if (!stateEntry) return false;
  if (stateEntry.rule === 'other') return 'other'; // South Dakota-style — no automatic answer at all
  if (stateEntry.rule === 'contributory') return faultPercent > 0 ? 'contributory' : false;
  if (stateEntry.rule.indexOf('modified') === 0) {
    var barred = stateEntry.barOperator === '>='
      ? faultPercent >= stateEntry.barAt
      : faultPercent > stateEntry.barAt;
    return barred ? 'modified' : false;
  }
  return false; // pure-comparative — never bars recovery
}

function calculateSettlement(inputs, moneyPageSlug) {
  var medicalBills = Number(inputs.medicalBills) || 0;
  var lostWages = Number(inputs.lostWages) || 0;
  var severity = inputs.severity || 'moderate';
  var faultPercent = Math.min(Math.max(Number(inputs.faultPercent) || 0, 0), 100);
  var state = inputs.state || '';

  var multiplier = SEVERITY_MULTIPLIERS[severity] || SEVERITY_MULTIPLIERS.moderate;
  var economicDamages = medicalBills + lostWages;
  var rawPainAndSuffering = economicDamages * multiplier;

  var result = {
    economicDamages: economicDamages,
    multiplier: multiplier,
    state: state,
    stateRule: null,
    barred: false,
    barredReason: null,
    cap: null,
    painAndSuffering: rawPainAndSuffering,
    subtotal: null,
    faultReduction: null,
    total: null
  };

  var stateEntry = state ? lookupNegligenceRule(state) : null;

  // Florida carve-out: medical-malpractice claims stay pure-comparative even though
  // Florida's general HB 837 (2023) entry is modified-51 — see comparative-negligence.json's
  // Florida note. This is the one hardcoded state/page exception in this file, and it exists
  // because the underlying law itself carves it out, not because the data model couldn't
  // express it generally.
  var effectiveEntry = stateEntry;
  if (state === 'Florida' && moneyPageSlug === 'medical-malpractice-settlement-calculator' && stateEntry) {
    effectiveEntry = { state: 'Florida', rule: 'pure-comparative' };
  }

  if (effectiveEntry) {
    result.stateRule = effectiveEntry.rule;
    var barStatus = isBarred(effectiveEntry, faultPercent);
    if (barStatus) {
      result.barred = true;
      result.barredReason = barStatus; // 'other' | 'contributory' | 'modified'
      return result; // never compute or show a dollar total when barred — see never-render-$0 rule
    }
  }

  // Damage cap: applied to the pain-and-suffering component only, never economic damages,
  // routed by which money page this is (medical-malpractice / wrongful-death / everything else).
  var cappedPainAndSuffering = rawPainAndSuffering;
  if (state) {
    var appliesTo = capRouteFor(moneyPageSlug);
    var capEntry = lookupDamageCap(state, appliesTo);
    var resolved = resolveCapAmount(capEntry, new Date().getFullYear());
    if (resolved.unavailable) {
      result.cap = { unavailable: true, reason: resolved.reason, capEntry: resolved.capEntry || capEntry };
    } else {
      var wasCapped = rawPainAndSuffering > resolved.amount;
      if (wasCapped) cappedPainAndSuffering = resolved.amount;
      result.cap = { amount: resolved.amount, resolvedYear: resolved.resolvedYear, wasCapped: wasCapped };
    }
  }
  result.painAndSuffering = cappedPainAndSuffering;

  var subtotal = economicDamages + cappedPainAndSuffering;
  var faultReduction = subtotal * (faultPercent / 100);
  result.subtotal = subtotal;
  result.faultReduction = faultReduction;
  result.total = Math.max(subtotal - faultReduction, 0);

  return result;
}

function formatUSD(amount) {
  return '$' + Math.round(amount).toLocaleString('en-US');
}

var BARRED_MESSAGES = {
  contributory: function (state) {
    return 'In ' + state + ', the pure contributory negligence rule generally bars recovery ' +
      'once the injured party bears any percentage of fault. Real exceptions exist — doctrines ' +
      'like "last clear chance," and in some states a defendant\'s especially reckless conduct, can ' +
      'preserve a claim even here. Fault percentage is ultimately decided by a judge or jury, not by ' +
      'this estimate. Consult a licensed attorney in ' + state + ' before assuming this claim has no value.';
  },
  modified: function (state, stateEntry) {
    return 'In ' + state + ', recovery is generally barred once fault reaches the threshold this ' +
      'state sets (' + (stateEntry ? stateEntry.rule : 'a modified-comparative') + ' rule). This is a ' +
      'self-reported estimate, not a legal finding — fault percentage is ultimately decided by a ' +
      'judge or jury. Consult a licensed attorney in ' + state + ' before assuming this claim has no value.';
  },
  other: function (state) {
    return state + ' uses a non-standard negligence rule (slight/gross comparative fault) that does ' +
      'not reduce to a simple fault-percentage threshold, so this tool cannot estimate a result here. ' +
      'Consult a licensed attorney in ' + state + ' for how this rule applies to your situation.';
  }
};

function initSettlementCalculator(formId, resultId, moneyPageSlug) {
  var form = document.getElementById(formId);
  var resultBlock = document.getElementById(resultId);
  if (!form || !resultBlock) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var stateField = form.querySelector('[name="state"]');
    var inputs = {
      medicalBills: form.querySelector('[name="medicalBills"]').value,
      lostWages: form.querySelector('[name="lostWages"]').value,
      severity: form.querySelector('[name="severity"]').value,
      faultPercent: form.querySelector('[name="faultPercent"]').value,
      state: stateField ? stateField.value : ''
    };
    var result = calculateSettlement(inputs, moneyPageSlug);

    resultBlock.hidden = false;

    if (result.barred) {
      var msgFn = BARRED_MESSAGES[result.barredReason];
      var stateEntry = lookupNegligenceRule(result.state);
      resultBlock.innerHTML =
        '<div class="result-warning">' + msgFn(result.state, stateEntry) + '</div>';
      resultBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    // Rebuild the normal result markup each time (covers the case where a prior submit
    // rendered the warning-block innerHTML replacement above).
    resultBlock.innerHTML =
      '<div class="result-total"></div>' +
      '<div class="result-row"><span>Economic damages</span><span class="result-economic"></span></div>' +
      '<div class="result-row"><span>Pain &amp; suffering</span><span class="result-pain"></span></div>' +
      '<div class="result-row result-cap-row" hidden><span>State cap applied</span><span class="result-cap"></span></div>' +
      '<div class="result-row result-cap-unresolved-row" hidden><span colspan="2" class="result-cap-note"></span></div>' +
      '<div class="result-row result-fault-row" hidden><span>Fault reduction</span><span class="result-fault"></span></div>';

    resultBlock.querySelector('.result-total').textContent = formatUSD(result.total);
    resultBlock.querySelector('.result-economic').textContent = formatUSD(result.economicDamages);
    resultBlock.querySelector('.result-pain').textContent = formatUSD(result.painAndSuffering) + ' (' + result.multiplier + 'x)';

    if (result.cap && result.cap.wasCapped) {
      resultBlock.querySelector('.result-cap-row').hidden = false;
      resultBlock.querySelector('.result-cap').textContent =
        formatUSD(result.cap.amount) + (result.cap.resolvedYear ? ' (' + result.cap.resolvedYear + ' schedule)' : '');
    } else if (result.cap && result.cap.unavailable && result.cap.reason === 'not-resolvable') {
      resultBlock.querySelector('.result-cap-unresolved-row').hidden = false;
      resultBlock.querySelector('.result-cap-note').textContent =
        result.state + ' has a damage cap that changes over time and could not be auto-resolved here — check the current figure with a local attorney.';
    }

    if (result.faultReduction > 0) {
      resultBlock.querySelector('.result-fault-row').hidden = false;
      resultBlock.querySelector('.result-fault').textContent = '-' + formatUSD(result.faultReduction);
    } else {
      resultBlock.querySelector('.result-fault-row').hidden = true;
    }
    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
