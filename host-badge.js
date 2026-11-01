// Removes the host's injected "Powered by Netlify" badge from the page.
//
// Why this exists: Netlify adds that badge at their edge on some plans. It is not
// part of this project and no stylesheet of ours can reach inside it — it renders
// in an isolated frame, so its contents are unreachable. What we *can* do is
// delete or hide the host element sitting in our own document.
//
// This is a best effort, not a guarantee. The supported switch is the project
// setting: Netlify → Project configuration → General → Powered by Netlify badge.
// If the badge survives this, that toggle is the answer, not more selectors.
//
// It runs on import, before any app logic, so a badge baked into the served HTML
// is gone even if the rest of the app fails to start.

const LABEL = /^powered by netlify$/i;
const HOST = /netlify/i;
const ATTRS = ['id', 'class', 'src', 'href', 'name', 'data-testid'];

/** Does this element look like the host's badge? */
export function isHostBadge(el) {
  if (!el || el.nodeType !== 1) return false;

  const tag = (el.tagName || '').toLowerCase();
  if (tag.includes('netlify')) return true;

  for (const attr of ATTRS) {
    const value = typeof el.getAttribute === 'function' ? el.getAttribute(attr) : null;
    if (value && HOST.test(value)) return true;
  }

  // the pill's own label — anchored, so it can only match an element whose whole
  // text is the label and never a paragraph that merely mentions it
  if (el.childElementCount === 0) {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text && text.length < 40 && LABEL.test(text)) return true;
  }

  return false;
}

/** Remove every matching element inside `root`. Returns how many went. */
export function sweepHostBadges(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  let removed = 0;

  // walk a static copy — removing during a live NodeList skips siblings
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (!el.isConnected) continue;
    if (isHostBadge(el)) {
      el.remove();
      removed++;
    }
  }
  return removed;
}

/**
 * Sweep now, then keep watching, because the host can inject the badge after
 * load. Returns the number removed by the first pass.
 */
export function stripHostBadge(doc = document) {
  if (!doc || !doc.body) return 0;

  let removed = sweepHostBadges(doc.body);

  // take the constructor from the document's own window: in some hosts (a test
  // runner, an iframe) it is not on the global object
  const Observer = (doc.defaultView && doc.defaultView.MutationObserver)
    || (typeof MutationObserver === 'function' ? MutationObserver : null);
  if (!Observer) return removed;

  const observer = new Observer((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (isHostBadge(node)) {
          node.remove();
          removed++;
          continue;
        }
        removed += sweepHostBadges(node);
      }
    }
  });

  observer.observe(doc.body, { childList: true, subtree: true });
  return removed;
}

// self-start: the point is that this works even if the app never boots
if (typeof document !== 'undefined' && document.body) {
  stripHostBadge(document);
} else if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => stripHostBadge(document), { once: true });
}
