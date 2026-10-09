// Données fictives de la phase 1. Aucune vraie offre, aucune vraie entreprise.

export type AgentId =
  | "veilleur" | "verificateur" | "analyste" | "enqueteur" | "plume"
  | "relecteur" | "chef" | "postier" | "archiviste" | "coach";

export type AgentState = "working" | "coffee" | "waiting" | "error" | "sleeping";

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  gx: number;
  gy: number;
  shirt: string;
  hair: string;
  skin: string;
  accessory: "glasses" | "cap" | "bow" | "tie" | "headset" | "none" | "beret";
  bubbles: Record<"working" | "coffee" | "waiting" | "error" | "sleeping", string[]>;
  events: string[];
}

export const AGENTS: Agent[] = [
  {
    id: "veilleur", name: "Hugo", role: "Le Veilleur", gx: 2, gy: 2,
    shirt: "#4f7cac", hair: "#3b2a20", skin: "#e8b88a", accessory: "cap",
    bubbles: {
      working: ["J'ai trouvé 14 offres ce matin, 3 sentent bon le voyage 👀", "France Travail m'a servi une belle fournée.", "Alerte Gmail reçue, je range tout ça."],
      coffee: ["Un café et je repars en chasse."], waiting: ["Je n'ai plus de mots-clés neufs, un coup de main ?"],
      error: ["L'API France Travail me répond 429, je réessaie."], sleeping: ["zzz… offres… zzz…"],
    },
    events: ["a trouvé 14 offres via France Travail", "a lu 6 alertes Gmail (libellé « Veille »)", "a ajouté 3 offres du site carrières d'un tour-opérateur (fictif)"],
  },
  {
    id: "verificateur", name: "Inès", role: "Le Vérificateur", gx: 5, gy: 2,
    shirt: "#6a9e6d", hair: "#1e1e24", skin: "#c68b5e", accessory: "glasses",
    bubbles: {
      working: ["4 doublons éliminés, pas un de plus.", "Cette offre est toujours en ligne, je tamponne.", "52 minutes de trajet ? Non merci."],
      coffee: ["Pause : les liens morts attendront."], waiting: ["Un lien me demande de me connecter, je m'arrête là."],
      error: ["Navitia ne répond plus, je patiente."], sleeping: ["zzz… 404… zzz…"],
    },
    events: ["a écarté 4 doublons", "a écarté 2 offres à plus de 30 min de trajet", "a vérifié que 9 offres sont encore en ligne"],
  },
  {
    id: "analyste", name: "Max", role: "L'Analyste", gx: 8, gy: 2,
    shirt: "#d98c3f", hair: "#7a4a24", skin: "#f0c8a0", accessory: "tie",
    bubbles: {
      working: ["Score de compétences : 82. Environnement : 74. Pas mal.", "Poste solo sans cadre : je le signale.", "Noté, moins de postes orientés vente."],
      coffee: ["Je calcule mieux avec de la caféine."], waiting: ["Ton refus d'hier m'a fait réfléchir, je réajuste mes critères."],
      error: ["Cette fiche est trop floue, je ne peux pas la noter."], sleeping: ["zzz… 82/100… zzz…"],
    },
    events: ["a noté 7 offres (3 cœur de cible)", "a signalé un poste « seul(e) en charge de la com »", "a ajusté ses critères après un refus"],
  },
  {
    id: "enqueteur", name: "Léon", role: "L'Enquêteur", gx: 8, gy: 5,
    shirt: "#8a6fb0", hair: "#222", skin: "#e0ac7c", accessory: "beret",
    bubbles: {
      working: ["Leur dernière campagne Instagram est jolie, je note l'angle.", "Fiche entreprise terminée, avec une observation concrète.", "Ils viennent de lancer une newsletter, ça tombe bien."],
      coffee: ["Je cherche mon indice au fond de la tasse."], waiting: ["Je ne trouve rien de récent sur cette structure."],
      error: ["Leur site ne charge pas, j'essaie plus tard."], sleeping: ["zzz… angle d'accroche… zzz…"],
    },
    events: ["a terminé 3 fiches entreprise", "a trouvé un angle d'accroche pour une offre voyage", "a repéré une campagne récente à évoquer"],
  },
  {
    id: "plume", name: "Colette", role: "La Plume", gx: 5, gy: 5,
    shirt: "#d4627a", hair: "#a13d2d", skin: "#f2cfae", accessory: "bow",
    bubbles: {
      working: ["Lettre de 212 mots, ton chaleureux, zéro tiret cadratin.", "Je mets en avant la newsletter B2B et les tests A/B.", "Une accroche qui ne ressemble à aucune autre, promis."],
      coffee: ["Je cherche ma première phrase avec un café."], waiting: ["Mes lettres sont prêtes, le Relecteur les regarde."],
      error: ["Le Relecteur m'a renvoyé le dossier, je corrige."], sleeping: ["zzz… chère Madame… zzz…"],
    },
    events: ["a rédigé une lettre de 212 mots", "a proposé 2 projets du portfolio à mettre en avant", "a repris une lettre après la relecture"],
  },
  {
    id: "relecteur", name: "Gustave", role: "Le Relecteur", gx: 2, gy: 5,
    shirt: "#5a5a6e", hair: "#bdbdbd", skin: "#d9a577", accessory: "glasses",
    bubbles: {
      working: ["Chaque affirmation est traçable dans le profil. Validé.", "Un tiret cadratin ! Retour à l'envoyeur.", "« Je me permets de » ? Non, non, non."],
      coffee: ["Pause. Je relis mon café, il est un peu long."], waiting: ["Je t'ai mis 2 lettres propres sur le bureau."],
      error: ["Cette phrase n'est dans aucun document du profil. Je bloque."], sleeping: ["zzz… virgule… zzz…"],
    },
    events: ["a renvoyé une lettre à la Plume (formule creuse)", "a validé 2 lettres", "a bloqué une phrase non traçable dans le profil"],
  },
  {
    id: "chef", name: "Madeleine", role: "Le Chef de bureau", gx: 8.6, gy: 7.2,
    shirt: "#c0392b", hair: "#3b2a20", skin: "#c68b5e", accessory: "headset",
    bubbles: {
      working: ["Quotas du jour : 4 offres sur 10, 2 candidatures sur 5.", "Tout le monde est à son poste.", "2 relances à faire cette semaine."],
      coffee: ["Je fais le tour du bureau avec mon café."], waiting: ["Yacine, 2 dossiers t'attendent dans la bannette."],
      error: ["Un agent bloque, je regarde ça."], sleeping: ["zzz… planning… zzz…"],
    },
    events: ["a préparé le brief du matin", "a rappelé les quotas du jour", "a signalé 2 dossiers en attente de validation"],
  },
  {
    id: "postier", name: "Fernand", role: "Le Postier", gx: 2, gy: 10,
    shirt: "#e6b422", hair: "#4a3728", skin: "#e8b88a", accessory: "cap",
    bubbles: {
      working: ["Brouillon Gmail prêt, il ne manque que ton clic.", "Kit de candidature copiable en un clic.", "Je n'envoie rien sans ton feu vert."],
      coffee: ["Je reprends des forces avant la tournée."], waiting: ["J'attends ta validation pour préparer le brouillon."],
      error: ["Gmail refuse mon brouillon, je réessaie."], sleeping: ["zzz… courrier… zzz…"],
    },
    events: ["a préparé un brouillon Gmail (non envoyé)", "a préparé un kit de candidature", "attend la validation avant d'agir"],
  },
  {
    id: "archiviste", name: "Odile", role: "L'Archiviste", gx: 5, gy: 10,
    shirt: "#3f9c9c", hair: "#5e4b8b", skin: "#f0c8a0", accessory: "glasses",
    bubbles: {
      working: ["Relance J+7 programmée pour 2 candidatures.", "Une réponse dans Gmail ! Statut mis à jour.", "Le pipeline est à jour, au carré."],
      coffee: ["Je classe aussi mes pauses."], waiting: ["Une réponse est arrivée, je te laisse la lire."],
      error: ["Je n'arrive pas à lire cet email, il est étrange."], sleeping: ["zzz… dossier A à Z… zzz…"],
    },
    events: ["a programmé 2 relances à J+7", "a détecté une réponse de recruteur", "a mis le kanban à jour"],
  },
  {
    id: "coach", name: "Rudy", role: "Le Coach", gx: 8, gy: 10,
    shirt: "#2e86de", hair: "#111", skin: "#a8764a", accessory: "headset",
    bubbles: {
      working: ["Fiche entretien prête : 3 questions d'approfondissement.", "On s'entraîne ? Parle-moi de ta newsletter B2B.", "Méthode STAR, avec tes vraies expériences."],
      coffee: ["Un café, puis on répète ensemble."], waiting: ["Prêt pour l'entraînement quand tu veux."],
      error: ["Je n'ai pas assez d'exemples réels sur ce sujet."], sleeping: ["zzz… STAR… zzz…"],
    },
    events: ["a préparé une fiche entretien", "a sélectionné 3 questions d'approfondissement", "a proposé une séance d'entraînement"],
  },
];

