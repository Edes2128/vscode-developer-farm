import type { ShopDef } from '../engine/economy/types';

/**
 * Willa's stall on Home Farm. She minds it from about nine until five (her schedule says so, and the stall is shut
 * the rest of the time). She sells seeds by the season, chicken feed and chickens, and buys produce on the spot at a
 * price that shifts from day to day. The shipping bin pays the usual price, tomorrow.
 */
export const SHOPS: readonly ShopDef[] = [
  {
    id: 'seed_stall',
    name: "Willa's stall",
    keeper: 'willa',
    buys: { variance: 0.15 },
    offers: [
      { item: 'radish_seeds', quantity: 5, price: 50, seasons: ['spring'] },
      { item: 'strawberry_seeds', quantity: 3, price: 90, seasons: ['spring'] },
      { item: 'tomato_seeds', quantity: 3, price: 75, seasons: ['summer'] },
      { item: 'sunflower_seeds', quantity: 5, price: 100, seasons: ['summer', 'autumn'] },
      { item: 'pumpkin_seeds', quantity: 2, price: 100, seasons: ['autumn'] },
      { item: 'chicken_feed', quantity: 5, price: 25 },
      { animal: 'chicken', quantity: 1, price: 250 },
    ],
  },
];

/**
 * Hollis's general store: the tools for the water and the mine, and a buyer for what you bring up. He minds the counter from nine
 * until five (inside the shop). Tools are one-offs: they are not offered again while you hold one.
 */
export const GENERAL_STORE_SHOP: ShopDef = {
  id: 'general_store',
  name: "Reed's General Store",
  keeper: 'hollis',
  buys: { variance: 0.1 },
  offers: [
    { item: 'fishing_rod', quantity: 1, price: 60, once: true },
    { item: 'pickaxe', quantity: 1, price: 90, once: true },
    { item: 'chicken_feed', quantity: 5, price: 25 },
    // Furniture for the farmhouse (see Make Yourself at Home).
    { item: 'chair', quantity: 1, price: 80 },
    { item: 'table', quantity: 1, price: 150 },
    { item: 'bookshelf', quantity: 1, price: 200 },
    { item: 'rug', quantity: 1, price: 120 },
    { item: 'pot_plant', quantity: 1, price: 60 },
    { item: 'armchair', quantity: 1, price: 220 },
    { item: 'wardrobe', quantity: 1, price: 300 },
  ],
};

/** Every shop in the game. */
/**
 * Rowan's cart, on the green every Sunday from eight until six. He sells every kind of seed whatever the season (a glasshouse
 * makes them worth having) at about four tenths over Willa's price, and he buys produce at a price that moves more than hers.
 */
export const MERCHANT_SHOP: ShopDef = {
  id: 'merchant',
  name: "Rowan's cart",
  keeper: 'rowan',
  buys: { variance: 0.2 },
  offers: [
    { item: 'radish_seeds', quantity: 5, price: 70 },
    { item: 'strawberry_seeds', quantity: 3, price: 125 },
    { item: 'tomato_seeds', quantity: 3, price: 105 },
    { item: 'sunflower_seeds', quantity: 5, price: 140 },
    { item: 'pumpkin_seeds', quantity: 2, price: 140 },
  ],
};

/**
 * Fern's shelf at the lodge, open whenever she is in (she is always in). Moonbloom seeds and fertilizer: the first only grows on
 * nights it rains, the second makes a crop far likelier to turn out well. She buys what the valley's shy creatures leave behind.
 */
export const LODGE_SHOP: ShopDef = {
  id: 'lodge',
  name: "Fern's shelf",
  keeper: 'fern',
  buys: { variance: 0.1 },
  offers: [
    { item: 'moonbloom_seeds', quantity: 2, price: 220 },
    { item: 'fertilizer', quantity: 3, price: 45 },
  ],
};

export const ALL_SHOPS: readonly ShopDef[] = [...SHOPS, GENERAL_STORE_SHOP, MERCHANT_SHOP, LODGE_SHOP];
