// "Open all 4": opens the environment's four sites in new tabs. Browsers count every tab
// after the first as a pop-up; when they block some, say so (allow pop-ups for this site).
for (const button of document.querySelectorAll('button[data-open-all]')) {
  button.hidden = false; // without scripts the button stays hidden; the links still work
  button.addEventListener('click', () => {
    const urls = JSON.parse(button.dataset.openAll);
    let blocked = 0;
    for (const url of urls) {
      const tab = window.open(url, '_blank');
      if (tab) tab.opener = null; // same protection as rel="noopener", but a blocked tab stays detectable
      else blocked++;
    }
    const note = button.closest('[data-env]').querySelector('[data-blocked]');
    note.hidden = blocked === 0;
    note.textContent = blocked ? `Your browser blocked ${blocked} of ${urls.length} tabs. Allow pop-ups for this site, then click again.` : '';
  });
}
