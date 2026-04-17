export const LISTING_PACK_PRODUCT_OPTIONS = [
  {
    id: 'clothing',
    label: 'Vetement',
    summary: 'Robes, hauts, pantalons, vestes et pieces textile.',
  },
  {
    id: 'shoes',
    label: 'Chaussures',
    summary: 'Sneakers, bottes, sandales, mocassins.',
  },
  {
    id: 'bag',
    label: 'Sac',
    summary: 'Sacs, pochettes, cartables, mini-bags.',
  },
  {
    id: 'jewelry',
    label: 'Bijou',
    summary: 'Bagues, colliers, bracelets, boucles.',
  },
  {
    id: 'beauty',
    label: 'Beaute',
    summary: 'Cosmetiques, skincare, parfums, soins.',
  },
  {
    id: 'home',
    label: 'Maison',
    summary: 'Decoration, linge, petits objets maison.',
  },
  {
    id: 'tech',
    label: 'Tech',
    summary: 'Accessoires, petits devices, audio, gaming.',
  },
  {
    id: 'other',
    label: 'Autre',
    summary: 'Produit divers quand aucune famille ne colle.',
  },
] as const;

export const LISTING_PACK_STYLE_OPTIONS = [
  {
    id: 'soft_daylight',
    label: 'Lumiere douce',
    summary: 'Lumineux, naturel, propre, tres resale-friendly.',
  },
  {
    id: 'studio_clean',
    label: 'Studio propre',
    summary: 'Fond propre, lumiere diffuse, rendu net et neutre.',
  },
  {
    id: 'editorial_minimal',
    label: 'Editorial minimal',
    summary: 'Plus premium, plus compose, mais toujours credible.',
  },
  {
    id: 'cozy_home',
    label: 'Home casual',
    summary: 'Appartement calme, vrai contexte domestique, doux.',
  },
] as const;

export type ListingPackProductType = typeof LISTING_PACK_PRODUCT_OPTIONS[number]['id'];
export type ListingPackStyleId = typeof LISTING_PACK_STYLE_OPTIONS[number]['id'];

export type ListingPackShot = {
  id: string;
  label: string;
  shortLabel: string;
  prompt: string;
};

export type ListingPackAutoPlan = {
  productType: ListingPackProductType;
  productLabel: string;
  styleId: ListingPackStyleId;
  styleLabel: string;
  shotCount: number;
  summary: string;
  rationale: string;
  shots: ListingPackShot[];
};

export type ListingPackPlanInput = {
  productType: ListingPackProductType;
  styleId: ListingPackStyleId;
  notes?: string;
  shotCount?: number;
};

type ShotBlueprint = {
  id: string;
  label: string;
  shortLabel: string;
  direction: string;
};

const STYLE_DIRECTION_COPY: Record<ListingPackStyleId, string> = {
  soft_daylight:
    'soft window daylight, calm off-white surfaces, clean secondhand listing realism, subtle natural shadows, believable smartphone-camera photo quality',
  studio_clean:
    'diffused studio lighting, light beige seamless backdrop, crisp resale listing realism, balanced exposure, quiet premium cleanliness',
  editorial_minimal:
    'refined editorial lighting, restrained premium composition, muted color palette, high-end secondhand marketplace mood, still realistic and sellable',
  cozy_home:
    'bright apartment daylight, warm neutral materials, relaxed lived-in context, natural listing photo realism, gentle cozy atmosphere',
};

const PRODUCT_ROLE_COPY: Record<ListingPackProductType, string> = {
  clothing: 'garment',
  shoes: 'pair of shoes',
  bag: 'bag',
  jewelry: 'piece of jewelry',
  beauty: 'beauty product',
  home: 'home decor product',
  tech: 'tech product',
  other: 'product',
};

