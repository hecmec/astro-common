/**
 * Styles inside the shadow root. Fonts and colours inherit from the page; sites can
 * tune the look with these custom properties on any ancestor:
 *   --bc-accent, --bc-accent-text, --bc-muted, --bc-border, --bc-surface, --bc-radius, --bc-danger
 */
export const STYLE = `
:host { display: block; }
:host([hidden]) { display: none; }
.bc { --accent: var(--bc-accent, #2f6b4f); --accent-text: var(--bc-accent-text, #fff); --muted: var(--bc-muted, color-mix(in srgb, currentColor 65%, transparent));
  --border: var(--bc-border, color-mix(in srgb, currentColor 20%, transparent)); --surface: var(--bc-surface, transparent);
  --radius: var(--bc-radius, .6rem); --danger: var(--bc-danger, #b3261e); }
h2 { font-size: 1.3em; margin: 0 0 .75em; }
p { margin: 0 0 .75em; }
.muted { color: var(--muted); font-size: .9em; }
.small { font-size: .8em; }
.empty { margin-top: 1em; }
.reactions { display: flex; flex-wrap: wrap; gap: .5em; margin-bottom: 1em; }
.reaction { font: inherit; font-size: .9em; padding: .35em .8em; border: 1px solid var(--border); border-radius: 2em; background: var(--surface); color: inherit; cursor: pointer; }
.reaction[aria-pressed="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.reaction .count { font-weight: 700; }
.comments { display: grid; gap: .75em; margin-top: 1.25em; }
.comment { border: 1px solid var(--border); border-radius: var(--radius); padding: .75em 1em; background: var(--surface); }
.comment.pending, .comment.refused { border-style: dashed; }
.comment header { display: flex; flex-wrap: wrap; gap: .5em; align-items: baseline; font-size: .9em; }
.comment time { color: var(--muted); }
.body { white-space: pre-wrap; overflow-wrap: anywhere; margin: .4em 0 0; }
.body a, .notice a { color: var(--accent); }
.reply { margin-top: .6em; padding: .5em .8em; border-left: 3px solid var(--accent); font-size: .95em; }
.badge { font-size: .8em; padding: .05em .5em; border: 1px solid var(--border); border-radius: 1em; color: var(--muted); }
.footer { margin-top: .5em; }
label { display: block; font-weight: 600; margin-bottom: .35em; }
textarea, input[type=text] { width: 100%; box-sizing: border-box; font: inherit; padding: .55em .7em; border: 1px solid var(--border); border-radius: calc(var(--radius) * .8); background: var(--surface); color: inherit; }
.row { display: flex; flex-wrap: wrap; gap: .5em; align-items: center; margin-top: .5em; }
.row input { flex: 1 1 12em; width: auto; }
.spread { justify-content: space-between; }
.btn { font: inherit; padding: .5em 1.1em; border: 1px solid var(--accent); border-radius: calc(var(--radius) * .8); background: var(--accent); color: var(--accent-text); cursor: pointer; }
.btn:disabled { opacity: .6; cursor: wait; }
.btn.secondary { background: transparent; color: var(--accent); }
.btn.danger { background: transparent; border-color: var(--danger); color: var(--danger); }
.link { font: inherit; font-size: .9em; padding: 0; border: 0; background: none; color: var(--accent); text-decoration: underline; cursor: pointer; }
.comment > .link { margin-top: .4em; }
.notice { padding: .55em .9em; border-left: 3px solid var(--border); border-radius: calc(var(--radius) * .5); background: color-mix(in srgb, currentColor 5%, transparent); font-size: .95em; }
.notice.success { border-left-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.notice.error { border-left-color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }
.notice .icon { font-weight: 700; color: var(--accent); margin-right: .4em; }
.account { margin-top: .75em; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
