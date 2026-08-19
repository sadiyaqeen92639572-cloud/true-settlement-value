// EEOC / employment-discrimination settlement estimator.
// Deliberately NOT the injury multiplier engine (calc-engine.js) — the underlying
// legal structure is different, not just the inputs. See data/eeoc-caps.json for
// the legal basis of every branch below.

var TITLE_VII_ADA_CAPS = [
  { minEmployees: 15, maxEmployees: 100, cap: 50000 },
  { minEmployees: 101, maxEmployees: 200, cap: 100000 },
  { minEmployees: 201, maxEmployees: 500, cap: 200000 },
  { minEmployees: 501, maxEmployees: null, cap: 300000 }
];

function lookupTitleViiCap(employeeCount) {
  for (var i = 0; i < TITLE_VII_ADA_CAPS.length; i++) {
    var tier = TITLE_VII_ADA_CAPS[i];
    if (employeeCount >= tier.minEmployees && (tier.maxEmployees === null || employeeCount <= tier.maxEmployees)) {
      return tier.cap;
    }
  }
  return 0; // fewer than 15 employees: Title VII/ADA don't apply at all
}

// lawType: 'title-vii' | 'ada' | 'adea' | 'feha-ca'
function calculateEeocSettlement(inputs) {
  var backPay = Number(inputs.backPay) || 0;
  var frontPay = Number(inputs.frontPay) || 0;
  var compensatoryRequested = Number(inputs.compensatoryRequested) || 0;
  var punitiveRequested = Number(inputs.punitiveRequested) || 0;
  var employeeCount = Number(inputs.employeeCount) || 0;
  var lawType = inputs.lawType || 'title-vii';
  var isPublicEmployer = !!inputs.isPublicEmployer;
  var willfulViolation = !!inputs.willfulViolation; // ADEA only

  // Back pay + front pay are NEVER subject to the §1981a cap, regardless of law
  // type — this bucket is uncapped in every regime modeled here.
  var uncapped = backPay + frontPay;

  var capped = 0;
  var capApplied = null;
  var punitiveExcluded = false;
  var liquidatedDamages = 0;

  if (lawType === 'adea') {
    // ADEA has no compensatory/punitive damages at all — remedy is back pay
    // plus liquidated damages (a doubling of back pay) for a willful violation.
    // Front pay is available but, like Title VII, is not part of any cap.
    liquidatedDamages = willfulViolation ? backPay : 0;
    uncapped = backPay + frontPay + liquidatedDamages;
    capped = 0;
  } else if (lawType === 'feha-ca') {
    // California FEHA: no statutory cap on compensatory or punitive damages.
    capped = compensatoryRequested + punitiveRequested;
  } else {
    // title-vii or ada: capped bucket is compensatory + punitive, capped by
    // employer size. Punitive damages are unavailable against public employers.
    var effectivePunitive = isPublicEmployer ? 0 : punitiveRequested;
    punitiveExcluded = isPublicEmployer && punitiveRequested > 0;
    var requestedCapped = compensatoryRequested + effectivePunitive;
    capApplied = lookupTitleViiCap(employeeCount);
    capped = Math.min(requestedCapped, capApplied);
  }

  var total = uncapped + capped;

  return {
    uncapped: uncapped,
    capped: capped,
    capApplied: capApplied,
    punitiveExcluded: punitiveExcluded,
    liquidatedDamages: liquidatedDamages,
    total: total,
    lawType: lawType
  };
}

function formatEeocUSD(amount) {
  return '$' + Math.round(amount).toLocaleString('en-US');
}

function initEeocCalculator(formId, resultId) {
  var form = document.getElementById(formId);
  var resultBlock = document.getElementById(resultId);
  if (!form || !resultBlock) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var val = function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? el.value : '';
    };
    var checked = function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? el.checked : false;
    };

    var inputs = {
      backPay: val('backPay'),
      frontPay: val('frontPay'),
      compensatoryRequested: val('compensatoryRequested'),
      punitiveRequested: val('punitiveRequested'),
      employeeCount: val('employeeCount'),
      lawType: val('lawType'),
      isPublicEmployer: checked('isPublicEmployer'),
      willfulViolation: checked('willfulViolation')
    };
    var result = calculateEeocSettlement(inputs);

    resultBlock.hidden = false;
    resultBlock.querySelector('.result-total').textContent = formatEeocUSD(result.total);
    resultBlock.querySelector('.result-uncapped').textContent = formatEeocUSD(result.uncapped);

    var cappedRow = resultBlock.querySelector('.result-capped-row');
    var capNote = resultBlock.querySelector('.result-cap-note');
    if (result.lawType === 'adea') {
      cappedRow.hidden = true;
      capNote.hidden = false;
      capNote.textContent = 'ADEA claims have no compensatory or punitive damages cap — there ' +
        'are none available under this law. Back pay, front pay, and (for willful violations) ' +
        'liquidated damages are shown above.';
    } else if (result.lawType === 'feha-ca') {
      cappedRow.hidden = false;
      resultBlock.querySelector('.result-capped').textContent = formatEeocUSD(result.capped);
      capNote.hidden = false;
      capNote.textContent = 'California FEHA has no statutory cap on compensatory or punitive damages.';
    } else {
      cappedRow.hidden = false;
      resultBlock.querySelector('.result-capped').textContent = formatEeocUSD(result.capped);
      var note = 'Compensatory + punitive damages capped at ' + formatEeocUSD(result.capApplied) +
        ' based on employer size (42 U.S.C. § 1981a). This cap is fixed at 1991 levels — never indexed for inflation.';
      if (result.punitiveExcluded) {
        note += ' Punitive damages are unavailable against public/government employers and were excluded.';
      }
      capNote.hidden = false;
      capNote.textContent = note;
    }
    resultBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}
