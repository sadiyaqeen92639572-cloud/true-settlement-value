// Shared multiplier-method settlement calculator.
// One severity scale applies across every injury type — the multiplier reflects
// injury severity/duration, not the cause of injury, matching standard practice.
var SEVERITY_MULTIPLIERS = {
  minor: 1.5,
  moderate: 3,
  severe: 5
};

function calculateSettlement(inputs) {
  var medicalBills = Number(inputs.medicalBills) || 0;
  var lostWages = Number(inputs.lostWages) || 0;
  var severity = inputs.severity || 'moderate';
  var faultPercent = Math.min(Math.max(Number(inputs.faultPercent) || 0, 0), 100);

  var multiplier = SEVERITY_MULTIPLIERS[severity] || SEVERITY_MULTIPLIERS.moderate;
  var economicDamages = medicalBills + lostWages;
  var painAndSuffering = economicDamages * multiplier;
  var subtotal = economicDamages + painAndSuffering;
  var faultReduction = subtotal * (faultPercent / 100);
  var total = subtotal - faultReduction;

  return {
    economicDamages: economicDamages,
    painAndSuffering: painAndSuffering,
    subtotal: subtotal,
    faultReduction: faultReduction,
    total: Math.max(total, 0),
    multiplier: multiplier
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
    var inputs = {
      medicalBills: form.querySelector('[name="medicalBills"]').value,
      lostWages: form.querySelector('[name="lostWages"]').value,
      severity: form.querySelector('[name="severity"]').value,
      faultPercent: form.querySelector('[name="faultPercent"]').value
    };
    var result = calculateSettlement(inputs);

    resultBlock.hidden = false;
    resultBlock.querySelector('.result-total').textContent = formatUSD(result.total);
    resultBlock.querySelector('.result-economic').textContent = formatUSD(result.economicDamages);
    resultBlock.querySelector('.result-pain').textContent = formatUSD(result.painAndSuffering) + ' (' + result.multiplier + 'x)';
    if (result.faultReduction > 0) {
      resultBlock.querySelector('.result-fault-row').hidden = false;
      resultBlock.querySelector('.result-fault').textContent = '-' + formatUSD(result.faultReduction);
    } else {
      resultBlock.querySelector('.result-fault-row').hidden = true;
    }
    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
