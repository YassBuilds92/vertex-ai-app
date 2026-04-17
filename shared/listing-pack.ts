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
      label: 'Porté discret',
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
      label: 'Porté crop',
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

function sanitizeUserNotes(value?: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getProductLabel(productType: ListingPackProductType) {
  return LISTING_PACK_PRODUCT_OPTIONS.find((option) => option.id === productType)?.label || 'Produit';
}

function getStyleLabel(styleId: ListingPackStyleId) {
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
    `${Math.max(3, Math.min(input.shotCount || 4, 4))} vues`,
    notes ? `Note: ${notes}` : '',
  ].filter(Boolean).join(' | ');
}

export function buildListingPackPlan(input: ListingPackPlanInput): ListingPackShot[] {
  const shotCount = Math.max(3, Math.min(input.shotCount || 4, 4));
  const basePrompt = buildBasePrompt(input);
  const library = PRODUCT_SHOT_LIBRARY[input.productType] || PRODUCT_SHOT_LIBRARY.other;

  return library.slice(0, shotCount).map((shot) => ({
    id: shot.id,
    label: shot.label,
    shortLabel: shot.shortLabel,
    prompt: `${basePrompt} ${shot.direction}`,
  }));
}
