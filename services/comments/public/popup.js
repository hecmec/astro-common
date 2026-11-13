// Sign-in popup: closes itself once the sign-in flow is complete.
(function () {
  var closing = document.querySelector('[data-close]');
  if (closing) {
    setTimeout(function () { window.close(); }, 1200);
    return;
  }
  var el = document.querySelector('[data-flow]');
  if (!el) return;
  var flow = el.getAttribute('data-flow');
  var timer = setInterval(function () {
    fetch('/auth/popup-status?flow=' + encodeURIComponent(flow))
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s.done) { clearInterval(timer); window.close(); }
        if (s.expired) clearInterval(timer);
      })
      .catch(function () {});
  }, 2000);
})();
