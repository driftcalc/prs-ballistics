// Factory ammo library: manufacturers' PUBLISHED figures only, typed in by hand
// from each maker's own product page (no scraping, no other apps' databases).
// Every entry records its source page and the date it was checked.
// Brand and product names are trademarks of their owners; no endorsement implied.
//
// To add a load: copy an entry, fill every field from the maker's own page,
// set `source` and `checked`, and run `npm test` (ammo.test.ts checks ranges).
// Leave a load out rather than guessing a figure the maker doesn't publish.

export const CARTRIDGES = ['6.5 Creedmoor', '6mm Creedmoor', '.308 Win'] as const
export type Cartridge = (typeof CARTRIDGES)[number]

export interface FactoryLoad {
  id: string
  brand: string
  product: string
  sku?: string
  cartridge: Cartridge
  bulletWeightGr: number
  /** Published muzzle velocity from the test barrel below. */
  muzzleVelocityFps: number
  testBarrelIn: number
  /** True when the maker doesn't state the test barrel and 24" (industry standard) is assumed. */
  testBarrelAssumed?: boolean
  bc: number
  dragModel: 'G1' | 'G7'
  bulletDiameterIn: number
  /** Only when the maker publishes it (needed for spin drift). */
  bulletLengthIn?: number
  /** Extra detail about where a figure came from. */
  note?: string
  source: string
  /** Date the source page was checked (YYYY-MM-DD). */
  checked: string
}

const CHECKED = '2026-11-07'
const HORNADY_BC_NOTE = 'Hornady publishes BC by speed band; this is the Mach 1.75 value Hornady recommends beyond 600 yd (hornady.com/bc).'
const FEDERAL_BARREL_NOTE = "Federal doesn't print its test barrel length; 24\" (industry standard) assumed."