const PRODUCT_SHOT_LIBRARY: Record<ListingPackProductType, ShotBlueprint[]> = {
  clothing: [
    {
      id: 'hero-front',
      label: 'Hero face',
      shortLabel: 'Hero',
      direction:
        'Create a clean hero cover shot that clearly shows the full front of the garment with slight volume, accurate drape, and a centered 4:5 listing composition.',
    },
    {
      id: 'material-detail',
      label: 'Detail matiere',
      shortLabel: 'Detail',
      direction:
        'Create a tight detail crop focused on fabric texture, stitching, print, fasteners, and material quality without changing the item.',
    },
    {
      id: 'alternate-angle',
      label: 'Dos ou profil',
      shortLabel: 'Angle',
      direction:
        'Create a clean alternate angle that shows the back view if relevant, otherwise a side profile that makes the silhouette and cut easy to understand.',
    },
    {
      id: 'styled-context',
      label: 'Contexte simple',
      shortLabel: 'Contexte',
      direction:
        'Create a simple contextual resale photo with the garment on a hanger or lightly handheld near daylight, with no visible face and no clutter.',
    },
  ],
  shoes: [
    {
      id: 'hero-pair',
      label: 'Pair hero',
      shortLabel: 'Hero',
      direction:
        'Create a sharp hero shot of the pair at a flattering three-quarter angle, with both shoes clearly readable and true to the source.',
    },
    {
      id: 'profile',
      label: 'Profil lateral',
      shortLabel: 'Profil',
      direction:
        'Create a side-profile shot that shows shape, sole thickness, and structure with crisp resale realism.',
    },
    {
      id: 'material-detail',
      label: 'Semelle detail',
      shortLabel: 'Detail',
      direction:
        'Create a close detail on texture, stitching, outsole, laces, and finish quality while preserving the exact pair.',
    },
    {
      id: 'context-floor',
      label: 'Contexte sol',
      shortLabel: 'Contexte',
      direction:
        'Create a natural contextual listing photo of the pair near a clean floor or held in hand, still focused on resale clarity rather than lifestyle theatrics.',
    },
  ],
  bag: [
    {
      id: 'hero-front',
      label: 'Hero face',
      shortLabel: 'Hero',
      direction:
        'Create a front hero shot of the bag with balanced lighting, clean background, and accurate shape, hardware, and strap placement.',
    },
    {
      id: 'hardware-detail',
      label: 'Detail hardware',
      shortLabel: 'Detail',
      direction:
        'Create a close detail crop showing zipper, clasp, stitching, hardware, leather grain, or fabric texture with honest resale fidelity.',
    },
    {
      id: 'interior-detail',
      label: 'Interieur',
      shortLabel: 'Interieur',
      direction:
        'Create a clean detail shot of the opening, interior lining, or strap construction, depending on what the source product supports best.',
    },
    {
      id: 'carry-context',
      label: 'Porte discret',
      shortLabel: 'Contexte',
      direction:
        'Create a minimal carry-context photo cropped on hand, arm, or torso only, with no face and no distracting props.',
    },
  ],
  jewelry: [
    {
      id: 'hero-macro',
      label: 'Macro hero',
      shortLabel: 'Hero',
      direction:
        'Create a sharp macro hero shot with clean highlights, true metal or stone rendering, and luxury-resale clarity.',
    },
    {
      id: 'craft-detail',
      label: 'Finition detail',
      shortLabel: 'Detail',
      direction:
        'Create an extreme close-up of clasp, texture, stone setting, engraving, or finishing detail without inventing new features.',
    },
    {
      id: 'worn-crop',
      label: 'Porte crop',
      shortLabel: 'Porte',
      direction:
        'Create a subtle worn crop on wrist, neck, or ear only, keeping the product dominant and avoiding full-face portrait framing.',
    },
    {
      id: 'clean-flatlay',
      label: 'Flat lay propre',
      shortLabel: 'Flat lay',
      direction:
        'Create a clean flat lay on a soft neutral surface with refined shadows and strong product readability.',
    },
  ],
  beauty: [
    {
      id: 'hero-packshot',
      label: 'Packshot hero',
      shortLabel: 'Hero',
      direction:
        'Create a clean hero packshot with the product upright, label readable if already present in the source, and balanced listing light.',
    },
    {
      id: 'texture-swatch',
      label: 'Texture',
      shortLabel: 'Texture',
      direction:
        'Create a texture or swatch-inspired detail shot only if it makes sense for the product, while keeping packaging faithful to the source.',
    },
    {
      id: 'cap-detail',
      label: 'Cap detail',
      shortLabel: 'Detail',
      direction:
        'Create a close crop showing cap, nozzle, applicator, or surface finish with crisp resale realism.',
    },
    {
      id: 'bathroom-context',
      label: 'Contexte propre',
      shortLabel: 'Contexte',
      direction:
        'Create a natural bathroom or vanity context shot with a calm background and no extra products stealing attention.',
    },
  ],
  home: [
    {
      id: 'hero-room',
      label: 'Hero contexte',
      shortLabel: 'Hero',
      direction:
        'Create a tasteful hero shot of the product integrated into a quiet home setting that still reads clearly as a resale listing image.',
    },
    {
      id: 'material-detail',
      label: 'Matiere detail',
      shortLabel: 'Detail',
      direction:
        'Create a material-focused close-up that shows texture, weave, grain, finish, or construction detail.',
    },
    {
      id: 'scale-context',
      label: 'Echelle',
      shortLabel: 'Echelle',
      direction:
        'Create a simple scale-context shot that helps size perception without adding distracting staging.',
    },
    {
      id: 'top-down',
      label: 'Top-down',
      shortLabel: 'Top',
      direction:
        'Create a calm top-down or alternative angle that shows form and footprint clearly.',
    },
  ],
  tech: [
    {
      id: 'hero-device',
      label: 'Hero device',
      shortLabel: 'Hero',
      direction:
        'Create a clean hero shot of the device or accessory with crisp edges, accurate materials, and realistic reflections.',
    },
    {
      id: 'ports-detail',
      label: 'Ports detail',
      shortLabel: 'Detail',
      direction:
        'Create a close detail showing buttons, ports, textures, case finish, or connector surfaces with faithful realism.',
    },
    {
      id: 'in-hand-scale',
      label: 'Main echelle',
      shortLabel: 'Echelle',
      direction:
        'Create an in-hand scale shot that keeps the product dominant, avoids dramatic posing, and feels like a premium resale photo.',
    },
    {
      id: 'desk-context',
      label: 'Desk context',
      shortLabel: 'Contexte',
      direction:
        'Create a simple desk or shelf context photo with a restrained setup and no extra clutter.',
    },
  ],
  other: [
    {
      id: 'hero-cover',
      label: 'Hero cover',
      shortLabel: 'Hero',
      direction:
        'Create a clean hero cover shot that makes the product instantly readable and attractive in a 4:5 listing frame.',
    },
    {
      id: 'detail-closeup',
      label: 'Detail close-up',
      shortLabel: 'Detail',
      direction:
        'Create a close detail crop focused on surface quality, texture, finishing, or any high-value feature visible in the source.',
    },
    {
      id: 'alternate-angle',
      label: 'Angle secondaire',
      shortLabel: 'Angle',
      direction:
        'Create a secondary angle that clarifies depth, profile, or structure while staying faithful to the source.',
    },
    {
      id: 'scale-context',
      label: 'Contexte simple',
      shortLabel: 'Contexte',
      direction:
        'Create a restrained contextual photo that suggests scale and daily use without turning into a busy ad.',
    },
  ],
};

