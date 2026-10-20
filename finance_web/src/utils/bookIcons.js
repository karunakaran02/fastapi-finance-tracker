export const PRESET_BOOK_ICONS = [
  { id: 'agriculture', label: 'Agriculture / Farm' },
  { id: 'corporate_fare', label: 'Business / Office' },
  { id: 'storefront', label: 'Retail / Store' },
  { id: 'directions_car', label: 'Vehicle / Travel' },
  { id: 'work', label: 'Work / Payroll' },
  { id: 'home', label: 'Home / Rent' },
  { id: 'account_balance', label: 'Bank / Wealth' },
  { id: 'person', label: 'Personal / Self' },
  { id: 'savings', label: 'Savings / Fund' },
  { id: 'shopping_bag', label: 'Shopping / Lifestyle' },
  { id: 'restaurant', label: 'Food / Dining' },
  { id: 'medical_services', label: 'Health / Medical' },
  { id: 'school', label: 'Education / Studies' },
  { id: 'bolt', label: 'Tech / Energy' },
  { id: 'local_shipping', label: 'Logistics / Supply' },
  { id: 'build', label: 'Tools / Maintenance' },
  { id: 'trending_up', label: 'Investments / Growth' },
  { id: 'folder', label: 'Projects / Files' },
  { id: 'menu_book', label: 'Ledger / General' },
];

export const inferIconFromTitle = (title = '') => {
  const t = String(title || '').toLowerCase().trim();
  if (!t) return 'menu_book';

  if (/\b(agri|farm|crop|harvest|field|paddy|wheat|samba|kharif|rabi|grain|dairy|plant|horticulture|tractor|seed|fertilizer)\b/.test(t) || t.includes('agri') || t.includes('farm') || t.includes('samba')) {
    return 'agriculture';
  }

  if (/\b(office|company|corporate|corp|firm|enterprise|agency|consult|business|hq|venture)\b/.test(t) || t.includes('corp') || t.includes('office') || t.includes('sundareswar')) {
    return 'corporate_fare';
  }

  if (/\b(shop|store|retail|mart|market|pos|merchandise|boutique|bazaar|supermarket|trade|sales)\b/.test(t) || t.includes('shop') || t.includes('store') || t.includes('mart')) {
    return 'storefront';
  }

  if (/\b(car|vehicle|auto|transport|travel|fuel|diesel|petrol|taxi|cab|flight|trip|commute|fleet|driver|toll|transit)\b/.test(t) || t.includes('travel') || t.includes('transport') || t.includes('fuel')) {
    return 'directions_car';
  }

  if (/\b(salary|payroll|wage|labor|labour|worker|employee|staff|bonus|freelance|stipend|job|career|wages)\b/.test(t) || t.includes('salary') || t.includes('payroll') || t.includes('wage')) {
    return 'work';
  }

  if (/\b(home|house|flat|apartment|rent|mortgage|lease|property|realty|estate|villa|residence)\b/.test(t) || t.includes('home') || t.includes('house') || t.includes('rent')) {
    return 'home';
  }

  if (/\b(personal|private|individual|self|karunakaran|karan|family|member)\b/.test(t) || t.includes('personal') || t.includes('karunakaran')) {
    return 'person';
  }

  if (/\b(savings|piggy|reserve|emergency|deposit)\b/.test(t) || t.includes('saving')) {
    return 'savings';
  }

  if (/\b(bank|finance|wealth|fund|invest|crypto|loan|capital|vault|cash|treasury|asset|stocks|mutual|trading)\b/.test(t) || t.includes('bank') || t.includes('invest') || t.includes('crypto')) {
    return 'account_balance';
  }

  if (/\b(health|medical|hospital|clinic|doctor|pharma|medicine|care|fitness|dental|gym|treatment|wellness)\b/.test(t) || t.includes('health') || t.includes('clinic') || t.includes('med')) {
    return 'medical_services';
  }

  if (/\b(food|dining|restaurant|cafe|hotel|kitchen|grocery|groceries|snack|meal|mess|bakery|catering|coffee)\b/.test(t) || t.includes('food') || t.includes('dining') || t.includes('restaurant')) {
    return 'restaurant';
  }

  if (/\b(shop|shopping|cloth|apparel|dress|mall|order|buy)\b/.test(t) || t.includes('shopping')) {
    return 'shopping_bag';
  }

  if (/\b(tech|electric|power|utility|cloud|software|code|it|server|network|energy|bill|hosting|domain)\b/.test(t) || t.includes('electric') || t.includes('power') || t.includes('software')) {
    return 'bolt';
  }

  if (/\b(school|college|tuition|course|study|exam|class|training|academy|degree|student|fees)\b/.test(t) || t.includes('school') || t.includes('college') || t.includes('tuition')) {
    return 'school';
  }

  if (/\b(warehouse|stock|inventory|shipping|cargo|delivery|courier|logistics|shipment|freight)\b/.test(t) || t.includes('shipping') || t.includes('stock') || t.includes('cargo')) {
    return 'local_shipping';
  }

  if (/\b(repair|maintenance|tool|hardware|construct|build|civil|service|machinery)\b/.test(t) || t.includes('repair') || t.includes('maintenance')) {
    return 'build';
  }

  if (/\b(invest|growth|equity|dividend|forex|yield|return)\b/.test(t) || t.includes('invest')) {
    return 'trending_up';
  }

  if (/\b(project|folder|docs|file|records|general|client|audit|misc)\b/.test(t)) {
    return 'folder';
  }

  return 'menu_book';
};

export const getAppropriateBookIcon = (title = '', customIcon = '') => {
  if (customIcon && /^[a-z0-9_]+$/.test(customIcon) && customIcon !== 'menu_book' && customIcon !== 'book') {
    return customIcon;
  }

  if (title) {
    const inferred = inferIconFromTitle(title);
    if (inferred && inferred !== 'menu_book') return inferred;
  }

  if (customIcon && (customIcon === 'menu_book' || customIcon === 'book')) {
    return 'menu_book';
  }

  if (title) {
    return inferIconFromTitle(title);
  }

  return 'menu_book';
};

export default {
  PRESET_BOOK_ICONS,
  inferIconFromTitle,
  getAppropriateBookIcon,
};

