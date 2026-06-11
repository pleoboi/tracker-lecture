export const PROGRAMMES = [
  { id: 71515, name: 'Basket-Center DE', group: 'Basket-Center', country: 'DE', currency: 'EUR' },
  { id: 71517, name: 'Basket-Center ES', group: 'Basket-Center', country: 'ES', currency: 'EUR' },
  { id: 65154, name: 'Basket-Center FR', group: 'Basket-Center', country: 'FR', currency: 'EUR' },
  { id: 80883, name: 'Basket-Center IT', group: 'Basket-Center', country: 'IT', currency: 'EUR' },
  { id: 103057, name: 'Basket-Center NL', group: 'Basket-Center', country: 'NL', currency: 'EUR' },
  { id: 65908, name: 'Direct-Running DE', group: 'Direct-Running', country: 'DE', currency: 'EUR' },
  { id: 80865, name: 'Direct-Running ES', group: 'Direct-Running', country: 'ES', currency: 'EUR' },
  { id: 65156, name: 'Direct-Running FR', group: 'Direct-Running', country: 'FR', currency: 'EUR' },
  { id: 80891, name: 'Direct-Running IT', group: 'Direct-Running', country: 'IT', currency: 'EUR' },
  { id: 71531, name: 'Direct-Running NL', group: 'Direct-Running', country: 'NL', currency: 'EUR' },
  { id: 71523, name: 'Direct-Running UK', group: 'Direct-Running', country: 'UK', currency: 'GBP' },
  { id: 85613, name: 'Direct-Running US', group: 'Direct-Running', country: 'US', currency: 'USD' },
  { id: 103039, name: 'Direct-Volley DE', group: 'Direct-Volley', country: 'DE', currency: 'EUR' },
  { id: 71527, name: 'Direct-Volley ES', group: 'Direct-Volley', country: 'ES', currency: 'EUR' },
  { id: 65158, name: 'Direct-Volley FR', group: 'Direct-Volley', country: 'FR', currency: 'EUR' },
  { id: 80877, name: 'Direct-Volley IT', group: 'Direct-Volley', country: 'IT', currency: 'EUR' },
  { id: 103041, name: 'Direct-Volley NL', group: 'Direct-Volley', country: 'NL', currency: 'EUR' },
  { id: 85609, name: 'Direct-Volley PT', group: 'Direct-Volley', country: 'PT', currency: 'EUR' },
  { id: 84353, name: 'Endurance-Store FR', group: 'Endurance-Store', country: 'FR', currency: 'EUR' },
  { id: 65914, name: 'Handball-Store IT', group: 'Handball-Store', country: 'IT', currency: 'EUR' },
  { id: 65916, name: 'Handball-Store DE', group: 'Handball-Store', country: 'DE', currency: 'EUR' },
  { id: 71537, name: 'Handball-Store ES', group: 'Handball-Store', country: 'ES', currency: 'EUR' },
  { id: 61909, name: 'Handball-Store FR', group: 'Handball-Store', country: 'FR', currency: 'EUR' },
  { id: 71541, name: 'Handball-Store NL', group: 'Handball-Store', country: 'NL', currency: 'EUR' },
  { id: 85601, name: 'Handball-Store PT', group: 'Handball-Store', country: 'PT', currency: 'EUR' },
  { id: 71535, name: 'Smash-Expert DE', group: 'Smash-Expert', country: 'DE', currency: 'EUR' },
  { id: 80889, name: 'Smash-Expert ES', group: 'Smash-Expert', country: 'ES', currency: 'EUR' },
  { id: 65152, name: 'Smash-Expert FR', group: 'Smash-Expert', country: 'FR', currency: 'EUR' },
  { id: 80879, name: 'Smash-Expert NL', group: 'Smash-Expert', country: 'NL', currency: 'EUR' },
  { id: 62027, name: 'Trek-Expert FR', group: 'Trek-Expert', country: 'FR', currency: 'EUR' },
  { id: 71543, name: 'Trek-Expert DE', group: 'Trek-Expert', country: 'DE', currency: 'EUR' },
  { id: 71547, name: 'Trek-Expert ES', group: 'Trek-Expert', country: 'ES', currency: 'EUR' },
  { id: 71551, name: 'Trek-Expert NL', group: 'Trek-Expert', country: 'NL', currency: 'EUR' },
  { id: 85619, name: 'Trek-Expert UK', group: 'Trek-Expert', country: 'UK', currency: 'GBP' },
];

export const GROUPS = ['Basket-Center', 'Direct-Running', 'Direct-Volley', 'Endurance-Store', 'Handball-Store', 'Smash-Expert', 'Trek-Expert'];

export function getProgrammesByGroup(group) {
  if (!group || group === 'all') return PROGRAMMES;
  return PROGRAMMES.filter(p => p.group === group);
}
