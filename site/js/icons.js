// Pictogrammes originaux des dix motivations (trait, couleur héritée de la carte).

const P = {
  curiosity: '<circle cx="21" cy="21" r="11"/><path d="M29 29l11 11"/><path d="M17.5 17.5a5 5 0 0 1 7 0"/>',
  honor: '<path d="M24 6l14 5v12c0 9-6.5 15.5-14 19-7.5-3.5-14-10-14-19V11z"/><path d="M18 24l4.5 4.5L31 20"/>',
  acceptance: '<circle cx="24" cy="24" r="15" stroke-dasharray="4 4.2"/><circle cx="24" cy="24" r="5" fill="currentColor" stroke="none"/>',
  mastery: '<path d="M7 40h10v-9h9v-9h9V12h6"/><path d="M35 12V6l5 3-5 3"/>',
  power: '<path d="M6 34l36-14"/><path d="M19 42l5-12 5 12z" fill="currentColor" fill-opacity=".25"/><rect x="33" y="9" width="8" height="8" rx="1.5" fill="currentColor" fill-opacity=".25"/>',
  freedom: '<path d="M24 5l11 13-11 13-11-13z"/><path d="M13 18h22M24 5v26" stroke-width="1.6"/><path d="M24 31c-3 4 4 6 0 12"/>',
  relatedness: '<circle cx="18" cy="24" r="11"/><circle cx="30" cy="24" r="11"/>',
  order: '<rect x="8" y="9" width="7" height="7" rx="1.5"/><rect x="8" y="20.5" width="7" height="7" rx="1.5"/><rect x="8" y="32" width="7" height="7" rx="1.5"/><path d="M20 12.5h20M20 24h20M20 35.5h20"/>',
  goal: '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none"/>',
  status: '<path d="M6 42V30h12v12M18 42V22h12v20M30 42V33h12v9"/><path d="M24 7l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="currentColor" stroke="none"/>',
};

export function icon(id) {
  return `<svg class="mcard-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[id] ?? ''}</svg>`;
}