const PRODUCT_SHOT_COMPLEMENTS: Record<ListingPackProductType, ShotBlueprint[]> = {
  clothing: [
    {
      id: 'proof-detail',
      label: 'Detail preuve',
      shortLabel: 'Preuve',
      direction:
        'Create an honest proof-detail shot focused on label area, stitching, sleeve finish, hem, or a strong quality marker that reassures resale buyers.',
    },
  ],
  shoes: [
    {
      id: 'sole-proof',
      label: 'Semelle preuve',
      shortLabel: 'Preuve',
      direction:
        'Create a clean proof-detail focused on outsole, heel wear, stitching, or tongue details to reinforce trust and condition clarity.',
    },
  ],
  bag: [
    {
      id: 'strap-proof',
      label: 'Anse detail',
      shortLabel: 'Preuve',
      direction:
        'Create a precise proof-detail of strap attachment, handle finish, corners, or hardware edges with honest resale fidelity.',
    },
  ],
  jewelry: [
    {
      id: 'clasp-proof',
      label: 'Fermoir detail',
      shortLabel: 'Preuve',
      direction:
        'Create a clean proof-detail around clasp, chain links, engraving, or stone setting to support quality and authenticity reading.',
    },
  ],
  beauty: [
    {
      id: 'usage-proof',
      label: 'Bouchon detail',
      shortLabel: 'Preuve',
      direction:
        'Create a reassuring proof-detail focused on cap, nozzle, texture of packaging, or applicator finish with clean resale clarity.',
    },
  ],
  home: [
    {
      id: 'finish-proof',
      label: 'Finition detail',
      shortLabel: 'Preuve',
      direction:
        'Create a proof-detail on weave, grain, glaze, stitching, or finishing detail that helps buyers trust material quality.',
    },
  ],
  tech: [
    {
      id: 'connector-proof',
      label: 'Connectique detail',
      shortLabel: 'Preuve',
      direction:
        'Create a proof-detail showing buttons, ports, connectors, texture, or edge finish with crisp honest realism.',
    },
  ],
  other: [
    {
      id: 'trust-detail',
      label: 'Detail preuve',
      shortLabel: 'Preuve',
      direction:
        'Create a reassuring proof-detail focused on texture, finish, seams, or a high-value visible feature that supports trust.',
    },
  ],
};