export const PIPELINE: AgentId[] = ["veilleur", "verificateur", "analyste", "enqueteur", "plume", "relecteur"];

export type Niveau = "Cœur de cible" | "Bonne correspondance" | "À examiner";

export interface Offer {
  id: string;
  titre: string;
  entreprise: string;
  lieu: string;
  trajet: number;
  source: string;
  niveau: Niveau;
  scoreCompetences: number;
  scoreEnvironnement: number;
  atouts: string;
  manques: string;
  alertes: string;
  fiche: string;
  lettre: string;
}

export const OFFERS: Offer[] = [
  {
    id: "o1", titre: "Chargé(e) de marketing CRM", entreprise: "Atelier Voyageurs (fictif)", lieu: "Paris 11e", trajet: 22,
    source: "France Travail", niveau: "Cœur de cible", scoreCompetences: 82, scoreEnvironnement: 74,
    atouts: "Newsletters B2B, segmentation et tests A/B chez Atalante. Outils HubSpot, Klaviyo, Mailchimp. Secteur voyage.",
    manques: "Pas de mention de lead scoring avancé côté outil demandé.",
    alertes: "Salaire non indiqué. Équipe marketing de 3 personnes, N+1 identifié : plutôt rassurant.",
    fiche: "Agence de voyages en petit groupe, 40 personnes. Vient de lancer une newsletter mensuelle. Ton de marque chaleureux, très orienté partage.",
    lettre: "Madame, Monsieur,\n\nVotre newsletter mensuelle sur les voyages en petit groupe m'a donné envie de la lire jusqu'au bout, et c'est exactement le type de lecture que j'aimerais faire grandir chez vous.\n\nChez Atalante, je gère les newsletters B2B de nos partenaires : segmentation des bases, tests A/B sur les objets et les contenus, bilan chaque semaine. Je peux vous apporter cette même rigueur, et l'envie de comprendre qui lit quoi avant d'écrire.\n\nJe serais heureux d'en discuter avec vous.\n\nCordialement,\nYacine Bechar",
  },
  {
    id: "o2", titre: "Chargé(e) de communication digitale", entreprise: "Fondation Horizon (fictive)", lieu: "Paris 13e", trajet: 14,
    source: "Alerte Welcome to the Jungle", niveau: "Cœur de cible", scoreCompetences: 78, scoreEnvironnement: 88,
    atouts: "LinkedIn et Instagram en organique, supports print et digitaux chez Lyf Pay. Structure à mission.",
    manques: "Pas d'expérience en fondation ou en mécénat.",
    alertes: "Aucun signal d'alerte notable.",
    fiche: "Fondation pour l'éducation, 25 salariés. Campagne récente sur la lecture pour tous. Ton sobre et engagé.",
    lettre: "Madame, Monsieur,\n\nVotre campagne sur la lecture pour tous m'a marqué par sa simplicité : un message clair, pas de jargon. C'est la façon dont j'aime communiquer.\n\nJ'anime les réseaux LinkedIn et Instagram chez Atalante, et j'ai produit des supports print et digitaux diffusés nationalement chez Lyf Pay. Je peux vous aider à faire vivre vos causes auprès de publics différents.\n\nJe serais ravi d'échanger avec vous.\n\nCordialement,\nYacine Bechar",
  },
  {
    id: "o3", titre: "Content manager SEO & GEO", entreprise: "Maison Pixel (fictive)", lieu: "Paris 9e", trajet: 27,
    source: "Alerte Indeed", niveau: "Bonne correspondance", scoreCompetences: 71, scoreEnvironnement: 62,
    atouts: "SEO on-page, maillage interne et longue traîne chez Rue des Joueurs. Mention de la pratique GEO dans le CV.",
    manques: "Outil de suivi SEO précis non mentionné dans le profil.",
    alertes: "« Vous serez seul(e) en charge du contenu » : à examiner. Salaire absent.",
    fiche: "Studio de jeux vidéo indépendant, 18 personnes. Blog très lu, peu structuré côté SEO.",
    lettre: "Madame, Monsieur,\n\nVotre blog est lu, et je pense qu'il pourrait l'être encore plus. Les bonnes idées sont là, il manque la structure qui les fait remonter dans les résultats.\n\nChez Rue des Joueurs, j'ai géré un calendrier éditorial, travaillé le maillage interne et cherché des mots-clés de longue traîne. Je peux vous apporter cette méthode, sans faire perdre sa voix à votre blog.\n\nJe serais heureux d'en parler.\n\nCordialement,\nYacine Bechar",
  },
];

