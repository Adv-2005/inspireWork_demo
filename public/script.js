async function triggerCall() {
  const raw = document.getElementById('phone').value.trim().replace(/^\+/, '');

  if (!raw) {
    showStatus('error', 'Please enter a destination phone number.');
    return;
  }

  const to  = '+' + raw;
  const btn = document.getElementById('callBtn');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Initiating...';
  animateStep('step-sms', 'active');

  try {
    const res = await fetch('/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unknown error');

    // Animate remaining steps with delay
    setTimeout(() => animateStep('step-call', 'active'), 400);
    setTimeout(() => animateStep('step-auth', 'active'), 900);
    setTimeout(() => animateStep('step-ivr',  'active'), 1400);

    showStatus(
      'success',
      `✓ OTP sent via SMS\n Call placed to ${to}`,
      data.requestUuid ? `UUID: ${data.requestUuid}` : ''
    );

    btn.innerHTML = ' Call Initiated';

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = 'Initiate Another Call';
      resetSteps();
    }, 5000);

  } catch (err) {
    showStatus('error', `✗ ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = 'Initiate Call';
    resetSteps();
  }
}

// Live status updates via Server-Sent Events
function initEventSource() {
  if (!window.EventSource) return;

  const url = `${location.protocol}//${location.host}/events`;
  let es;
  let reconnectTimer = null;

  function connect() {
    es = new EventSource(url);

    es.onopen = () => {
      console.log('SSE connected');
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'plivo_status') {
          const p = data.payload;
          const statusText = `Status: ${p.CallStatus || p.callStatus || p.Event || p.event || 'unknown'}; From: ${p.From || p.from || ''}; To: ${p.To || p.to || ''}`;
          showStatus('info', statusText, `UUID: ${p.CallUUID || p.callUUID || ''}`);
        }
      } catch (err) {
        // some server messages might not be JSON (e.g., comments); ignore parse errors
      }
    };

    es.onerror = (err) => {
      console.log('SSE error', err);
      try { es.close(); } catch (e) {}
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => connect(), 3000);
      }
    };
  }

  connect();
}

initEventSource();

function showStatus(type, msg, sub = '') {
  const el = document.getElementById('status');
  el.className = `status ${type}`;
  document.getElementById('statusMsg').textContent = msg;
  document.getElementById('uuid').textContent = sub;
}

function animateStep(id, cls) {
  const prev = document.querySelector('.step.active');
  if (prev && prev.id !== id) {
    prev.classList.remove('active');
    prev.classList.add('done');
  }
  document.getElementById(id).classList.add(cls);
}

function resetSteps() {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active', 'done'));
  document.getElementById('step-sms').classList.add('active');
}

// Allow Enter key to trigger call
document.getElementById('phone').addEventListener('keydown', e => {
  if (e.key === 'Enter') triggerCall();
});