const PRODUCT_KEYWORDS: Record<ListingPackProductType, string[]> = {
  clothing: ['vetement', 'robe', 'robee', 'dress', 'top', 'tee', 't-shirt', 'shirt', 'chemise', 'hoodie', 'sweat', 'jean', 'jeans', 'pantalon', 'pant', 'skirt', 'jupe', 'veste', 'jacket', 'coat', 'pull', 'cardigan', 'blouse'],
  shoes: ['chaussure', 'chaussures', 'shoe', 'shoes', 'sneaker', 'sneakers', 'basket', 'baskets', 'boot', 'boots', 'botte', 'bottes', 'heel', 'heels', 'sandale', 'sandales', 'loafer', 'mocassin'],
  bag: ['sac', 'bag', 'handbag', 'tote', 'pochette', 'clutch', 'backpack', 'cartable', 'mini bag', 'shoulder bag', 'crossbody'],
  jewelry: ['bijou', 'bijoux', 'jewelry', 'jewellery', 'ring', 'bague', 'necklace', 'collier', 'bracelet', 'earring', 'boucle', 'pendant', 'broche'],
  beauty: ['beaute', 'beauty', 'parfum', 'perfume', 'skincare', 'serum', 'creme', 'cream', 'lipstick', 'gloss', 'makeup', 'cosmetic', 'cosmetique'],
  home: ['maison', 'home', 'deco', 'decor', 'decoration', 'vase', 'cushion', 'coussin', 'lampe', 'lamp', 'candle', 'bougie', 'mug', 'plate', 'linge'],
  tech: ['tech', 'iphone', 'phone', 'smartphone', 'airpods', 'headphone', 'casque', 'camera', 'cam', 'console', 'gaming', 'charger', 'macbook', 'ipad', 'keyboard', 'mouse', 'device'],
  other: [],
};