export const FACTORY_LOADS: FactoryLoad[] = [
  // ---------- 6.5 Creedmoor ----------
  {
    id: 'hornady-65cm-140-eldm',
    brand: 'Hornady',
    product: 'Match 140 gr ELD Match',
    sku: '81500',
    cartridge: '6.5 Creedmoor',
    bulletWeightGr: 140,
    muzzleVelocityFps: 2710,
    testBarrelIn: 24,
    bc: 0.31,
    dragModel: 'G7',
    bulletDiameterIn: 0.264,
    note: HORNADY_BC_NOTE,
    source: 'https://www.hornady.com/ammunition/rifle/6-5-creedmoor-140-gr-eld-match',
    checked: CHECKED,
  },
  {
    id: 'federal-gm-65cm-130-berger-ar-hybrid',
    brand: 'Federal',
    product: 'Gold Medal Berger 130 gr AR Hybrid OTM',
    sku: 'GM65CRDBH130',
    cartridge: '6.5 Creedmoor',
    bulletWeightGr: 130,
    muzzleVelocityFps: 2875,
    testBarrelIn: 24,
    testBarrelAssumed: true,
    bc: 0.287,
    dragModel: 'G7',
    bulletDiameterIn: 0.264,
    bulletLengthIn: 1.292,
    note: FEDERAL_BARREL_NOTE,
    source: 'https://www.federalpremium.com/rifle/gold-medal/gold-medal-berger/11-GM65CRDBH130.html',
    checked: CHECKED,
  },
  {
    id: 'federal-gm-65cm-140-berger-hybrid',
    brand: 'Federal',
    product: 'Gold Medal Berger 140 gr Hybrid',
    sku: 'GM65CRDBH2',
    cartridge: '6.5 Creedmoor',
    bulletWeightGr: 140,
    muzzleVelocityFps: 2725,
    testBarrelIn: 24,
    testBarrelAssumed: true,
    bc: 0.311,
    dragModel: 'G7',
    bulletDiameterIn: 0.264,
    bulletLengthIn: 1.407,
    note: FEDERAL_BARREL_NOTE,
    source: 'https://www.federalpremium.com/rifle/gold-medal/gold-medal-berger/11-GM65CRDBH2.html',
    checked: CHECKED,
  },
  {
    id: 'federal-gm-65cm-140-smk',
    brand: 'Federal',
    product: 'Gold Medal 140 gr Sierra MatchKing',
    sku: 'GM65CRD1',
    cartridge: '6.5 Creedmoor',
    bulletWeightGr: 140,
    muzzleVelocityFps: 2675,
    testBarrelIn: 24,
    testBarrelAssumed: true,
    bc: 0.261,
    dragModel: 'G7',
    bulletDiameterIn: 0.264,
    bulletLengthIn: 1.3,
    note: FEDERAL_BARREL_NOTE,
    source: 'https://www.federalpremium.com/rifle/gold-medal/gold-medal-sierra-matchking/11-GM65CRD1.html',
    checked: CHECKED,
  },
  {
    id: 'berger-65cm-140-hybrid-target',
    brand: 'Berger',
    product: '140 gr Hybrid Target',
    sku: '31011',
    cartridge: '6.5 Creedmoor',
    bulletWeightGr: 140,
    muzzleVelocityFps: 2750,
    testBarrelIn: 26,
    bc: 0.311,
    dragModel: 'G7',
    bulletDiameterIn: 0.264,
    source: 'https://bergerbullets.com/product/6-5-mm-creedmoor-140gr-hybrid-target',
    checked: CHECKED,
  },
  {
    id: 'lapua-65cm-136-scenar-l',
    brand: 'Lapua',
    product: '136 gr Scenar-L',
    sku: '4316063',
    cartridge: '6.5 Creedmoor',
    bulletWeightGr: 136,
    muzzleVelocityFps: 2740,
    testBarrelIn: 24,
    bc: 0.274,
    dragModel: 'G7',
    bulletDiameterIn: 0.264,
    source: 'https://lapua.com/product/6-5-creedmoor-open-tip-match-target-cartridge-scenar-l88g-136gr-4316063',
    checked: CHECKED,
  },
  {
    id: 'norma-65cm-130-golden-target',
    brand: 'Norma',
    product: 'Golden Target 130 gr',
    sku: '10166312',
    cartridge: '6.5 Creedmoor',
    bulletWeightGr: 130,
    muzzleVelocityFps: 2851,
    testBarrelIn: 24,
    bc: 0.271,
    dragModel: 'G7',
    bulletDiameterIn: 0.264,
    source: 'https://www.norma-ammunition.com/products/shooting/norma-golden-target/norma-golden-target-6-5-creedmoor-130gr---10166312',
    checked: CHECKED,
  },

  // ---------- 6mm Creedmoor ----------
  {
    id: 'hornady-6cm-108-eldm',
    brand: 'Hornady',
    product: 'Match 108 gr ELD Match',
    sku: '81391',
    cartridge: '6mm Creedmoor',
    bulletWeightGr: 108,
    muzzleVelocityFps: 2960,
    testBarrelIn: 24,
    bc: 0.261,
    dragModel: 'G7',
    bulletDiameterIn: 0.243,
    note: HORNADY_BC_NOTE,
    source: 'https://www.hornady.com/ammunition/rifle/6mm-creedmoor-108-gr-eld-match',
    checked: CHECKED,
  },
  {
    id: 'federal-gm-6cm-109-berger-lrht',
    brand: 'Federal',
    product: 'Gold Medal Berger 109 gr Long Range Hybrid Target',
    sku: 'GM6CRDLRHT1',
    cartridge: '6mm Creedmoor',
    bulletWeightGr: 109,
    muzzleVelocityFps: 2900,
    testBarrelIn: 24,
    testBarrelAssumed: true,
    bc: 0.292,
    dragModel: 'G7',
    bulletDiameterIn: 0.243,
    bulletLengthIn: 1.275,
    note: FEDERAL_BARREL_NOTE,
    source: 'https://www.federalpremium.com/rifle/gold-medal/gold-medal-berger/11-GM6CRDLRHT1.html',
    checked: CHECKED,
  },

  // ---------- .308 Win ----------
  {
    id: 'hornady-308-168-eldm',
    brand: 'Hornady',
    product: 'Match 168 gr ELD Match',
    sku: '80966',
    cartridge: '.308 Win',
    bulletWeightGr: 168,
    muzzleVelocityFps: 2700,
    testBarrelIn: 24,
    bc: 0.251,
    dragModel: 'G7',
    bulletDiameterIn: 0.308,
    note: HORNADY_BC_NOTE,
    source: 'https://www.hornady.com/ammunition/rifle/308-win-168-gr-eld-match',
    checked: CHECKED,
  },
  {
    id: 'federal-gm-308-168-smk',
    brand: 'Federal',
    product: 'Gold Medal 168 gr Sierra MatchKing',
    sku: 'GM308M',
    cartridge: '.308 Win',
    bulletWeightGr: 168,
    muzzleVelocityFps: 2650,
    testBarrelIn: 24,
    testBarrelAssumed: true,
    bc: 0.224,
    dragModel: 'G7',
    bulletDiameterIn: 0.308,
    bulletLengthIn: 1.22,
    note: FEDERAL_BARREL_NOTE,
    source: 'https://www.federalpremium.com/rifle/gold-medal/gold-medal-sierra-matchking/11-GM308M.html',
    checked: CHECKED,
  },
  {
    id: 'federal-gm-308-175-smk',
    brand: 'Federal',
    product: 'Gold Medal 175 gr Sierra MatchKing',
    sku: 'GM308M2',
    cartridge: '.308 Win',
    bulletWeightGr: 175,
    muzzleVelocityFps: 2600,
    testBarrelIn: 24,
    testBarrelAssumed: true,
    bc: 0.25,
    dragModel: 'G7',
    bulletDiameterIn: 0.308,
    bulletLengthIn: 1.242,
    note: FEDERAL_BARREL_NOTE,
    source: 'https://www.federalpremium.com/rifle/gold-medal/gold-medal-sierra-matchking/11-GM308M2.html',
    checked: CHECKED,
  },
  {
    id: 'lapua-308-175-scenar-l',
    brand: 'Lapua',
    product: '175 gr Scenar-L',
    sku: '4317520',
    cartridge: '.308 Win',
    bulletWeightGr: 175,
    muzzleVelocityFps: 2602,
    testBarrelIn: 26,
    bc: 0.247,
    dragModel: 'G7',
    bulletDiameterIn: 0.308,
    source: 'https://lapua.com/product/308-win-target-cartridge-scenar-l-113g-175gr-4317520',
    checked: CHECKED,
  },
  {
    id: 'lapua-308-155-scenar-l',
    brand: 'Lapua',
    product: '155 gr Scenar-L',
    sku: '4317076',
    cartridge: '.308 Win',
    bulletWeightGr: 155,
    muzzleVelocityFps: 2820,
    testBarrelIn: 26,
    bc: 0.23,
    dragModel: 'G7',
    bulletDiameterIn: 0.308,
    source: 'https://lapua.com/product/308-win-target-cartridge-scenar-l-10g-155gr-4317076',
    checked: CHECKED,
  },
]

export const loadName = (l: FactoryLoad) => `${l.brand} ${l.cartridge} ${l.product}`

/** Matches every word typed against brand, product, cartridge, weight and SKU. */
export function searchLoads(query: string, loads: FactoryLoad[] = FACTORY_LOADS): FactoryLoad[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return loads.filter((l) => {
    const hay = `${l.brand} ${l.product} ${l.cartridge} ${l.bulletWeightGr}gr ${l.bulletWeightGr} gr ${l.sku ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
