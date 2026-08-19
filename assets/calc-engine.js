// Shared multiplier-method settlement calculator.
// One severity scale applies across every injury type — the multiplier reflects
// injury severity/duration, not the cause of injury, matching standard practice.
var SEVERITY_MULTIPLIERS = {
  minor: 1.5,
  moderate: 3,
  severe: 5
};

// State fault-allocation rule. Mirrors data/negligence-rules.json — kept inline
// here (not fetched) since this runs client-side with no build step for the
// calculator pages. 'pure' = reduce only, never bars. 'modified-50' = barred at
// fault >= 50%. 'modified-51' = barred at fault > 50% (50% exactly still recovers).
// 'contributory' = any fault at all bars recovery.
var NEGLIGENCE_RULES = {
  "Alabama": "contributory", "Alaska": "pure", "Arizona": "pure", "Arkansas": "modified-50",
  "California": "pure", "Colorado": "modified-50", "Connecticut": "modified-51",
  "Delaware": "modified-51", "District of Columbia": "contributory", "Florida": "modified-50",
  "Georgia": "modified-50", "Hawaii": "modified-51", "Idaho": "modified-50", "Illinois": "modified-50",
  "Indiana": "modified-50", "Iowa": "modified-50", "Kansas": "modified-50", "Kentucky": "pure",
  "Louisiana": "pure", "Maine": "modified-50", "Maryland": "contributory", "Massachusetts": "modified-50",
  "Michigan": "modified-50", "Minnesota": "modified-50", "Mississippi": "pure", "Missouri": "pure",
  "Montana": "modified-50", "Nebraska": "modified-50", "Nevada": "modified-50", "New Hampshire": "modified-50",
  "New Jersey": "modified-50", "New Mexico": "pure", "New York": "pure", "North Carolina": "contributory",
  "North Dakota": "modified-50", "Ohio": "modified-50", "Oklahoma": "modified-50", "Oregon": "modified-50",
  "Pennsylvania": "modified-50", "Rhode Island": "pure", "South Carolina": "modified-50",
  "South Dakota": "modified-50", "Tennessee": "modified-50", "Texas": "modified-50", "Utah": "modified-50",
  "Vermont": "modified-50", "Virginia": "contributory", "Washington": "pure", "West Virginia": "modified-50",
  "Wisconsin": "modified-50", "Wyoming": "modified-50"
};
var DEFAULT_NEGLIGENCE_RULE = "modified-51"; // majority rule, used only when no state selected

function calculateSettlement(inputs) {
  var medicalBills = Number(inputs.medicalBills) || 0;
  var lostWages = Number(inputs.lostWages) || 0;
  var severity = inputs.severity || 'moderate';
  var faultPercent = Math.min(Math.max(Number(inputs.faultPercent) || 0, 0), 100);
  var state = inputs.state || '';

  var multiplier = SEVERITY_MULTIPLIERS[severity] || SEVERITY_MULTIPLIERS.moderate;
  var economicDamages = medicalBills + lostWages;
  var painAndSuffering = economicDamages * multiplier;
  var subtotal = economicDamages + painAndSuffering;

  var rule = NEGLIGENCE_RULES[state] || DEFAULT_NEGLIGENCE_RULE;
  var barred = false;
  if (faultPercent > 0) {
    if (rule === 'contributory') {
      barred = true;
    } else if (rule === 'modified-50' && faultPercent >= 50) {
      barred = true;
    } else if (rule === 'modified-51' && faultPercent > 50) {
      barred = true;
    }
  }

  var faultReduction = barred ? subtotal : subtotal * (faultPercent / 100);
  var total = barred ? 0 : subtotal - faultReduction;

  return {
    economicDamages: economicDamages,
    painAndSuffering: painAndSuffering,
    subtotal: subtotal,
    faultReduction: faultReduction,
    total: Math.max(total, 0),
    multiplier: multiplier,
    rule: rule,
    barred: barred
  };
}

function formatUSD(amount) {
  return '$' + Math.round(amount).toLocaleString('en-US');
}

function initSettlementCalculator(formId, resultId) {
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
    var result = calculateSettlement(inputs);

    resultBlock.hidden = false;
    var barredNote = resultBlock.querySelector('.result-barred-note');
    if (result.barred) {
      resultBlock.querySelector('.result-total').textContent = formatUSD(0);
      if (barredNote) {
        barredNote.hidden = false;
        barredNote.textContent = result.rule === 'contributory'
          ? 'Your state uses contributory negligence: any percentage of fault on your part bars recovery entirely. This estimate reflects that rule, not a calculation error.'
          : 'Your state bars recovery once your fault reaches the modified-comparative threshold. This estimate reflects that rule, not a calculation error.';
      }
      resultBlock.querySelector('.result-fault-row').hidden = true;
    } else {
      resultBlock.querySelector('.result-total').textContent = formatUSD(result.total);
      if (barredNote) barredNote.hidden = true;
      if (result.faultReduction > 0) {
        resultBlock.querySelector('.result-fault-row').hidden = false;
        resultBlock.querySelector('.result-fault').textContent = '-' + formatUSD(result.faultReduction);
      } else {
        resultBlock.querySelector('.result-fault-row').hidden = true;
      }
    }
    resultBlock.querySelector('.result-economic').textContent = formatUSD(result.economicDamages);
    resultBlock.querySelector('.result-pain').textContent = formatUSD(result.painAndSuffering) + ' (' + result.multiplier + 'x)';
    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