const STYLE_KEYWORDS: Record<ListingPackStyleId, string[]> = {
  soft_daylight: ['daylight', 'naturel', 'natural', 'soft', 'doux', 'douce', 'clair', 'light', 'clean daylight'],
  studio_clean: ['studio', 'packshot', 'fond propre', 'fond blanc', 'clean', 'neutral', 'neutre', 'seamless'],
  editorial_minimal: ['editorial', 'premium', 'luxe', 'luxury', 'campaign', 'magazine', 'brand', 'haut de gamme'],
  cozy_home: ['cozy', 'home', 'maison', 'interieur', 'apartment', 'warm', 'domestic', 'lived-in'],
};

const DEFAULT_STYLE_BY_PRODUCT: Record<ListingPackProductType, ListingPackStyleId> = {
  clothing: 'soft_daylight',
  shoes: 'studio_clean',
  bag: 'editorial_minimal',
  jewelry: 'editorial_minimal',
  beauty: 'studio_clean',
  home: 'cozy_home',
  tech: 'studio_clean',
  other: 'soft_daylight',
};

const DEFAULT_SHOT_COUNT_BY_PRODUCT: Record<ListingPackProductType, number> = {
  clothing: 5,
  shoes: 5,
  bag: 5,
  jewelry: 5,
  beauty: 4,
  home: 4,
  tech: 5,
  other: 4,
};

