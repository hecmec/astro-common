// Crosshair tooltip for the console's line charts (progressive enhancement: without
// scripts every point still has its <title>). Reads the chart data from data-chart.
for (const svg of document.querySelectorAll('svg[data-chart]')) {
  const figure = svg.closest('[data-chart-figure]');
  const tip = figure.querySelector('[data-chart-tooltip]');
  const cross = svg.querySelector('[data-crosshair]');
  const data = JSON.parse(svg.dataset.chart);
  const fmt = new Intl.NumberFormat('en-GB');
  for (const t of svg.querySelectorAll('.chart-point > title')) t.remove(); // the tooltip replaces them

  const show = (event) => {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const x = pt.matrixTransform(svg.getScreenCTM().inverse()).x;
    let i = 0;
    for (let k = 1; k < data.columns.length; k++) if (Math.abs(data.columns[k] - x) < Math.abs(data.columns[i] - x)) i = k;
    cross.setAttribute('x1', data.columns[i]);
    cross.setAttribute('x2', data.columns[i]);
    cross.setAttribute('visibility', 'visible');
    const rows = data.series
      .map((s) => ({ name: s.name, color: s.color, value: s.values[i] }))
      .sort((a, b) => b.value - a.value);
    tip.replaceChildren();
    const head = document.createElement('div');
    head.className = 'mb-1 font-semibold';
    head.textContent = data.days[i];
    tip.append(head);
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      const dot = document.createElement('span');
      dot.className = 'site-dot';
      dot.style.background = r.color;
      const label = document.createElement('span');
      label.textContent = `${r.name}: ${fmt.format(r.value)} ${r.value === 1 ? data.unit[0] : data.unit[1]}`;
      row.append(dot, label);
      tip.append(row);
    }
    tip.hidden = false;
    const box = figure.getBoundingClientRect();
    const left = event.clientX - box.left;
    tip.style.top = `${Math.max(0, event.clientY - box.top - tip.offsetHeight - 12)}px`;
    tip.style.left = `${Math.min(Math.max(0, left + 12), box.width - tip.offsetWidth)}px`;
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerleave', () => {
    tip.hidden = true;
    cross.setAttribute('visibility', 'hidden');
  });
}