export const REFUS_RAISONS = [
  "Trop commercial", "Trop loin", "Poste solo", "Salaire trop flou", "Secteur peu intéressant", "Autre",
];

export const KANBAN_COLUMNS = ["Repérée", "Préparée", "Validée", "Envoyée", "Relancée", "Entretien", "Refus", "Offre"] as const;

export const KANBAN_CARDS: Record<(typeof KANBAN_COLUMNS)[number], string[]> = {
  Repérée: ["Chargé(e) CRM, Atelier Voyageurs", "Content manager, Maison Pixel", "Social media, Théâtre des Quais"],
  Préparée: ["Com digitale, Fondation Horizon"],
  Validée: [],
  Envoyée: ["Marketing partenariats, Roule & Co"],
  Relancée: ["Emailing, Librairie Aurore"],
  Entretien: ["Chargé de contenus, Musée du Jouet"],
  Refus: ["SEO, Agence Nord"],
  Offre: [],
};

export const STATS = {
  offresVues: 128, candidaturesEnvoyees: 11, tauxReponse: 27, entretiens: 2,
  parPlateforme: [["France Travail", 52], ["LinkedIn", 38], ["Welcome to the Jungle", 21], ["Indeed", 17]] as [string, number][],
  parNiveau: [["Cœur de cible", 4], ["Bonne correspondance", 5], ["À examiner", 2]] as [string, number][],
  parSemaine: [["S-3", 2], ["S-2", 3], ["S-1", 4], ["Cette sem.", 2]] as [string, number][],
};