function sanitizeUserNotes(value?: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDetectionText(value?: string) {
  return sanitizeUserNotes(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ');
}

function scoreKeywordMatches(haystack: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => {
    if (!keyword) return score;
    return haystack.includes(normalizeDetectionText(keyword)) ? score + 1 : score;
  }, 0);
}

function inferProductType(notes?: string, fileNames: string[] = []): ListingPackProductType {
  const haystack = normalizeDetectionText([notes || '', ...fileNames].join(' '));
  if (!haystack) return 'other';

  let bestType: ListingPackProductType = 'other';
  let bestScore = 0;
  (Object.keys(PRODUCT_KEYWORDS) as ListingPackProductType[]).forEach((productType) => {
    const score = scoreKeywordMatches(haystack, PRODUCT_KEYWORDS[productType]);
    if (score > bestScore) {
      bestType = productType;
      bestScore = score;
    }
  });

  return bestType;
}

function inferStyleId(notes: string | undefined, productType: ListingPackProductType): ListingPackStyleId {
  const haystack = normalizeDetectionText(notes);
  if (!haystack) return DEFAULT_STYLE_BY_PRODUCT[productType];

  let bestStyle: ListingPackStyleId = DEFAULT_STYLE_BY_PRODUCT[productType];
  let bestScore = 0;
  (Object.keys(STYLE_KEYWORDS) as ListingPackStyleId[]).forEach((styleId) => {
    const score = scoreKeywordMatches(haystack, STYLE_KEYWORDS[styleId]);
    if (score > bestScore) {
      bestStyle = styleId;
      bestScore = score;
    }
  });

  return bestStyle;
}

function inferShotCount(
  productType: ListingPackProductType,
  notes: string | undefined,
  imageCount = 0,
) {
  const haystack = normalizeDetectionText(notes);
  let shotCount = DEFAULT_SHOT_COUNT_BY_PRODUCT[productType];

  if (/\b(detail|details|macro|texture|matiere|proof|preuve|echelle|scale|angles|plusieurs vues|tous les angles)\b/.test(haystack)) {
    shotCount += 1;
  }

  if (imageCount >= 5) {
    shotCount += 1;
  }

  return Math.max(4, Math.min(shotCount, 5));
}

function getShotBlueprints(productType: ListingPackProductType) {
  return [
    ...(PRODUCT_SHOT_LIBRARY[productType] || PRODUCT_SHOT_LIBRARY.other),
    ...(PRODUCT_SHOT_COMPLEMENTS[productType] || PRODUCT_SHOT_COMPLEMENTS.other),
  ];
}

export function getProductLabel(productType: ListingPackProductType) {
  return LISTING_PACK_PRODUCT_OPTIONS.find((option) => option.id === productType)?.label || 'Produit';
}

export function getStyleLabel(styleId: ListingPackStyleId) {
  return LISTING_PACK_STYLE_OPTIONS.find((option) => option.id === styleId)?.label || 'Style';
}

function buildBasePrompt(input: ListingPackPlanInput) {
  const productRole = PRODUCT_ROLE_COPY[input.productType] || 'product';
  const styleDirection = STYLE_DIRECTION_COPY[input.styleId] || STYLE_DIRECTION_COPY.soft_daylight;
  const notes = sanitizeUserNotes(input.notes);

  const segments = [
    `Use the attached source photos as the only source of truth for the ${productRole}.`,
    'Preserve the exact item identity, silhouette, proportions, colors, textures, hardware placement, seams, and material feel.',
    'Remove AliExpress-style clutter, collage layouts, stock-photo noise, watermarks, fake labels, promo text, and extra props.',
    'Create a photorealistic Vinted-ready secondhand listing photo with one product only, no duplicates, no packaging, and no invented accessories.',
    `Art direction: ${styleDirection}.`,
    'Keep the image believable, clean, and honest. No generated text overlays. No split collage. No background chaos.',
  ];

  if (notes) {
    segments.push(`Respect this user note when relevant: ${notes}.`);
  }

  return segments.join(' ');
}

export function buildListingPackSummary(input: ListingPackPlanInput) {
  const notes = sanitizeUserNotes(input.notes);
  return [
    `Pack Vinted auto`,
    getProductLabel(input.productType),
    getStyleLabel(input.styleId),
    `${Math.max(3, Math.min(input.shotCount || 4, 5))} vues`,
    notes ? `Note: ${notes}` : '',
  ].filter(Boolean).join(' | ');
}

export function buildListingPackPlan(input: ListingPackPlanInput): ListingPackShot[] {
  const shotCount = Math.max(3, Math.min(input.shotCount || 4, 5));
  const basePrompt = buildBasePrompt(input);
  const library = getShotBlueprints(input.productType);

  return library.slice(0, shotCount).map((shot) => ({
    id: shot.id,
    label: shot.label,
    shortLabel: shot.shortLabel,
    prompt: `${basePrompt} ${shot.direction}`,
  }));
}

function buildAutoPlanRationale(
  productType: ListingPackProductType,
  styleId: ListingPackStyleId,
  shotCount: number,
  imageCount: number,
) {
  const productLabel = getProductLabel(productType);
  const styleLabel = getStyleLabel(styleId);
  const referenceLabel = imageCount > 0 ? `${imageCount} ref${imageCount > 1 ? 's' : ''}` : 'brief libre';
  return `${productLabel} detecte, rendu ${styleLabel.toLowerCase()}, ${shotCount} angles utiles a partir de ${referenceLabel}.`;
}

export function buildAdaptiveListingPack(input: {
  notes?: string;
  imageCount?: number;
  fileNames?: string[];
}): ListingPackAutoPlan {
  const productType = inferProductType(input.notes, input.fileNames || []);
  const styleId = inferStyleId(input.notes, productType);
  const shotCount = inferShotCount(productType, input.notes, input.imageCount || 0);
  const shots = buildListingPackPlan({
    productType,
    styleId,
    notes: input.notes,
    shotCount,
  });
  const productLabel = getProductLabel(productType);
  const styleLabel = getStyleLabel(styleId);

  return {
    productType,
    productLabel,
    styleId,
    styleLabel,
    shotCount,
    summary: [
      'Plan auto',
      productLabel,
      styleLabel,
      `${shotCount} vues`,
    ].join(' - '),
    rationale: buildAutoPlanRationale(productType, styleId, shotCount, input.imageCount || 0),
    shots,
  };
}
