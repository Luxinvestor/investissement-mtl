import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';

/* ============================================================
   SOURCES CENTRALISÉES
   ============================================================ */
const SOURCES = {
  apprecImmo: {
    label: 'APCIQ / Centris – prix médian condo Montréal +46 % en 5 ans (2020-2025), +5 % en 2025',
    url: 'https://www.lapresse.ca/affaires/marche-immobilier/2026-01-14/rapport-de-l-apciq/les-prix-des-proprietes-ont-explose-de-67-en-cinq-ans.php',
    note: 'Projection long terme ~3-4 %/an après période de hausse exceptionnelle'
  },
  loyerMtl: {
    label: 'SCHL / Statistique Canada – loyer moyen 2 ch Montréal +7,2 % en 2025, +6,3 % en 2024',
    url: 'https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/market-reports/rental-market-reports-major-centres',
    note: 'Loyer moyen 2-ch Montréal RMR : 1 346 $ en 2025'
  },
  talAjustement: {
    label: 'TAL – ajustement moyen 2024 : ~4 % (varie 3-6 % selon composantes)',
    url: 'https://www.tal.gouv.qc.ca/fr/actualites/detail?code=le-calcul-de-l-ajustement-des-loyers-en-2025',
    note: 'Augmentation légale encadrée mais non plafonnée'
  },
  assurance: {
    label: 'Bureau d\'assurance du Canada / Applied Rating Index – assurance habitation +7,3 % en 2024, +5,3 % en 2025',
    url: 'https://www.ledevoir.com/economie/956412/assureurs-habitation-augmentent-tarifs-reduisent-couverture',
    note: 'Coût d\'assurance habitation au Québec a augmenté de 31 % entre 2021-2025 selon Statistique Canada'
  },
  taxesMunicipales: {
    label: 'Calcul Conversion – taxes municipales et scolaires Québec',
    url: 'https://www.calculconversion.com/calcul-taxes-municipales.html',
    note: 'Augmentation historique ~2-4 %/an alignée à la valeur foncière'
  },
  tmi2026: {
    label: 'Revenu Québec + ARC – paliers d\'imposition combinés 2026',
    url: 'https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/bareme-imposition-particuliers/',
    note: 'Taux combinés 25,69 % à 53,31 % pour résidents du Québec'
  },
  celi2026: {
    label: 'ARC – plafond CELI cumulatif 109 000 $ en 2026 (pour quelqu\'un admissible depuis 2009)',
    url: 'https://www.desjardins.com/fr/epargne-placements/regimes-epargne/celi.html',
    note: 'Plafond annuel 2026 : 7 000 $'
  },
  reer2026: {
    label: 'ARC – plafond REER 2026 : 33 810 $ ou 18 % du revenu gagné',
    url: 'https://www.td.com/ca/fr/services-bancaires-personnels/placements-personnels/apprendre/regles-plafond-cotisation-reer',
    note: 'Le moindre des deux montants'
  },
  sp500: {
    label: 'VEQT / S&P 500 – rendement annualisé nominal historique',
    url: 'https://www.officialdata.org/us/stocks/s-p-500/1994',
    note: 'VEQT (actions mondiales) ~7-8 % nominal; S&P 500 US ~9-10 %. Défaut : 7,5 % (base canadienne réaliste)'
  },
  gainCapital: {
    label: 'ARC – taux d\'inclusion du gain en capital : 50 % (annulation de la hausse à 66,67 %)',
    url: 'https://cffp.recherche.usherbrooke.ca/outils-ressources/guide-mesures-fiscales/bareme-imposition-particuliers/',
    note: 'Résidence principale : exemption totale'
  },
};

/* ============================================================
   PALIERS D'IMPOSITION COMBINÉS QUÉBEC 2026
   Source : CFFP / Revenu Québec / ARC
   ============================================================ */
const TRANCHES_2026 = [
  { min: 0, max: 17183, taux: 0 },
  { min: 17183, max: 53255, taux: 0.2569 },
  { min: 53255, max: 57375, taux: 0.3253 },
  { min: 57375, max: 106495, taux: 0.3712 },
  { min: 106495, max: 114750, taux: 0.4170 },
  { min: 114750, max: 129590, taux: 0.4671 },
  { min: 129590, max: 158519, taux: 0.4812 },
  { min: 158519, max: 258482, taux: 0.5097 },
  { min: 258482, max: Infinity, taux: 0.5331 },
];

function droitsMutation(prix) {
  // Droits de mutation Île de Montréal (taxe de bienvenue) 2024
  const tranches = [
    { max: 58900, taux: 0.005 },
    { max: 294600, taux: 0.010 },
    { max: 552300, taux: 0.015 },
    { max: 1051000, taux: 0.020 },
    { max: Infinity, taux: 0.025 },
  ];
  let total = 0, prev = 0;
  for (const t of tranches) {
    const portion = Math.min(prix, t.max) - prev;
    if (portion <= 0) break;
    total += portion * t.taux;
    prev = t.max;
  }
  return Math.round(total);
}

function tmiPourRevenu(revenu) {
  // TMI = taux marginal sur le prochain dollar gagné
  for (let i = TRANCHES_2026.length - 1; i >= 0; i--) {
    if (revenu > TRANCHES_2026[i].min) return TRANCHES_2026[i].taux;
  }
  return 0;
}

function impotTotal(revenu) {
  let impot = 0;
  for (const t of TRANCHES_2026) {
    if (revenu <= t.min) break;
    const tranche = Math.min(revenu, t.max) - t.min;
    impot += tranche * t.taux;
  }
  return impot;
}

/* ============================================================
   CALCUL CUMULATIF DES DROITS CELI
   ============================================================ */
const PLAFONDS_CELI_HISTORIQUES = {
  2009: 5000, 2010: 5000, 2011: 5000, 2012: 5000,
  2013: 5500, 2014: 5500,
  2015: 10000,
  2016: 5500, 2017: 5500, 2018: 5500,
  2019: 6000, 2020: 6000, 2021: 6000, 2022: 6000,
  2023: 6500, 2024: 7000, 2025: 7000, 2026: 7000,
};

function droitsCeliCumulatifs(anneeArrivee, anneeCourante = 2026) {
  const debut = Math.max(2009, anneeArrivee);
  let total = 0;
  for (let an = debut; an <= anneeCourante; an++) {
    total += PLAFONDS_CELI_HISTORIQUES[an] || 7000;
  }
  return total;
}

/* ============================================================
   PRIME D'ASSURANCE SCHL (CMHC)
   Source : SCHL — mise de fonds < 20 %, propriété ≤ 1,5 M $
   Taux : 4,00 % (5-9,99 %), 3,10 % (10-14,99 %), 2,80 % (15-19,99 %)
   La prime est ajoutée au prêt ; la taxe provinciale QC (9 %) est payée à la clôture.
   Non disponible : propriété > 1,5 M $, immeuble locatif pur, > 4 logements.
   ============================================================ */
function calculerSCHL(prix, miseFondsPct, estLocatifPur = false) {
  if (estLocatifPur || miseFondsPct >= 0.20 || prix > 1500000) {
    return { applicable: false, prime: 0, taux: 0, pstQc: 0, raisonInapplicable: estLocatifPur ? 'locatif' : prix > 1500000 ? 'prix' : null };
  }
  const taux = miseFondsPct >= 0.15 ? 0.028 : miseFondsPct >= 0.10 ? 0.031 : 0.040;
  const emprunt = prix * (1 - miseFondsPct);
  const prime = emprunt * taux;
  return { applicable: true, prime, taux, pstQc: prime * 0.09 };
}

/* ============================================================
   CALCUL PRINCIPAL
   ============================================================ */
function computeScenarios(h) {
  const {
    prix, miseFondsPct, tauxHypo, amortissement, apprec, horizon,
    notaire, inspection, divers,
    condoMens, assurMens, entretienPct, inflationCouts, inflationAssur,
    commVente, fraisJurVente,
    loyerInitial, augmLoyer, assurLoc,
    rendement, celiDisponible, reerDisponibleInitial,
    salaireActuel, ageActuel, ageRetraite, revenuRetraiteEstime,
    inclusionGainCap,
    miseFondsLocPct, tauxHypoLoc, loyerPercuInitial, vacancePct, gestionPct,
    miseFondsMultiplexPct, tauxHypoMultiplex,
    nbLogementsLoues, // pour duplex/triplex
    // stress tests
    stressAppliquer, stressAnnee, stressImmo, stressBourse, stressTauxRenouv,
    // inflation générale (pour dollars réels)
    inflationGen,
  } = h;

  // TMI dynamique selon salaire
  const tmiActuel = tmiPourRevenu(salaireActuel);
  const tmiRetraite = tmiPourRevenu(revenuRetraiteEstime);

  // --- Frais fixes Montréal (Québec) ---
  const taxeBienvenue = prix <= 58900
    ? prix * 0.005
    : prix <= 294600
      ? 58900 * 0.005 + (prix - 58900) * 0.01
      : 58900 * 0.005 + (294600 - 58900) * 0.01 + (prix - 294600) * 0.015;
  const taxeScolaireAn = (prix - 25000) * (0.09152 / 100);
  const taxeMuniAn = (0.65 / 100 * prix) + 100;

  // ================ RÉSIDENCE PRINCIPALE ================
  const miseFonds = prix * miseFondsPct;
  const emprunt = prix - miseFonds;
  const rMens = tauxHypo / 12;
  const nMens = amortissement * 12;

  // Assurance SCHL si mise de fonds < 20 % et prix ≤ 1,5 M $
  const schl = calculerSCHL(prix, miseFondsPct, false);
  const empruntRP = emprunt + schl.prime; // prime intégrée au prêt
  const versementMens = rMens * empruntRP / (1 - Math.pow(1 + rMens, -nMens));
  const coutInitialRP = miseFonds + notaire + inspection + taxeBienvenue + divers + schl.pstQc;

  let soldeRP = empruntRP, interetsCumRP = 0, coutsRecCumRP = 0;
  let valeurRP = prix;
  const tsRP = [];
  let tauxHypoEffectif = tauxHypo;

  for (let y = 1; y <= horizon; y++) {
    // Stress tests
    if (stressAppliquer && y === stressAnnee) {
      valeurRP *= (1 + stressImmo);
    }
    if (stressAppliquer && y === 5) {
      tauxHypoEffectif = stressTauxRenouv;
    }
    const rMensEff = tauxHypoEffectif / 12;

    const valDebut = valeurRP;
    valeurRP = valDebut * (1 + apprec);
    const soldeDebut = soldeRP;
    const soldeFin = y <= amortissement
      ? Math.max(0, soldeDebut * Math.pow(1 + rMensEff, 12) - versementMens * (Math.pow(1 + rMensEff, 12) - 1) / rMensEff)
      : 0;
    const capital = soldeDebut - soldeFin;
    const verseAnnuel = y <= amortissement ? versementMens * 12 : 0;
    const interets = verseAnnuel - capital;
    // Coûts récurrents avec inflation différenciée
    const condoAn = condoMens * 12 * Math.pow(1 + inflationCouts, y - 1);
    const assurAn = assurMens * 12 * Math.pow(1 + inflationAssur, y - 1);
    const taxeMuniAnY = taxeMuniAn * Math.pow(1 + inflationCouts, y - 1);
    const taxeScolaireAnY = taxeScolaireAn * Math.pow(1 + inflationCouts, y - 1);
    const entretienAn = valDebut * entretienPct;
    const coutsRec = condoAn + assurAn + taxeMuniAnY + taxeScolaireAnY + entretienAn;

    soldeRP = soldeFin;
    interetsCumRP += interets;
    coutsRecCumRP += coutsRec;
    tsRP.push({
      annee: y,
      valeurBien: Math.round(valeurRP),
      soldeHypo: Math.round(soldeFin),
      equite: Math.round(valeurRP - soldeFin),
      capital: Math.round(capital),
      interets: Math.round(interets),
      coutsRec: Math.round(coutsRec),
      verseAnnuel: Math.round(verseAnnuel),
    });
  }
  const valeurFinaleRP = valeurRP;
  const commissionRP = valeurFinaleRP * commVente;
  const gainBrutRP = valeurFinaleRP - soldeRP - commissionRP - fraisJurVente;
  const beneficeNetRP = gainBrutRP - coutInitialRP - interetsCumRP - coutsRecCumRP;

  // ================ DUPLEX (vit + loue) ================
  // L'utilisateur habite dans 1 logement et loue les autres
  // Taxe basée sur le prix total, hypothèse résidence principale sur la portion occupée
  const prixDuplex = prix * (1 + 0.8 * nbLogementsLoues); // chaque logement loué ajoute 80 % du prix initial
  const miseFondsDuplex = prixDuplex * miseFondsMultiplexPct;
  const empruntDuplex = prixDuplex - miseFondsDuplex;
  const rMensMult = tauxHypoMultiplex / 12;
  const versementMensDuplex = rMensMult * empruntDuplex / (1 - Math.pow(1 + rMensMult, -nMens));
  const taxeBienvenueDuplex = prixDuplex <= 58900
    ? prixDuplex * 0.005
    : prixDuplex <= 294600
      ? 58900 * 0.005 + (prixDuplex - 58900) * 0.01
      : 58900 * 0.005 + (294600 - 58900) * 0.01 + (prixDuplex - 294600) * 0.015;
  const coutInitialDuplex = miseFondsDuplex + notaire + inspection + taxeBienvenueDuplex + divers;

  let soldeDuplex = empruntDuplex, valeurDuplex = prixDuplex;
  let cashflowCumDuplex = 0, interetsCumDuplex = 0, coutsRecCumDuplex = 0;
  const tsDuplex = [];
  const portionLocative = nbLogementsLoues / (nbLogementsLoues + 1); // part locative

  for (let y = 1; y <= horizon; y++) {
    const valDebut = valeurDuplex;
    valeurDuplex = valDebut * (1 + apprec);
    const soldeDebut = soldeDuplex;
    const soldeFin = y <= amortissement
      ? Math.max(0, soldeDebut * Math.pow(1 + rMensMult, 12) - versementMensDuplex * (Math.pow(1 + rMensMult, 12) - 1) / rMensMult)
      : 0;
    const capital = soldeDebut - soldeFin;
    const verseAnnuel = y <= amortissement ? versementMensDuplex * 12 : 0;
    const interets = verseAnnuel - capital;

    // Coûts récurrents totaux (immeuble)
    const entretienAn = valDebut * entretienPct; // croît avec l'appréciation, pas réinflaté
    const coutsImmeuble = (condoMens * 12 + assurMens * 12 * 1.3 + taxeMuniAn * (prixDuplex / prix) + taxeScolaireAn * (prixDuplex / prix)) * Math.pow(1 + inflationCouts, y - 1) + entretienAn;

    // Revenus locatifs (sur les logements loués)
    const loyerBrut = loyerPercuInitial * 12 * nbLogementsLoues * Math.pow(1 + augmLoyer, y - 1);
    const loyerEffectif = loyerBrut * (1 - vacancePct) * (1 - gestionPct);

    // Impôt sur revenu net locatif (portion dépenses attribuée aux logements loués)
    const interetsLocatifs = interets * portionLocative;
    const coutsLocatifs = coutsImmeuble * portionLocative;
    const revenuNetImposable = loyerEffectif - interetsLocatifs - coutsLocatifs;
    const impot = Math.max(0, revenuNetImposable * tmiActuel);

    const cashflow = loyerEffectif - verseAnnuel - coutsImmeuble - impot;

    soldeDuplex = soldeFin;
    cashflowCumDuplex += cashflow;
    interetsCumDuplex += interets;
    coutsRecCumDuplex += coutsImmeuble;
    tsDuplex.push({
      annee: y,
      valeurBien: Math.round(valeurDuplex),
      cashflow: Math.round(cashflow),
      loyer: Math.round(loyerEffectif),
    });
  }
  const valeurFinaleDuplex = valeurDuplex;
  const commissionDuplex = valeurFinaleDuplex * commVente;
  // Impôt gain en capital : seulement sur la portion locative
  const gainCapDuplex = (valeurFinaleDuplex - prixDuplex) * portionLocative;
  const impotGainCapDuplex = gainCapDuplex * inclusionGainCap * tmiActuel;
  const gainNetReventeDuplex = valeurFinaleDuplex - soldeDuplex - commissionDuplex - fraisJurVente - impotGainCapDuplex;
  const beneficeNetDuplex = gainNetReventeDuplex + cashflowCumDuplex - coutInitialDuplex;

  // ================ IMMO LOCATIF PUR ================
  const miseFondsLoc = prix * miseFondsLocPct;
  const empruntLoc = prix - miseFondsLoc;
  const rMensLoc = tauxHypoLoc / 12;
  const versementMensLoc = rMensLoc * empruntLoc / (1 - Math.pow(1 + rMensLoc, -nMens));
  const coutInitialLoc = miseFondsLoc + notaire + inspection + taxeBienvenue + divers;

  let soldeLoc = empruntLoc, cashflowCumLoc = 0, loyerPayeCumLoc = 0, interetsCumLoc = 0;
  let valeurLoc = prix;
  const tsLoc = [];
  for (let y = 1; y <= horizon; y++) {
    const valDebut = valeurLoc;
    valeurLoc = valDebut * (1 + apprec);
    const soldeDebut = soldeLoc;
    const soldeFin = y <= amortissement
      ? Math.max(0, soldeDebut * Math.pow(1 + rMensLoc, 12) - versementMensLoc * (Math.pow(1 + rMensLoc, 12) - 1) / rMensLoc)
      : 0;
    const capital = soldeDebut - soldeFin;
    const verseAnnuel = y <= amortissement ? versementMensLoc * 12 : 0;
    const interets = verseAnnuel - capital;
    const condoAn = condoMens * 12 * Math.pow(1 + inflationCouts, y - 1);
    const assurAn = assurMens * 12 * 1.3 * Math.pow(1 + inflationAssur, y - 1);
    const taxeMuniAnY = taxeMuniAn * Math.pow(1 + inflationCouts, y - 1);
    const taxeScolaireAnY = taxeScolaireAn * Math.pow(1 + inflationCouts, y - 1);
    const entretienAn = valDebut * entretienPct;
    const coutsRec = condoAn + assurAn + taxeMuniAnY + taxeScolaireAnY + entretienAn;
    const loyerBrut = loyerPercuInitial * 12 * Math.pow(1 + augmLoyer, y - 1);
    const loyerEffectif = loyerBrut * (1 - vacancePct) * (1 - gestionPct);
    const cashflowAvantImpot = loyerEffectif - verseAnnuel - coutsRec;
    const revenuNetImposable = loyerEffectif - interets - coutsRec;
    const impot = Math.max(0, revenuNetImposable * tmiActuel);
    const cashflowApresImpot = cashflowAvantImpot - impot;
    // Loyer payé par vous-même comme locataire (vous habitez ailleurs)
    const loyerPayeAn = loyerInitial * Math.pow(1 + augmLoyer, y - 1) * 12
      + assurLoc * 12 * Math.pow(1 + inflationAssur, y - 1);
    soldeLoc = soldeFin;
    cashflowCumLoc += cashflowApresImpot;
    loyerPayeCumLoc += loyerPayeAn;
    interetsCumLoc += interets;
    tsLoc.push({
      annee: y,
      valeurBien: Math.round(valeurLoc),
      cashflow: Math.round(cashflowApresImpot),
      loyer: Math.round(loyerEffectif),
      interets: Math.round(interets),
    });
  }
  const valeurFinaleLoc = valeurLoc;
  const commissionLoc = valeurFinaleLoc * commVente;
  const gainCap = valeurFinaleLoc - prix;
  const impotGainCap = gainCap * inclusionGainCap * tmiActuel;
  const gainNetRevente = valeurFinaleLoc - soldeLoc - commissionLoc - fraisJurVente - impotGainCap;
  // Bénéfice net : produit de vente + cashflow locatif - coût initial
  // Note : le loyer payé (loyerPayeCumLoc) est affiché séparément comme indicateur de coût de logement.
  // Dans le scénario Bourse, le loyer est géré via l'économie annuelle (réduction des investissements),
  // ce qui n'est pas directement additionnable au bénéfice net ici sans créer une asymétrie de traitement.
  const beneficeNetLoc = gainNetRevente + cashflowCumLoc - coutInitialLoc;

  // ================ BOURSE (louer + investir) ================
  let cotisCeliCum = 0, porteCELI = 0, porteREER = 0, porteNonEnr = 0, investiCum = 0, loyerPayeCumBourse = 0;
  let reerDispo = reerDisponibleInitial;
  const tsBourse = [];
  for (let y = 1; y <= horizon; y++) {
    let rendementAnnuel = rendement;
    if (stressAppliquer && y === stressAnnee) {
      rendementAnnuel = stressBourse;
    }
    const loyerMens = loyerInitial * Math.pow(1 + augmLoyer, y - 1);
    const coutLocAn = loyerMens * 12 + assurLoc * 12 * Math.pow(1 + inflationAssur, y - 1);
    const verseHypoAn = y <= amortissement ? versementMens * 12 : 0;
    const condoAn = condoMens * 12 * Math.pow(1 + inflationCouts, y - 1);
    const assurAn = assurMens * 12 * Math.pow(1 + inflationAssur, y - 1);
    const taxeMuniAnY = taxeMuniAn * Math.pow(1 + inflationCouts, y - 1);
    const taxeScolaireAnY = taxeScolaireAn * Math.pow(1 + inflationCouts, y - 1);
    const entretienAn = prix * Math.pow(1 + apprec, y - 1) * entretienPct;
    const coutPropAn = verseHypoAn + condoAn + assurAn + taxeMuniAnY + taxeScolaireAnY + entretienAn;
    const economie = Math.max(0, coutPropAn - coutLocAn);

    // Année 1: on ajoute aussi le capital initial équivalent
    const aInvestir = economie + (y === 1 ? coutInitialRP : 0);

    // Répartition: CELI d'abord (plafond annuel + droits accumulés), puis REER, puis non-enregistré
    // Pour simplifier : la limite CELI est cumulative, chaque année on peut mettre ce qui reste + 7 000 $ nouveau
    const droitsCeliRestants = Math.max(0, celiDisponible + y * 7000 - cotisCeliCum);
    const depotCELI = Math.min(aInvestir, droitsCeliRestants);
    const apresCELI = aInvestir - depotCELI;

    const plafondReerAnnuel = Math.min(33810, salaireActuel * 0.18);
    const droitsReerTotal = reerDispo + plafondReerAnnuel;
    const depotREER = Math.min(apresCELI, droitsReerTotal);
    reerDispo = Math.max(0, droitsReerTotal - depotREER);
    const depotNonEnr = apresCELI - depotREER;

    cotisCeliCum += depotCELI;
    porteCELI = porteCELI * (1 + rendementAnnuel) + depotCELI;
    porteREER = porteREER * (1 + rendementAnnuel) + depotREER;
    // Non-enregistré : imposé sur rendement chaque année (approximation : 50 % gain en capital, reste imposé sur dividendes/intérêts)
    // Approximation simple : on taxe 30 % du rendement chaque année (mix gain en cap réalisé + dividendes)
    const rendementNonEnr = porteNonEnr * rendementAnnuel;
    const impotAnnuelNonEnr = rendementNonEnr * 0.5 * tmiActuel; // 50% inclusion gain en cap
    porteNonEnr = porteNonEnr + rendementNonEnr - impotAnnuelNonEnr + depotNonEnr;
    investiCum += aInvestir;
    loyerPayeCumBourse += coutLocAn;
    tsBourse.push({
      annee: y,
      porteCELI: Math.round(porteCELI),
      porteREER: Math.round(porteREER),
      porteNonEnr: Math.round(porteNonEnr),
      porteTotal: Math.round(porteCELI + porteREER + porteNonEnr),
      investiCum: Math.round(investiCum),
      economie: Math.round(economie),
    });
  }
  const porteNetApresImpot = porteCELI + porteREER * (1 - tmiRetraite) + porteNonEnr;
  const beneficeNetBourse = porteNetApresImpot - investiCum;

  // ================ VERSIONS DOLLARS RÉELS ================
  const facteurInflation = Math.pow(1 + inflationGen, horizon);
  const reel = (v) => v / facteurInflation;

  return {
    meta: { tmiActuel, tmiRetraite, facteurInflation },
    rp: {
      valeurFinale: valeurFinaleRP,
      gainBrut: gainBrutRP,
      coutInitial: coutInitialRP,
      interetsCum: interetsCumRP,
      coutsRecCum: coutsRecCumRP,
      beneficeNet: beneficeNetRP,
      beneficeNetReel: reel(beneficeNetRP),
      equiteFinale: valeurFinaleRP - soldeRP,
      versementMens,
      schl,
      timeseries: tsRP,
    },
    duplex: {
      valeurFinale: valeurFinaleDuplex,
      gainNetRevente: gainNetReventeDuplex,
      cashflowCum: cashflowCumDuplex,
      coutInitial: coutInitialDuplex,
      impotGainCap: impotGainCapDuplex,
      beneficeNet: beneficeNetDuplex,
      beneficeNetReel: reel(beneficeNetDuplex),
      equiteFinale: valeurFinaleDuplex - soldeDuplex,
      versementMens: versementMensDuplex,
      prixDuplex,
      timeseries: tsDuplex,
    },
    loc: {
      valeurFinale: valeurFinaleLoc,
      gainNetRevente,
      cashflowCum: cashflowCumLoc,
      loyerPayeCum: loyerPayeCumLoc,
      interetsCum: interetsCumLoc,
      coutInitial: coutInitialLoc,
      impotGainCap,
      beneficeNet: beneficeNetLoc,
      beneficeNetReel: reel(beneficeNetLoc),
      versementMens: versementMensLoc,
      timeseries: tsLoc,
    },
    bourse: {
      porteCELI,
      porteREER,
      porteNonEnr,
      porteTotal: porteCELI + porteREER + porteNonEnr,
      porteNetApresImpot,
      investiCum,
      loyerPayeCum: loyerPayeCumBourse,
      beneficeNet: beneficeNetBourse,
      beneficeNetReel: reel(beneficeNetBourse),
      timeseries: tsBourse,
    },
    derives: {
      taxeBienvenue, taxeScolaireAn, taxeMuniAn,
      versementMens,
    }
  };
}

/* ============================================================
   ICONES SVG (sobres, monochrome)
   ============================================================ */
const IconChart = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="9" width="3" height="6" rx="0.5"/>
    <rect x="6" y="5" width="3" height="10" rx="0.5"/>
    <rect x="11" y="1" width="3" height="14" rx="0.5"/>
  </svg>
);
const IconSettings = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"/>
  </svg>
);
const IconQuestion = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="7"/>
    <path d="M6 6c0-1.1.9-2 2-2s2 .9 2 2c0 1.5-2 2-2 3"/>
    <circle cx="8" cy="12.5" r="0.5" fill="currentColor"/>
  </svg>
);
const IconMoon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" stroke="none">
    <path d="M8.5 2a6.5 6.5 0 100 12A5 5 0 018.5 2z"/>
  </svg>
);
const IconSun = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="3"/>
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41"/>
  </svg>
);
const IconMenu = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M2 4h14M2 9h14M2 14h14"/>
  </svg>
);
const IconClose = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M3 3l12 12M15 3L3 15"/>
  </svg>
);
const IconInfo = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="7" r="6"/>
    <path d="M7 6v4"/>
    <circle cx="7" cy="4" r="0.5" fill="currentColor"/>
  </svg>
);
const IconChevron = ({ size = 14, dir = 'down' }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: dir === 'up' ? 'rotate(180deg)' : 'none' }}>
    <path d="M2 4.5l5 5 5-5"/>
  </svg>
);

const IconRP = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M1 7L8 1.5L15 7V15H10V10H6V15H1V7Z" fill="currentColor" opacity="0.9"/>
  </svg>
);
const IconMultiplex = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="1" y="4" width="14" height="11" rx="1" fill="currentColor" opacity="0.9"/>
    <path d="M0 5L8 0.5L16 5" fill="currentColor" opacity="0.6"/>
    <rect x="3" y="7" width="2.5" height="2.5" rx="0.4" fill="white"/>
    <rect x="6.8" y="7" width="2.5" height="2.5" rx="0.4" fill="white"/>
    <rect x="10.5" y="7" width="2.5" height="2.5" rx="0.4" fill="white"/>
    <rect x="3" y="11" width="2.5" height="2.5" rx="0.4" fill="white"/>
    <rect x="6.8" y="11" width="2.5" height="2.5" rx="0.4" fill="white"/>
    <rect x="10.5" y="11" width="2.5" height="2.5" rx="0.4" fill="white"/>
  </svg>
);
const IconLocatif = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M1 7L8 1.5L15 7V15H10V10H6V15H1V7Z" fill="currentColor" opacity="0.5"/>
    <circle cx="11.5" cy="4.5" r="3" fill="currentColor" opacity="0.9"/>
    <path d="M9.5 4.5L11 6L13.5 3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconBourse = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <polyline points="1,13 4.5,7 7.5,10 11,4 15,2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="15" cy="2" r="1.8" fill="currentColor"/>
  </svg>
);

const STRATEGY_ICONS = {
  'Résid. principale': IconRP,
  'Multiplex': IconMultiplex,
  'Je loue mon bien': IconLocatif,
  'Bourse': IconBourse,
};

const LogoStocksStone = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 32" fill="none">
    {/* Barres histogramme */}
    <rect x="2" y="20" width="6" height="10" rx="1" fill="#059669" opacity="0.75"/>
    <rect x="10" y="13" width="6" height="17" rx="1" fill="#059669" opacity="0.88"/>
    <rect x="18" y="18" width="6" height="12" rx="1" fill="#059669" opacity="0.75"/>
    <rect x="26" y="8" width="6" height="22" rx="1" fill="#059669"/>
    {/* Toit de maison — triangle au-dessus de la barre droite */}
    <polyline points="23,9 29,2 35,9" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

/* ============================================================
   UI HELPERS
   ============================================================ */
function Tooltip2({ text, children, below = false }) {
  const [show, setShow] = useState(false);
  const pos = below
    ? 'top-full left-1/2 -translate-x-1/2 mt-2'
    : 'bottom-full left-1/2 -translate-x-1/2 mb-2';
  const arrow = below
    ? 'bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-stone-900'
    : 'top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900';
  return (
    <span className="relative inline-block">
      <span
        className="underline decoration-dotted decoration-stone-400 cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
      >
        {children}
      </span>
      {show && (
        <span className={`absolute z-50 ${pos} w-72 p-3 bg-stone-900 text-stone-100 text-xs rounded-lg shadow-xl normal-case tracking-normal font-sans leading-relaxed`}>
          {text}
          <span className={`absolute ${arrow}`} />
        </span>
      )}
    </span>
  );
}

function MiniSlider({ label, value, onChange, min, max, step, format, tooltip }) {
  const fmt = (v) => format === 'pct' ? `${(v * 100).toFixed(1)}%`
    : format === 'money' ? `${Math.round(v / 1000)}k $`
    : format === 'years' ? `${v} ans`
    : v.toString();
  const [tipOpen, setTipOpen] = useState(false);
  return (
    <div className="min-w-0">
      <div className="flex justify-between items-baseline mb-1 gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs text-stone-500 leading-tight">{label}</span>
          {tooltip && (
            <span className="relative shrink-0">
              <button
                type="button"
                className="text-stone-400 hover:text-stone-600 text-[10px] leading-none w-3.5 h-3.5 flex items-center justify-center rounded-full border border-stone-300 hover:border-stone-500 transition-colors"
                onMouseEnter={() => setTipOpen(true)}
                onMouseLeave={() => setTipOpen(false)}
                onClick={() => setTipOpen(s => !s)}
              >?</button>
              {tipOpen && (
                <span className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3 bg-stone-900 text-stone-100 text-xs rounded-lg shadow-xl font-sans leading-relaxed pointer-events-none">
                  {tooltip}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-stone-900" />
                </span>
              )}
            </span>
          )}
        </div>
        <span className="text-xs font-semibold text-stone-800 tabular-nums shrink-0">{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-stone-200 rounded-full appearance-none cursor-pointer accent-stone-800"
      />
    </div>
  );
}

function SourceLink({ sourceKey }) {
  const s = SOURCES[sourceKey];
  if (!s) return null;
  return (
    <Tooltip2 text={`${s.label} — ${s.note}`}>
      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-700 hover:text-amber-900 ml-1">ⓘ</a>
    </Tooltip2>
  );
}

function Slider({ label, value, onChange, min, max, step, format, help, sourceKey }) {
  const formatted = format === 'pct' ? `${(value * 100).toFixed(1)}%`
    : format === 'money' ? `${Math.round(value).toLocaleString('fr-CA')} $`
    : value.toString();
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1 gap-2">
        <label className="text-sm font-medium text-stone-700 flex items-center gap-1">
          {label}
          {sourceKey && <SourceLink sourceKey={sourceKey} />}
        </label>
        <span className="text-sm font-mono font-semibold text-amber-900 tabular-nums">{formatted}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
      />
      {help && <p className="text-xs text-stone-500 mt-1 italic">{help}</p>}
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, step, format, help, sourceKey }) {
  const [localStr, setLocalStr] = useState(String(value));
  const focused = React.useRef(false);
  // Sync from parent only when not currently being edited
  useEffect(() => { if (!focused.current) setLocalStr(String(value)); }, [value]);
  return (
    <div className="mb-4">
      <label className="text-sm font-medium text-stone-700 flex items-center gap-1 mb-1">
        {label}
        {sourceKey && <SourceLink sourceKey={sourceKey} />}
      </label>
      <input
        type="text" inputMode="numeric" value={localStr}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => {
          setLocalStr(e.target.value);
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        onBlur={() => {
          focused.current = false;
          const v = parseFloat(localStr);
          const clamped = isNaN(v) ? (min ?? 0) : Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v));
          onChange(clamped);
          setLocalStr(String(clamped));
        }}
        className="w-full px-3 py-2 border border-stone-300 rounded bg-white text-sm font-mono tabular-nums focus:outline-none focus:border-amber-700"
      />
      {help && <p className="text-xs text-stone-500 mt-1 italic">{help}</p>}
    </div>
  );
}

function MoneyCard({ label, value, sublabel, emphasis, color, tooltip }) {
  const colorMap = {
    green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    stone: 'bg-stone-50 border-stone-200 text-stone-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };
  const rounded = Math.round(value);
  const isNeg = rounded < 0;
  const formatted = `${isNeg ? '−' : ''}${Math.abs(rounded).toLocaleString('fr-CA')} $`;
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color || 'stone']}`}>
      <div className="text-xs uppercase tracking-wider opacity-75 font-medium">
        {tooltip ? <Tooltip2 text={tooltip}>{label}</Tooltip2> : label}
      </div>
      <div className={`${emphasis ? 'text-3xl' : 'text-2xl'} font-bold mt-1 tabular-nums`}>{formatted}</div>
      {sublabel && <div className="text-xs opacity-60 mt-1">{sublabel}</div>}
    </div>
  );
}

/* ============================================================
   GLOSSAIRE
   ============================================================ */
const GLOSSAIRE = [
  { terme: 'TMI (Taux Marginal d\'Imposition)', def: 'Le taux d\'impôt payé sur le prochain dollar gagné. Au Québec en 2026, va de 26 % à 53 %. Ex : si ton salaire est 80 000 $, ton TMI est 37 %, donc chaque dollar de plus est taxé à 37 %.' },
  { terme: 'CELI', def: 'Compte d\'Épargne Libre d\'Impôt. L\'argent y croît sans impôt, et les retraits sont totalement non imposables. Plafond cumulatif en 2026 : jusqu\'à 109 000 $ si admissible depuis 2009.' },
  { terme: 'REER', def: 'Régime Enregistré d\'Épargne-Retraite. Les cotisations réduisent ton revenu imposable cette année (déduction fiscale). L\'argent croît à l\'abri de l\'impôt, mais les retraits sont taxés plus tard au TMI de la retraite.' },
  { terme: 'Compte non-enregistré (marge)', def: 'Compte de placement ordinaire. Pas d\'avantage fiscal à l\'entrée, et le rendement est imposé chaque année (dividendes + 50 % des gains en capital réalisés).' },
  { terme: 'Taux d\'inclusion (gain en capital)', def: 'Au Canada, seulement 50 % d\'un gain en capital est ajouté à ton revenu imposable. Ex : gain de 100 000 $ → 50 000 $ s\'ajoutent, taxés au TMI. Pas 50 % d\'impôt mais 50 % d\'inclusion.' },
  { terme: 'Résidence principale (exemption)', def: 'Le gain en capital sur ta résidence principale est totalement exempté d\'impôt au Canada. C\'est un énorme avantage pour un condo/maison où tu habites.' },
  { terme: 'Amortissement hypothécaire', def: 'Durée pour rembourser totalement l\'hypothèque. Standard : 25 ans. Chaque versement mensuel contient une portion d\'intérêt (vraie dépense) et une portion de capital (qui t\'appartient).' },
  { terme: 'Équité', def: 'La valeur actuelle du bien moins le solde hypothécaire. C\'est ta "vraie" richesse immobilière. Commence petite, grossit à mesure que tu rembourses + le bien prend de la valeur.' },
  { terme: 'Cashflow locatif', def: 'Loyers reçus moins toutes les dépenses (hypothèque, condo, taxes, entretien, assurance, impôt). Peut être négatif les premières années.' },
  { terme: 'Vacance', def: 'Pourcentage du temps où le logement locatif n\'a pas de locataire. Varie entre 2 % et 10 % selon le secteur. Standard prudent : 5 %.' },
  { terme: 'Dollars réels vs nominaux', def: 'Les dollars "nominaux" sont les montants bruts en 2050. Les dollars "réels" ajustent pour l\'inflation pour refléter le pouvoir d\'achat d\'aujourd\'hui. À 2,5 % d\'inflation, 1 000 $ en 2051 = ~540 $ de 2026.' },
  { terme: 'Facteur d\'appréciation', def: 'Taux annuel de hausse du prix d\'une maison. Montréal : moyenne historique ~3-4 %/an, mais +46 % pour les condos sur 2020-2025 selon l\'APCIQ (période exceptionnelle).' },
];

/* ============================================================
   FAQ
   ============================================================ */
const FAQ = [
  {
    q: "Qu'est-ce que le TMI et pourquoi est-il important ?",
    r: "Le Taux Marginal d'Imposition est le taux payé sur le prochain dollar gagné. Au Québec en 2026, il va de 26 % à 53 %. C'est crucial pour comparer les stratégies : un REER cotisé à 40 % de TMI et retiré à 26 % à la retraite = gain fiscal réel. Ce simulateur calcule automatiquement votre TMI selon votre salaire."
  },
  {
    q: "C'est quoi le CELI et pourquoi c'est le meilleur compte ?",
    r: "Le Compte d'Épargne Libre d'Impôt permet d'investir de l'argent après impôt, puis de retirer tout (capital + gains) sans jamais payer d'impôt. Plafond cumulatif en 2026 : jusqu'à 109 000 $ si admissible depuis 2009. C'est le premier compte à remplir avant d'investir ailleurs."
  },
  {
    q: "C'est quoi le REER et quand vaut-il la peine ?",
    r: "Le REER permet de déduire vos cotisations de votre revenu imposable cette année, puis de payer l'impôt au moment des retraits (à la retraite). Il est avantageux si votre TMI maintenant est plus élevé que celui à la retraite. Plafond : le moindre de 33 810 $ ou 18 % de votre salaire."
  },
  {
    q: "Qu'est-ce qu'un compte non-enregistré ?",
    r: "Un compte de placement ordinaire (pas de CELI ni REER). Aucun avantage fiscal à l'entrée, et le rendement est imposé chaque année (dividendes + 50 % des gains en capital réalisés). On l'utilise seulement quand CELI et REER sont pleins."
  },
  {
    q: "Pourquoi la résidence principale bénéficie d'une exemption d'impôt ?",
    r: "Au Canada, le gain en capital sur votre résidence principale est totalement exempté d'impôt. C'est un avantage fiscal énorme : si vous achetez un condo 400 000 $ et le revendez 700 000 $, les 300 000 $ de gain = 0 $ d'impôt. Pour un immeuble locatif, ce serait ~75 000 $ d'impôt."
  },
  {
    q: "C'est quoi le taux d'inclusion sur les gains en capital ?",
    r: "Au Canada, seulement 50 % d'un gain en capital est ajouté à votre revenu imposable. Exemple : vous vendez un immeuble locatif avec un gain de 200 000 $. Seulement 100 000 $ s'ajoutent à votre revenu et sont taxés à votre TMI. Ce n'est pas 50 % d'impôt, mais 50 % d'inclusion."
  },
  {
    q: "Qu'est-ce que l'amortissement hypothécaire ?",
    r: "La durée totale pour rembourser votre hypothèque. Standard au Canada : 25 ans (ou 30 ans pour certains acheteurs depuis 2024). Chaque versement mensuel contient une portion intérêt (coût réel) et une portion capital (qui vous revient). Les premières années : surtout des intérêts."
  },
  {
    q: "C'est quoi l'équité immobilière ?",
    r: "Valeur du bien moins le solde hypothécaire restant. C'est votre 'richesse réelle' dans l'immeuble. En début de prêt, l'équité est petite (vous avez surtout de la dette). Elle grossit avec le temps car vous remboursez + la valeur du bien monte."
  },
  {
    q: "Qu'est-ce que le cashflow locatif ?",
    r: "Loyers reçus moins toutes les dépenses (versement hypothécaire, frais de condo, taxes, entretien, assurance, impôt sur revenus locatifs). Il est souvent négatif les premières années à Montréal — c'est normal. La richesse vient principalement de l'appréciation du bien et du remboursement d'hypothèque."
  },
  {
    q: "Pourquoi y a-t-il un taux de vacance dans les calculs ?",
    r: "Le taux de vacance représente le pourcentage du temps où votre logement n'a pas de locataire (recherche de locataire, rénovation, impayés). À Montréal, il varie entre 2 % et 5 %. Le modèle utilise 5 % par défaut par prudence. Cela réduit directement vos revenus locatifs annuels."
  },
  {
    q: "Quelle est la différence entre dollars d'aujourd'hui et dollars nominaux ?",
    r: "Les dollars 'nominaux' sont les montants bruts futurs (ex : 800 000 $ en 2051). Les dollars 'réels' ajustent pour l'inflation : à 2,5 %/an, 800 000 $ en 2051 ≈ 430 000 $ de pouvoir d'achat 2026. Cocher 'Dollars d'aujourd'hui' facilite la comparaison — tous les montants sont dans la même unité de valeur."
  },
  {
    q: "Comment est calculée l'appréciation immobilière à Montréal ?",
    r: "La valeur par défaut (3,5 %/an) reflète la moyenne historique long terme à Montréal. Note : les condos ont augmenté de +46 % entre 2020-2025 selon l'APCIQ, une période exceptionnelle non reconductible. Le modèle vous permet de tester différents scénarios (1 % à 7 %/an)."
  },
  {
    q: "Pourquoi acheter un duplex peut être plus avantageux ?",
    r: "Le duplex combine l'exemption de résidence principale (pour la part que vous habitez) avec des revenus locatifs (pour la part que vous louez). Le locataire aide à payer l'hypothèque, ce qui vous permet d'accéder à un bien plus grand. Contrepartie : vous devenez propriétaire-gestionnaire."
  },
  {
    q: "À quoi servent les stress tests (mode avancé) ?",
    r: "Les stress tests simulent des scénarios défavorables : krach immobilier (-15 à -40 %), effondrement boursier (-30 %), ou renouvellement hypothécaire à taux élevé. Ils ne prédisent pas l'avenir mais révèlent quelle stratégie résiste mieux aux crises. Un portefeuille diversifié rebondit en 3-5 ans historiquement."
  },
  {
    q: "Les projections sont-elles fiables ?",
    r: "Le modèle utilise des sources officielles (APCIQ, SCHL, ARC, Revenu Québec) et des hypothèses prudentes. Cela dit, toute projection sur 25 ans est incertaine par nature. Utilisez cet outil pour comprendre la logique des stratégies et les ordres de grandeur, pas comme une prévision précise. Consultez toujours un conseiller financier avant une décision importante."
  },
  {
    q: "À quoi sert le mode avancé ?",
    r: "Le mode avancé débloque 4 fonctionnalités supplémentaires : (1) Analyse de sensibilité — qui gagne selon différentes combinaisons rendement/appréciation; (2) Stress tests — impact d'un krach sur chaque stratégie; (3) Décaissement retraite — combien retirer chaque mois; (4) Paramètres avancés — mise de fonds locatif, amortissement, taux de gestion, etc."
  },
];

/* ============================================================
   PARAMÈTRES PAR DÉFAUT
   ============================================================ */
const defaultH = {
  // Bien
  prix: 400000,
  miseFondsPct: 0.20,
  tauxHypo: 0.05,
  amortissement: 25,
  apprec: 0.035,
  horizon: 25,
  // Frais achat
  notaire: 2000, inspection: 600, divers: 5000,
  // Coûts récurrents
  condoMens: 400, assurMens: 50, entretienPct: 0.01,
  inflationCouts: 0.025,
  inflationAssur: 0.06, // assurance habitation a augmenté 7,3 % en 2024, 5,3 % en 2025
  // Vente
  commVente: 0.05, fraisJurVente: 1500,
  // Location (scénario bourse)
  loyerInitial: 2200,
  augmLoyer: 0.045, // SCHL 2025 : +7,2 % Montréal, +6,3 % Québec 2024 — ajustement moyen TAL ~4 %
  assurLoc: 25,
  // Bourse
  rendement: 0.075,
  // Profil
  salaireActuel: 85000,
  ageActuel: 33,
  ageRetraite: 64,
  revenuRetraiteEstime: 45000,
  inflationGen: 0.025,
  // CELI/REER - seront calculés par défaut mais ajustables
  anneeArriveeCanada: 2016,
  reerDisponibleInitial: 20000,
  inclusionGainCap: 0.50,
  // Locatif
  miseFondsLocPct: 0.20,
  tauxHypoLoc: 0.055,
  loyerPercuInitial: 2200,
  vacancePct: 0.05,
  gestionPct: 0.00,
  // Multiplex (config séparée)
  miseFondsMultiplexPct: 0.20,
  tauxHypoMultiplex: 0.05,
  nbLogementsLoues: 1,
  // Stress
  stressAppliquer: false,
  stressAnnee: 5,
  stressImmo: -0.15,
  stressBourse: -0.30,
  stressTauxRenouv: 0.07,
};

/* ============================================================
   APP PRINCIPALE
   ============================================================ */
export default function App() {
  const [mode, setMode] = useState('debutant');
  const [activeTab, setActiveTab] = useState('comparison');
  const [dollarsReels, setDollarsReels] = useState(false);
  const [showRevenusSansVente, setShowRevenusSansVente] = useState(false);
  const [locLoyerDeduit, setLocLoyerDeduit] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showCGU, setShowCGU] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('imtl_seen'));
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('imtl_dark') === '1');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [introAgeStr, setIntroAgeStr] = useState(() => String(defaultH.ageActuel));
  const [introAnneeStr, setIntroAnneeStr] = useState(() => String(defaultH.anneeArriveeCanada));
  const [rawH, setRawH] = useState(() => {
    const saved = localStorage.getItem('imtl_prefs');
    if (saved) { try { return { ...defaultH, ...JSON.parse(saved) }; } catch { return defaultH; } }
    return defaultH;
  });

  // Injection automatique des droits CELI selon année d'arrivée
  const h = useMemo(() => ({
    ...rawH,
    celiDisponible: droitsCeliCumulatifs(rawH.anneeArriveeCanada),
  }), [rawH]);

  const update = (key) => (val) => setRawH(prev => ({ ...prev, [key]: val }));

  const results = useMemo(() => computeScenarios(h), [h]);
  const { rp, duplex, loc, bourse, derives, meta } = results;

  const facteurReel = dollarsReels ? (1 / meta.facteurInflation) : 1;
  const applyReel = (v) => v * facteurReel;
  const fmtMoney = (v) => `${Math.round(v).toLocaleString('fr-CA')} $`;

  // Comparaison (bénéfice net)
  const comparaison = [
    {
      name: 'Résid. principale',
      value: applyReel(rp.beneficeNet),
      full: 'Résidence principale',
      desc: `Vous achetez et habitez le bien. À la revente après ${h.horizon} ans : bénéfice net après remboursement de l'hypothèque, frais et charges. Le gain en capital est totalement exempté d'impôt.`
    },
    {
      name: `Multiplex (×${h.nbLogementsLoues + 1})`,
      value: applyReel(duplex.beneficeNet),
      full: `Multiplex — vous habitez + louez ${h.nbLogementsLoues} logement${h.nbLogementsLoues > 1 ? 's' : ''}`,
      desc: `Vous habitez un logement et louez ${h.nbLogementsLoues} autre${h.nbLogementsLoues > 1 ? 's' : ''}. Bénéfice net à la revente incluant le cashflow locatif cumulé, après impôt sur le gain en capital de la portion louée.`
    },
    {
      name: 'Je loue mon bien',
      value: locLoyerDeduit ? applyReel(loc.beneficeNet - loc.loyerPayeCum) : applyReel(loc.beneficeNet),
      full: 'Je loue mon bien (locatif pur)',
      desc: locLoyerDeduit
        ? `Bénéfice net après vente, avec le loyer cumulé que vous avez payé comme locataire (${Math.round(loc.loyerPayeCum).toLocaleString('fr-CA')} $) déduit — comparable au scénario Bourse où le loyer réduit les montants investis.`
        : `Vous achetez un bien que vous louez entièrement — vous habitez ailleurs. Bénéfice net à la revente incluant le cashflow cumulé, après impôt sur le gain en capital (50 % d'inclusion).`
    },
    {
      name: 'Bourse',
      value: locLoyerDeduit ? applyReel(bourse.beneficeNet) : applyReel(bourse.beneficeNet + bourse.loyerPayeCum),
      full: 'Rester locataire et investir en bourse',
      desc: locLoyerDeduit
        ? `Vous restez locataire et investissez l'équivalent de la mise de fonds + économies annuelles en CELI, REER et compte non-enregistré. Bénéfice net = portefeuille final après impôt moins capital total investi. Loyer cumulé payé (${Math.round(bourse.loyerPayeCum).toLocaleString('fr-CA')} $) déjà intégré.`
        : `Bénéfice net sans déduire le loyer cumulé (${Math.round(bourse.loyerPayeCum).toLocaleString('fr-CA')} $) — base de comparaison brute avec « Je loue mon bien ».`
    },
  ];
  const winner = [...comparaison].sort((a, b) => b.value - a.value)[0];

  // Coûts mensuels nets an 1 (pour tableau comparatif)
  const coutMensuelRP = rp.versementMens + h.condoMens + h.assurMens + derives.taxeMuniAn / 12 + derives.taxeScolaireAn / 12 + h.prix * h.entretienPct / 12;
  const loyerNetDuplexMens = h.loyerPercuInitial * h.nbLogementsLoues * (1 - h.vacancePct) * (1 - h.gestionPct);
  const coutMensuelDuplexBrut = duplex.versementMens + h.condoMens + h.assurMens * 1.3 + (derives.taxeMuniAn * duplex.prixDuplex / h.prix) / 12 + (derives.taxeScolaireAn * duplex.prixDuplex / h.prix) / 12 + duplex.prixDuplex * h.entretienPct / 12;
  const coutMensuelDuplexNet = coutMensuelDuplexBrut - loyerNetDuplexMens;
  const loyerNetLocMens = h.loyerPercuInitial * (1 - h.vacancePct) * (1 - h.gestionPct);
  const coutMensuelLocBrut = loc.versementMens + h.condoMens + h.assurMens * 1.3 + derives.taxeMuniAn / 12 + derives.taxeScolaireAn / 12 + h.prix * h.entretienPct / 12;
  const coutMensuelLocNet = h.loyerInitial + coutMensuelLocBrut - loyerNetLocMens;

  // Évolution (séries temporelles alignées : valeur nette équivalente)
  const timeSeriesData = rp.timeseries.map((r, i) => ({
    annee: r.annee,
    'Résid. principale': applyReel(r.equite * (1 - h.commVente)),
    'Multiplex': applyReel(duplex.timeseries[i].valeurBien * (1 - h.commVente)),
    'Je loue mon bien': applyReel(loc.timeseries[i].valeurBien * (1 - h.commVente)),
    'Bourse': applyReel(bourse.timeseries[i].porteTotal),
  }));

  // Sensibilité 2D (rendement bourse x apprec immo)
  const sensibiliteData = useMemo(() => {
    const results = [];
    const rendements = [0.04, 0.06, 0.08, 0.10];
    const apprecs = [0.01, 0.025, 0.04, 0.055];
    for (const rdt of rendements) {
      const row = { rendement: `${(rdt * 100).toFixed(0)}%` };
      for (const ap of apprecs) {
        const res = computeScenarios({ ...h, rendement: rdt, apprec: ap });
        const gagnant = [
          { n: 'RP', v: res.rp.beneficeNet },
          { n: 'Bourse', v: res.bourse.beneficeNet },
        ].sort((a, b) => b.v - a.v)[0];
        row[`${(ap * 100).toFixed(1)}%`] = { gagnant: gagnant.n, ecart: Math.abs(res.rp.beneficeNet - res.bourse.beneficeNet) };
      }
      results.push(row);
    }
    return { data: results, apprecs: apprecs.map(a => `${(a * 100).toFixed(1)}%`) };
  }, [h]);

  // Décaissement retraite
  const decaissementData = useMemo(() => {
    const anneesRetraite = Math.max(0, h.ageActuel + h.horizon - h.ageRetraite);
    if (anneesRetraite === 0) return null;
    const retraitAnnuel = (bourse.porteNetApresImpot) / anneesRetraite; // simple : étalé linéairement
    return {
      anneesRetraite,
      retraitAnnuel,
      retraitMensuel: retraitAnnuel / 12,
    };
  }, [h, bourse]);

  // Sync intro strings when modal opens
  useEffect(() => {
    if (showOnboarding) {
      setIntroAgeStr(String(rawH.ageActuel));
      setIntroAnneeStr(String(rawH.anneeArriveeCanada));
    }
  }, [showOnboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => { setShowSources(false); }, [activeTab]);
  useEffect(() => { if (mode !== 'avance') { setLocLoyerDeduit(true); } }, [mode]);

  const toggleDark = () => {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem('imtl_dark', next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-stone-50" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* ===== Header ===== */}
      <header className={`bg-white border-b ${mode === 'avance' ? 'border-blue-300' : 'border-stone-200'}`}>
        {mode === 'avance' && (
          <div className="bg-blue-700 text-blue-50 text-[11px] font-semibold text-center py-1 px-4 tracking-wide">
            Mode avancé activé — analyses de sensibilité, stress tests et décaissement retraite disponibles
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <button
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity text-left"
              title="Revoir l'introduction"
              onClick={() => setShowOnboarding(true)}
            >
              <LogoStocksStone size={40} />
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-0.5 font-medium">Simulateur · Île de Montréal · 2026</div>
                <h1 className="leading-none flex items-baseline gap-0" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                  <span className="text-2xl md:text-3xl font-extrabold text-emerald-700 tracking-tight">Stock</span>
                  <span className="text-stone-300 mx-2 text-lg md:text-xl font-light" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>or</span>
                  <span className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight">Stone</span>
                </h1>
              </div>
            </button>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex bg-stone-100 border border-stone-200 rounded-lg p-1 text-xs">
                <button
                  onClick={() => setMode('debutant')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'debutant' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-800'}`}
                >Débutant</button>
                <Tooltip2 text="Débloque les analyses de sensibilité, stress tests, décaissement retraite et paramètres avancés." below>
                  <button
                    onClick={() => setMode('avance')}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${mode === 'avance' ? 'bg-slate-700 text-white' : 'text-stone-500 hover:text-stone-800'}`}
                  >Avancé</button>
                </Tooltip2>
              </div>
              {mode === 'avance' && (
                <label className="hidden sm:flex items-center gap-2 text-xs bg-stone-100 border border-stone-200 rounded-lg px-3 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={dollarsReels} onChange={(e) => setDollarsReels(e.target.checked)} className="accent-stone-700" />
                  <Tooltip2 text="Affiche tous les montants en dollars de 2026 (pouvoir d'achat réel). Le modèle utilise des taux nominaux — 8 % bourse, 3,5 % appréciation immo — et divise ensuite par le facteur d'inflation cumulé. Non coché = dollars futurs nominaux (valeur brute sans ajustement)." below>
                    <span className="text-stone-700">$ d'aujourd'hui</span>
                  </Tooltip2>
                </label>
              )}
              <button onClick={() => setShowFAQ(true)} className="hidden sm:flex items-center gap-1.5 text-xs bg-stone-100 border border-stone-200 rounded-lg px-3 py-1.5 text-stone-700 hover:bg-stone-200 transition-colors">
                <IconQuestion size={13} /> FAQ
              </button>
              <button
                onClick={toggleDark}
                className="flex items-center justify-center bg-stone-100 border border-stone-200 rounded-lg p-1.5 text-stone-700 hover:bg-stone-200 transition-colors"
                title={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
              >
                {darkMode ? <IconSun size={15} /> : <IconMoon size={15} />}
              </button>
              <button
                className="sm:hidden flex items-center justify-center p-1.5 bg-stone-100 border border-stone-200 rounded-lg text-stone-700 hover:bg-stone-200 transition-colors"
                onClick={() => setShowMobileMenu(true)}
                aria-label="Menu"
              >
                <IconMenu size={17} />
              </button>
            </div>
          </div>
        </div>
      </header>


      {/* ===== Calculateur rapide (toujours visible) ===== */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
            <MiniSlider
              label="Prix du bien"
              value={h.prix} onChange={update('prix')} min={200000} max={800000} step={10000} format="money"
              tooltip="Prix d'achat du bien immobilier sur l'Île de Montréal. Ajuste automatiquement le versement mensuel et la mise de fonds."
            />
            <MiniSlider
              label="Mise de fonds"
              value={h.miseFondsPct} onChange={update('miseFondsPct')} min={0.05} max={0.50} step={0.01} format="pct"
              tooltip="Pourcentage du prix payé comptant. Minimum légal : 5 % (assurance SCHL obligatoire sous 20 %). Plus la mise est grande, moins vous empruntez."
            />
            <MiniSlider
              label="Taux hypothécaire"
              value={h.tauxHypo} onChange={update('tauxHypo')} min={0.02} max={0.08} step={0.0025} format="pct"
              tooltip="Taux annuel de votre prêt hypothécaire. Au Canada, fixé pour 5 ans typiquement, puis renouvelé. En avril 2026, les taux fixes 5 ans se situent autour de 4,5–5,5 % selon le profil et l'institution."
            />
            <MiniSlider
              label="Rendement bourse"
              value={h.rendement} onChange={update('rendement')} min={0.03} max={0.12} step={0.0025} format="pct"
              tooltip="Taux nominal (avant inflation) d'un portefeuille d'ETF indiciel. VEQT (actions mondiales diversifiées) : ~7-8 % nominal historique. S&P 500 US seul : ~9-10 %. Défaut : 7,5 % (base canadienne réaliste). En dollars réels (après 2,5 % d'inflation) : ~5 %/an."
            />
            <MiniSlider
              label="Horizon d'analyse"
              value={h.horizon} onChange={update('horizon')} min={5} max={45} step={1} format="years"
              tooltip="Durée de votre simulation en années. 25 ans est une hypothèse par défaut, mais vous pouvez ajuster selon votre horizon réel (ex: 15 ans avant de vendre, 40 ans jusqu'à la retraite)."
            />
          </div>
          <div className="mt-2 text-xs text-stone-400">
            Mise de fonds : <span className="text-stone-600 font-medium">{fmtMoney(h.prix * h.miseFondsPct)}</span>
            {' · '}<Tooltip2 text="Capital + intérêts hypothécaires uniquement. Ne comprend pas les frais de condo, taxes municipales/scolaires, assurance ni entretien. Voir l'onglet « Résidence principale » pour le coût mensuel total." below><span className="underline decoration-dotted cursor-help text-stone-400">Versement hyp./mois</span></Tooltip2> : <span className="text-stone-600 font-medium">{fmtMoney(rp.versementMens)}</span>
            {' · '}<Tooltip2 text={`Capital investi total = mise de fonds (${fmtMoney(h.prix * h.miseFondsPct)}) + taxe de bienvenue + notaire + inspection + divers${rp.schl.applicable ? ` + taxe provinciale SCHL (${fmtMoney(rp.schl.pstQc)})` : ''}. Ce montant est supérieur à la simple mise de fonds car il inclut tous les frais payés comptant à l'achat.`} below>
              <span className="underline decoration-dotted cursor-help text-stone-400">Capital investi total</span>
            </Tooltip2>{' '}:{' '}<span className="text-stone-600 font-medium">{fmtMoney(rp.coutInitial)}</span>
          </div>
          {rp.schl.applicable && (
            <div className="mt-1 text-xs text-amber-700">
              Prime SCHL : <strong>{fmtMoney(rp.schl.prime)}</strong> ajoutée au prêt ({(rp.schl.taux * 100).toFixed(1)} % du montant emprunté)
              {' · '}Taxe provinciale QC : <strong>{fmtMoney(rp.schl.pstQc)}</strong> payée à la clôture.
              <Tooltip2 text="L'assurance SCHL (CMHC) est obligatoire si votre mise de fonds est inférieure à 20 %. La prime (ajoutée au prêt) varie : 4,00 % si mise de fonds 5-9,99 %, 3,10 % si 10-14,99 %, 2,80 % si 15-19,99 %. Non disponible pour les immeubles locatifs purs (min. 20 %) ni pour les propriétés > 1,5 M $." below>
                {' '}<span className="underline decoration-dotted cursor-help">Pourquoi ?</span>
              </Tooltip2>
            </div>
          )}
          {!rp.schl.applicable && h.miseFondsPct < 0.20 && h.prix > 1500000 && (
            <div className="mt-1 text-xs text-red-600">
              Attention : assurance SCHL non disponible pour les propriétés {'>'}  1,5 M $ — une mise de fonds de 20 % minimum est obligatoire.
            </div>
          )}
        </div>
      </div>

      {/* ===== Verdict ===== */}
      <section className="bg-stone-50 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
          <div className="bg-white border border-emerald-200 rounded-xl shadow-sm px-5 py-4">
          <div className="text-xs uppercase tracking-widest text-stone-400 mb-1">Meilleure stratégie avec vos hypothèses</div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg md:text-xl font-semibold text-stone-900">{winner.full}</span>
            <span className="text-stone-500 text-sm">gagne avec</span>
            <span className="text-lg md:text-xl font-mono font-bold text-emerald-700 tabular-nums">{fmtMoney(winner.value)}</span>
            <span className="text-stone-500 text-sm">sur {h.horizon} ans{dollarsReels ? ' ($ 2026)' : ''}</span>
          </div>
          {mode === 'avance' && (
            <div className="mt-0.5 text-xs text-stone-400">
              <Tooltip2 text="Taux Marginal d'Imposition : le taux payé sur votre prochain dollar gagné. Au Québec 2026, va de 26 % à 53 % selon votre revenu. Calculé automatiquement depuis votre salaire." below>
                <span className="underline decoration-dotted cursor-help">TMI</span>
              </Tooltip2>
              {' '}:{' '}<span className="text-stone-600">{(meta.tmiActuel * 100).toFixed(1)}%</span>
              {' · '}
              <Tooltip2 text="Droits CELI disponibles : montant total que vous pouvez placer dans un CELI. Calculé selon votre année d'arrivée au Canada (cumulatif depuis 2009). Voir 'Mes infos' pour ajuster." below>
                <span className="underline decoration-dotted cursor-help">CELI disponible</span>
              </Tooltip2>
              {' '}:{' '}<span className="text-stone-600">{fmtMoney(h.celiDisponible)}</span>
            </div>
          )}
          </div>
        </div>
      </section>

      {/* ===== Tabs (desktop) ===== */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 hidden sm:block">
        <div className="flex items-end border-b border-stone-200">
          {/* Résultats : bouton spécial à gauche */}
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 rounded-tl rounded-tr mr-1 ${
              activeTab === 'comparison'
                ? 'bg-emerald-600 text-white -mb-px border-b-2 border-emerald-600'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-b-0 border-emerald-200'
            }`}
          ><IconChart size={14} /> Résultats</button>

          {/* Onglets centraux */}
          {[
            { id: 'profil', label: 'Mes infos', mode: 'all', icon: null },
            { id: 'rp', label: 'Résidence principale', mode: 'all', icon: IconRP },
            { id: 'duplex', label: 'Multiplex', mode: 'all', icon: IconMultiplex },
            { id: 'loc', label: 'Je loue mon bien', mode: 'all', icon: IconLocatif },
            { id: 'bourse', label: 'Bourse', mode: 'all', icon: IconBourse },
            { id: 'nonfin', label: 'Non-financier', mode: 'all', icon: null },
            { id: 'sensibilite', label: 'Sensibilité', mode: 'avance', icon: null },
            { id: 'stress', label: 'Stress tests', mode: 'avance', icon: null },
            { id: 'retraite', label: 'Retraite', mode: 'avance', icon: null },
          ].filter(t => t.mode === 'all' || mode === 'avance').map(t => {
            const isAvanceOnly = t.mode === 'avance';
            const isActive = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? isAvanceOnly
                      ? 'border-b-2 border-slate-600 text-slate-800 -mb-px'
                      : 'border-b-2 border-stone-700 text-stone-900 -mb-px'
                    : isAvanceOnly
                      ? 'text-slate-400 hover:text-slate-600'
                      : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {Icon && <Icon size={13} />}
                {t.label}
              </button>
            );
          })}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Paramètres : bouton spécial à droite */}
          <button
            onClick={() => setActiveTab('params')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 rounded-tl rounded-tr ${
              activeTab === 'params'
                ? 'bg-amber-600 text-white -mb-px border-b-2 border-amber-600'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-b-0 border-amber-200'
            }`}
          ><IconSettings size={14} /> Paramètres</button>
        </div>
      </div>

      {/* ===== Navigation mobile — onglet actif + bouton menu ===== */}
      {(() => {
        const allTabs = [
          { id: 'comparison', label: 'Résultats' },
          { id: 'profil', label: 'Mes infos' },
          { id: 'rp', label: 'Résidence principale' },
          ...(mode === 'avance' ? [{ id: 'duplex', label: 'Multiplex' }] : []),
          { id: 'loc', label: 'Je loue mon bien' },
          { id: 'bourse', label: 'Bourse' },
          { id: 'nonfin', label: 'Non-financier' },
          ...(mode === 'avance' ? [
            { id: 'sensibilite', label: 'Sensibilité' },
            { id: 'stress', label: 'Stress tests' },
            { id: 'retraite', label: 'Retraite' },
          ] : []),
          { id: 'params', label: 'Paramètres' },
        ];
        const currentTab = allTabs.find(t => t.id === activeTab);
        return (
          <div className="sm:hidden border-b border-stone-200 bg-white px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {activeTab === 'comparison' && <IconChart size={14} className="text-emerald-700 flex-shrink-0" />}
              {activeTab === 'params' && <IconSettings size={14} className="text-amber-700 flex-shrink-0" />}
              <span className="text-sm font-semibold text-stone-900 truncate">{currentTab?.label}</span>
            </div>
            <button
              onClick={() => setShowMobileMenu(true)}
              className="flex items-center gap-1.5 text-xs text-stone-600 border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 hover:bg-stone-100 transition-colors flex-shrink-0"
            >
              <IconMenu size={14} /> Changer d'onglet
            </button>
          </div>
        );
      })()}

      {/* ===== Menu hamburger overlay ===== */}
      {showMobileMenu && (
        <div className="fixed inset-0 bg-stone-900/80 z-50 flex flex-col" onClick={() => setShowMobileMenu(false)}>
          <div className="bg-white w-full max-w-sm ml-auto h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-stone-900 text-white px-4 py-4 flex justify-between items-center">
              <span className="font-bold">Navigation</span>
              <button onClick={() => setShowMobileMenu(false)} className="text-stone-400 hover:text-white"><IconClose size={18} /></button>
            </div>
            <div className="p-4 space-y-1">
              {[
                { id: 'comparison', label: '📊 Résultats' },
                { id: 'profil', label: 'Mes infos' },
                { id: 'rp', label: 'Résidence principale' },
                { id: 'duplex', label: 'Multiplex' },
                { id: 'loc', label: 'Je loue mon bien' },
                { id: 'bourse', label: 'Bourse' },
                { id: 'nonfin', label: 'Non-financier' },
                ...(mode === 'avance' ? [
                  { id: 'sensibilite', label: 'Sensibilité' },
                  { id: 'stress', label: 'Stress tests' },
                  { id: 'retraite', label: 'Retraite' },
                ] : []),
                { id: 'params', label: 'Paramètres' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => { setActiveTab(t.id); setShowMobileMenu(false); }}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'}`}
                >{t.label}</button>
              ))}
              <div className="border-t border-stone-200 pt-3 mt-3 space-y-2">
                <label className="flex items-center gap-3 px-4 py-2 text-sm text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={dollarsReels} onChange={e => setDollarsReels(e.target.checked)} className="accent-stone-700" />
                  Dollars d'aujourd'hui
                </label>
                <button onClick={() => { setShowFAQ(true); setShowMobileMenu(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg"><IconQuestion size={14} /> FAQ</button>
                <button onClick={() => { toggleDark(); }} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">{darkMode ? <><IconSun size={14} /> Mode clair</> : <><IconMoon size={14} /> Mode sombre</>}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Contenu classique (onglets) ===== */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">

        {/* ===== RÉSULTATS (anciennement Comparaison) ===== */}
        {activeTab === 'comparison' && (
          <div className="space-y-5">
            {/* Toggle loyer déduit — mode avancé seulement */}
            {mode === 'avance' && (
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-stone-500">Comparaison loyer :</span>
                <button
                  onClick={() => setLocLoyerDeduit(false)}
                  className={`px-3 py-1 rounded-l-full text-xs font-medium border transition-colors ${!locLoyerDeduit ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}
                >Sans loyer déduit</button>
                <button
                  onClick={() => setLocLoyerDeduit(true)}
                  className={`px-3 py-1 rounded-r-full text-xs font-medium border-t border-b border-r transition-colors ${locLoyerDeduit ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}
                >Loyer déduit</button>
              </div>
            )}

            {/* Graphique barres — visuels en premier */}
            <div className="bg-white rounded-lg border border-stone-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">
                    Bénéfice net après {h.horizon} ans
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    <span className="font-semibold text-emerald-700">Après impôts · Après vente du bien · En {dollarsReels ? 'dollars d\'aujourd\'hui' : 'dollars nominaux'}</span>
                    {' — '}Pour l'immobilier : produit de vente − hypothèque − frais − charges − impôts. Pour la bourse : portefeuille net d'impôt − capital investi.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
                <p className="text-xs text-stone-500">
                  Capital de départ commun : <span className="font-medium text-stone-700">{fmtMoney(rp.coutInitial)}</span>
                  {' '}(mise de fonds {fmtMoney(h.prix * h.miseFondsPct)} + frais ~{fmtMoney(rp.coutInitial - h.prix * h.miseFondsPct)})
                </p>
                <p className="text-xs text-stone-400 italic">Survolez les colonnes pour plus de détails sur chaque stratégie.</p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={comparaison} margin={{ top: 24, right: 5, bottom: 0, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="name" stroke="#78716c" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#78716c" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const entry = payload[0].payload;
                      return (
                        <div className="bg-stone-900 text-stone-100 text-xs rounded-lg p-3 shadow-xl max-w-xs leading-relaxed">
                          <div className="font-bold text-sm mb-1">{entry.full}</div>
                          <div className="text-emerald-300 font-mono text-base mb-2">{fmtMoney(entry.value)}</div>
                          <div className="text-stone-300">{entry.desc}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} label={{ position: 'top', formatter: (v) => v > 0 ? `${Math.round(v/1000)}k` : ``, fontSize: 10, fill: '#78716c' }}>
                    {comparaison.map((entry, i) => (
                      <Cell key={i} fill={entry.name === winner.name ? '#059669' : '#a8a29e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Graphique évolution */}
            <div className="bg-white rounded-lg border border-stone-200 p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">
                    {showRevenusSansVente ? 'Revenu mensuel net si vous gardez le bien' : `Évolution sur ${h.horizon} ans`}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {showRevenusSansVente
                      ? 'Revenu mensuel après impôt par année (loyers nets pour l\'immo, règle des 4 % pour la bourse). Le saut à l\'an ' + h.amortissement + ' = fin de l\'hypothèque.'
                      : `Valeurs nettes si vous vendiez chaque année (frais de commission déduits).${dollarsReels ? ' Ajusté pour inflation.' : ''}`
                    }
                  </p>
                  {!showRevenusSansVente && (
                    <p className="text-xs text-stone-400 mt-0.5 italic">
                      Ces courbes montrent la <strong>valeur récupérée si vous vendiez cette année-là</strong> (équité ou portefeuille brut) — pas le bénéfice net. Le bénéfice net déduit en plus tous les intérêts et charges payés : c'est ce que montrent les barres ci-dessus.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowRevenusSansVente(v => !v)}
                  className={`shrink-0 text-xs border rounded-lg px-3 py-1.5 font-medium transition-colors ${showRevenusSansVente ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-300 hover:border-stone-500'}`}
                >
                  {showRevenusSansVente ? '← Voir la valeur à la revente' : 'Voir le revenu si je garde →'}
                </button>
              </div>
              {!showRevenusSansVente && (
                <p className="text-xs text-stone-400 mb-3">Point de départ commun : <span className="font-medium text-stone-600">{fmtMoney(rp.coutInitial)}</span></p>
              )}
              {showRevenusSansVente && h.horizon <= h.amortissement + 3 && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3 text-xs text-amber-800">
                  <span>L'hypothèque se termine à l'an {h.amortissement}. Étendez l'horizon pour voir le revenu post-remboursement.</span>
                  <button
                    onClick={() => update('horizon')(h.amortissement + 15)}
                    className="shrink-0 bg-amber-700 text-white px-3 py-1 rounded-lg font-medium hover:bg-amber-800 transition-colors"
                  >Étendre à {h.amortissement + 15} ans</button>
                </div>
              )}
              <ResponsiveContainer width="100%" height={340}>
                {showRevenusSansVente ? (
                  <LineChart data={loc.timeseries.map((r, i) => ({
                    annee: r.annee,
                    'Locatif pur ($/mois net)': Math.round(applyReel(r.cashflow) / 12),
                    'Multiplex ($/mois net)': Math.round(applyReel(duplex.timeseries[i]?.cashflow || 0) / 12),
                    'Bourse (règle 4 %, /mois)': Math.round(applyReel(bourse.timeseries[i].porteTotal * 0.04 / 12)),
                  }))} margin={{ bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="annee" stroke="#78716c" tick={{ fontSize: 11 }} label={{ value: 'Années', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#78716c' }} />
                    <YAxis stroke="#78716c" tickFormatter={(v) => `${v.toLocaleString('fr-CA')} $`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${Math.round(v).toLocaleString('fr-CA')} $/mois`} labelFormatter={(l) => `Année ${l}`} />
                    <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                    <Line type="monotone" dataKey="Locatif pur ($/mois net)" stroke="#7c2d12" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Multiplex ($/mois net)" stroke="#0369a1" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Bourse (règle 4 %, /mois)" stroke="#b45309" strokeWidth={2} dot={false} />
                  </LineChart>
                ) : (
                  <LineChart data={timeSeriesData} margin={{ bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="annee" stroke="#78716c" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#78716c" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtMoney(v)} />
                    <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                    <Line type="monotone" dataKey="Résid. principale" stroke="#059669" strokeWidth={2} dot={false} />
                    {mode === 'avance' && <Line type="monotone" dataKey="Multiplex" stroke="#0369a1" strokeWidth={2} dot={false} />}
                    <Line type="monotone" dataKey="Je loue mon bien" stroke="#7c2d12" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Bourse" stroke="#b45309" strokeWidth={2} dot={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Graphique trésorerie mensuelle nette (mode avancé) */}
            {mode === 'avance' && (() => {
              const tsTreso = rp.timeseries.map((r, i) => ({
                annee: r.annee,
                'RP (sortie/mois)': -Math.round(applyReel(r.verseAnnuel + r.coutsRec) / 12),
                'Multiplex (net/mois)': Math.round(applyReel(duplex.timeseries[i]?.cashflow ?? 0) / 12),
                'Locatif (net/mois)': Math.round(applyReel(loc.timeseries[i]?.cashflow ?? 0) / 12),
                'Bourse (loyer/mois)': -Math.round(applyReel(h.loyerInitial * Math.pow(1 + h.augmLoyer, r.annee - 1))),
              }));
              return (
                <div className="bg-white rounded-lg border border-stone-200 p-5">
                  <h3 className="text-lg font-bold text-stone-900 mb-1">Trésorerie mensuelle nette par stratégie</h3>
                  <p className="text-xs text-stone-500 mb-1">
                    Ce que chaque stratégie vous coûte <strong>ou vous rapporte</strong> chaque mois après impôt.
                    Valeurs négatives = sorties de caisse nettes. Valeurs positives = rentrées nettes.
                    {dollarsReels ? ' En dollars d\'aujourd\'hui.' : ''}
                  </p>
                  <p className="text-xs text-stone-400 mb-4 italic">
                    RP : versement hypo + toutes charges. Multiplex / Locatif : loyers nets − hypothèque − charges − impôt. Bourse : loyer mensuel payé en tant que locataire.
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={tsTreso} margin={{ bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis dataKey="annee" stroke="#78716c" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#78716c" tickFormatter={(v) => `${v.toLocaleString('fr-CA')} $`} tick={{ fontSize: 11 }} />
                      <ReferenceLine y={0} stroke="#a8a29e" strokeDasharray="4 2" />
                      <Tooltip formatter={(v) => `${Math.round(v).toLocaleString('fr-CA')} $/mois`} labelFormatter={(l) => `Année ${l}`} />
                      <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                      <Line type="monotone" dataKey="RP (sortie/mois)" stroke="#059669" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Multiplex (net/mois)" stroke="#0369a1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Locatif (net/mois)" stroke="#7c2d12" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Bourse (loyer/mois)" stroke="#b45309" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}

            {/* Tableau comparatif — en dernier */}
            <details className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <summary className="bg-stone-50 px-4 py-3 cursor-pointer font-semibold text-stone-800 hover:bg-stone-100 transition-colors">
                Tableau comparatif détaillé
                <span className="ml-2 text-xs font-normal text-stone-500">(cliquer pour développer)</span>
              </summary>
              <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
                <table className="w-full text-sm" style={{ minWidth: '640px' }}>
                  <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Stratégie</th>
                      <th className="px-4 py-2 text-left">Comment ça marche</th>
                      <th className="px-4 py-2 text-left">Fiscalité</th>
                      <th className="px-4 py-2 text-left">Risque</th>
                      <th className="px-4 py-2 text-left">Liquidité</th>
                      <th className="px-4 py-2 text-right">Coût net/mois (an 1)</th>
                      <th className="px-4 py-2 text-right">Bénéfice net</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-stone-200">
                      <td className="px-4 py-3 font-semibold">Résidence principale</td>
                      <td className="px-4 py-3 text-stone-600">Vous achetez et habitez. Mise de fonds + hypothèque.</td>
                      <td className="px-4 py-3 text-stone-600"><Tooltip2 text={GLOSSAIRE.find(g => g.terme.includes('Résidence principale'))?.def}>Exemption totale</Tooltip2></td>
                      <td className="px-4 py-3 text-stone-600">Moyen (un actif unique)</td>
                      <td className="px-4 py-3 text-stone-600">Faible (6 mois pour vendre)</td>
                      <td className="px-4 py-3 text-right font-mono text-stone-700">
                        <Tooltip2 text={`Versement ${fmtMoney(rp.versementMens)} + condo ${fmtMoney(h.condoMens)} + assurance ${fmtMoney(h.assurMens)} + taxes ${fmtMoney((derives.taxeMuniAn + derives.taxeScolaireAn) / 12)} + entretien ${fmtMoney(h.prix * h.entretienPct / 12)}`}>
                          {fmtMoney(coutMensuelRP)}
                        </Tooltip2>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-stone-800">{fmtMoney(applyReel(rp.beneficeNet))}</td>
                    </tr>
                    <tr className="border-t border-stone-200 bg-stone-50">
                      <td className="px-4 py-3 font-semibold">Multiplex</td>
                      <td className="px-4 py-3 text-stone-600">Vous habitez un logement, louez les autres. Levier accru.</td>
                      <td className="px-4 py-3 text-stone-600">Portion occupée exemptée, portion louée taxée</td>
                      <td className="px-4 py-3 text-stone-600">Moyen-élevé</td>
                      <td className="px-4 py-3 text-stone-600">Faible</td>
                      <td className="px-4 py-3 text-right font-mono text-stone-700">
                        <Tooltip2 text={`Charges brutes ${fmtMoney(coutMensuelDuplexBrut)} − loyers nets ${fmtMoney(loyerNetDuplexMens)} = coût net de logement`}>
                          <span className={coutMensuelDuplexNet < 0 ? 'text-emerald-700' : ''}>{fmtMoney(coutMensuelDuplexNet)}</span>
                        </Tooltip2>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-stone-800">{fmtMoney(applyReel(duplex.beneficeNet))}</td>
                    </tr>
                    <tr className="border-t border-stone-200">
                      <td className="px-4 py-3 font-semibold">Je loue mon bien</td>
                      <td className="px-4 py-3 text-stone-600">Vous achetez un bien que vous louez entièrement. Vous habitez ailleurs comme locataire.</td>
                      <td className="px-4 py-3 text-stone-600">Revenus taxés + <Tooltip2 text={GLOSSAIRE.find(g => g.terme.includes('inclusion'))?.def}>50 % gain en capital</Tooltip2></td>
                      <td className="px-4 py-3 text-stone-600">Élevé (gestion + vacance)</td>
                      <td className="px-4 py-3 text-stone-600">Faible</td>
                      <td className="px-4 py-3 text-right font-mono text-stone-700">
                        <Tooltip2 text={`Votre loyer ${fmtMoney(h.loyerInitial)} + charges bien ${fmtMoney(coutMensuelLocBrut)} − loyer perçu net ${fmtMoney(loyerNetLocMens)}`}>
                          {fmtMoney(coutMensuelLocNet)}
                        </Tooltip2>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-stone-800">{fmtMoney(locLoyerDeduit ? applyReel(loc.beneficeNet - loc.loyerPayeCum) : applyReel(loc.beneficeNet))}</td>
                    </tr>
                    <tr className="border-t border-stone-200 bg-stone-50">
                      <td className="px-4 py-3 font-semibold">Bourse</td>
                      <td className="px-4 py-3 text-stone-600">Vous restez locataire et placez l'équivalent de la mise de fonds + économies annuelles en bourse (CELI, REER, non-enr.).</td>
                      <td className="px-4 py-3 text-stone-600"><Tooltip2 text={GLOSSAIRE.find(g => g.terme.includes('CELI'))?.def}>CELI</Tooltip2> + <Tooltip2 text={GLOSSAIRE.find(g => g.terme.includes('REER'))?.def}>REER</Tooltip2> + <Tooltip2 text={GLOSSAIRE.find(g => g.terme.includes('non-enregistré'))?.def}>non-enr.</Tooltip2></td>
                      <td className="px-4 py-3 text-stone-600">Moyen (ETF diversifiés)</td>
                      <td className="px-4 py-3 text-stone-600">Élevée (vente en 2 jours)</td>
                      <td className="px-4 py-3 text-right font-mono text-stone-700">
                        <Tooltip2 text="Loyer mensuel payé — c'est votre seule sortie de caisse logement.">
                          {fmtMoney(h.loyerInitial)}
                        </Tooltip2>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-stone-800">{fmtMoney(applyReel(bourse.beneficeNet))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>

            {/* CTA vers paramètres */}
            <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg px-4 py-3">
              <span className="text-sm text-stone-600">Vous voulez affiner les hypothèses ou explorer d'autres scénarios ?</span>
              <button
                onClick={() => setActiveTab('params')}
                className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors shrink-0 ml-3"
              ><IconSettings size={13} /> Ajuster les paramètres</button>
            </div>

            {/* À propos — fermé, après les graphiques */}
            <details className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> À propos de ces résultats</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-stone-600 space-y-2 border-t border-stone-200">
                <p>Ce simulateur compare le <strong>bénéfice net après {h.horizon} ans</strong> pour 4 stratégies avec le même capital de départ. Pour les stratégies immobilières, le bénéfice suppose la <strong>vente du bien à la fin de la période</strong>.</p>
                <p>Tous les montants sont <strong>après impôts</strong> : exemption totale pour la résidence principale, 50 % d'inclusion du gain en capital pour le locatif/multiplex, impôt REER au TMI retraite pour la bourse.</p>
                <p><strong>Graphique d'évolution :</strong> la valeur affichée est ce que vous récupéreriez <em>si vous vendiez cette année-là</em> (frais de commission déduits) — ce n'est pas le bénéfice net total qui, lui, déduit aussi tous les intérêts et charges accumulés.</p>
                <p><strong>Loyer déduit :</strong> pour « Je loue mon bien », le loyer cumulé que vous payez comme locataire est soustrait afin de rendre cette stratégie comparable à la Bourse, où le loyer réduit déjà les montants investis chaque année.</p>
              </div>
            </details>

          </div>
        )}

        {/* ===== PROFIL ===== */}
        {activeTab === 'profil' && (
          <div className="space-y-5">
            <details className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> À quoi servent ces informations ?</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-stone-600 space-y-2 border-t border-stone-200">
                <p>Ces données personnalisent les calculs fiscaux de <strong>tous les scénarios</strong> : taux marginal d'imposition (TMI), droits CELI cumulés et plafond REER annuel.</p>
                <p>Tous les champs ont des valeurs par défaut raisonnables pour un profil montréalais moyen — modifiez uniquement ce qui correspond à votre situation. Aucune donnée n'est envoyée à un serveur.</p>
              </div>
            </details>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white rounded-lg border border-stone-200 p-5">
              <h3 className="font-bold text-lg text-stone-900 mb-4 pb-2 border-b border-stone-200">Votre profil</h3>
              <NumberInput label="Âge actuel" value={h.ageActuel} onChange={update('ageActuel')} min={18} max={65} step={1} />
              <NumberInput label="Année d'arrivée au Canada" value={h.anneeArriveeCanada} onChange={update('anneeArriveeCanada')} min={1990} max={2026} step={1} help={`→ Droits CELI cumulés : ${fmtMoney(h.celiDisponible)}`} sourceKey="celi2026" />
              <NumberInput label="Salaire brut annuel ($)" value={h.salaireActuel} onChange={update('salaireActuel')} min={20000} max={300000} step={1000} help={`→ Taux marginal d'imposition : ${(meta.tmiActuel * 100).toFixed(1)} %`} sourceKey="tmi2026" format="money" />
              {mode === 'avance' && (
                <>
                  <NumberInput label="Âge souhaité à la retraite" value={h.ageRetraite} onChange={update('ageRetraite')} min={40} max={75} step={1} help="Utilisé pour le calcul de décaissement (onglet Retraite)" />
                  <NumberInput label="Revenu estimé à la retraite ($)" value={h.revenuRetraiteEstime} onChange={update('revenuRetraiteEstime')} min={15000} max={200000} step={1000} help={`Ce que vous pensez recevoir/an à la retraite (pension, REER, loyers, etc.). Sert à calculer votre taux d'imposition futur. → TMI retraite : ${(meta.tmiRetraite * 100).toFixed(1)} %`} format="money" />
                </>
              )}
              <NumberInput label="Droits REER inutilisés ($)" value={h.reerDisponibleInitial} onChange={update('reerDisponibleInitial')} min={0} max={500000} step={1000} help="Indiqué sur votre avis de cotisation ARC (ligne A). Mettez 0 si vous n'avez pas ce document." sourceKey="reer2026" format="money" />
            </section>

            <section className="bg-amber-50 border border-amber-200 rounded-lg p-5">
              <h3 className="font-bold text-lg text-amber-900 mb-4 pb-2 border-b border-amber-300">Conséquences calculées</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-stone-600"><Tooltip2 text={GLOSSAIRE.find(g => g.terme.includes('TMI'))?.def}>TMI actuel</Tooltip2></dt>
                  <dd className="font-mono font-bold text-amber-900">{(meta.tmiActuel * 100).toFixed(1)} %</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-600">TMI retraite estimé</dt>
                  <dd className="font-mono font-bold text-amber-900">{(meta.tmiRetraite * 100).toFixed(1)} %</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-600">Droits CELI cumulés</dt>
                  <dd className="font-mono font-bold text-amber-900">{fmtMoney(h.celiDisponible)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-600">Plafond REER annuel (18 % salaire)</dt>
                  <dd className="font-mono font-bold text-amber-900">{fmtMoney(Math.min(33810, h.salaireActuel * 0.18))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-600">Années jusqu'à la retraite</dt>
                  <dd className="font-mono font-bold text-amber-900">{Math.max(0, h.ageRetraite - h.ageActuel)} ans</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-stone-600">Horizon d'analyse</dt>
                  <dd className="font-mono font-bold text-amber-900">{h.horizon} ans</dd>
                </div>
              </dl>
              <p className="mt-5 text-xs text-stone-600 italic border-t border-amber-200 pt-3">
                Ces valeurs sont calculées automatiquement à partir des paliers d'imposition Québec+fédéral 2026 et des plafonds CELI/REER officiels. Elles s'appliquent à tous les scénarios.
              </p>
            </section>
          </div>
          </div>
        )}

        {/* ===== Résidence principale ===== */}
        {activeTab === 'rp' && (() => {
          const coutMensuelTotal = rp.versementMens + h.condoMens + h.assurMens + derives.taxeMuniAn / 12 + derives.taxeScolaireAn / 12 + h.prix * h.entretienPct / 12;
          const taxeBienvenue = droitsMutation(h.prix);
          const fraisNotaireAchat = Math.round(h.prix * 0.004 + 500); // ~0.4 % + fixe, fourchette réaliste Montréal
          const inspectionMin = 500, inspectionMax = 900;
          const ajustements = Math.round((derives.taxeMuniAn + derives.taxeScolaireAn) / 12 * 2); // ~2 mois de taxes prépayées
          const totalFraisAchat = taxeBienvenue + fraisNotaireAchat + inspectionMax + ajustements;
          return (
          <div className="space-y-6">
            <details className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> Scénario : Résidence principale</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-stone-600 space-y-2 border-t border-stone-200">
                <p>Vous achetez un bien à <strong>{fmtMoney(h.prix)}</strong> avec une mise de fonds de <strong>{fmtMoney(h.prix * h.miseFondsPct)}</strong> ({(h.miseFondsPct * 100).toFixed(0)} %) et vous y habitez.</p>
                <p><strong>Avantage fiscal majeur :</strong> le gain en capital réalisé à la vente est totalement exempté d'impôt (exemption résidence principale canadienne). Un bien acheté 400 000 $ et revendu 700 000 $ = 0 $ d'impôt sur les 300 000 $ de gain.</p>
                <p><strong>Le bénéfice net</strong> présenté suppose la vente à la fin de l'horizon. Il est calculé après remboursement de l'hypothèque, commissions, coût initial et toutes les charges accumulées (intérêts, condo, taxes, assurance, entretien).</p>
              </div>
            </details>

            {/* Guide premier acheteur */}
            <details className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-amber-900 hover:bg-amber-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> Guide premier acheteur — tous les coûts à l'achat</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-5 pt-3 border-t border-amber-200 space-y-4">
                {/* Mise de fonds */}
                <div>
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">1 · Mise de fonds</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white rounded-lg p-3 border border-amber-200">
                      <div className="text-stone-500 mb-1">Mise de fonds ({(h.miseFondsPct * 100).toFixed(0)} %)</div>
                      <div className="font-mono font-bold text-amber-900">{fmtMoney(h.prix * h.miseFondsPct)}</div>
                    </div>
                    {rp.schl.applicable && (
                      <div className="bg-white rounded-lg p-3 border border-amber-200">
                        <div className="text-stone-500 mb-1">Prime SCHL ({(rp.schl.tauxPrime * 100).toFixed(2)} %)</div>
                        <div className="font-mono font-bold text-amber-900">{fmtMoney(rp.schl.prime)}</div>
                        <div className="text-stone-400 mt-0.5">intégrée au prêt</div>
                      </div>
                    )}
                    <div className="bg-white rounded-lg p-3 border border-amber-200">
                      <div className="text-stone-500 mb-1">Prêt hypothécaire</div>
                      <div className="font-mono font-bold text-amber-900">{fmtMoney(h.prix * (1 - h.miseFondsPct) + (rp.schl.applicable ? rp.schl.prime : 0))}</div>
                    </div>
                  </div>
                  {h.miseFondsPct < 0.20 && (
                    <p className="text-xs text-amber-800 mt-2 bg-amber-100 rounded px-3 py-2">
                      <strong>Mise de fonds {'<'} 20 % :</strong> l'assurance SCHL est obligatoire. Elle s'ajoute au prêt ({fmtMoney(rp.schl.prime)}) et est remboursée sur toute la durée de l'hypothèque. La mise de fonds minimale est de 5 % pour un bien ≤ 500 k$ et de 10 % sur la tranche entre 500 k$ et 999 k$.
                    </p>
                  )}
                </div>

                {/* Frais à l'achat */}
                <div>
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">2 · Frais à débourser le jour du notaire</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-amber-100">
                        <tr>
                          <td className="py-2 pr-4 text-stone-700 font-medium">Droits de mutation (taxe de bienvenue)</td>
                          <td className="py-2 text-stone-500">Île de Montréal — tranches de 0,5 % à 2,5 %</td>
                          <td className="py-2 pl-4 text-right font-mono font-bold text-amber-900">{fmtMoney(taxeBienvenue)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-stone-700 font-medium">Honoraires notaire (acte de vente + hypothèque)</td>
                          <td className="py-2 text-stone-500">Variable selon complexité — estimation</td>
                          <td className="py-2 pl-4 text-right font-mono font-bold text-amber-900">~{fmtMoney(fraisNotaireAchat)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-stone-700 font-medium">Inspection préachat</td>
                          <td className="py-2 text-stone-500">Fortement recommandée — à ne pas sauter</td>
                          <td className="py-2 pl-4 text-right font-mono font-bold text-amber-900">{inspectionMin}–{inspectionMax} $</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-stone-700 font-medium">Ajustements de taxes (remboursement vendeur)</td>
                          <td className="py-2 text-stone-500">Taxes municipales/scolaires déjà payées par le vendeur</td>
                          <td className="py-2 pl-4 text-right font-mono font-bold text-amber-900">~{fmtMoney(ajustements)}</td>
                        </tr>
                        <tr className="bg-amber-100">
                          <td className="py-2 pr-4 text-amber-900 font-bold">Total frais à l'achat</td>
                          <td className="py-2 text-stone-500">En plus de la mise de fonds</td>
                          <td className="py-2 pl-4 text-right font-mono font-bold text-amber-900">~{fmtMoney(totalFraisAchat)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* À avoir en caisse */}
                <div>
                  <div className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">3 · Ce que vous devez avoir en caisse</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white rounded-lg p-3 border border-amber-200">
                      <div className="text-stone-500 mb-1">Mise de fonds</div>
                      <div className="font-mono font-bold text-amber-900">{fmtMoney(h.prix * h.miseFondsPct)}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-amber-200">
                      <div className="text-stone-500 mb-1">Frais d'achat (~)</div>
                      <div className="font-mono font-bold text-amber-900">{fmtMoney(rp.coutInitial - h.prix * h.miseFondsPct)}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-amber-200 border-dashed">
                      <div className="text-stone-500 mb-1">Réserve d'urgence (3 mois)</div>
                      <div className="font-mono font-bold text-amber-700">{fmtMoney(coutMensuelTotal * 3)}</div>
                      <div className="text-stone-400 mt-0.5">recommandée mais non comptée</div>
                    </div>
                  </div>
                  <div className="mt-3 bg-white rounded-lg px-4 py-3 border border-amber-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">Capital minimum requis pour fermer (hors réserve)</span>
                    <span className="font-mono font-bold text-base text-amber-900">{fmtMoney(rp.coutInitial)}</span>
                  </div>
                </div>

                <p className="text-xs text-stone-500 italic">Les montants sont des estimations basées sur les barèmes de l'Île de Montréal. Consultez un notaire et un courtier hypothécaire pour votre situation précise.</p>
              </div>
            </details>

            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 ${mode === 'avance' ? 'p-3 bg-blue-50 rounded-xl border border-blue-100' : ''}`}>
              <MoneyCard label="Versement mensuel" value={rp.versementMens} color="stone" tooltip={`Paiement hypothécaire mensuel (capital + intérêts)${rp.schl.applicable ? `. Prime SCHL de ${fmtMoney(rp.schl.prime)} intégrée au prêt.` : '.'} Ne comprend pas les taxes, condo ni assurance.`} />
              <MoneyCard label="Coût mensuel total" value={coutMensuelTotal} color="stone" tooltip={`Versement hypothécaire + frais de condo + assurance + taxes municipales/12 + taxes scolaires/12 + entretien/12. Total de vos sorties de caisse mensuelles réelles en tant que propriétaire.`} />
              {mode === 'avance'
                ? <MoneyCard label="Intérêts totaux payés" value={-applyReel(rp.interetsCum)} color="red" tooltip={`Total des intérêts versés à la banque sur ${h.horizon} ans. C'est l'argent "perdu" dans le prêt — la portion de chaque versement qui ne construit pas votre équité. Élevé en début de prêt (amortissement), décroît avec le temps.`} />
                : <MoneyCard label="Équité finale" value={applyReel(rp.equiteFinale)} color="amber" tooltip="Valeur du bien après appréciation, moins le solde d'hypothèque restant. C'est votre richesse immobilière brute — avant les frais de vente (commission, notaire)." />
              }
              <MoneyCard label="Bénéfice net (après vente)" value={applyReel(rp.beneficeNet)} color={rp.beneficeNet >= 0 ? 'green' : 'red'} emphasis sublabel={dollarsReels ? "en $ d'aujourd'hui · après impôts" : 'après impôts'} tooltip={`Simulation sur ${h.horizon} ans avec vente du bien à la fin. Bénéfice net = produit de vente − solde hypothèque − commissions − coût initial − tous les intérêts payés (${fmtMoney(rp.interetsCum)}) − toutes les charges. Le gain en capital est exempté d'impôt (résidence principale).`} />
            </div>

            {/* Mode avancé : tableau détaillé des flux */}
            {mode === 'avance' && (
              <details className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <summary className="bg-stone-50 px-4 py-3 cursor-pointer font-semibold text-stone-800 hover:bg-stone-100 transition-colors flex items-center justify-between text-sm">
                  <span>Flux annuels détaillés</span>
                  <IconChevron size={13} />
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-stone-50 text-stone-600 uppercase tracking-wider">
                      <tr>
                        {['Année', 'Valeur bien', 'Solde hypo', 'Équité', 'Capital remb.', 'Intérêts', 'Charges'].map(h => (
                          <th key={h} className="px-3 py-2 text-right first:text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rp.timeseries.filter((_, i) => i % 5 === 0 || i === rp.timeseries.length - 1).map((r) => (
                        <tr key={r.annee} className="border-t border-stone-100">
                          <td className="px-3 py-1.5 font-semibold">An {r.annee}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(applyReel(r.valeurBien))}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-red-700">{fmtMoney(applyReel(r.soldeHypo))}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700 font-semibold">{fmtMoney(applyReel(r.equite))}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmtMoney(applyReel(r.capital))}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-stone-500">{fmtMoney(applyReel(r.interets))}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-stone-500">{fmtMoney(applyReel(r.coutsRec))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <div className="bg-white rounded-lg border border-stone-200 p-6">
              <h3 className="text-lg font-bold text-stone-900 mb-4">Équité vs dette</h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={rp.timeseries} margin={{ bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="annee" stroke="#78716c" />
                  <YAxis stroke="#78716c" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="valeurBien" name="Valeur du bien" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="soldeHypo" name="Solde hypo" stroke="#dc2626" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="equite" name="Équité" stroke="#b45309" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {mode === 'avance' && (
              <div className="bg-white rounded-lg border border-blue-100 p-6">
                <h3 className="text-lg font-bold text-stone-900 mb-1">Garder vs revendre — produit net chaque année</h3>
                <p className="text-xs text-stone-500 mb-4">Équité accumulée (si vous gardez) vs produit net de vente après commission ({(h.commVente * 100).toFixed(0)} %) et frais juridiques (si vous vendez à cette année).</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={rp.timeseries.map(r => ({
                      annee: r.annee,
                      equite: r.equite,
                      produitVente: Math.max(0, r.valeurBien * (1 - h.commVente) - r.soldeHypo - h.fraisJurVente),
                    }))}
                    margin={{ bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="annee" stroke="#78716c" />
                    <YAxis stroke="#78716c" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmtMoney(v)} />
                    <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                    <Line type="monotone" dataKey="equite" name="Équité (garder)" stroke="#b45309" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="produitVente" name="Produit net (revendre)" stroke="#0369a1" strokeWidth={2} strokeDasharray="5 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          );
        })()}

        {/* ===== Multiplex ===== */}
        {activeTab === 'duplex' && (() => {
          const portionLocative = h.nbLogementsLoues / (h.nbLogementsLoues + 1);
          const coutMensuelDuplex = duplex.versementMens + h.condoMens + h.assurMens * 1.3 + (derives.taxeMuniAn * (duplex.prixDuplex / h.prix)) / 12 + (derives.taxeScolaireAn * (duplex.prixDuplex / h.prix)) / 12 + duplex.prixDuplex * h.entretienPct / 12;
          const loyerMensuelBrut = h.loyerPercuInitial * h.nbLogementsLoues;
          return (
          <div className="space-y-6">
            <details className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> Scénario : Multiplex (vous habitez + vous louez)</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-stone-600 space-y-2 border-t border-stone-200">
                <p>Vous achetez un immeuble à <strong>{fmtMoney(duplex.prixDuplex)}</strong>, habitez 1 logement et louez les <strong>{h.nbLogementsLoues} autre{h.nbLogementsLoues > 1 ? 's' : ''}</strong> ({fmtMoney(loyerMensuelBrut)}/mois bruts au départ, <strong>ce montant augmente chaque année</strong> selon le taux d'augmentation configuré dans les paramètres).</p>
                <p><strong>Fiscalité hybride :</strong> la portion que vous habitez ({(100 / (h.nbLogementsLoues + 1)).toFixed(0)} %) bénéficie de l'exemption résidence principale. La portion louée ({(portionLocative * 100).toFixed(0)} %) génère du revenu imposable et est soumise à l'impôt sur le gain en capital à la vente.</p>
                <p><strong>Effet de levier accru :</strong> vos locataires contribuent à rembourser votre hypothèque. Le prix de l'immeuble est estimé en ajoutant 80 % du prix de base par logement loué supplémentaire.</p>
                <p><strong>Prix de l'immeuble :</strong> {fmtMoney(duplex.prixDuplex)} · <strong>Versement hypothécaire :</strong> {fmtMoney(duplex.versementMens)}/mois · <strong>Loyers bruts initiaux :</strong> {fmtMoney(loyerMensuelBrut)}/mois</p>
              </div>
            </details>
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 ${mode === 'avance' ? 'p-3 bg-blue-50 rounded-xl border border-blue-100' : ''}`}>
              <MoneyCard label="Versement mensuel" value={duplex.versementMens} color="stone" tooltip="Paiement hypothécaire mensuel sur l'immeuble entier (votre logement + les logements loués). Capital + intérêts uniquement." />
              <MoneyCard label="Coût mensuel total" value={coutMensuelDuplex} color="stone" tooltip={`Versement + charges complètes de l'immeuble (condo, assurance ×1,3, taxes, entretien). Vos loyers perçus (${fmtMoney(loyerMensuelBrut)}/mois) compensent une partie de ces coûts.`} />
              {mode === 'avance'
                ? <MoneyCard label="Cashflow cumulé" value={applyReel(duplex.cashflowCum)} color={duplex.cashflowCum >= 0 ? 'green' : 'red'} tooltip="Total des loyers reçus moins toutes les dépenses (hypothèque, taxes, entretien, assurance, impôt sur revenus locatifs) sur toute la période. Peut être négatif les premières années." />
                : <MoneyCard label="Équité finale" value={applyReel(duplex.equiteFinale)} color="amber" tooltip="Valeur de l'immeuble après appréciation, moins le solde d'hypothèque restant. Richesse immobilière brute avant frais de vente." />
              }
              <MoneyCard label="Bénéfice net (après vente)" value={applyReel(duplex.beneficeNet)} color={duplex.beneficeNet >= 0 ? 'green' : 'red'} emphasis sublabel={dollarsReels ? "en $ d'aujourd'hui · après impôts" : 'après impôts'} tooltip={`Simulation sur ${h.horizon} ans avec vente de l'immeuble à la fin. Produit de vente net − coût initial − impôt sur gain en capital (portion louée : ${(portionLocative * 100).toFixed(0)} %) + cashflow locatif cumulé.`} />
            </div>
            <div className="bg-white rounded-lg border border-stone-200 p-6">
              <Slider label="Nombre de logements loués" value={h.nbLogementsLoues} onChange={update('nbLogementsLoues')} min={1} max={5} step={1} help="1 logement loué = duplex, 2 = triplex, 3 = quadruplex, 4 = quintuplex. Plus de logements = plus de levier mais plus de gestion." />
              <Slider label="Loyer mensuel perçu par logement loué" value={h.loyerPercuInitial} onChange={update('loyerPercuInitial')} min={800} max={3500} step={50} format="money" help={`Loyer initial par logement. Total : ${fmtMoney(h.loyerPercuInitial * h.nbLogementsLoues)}/mois. Ce montant augmente chaque année selon le taux d'augmentation — voir Paramètres → Marchés et loyers.`} />
            </div>
            <div className="bg-white rounded-lg border border-stone-200 p-6">
              <h3 className="text-lg font-bold text-stone-900 mb-4">Cashflow annuel après impôt</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={duplex.timeseries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="annee" stroke="#78716c" />
                  <YAxis stroke="#78716c" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Bar dataKey="cashflow" name="Cashflow" fill="#0369a1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          );
        })()}

        {/* ===== Locatif ===== */}
        {activeTab === 'loc' && (() => {
          const coutMensuelLoc = loc.versementMens + h.condoMens + h.assurMens * 1.3 + derives.taxeMuniAn / 12 + derives.taxeScolaireAn / 12 + h.prix * h.entretienPct / 12;
          const loyerNetMensuelAn1 = h.loyerPercuInitial * (1 - h.vacancePct) * (1 - h.gestionPct);
          const cashflowMensuelAn1 = (loc.timeseries[0]?.cashflow || 0) / 12;
          const anneeRemboursee = Math.min(h.amortissement, h.horizon);
          const cashflowMensuelPostRemb = (loc.timeseries[anneeRemboursee - 1]?.cashflow || loc.timeseries[loc.timeseries.length - 1]?.cashflow || 0) / 12;
          const anneeRentabilite = loc.timeseries.findIndex(r => r.cashflow >= 0);
          const depensesVsLoyerData = loc.timeseries.map(r => ({
            annee: r.annee,
            Loyer: Math.round(r.loyer / 12),
            Dépenses: Math.round((r.verseAnnuel !== undefined ? 0 : 0) + coutMensuelLoc),
          }));
          const depensesParAn = loc.timeseries.map((r, i) => {
            const versement = i < h.amortissement ? loc.versementMens : 0;
            const charges = h.condoMens + h.assurMens * 1.3 * Math.pow(1 + h.inflationAssur, i) + (derives.taxeMuniAn + derives.taxeScolaireAn) / 12 * Math.pow(1 + h.inflationCouts, i) + h.prix * Math.pow(1 + h.apprec, i) * h.entretienPct / 12;
            return {
              annee: r.annee,
              'Loyer perçu (net)': Math.round(r.loyer / 12),
              Hypothèque: Math.round(versement),
              Charges: Math.round(charges),
            };
          });
          return (
          <div className="space-y-6">
            <details className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> Scénario : Je loue mon bien (locatif pur)</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-stone-600 space-y-2 border-t border-stone-200">
                <p>Vous achetez un bien à <strong>{fmtMoney(h.prix)}</strong> que vous louez entièrement. Vous habitez vous-même ailleurs comme locataire ({fmtMoney(h.loyerInitial)}/mois initial, indexé chaque année).</p>
                <p><strong>Différence clé vs Multiplex :</strong> vous ne profitez pas de l'exemption résidence principale — 50 % du gain en capital est imposé à votre TMI ({(meta.tmiActuel * 100).toFixed(1)} %).</p>
                <p><strong>La mise de fonds minimale</strong> pour un locatif pur est de 20 % (pas d'assurance SCHL). Le taux hypothécaire est généralement +0,5 % vs résidence principale.</p>
              </div>
            </details>

            {/* Toggle comparaison loyer — mode avancé seulement */}
            {mode === 'avance' && (
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-stone-500">Bénéfice net :</span>
                <button
                  onClick={() => setLocLoyerDeduit(false)}
                  className={`px-3 py-1 rounded-l-full text-xs font-medium border transition-colors ${!locLoyerDeduit ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}
                >Sans loyer payé</button>
                <button
                  onClick={() => setLocLoyerDeduit(true)}
                  className={`px-3 py-1 rounded-r-full text-xs font-medium border-t border-b border-r transition-colors ${locLoyerDeduit ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}
                >Loyer déduit (≈ Bourse)</button>
              </div>
            )}

            {/* Cartes revenus */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MoneyCard label="Loyer perçu/mois (an 1)" value={loyerNetMensuelAn1} color="green" tooltip={`Loyer initial après vacance (${(h.vacancePct*100).toFixed(0)} %) et frais de gestion (${(h.gestionPct*100).toFixed(0)} %). Ce montant augmente de ${(h.augmLoyer*100).toFixed(1)} %/an.`} />
              <MoneyCard label="Cashflow net/mois (an 1)" value={cashflowMensuelAn1} color={cashflowMensuelAn1 >= 0 ? 'green' : 'red'} tooltip="Loyer net moins hypothèque, charges et impôt sur revenus locatifs. Souvent négatif les premières années à Montréal." />
              <MoneyCard label={`Cashflow net/mois (an ${anneeRemboursee})`} value={cashflowMensuelPostRemb} color={cashflowMensuelPostRemb >= 0 ? 'green' : 'amber'} tooltip={`Une fois l'hypothèque remboursée (an ${h.amortissement}), le versement mensuel disparaît — votre cashflow net augmente fortement. Les loyers continuent de croître avec l'indexation.`} />
              <MoneyCard
                label={locLoyerDeduit ? 'Bénéfice net (loyer déduit)' : 'Bénéfice net (après vente)'}
                value={locLoyerDeduit ? applyReel(loc.beneficeNet - loc.loyerPayeCum) : applyReel(loc.beneficeNet)}
                color={(locLoyerDeduit ? loc.beneficeNet - loc.loyerPayeCum : loc.beneficeNet) >= 0 ? 'green' : 'red'}
                emphasis
                sublabel={dollarsReels ? "en $ d'aujourd'hui · après impôts" : 'après impôts'}
                tooltip={locLoyerDeduit
                  ? `Bénéfice net standard (${Math.round(loc.beneficeNet).toLocaleString('fr-CA')} $) moins le loyer cumulé que vous avez payé en tant que locataire (${Math.round(loc.loyerPayeCum).toLocaleString('fr-CA')} $). Dans le scénario Bourse, ce loyer est déjà intégré car il réduit les montants investis chaque année.`
                  : `Produit de vente − solde hypothèque − commissions − impôt sur gain en capital (50 % inclusion) − coût initial + cashflow cumulé.`}
              />
            </div>

            {locLoyerDeduit && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
                <strong>Comparaison équitable avec la Bourse :</strong> dans le scénario Bourse, votre loyer réduit directement les montants investis chaque année — il est donc déjà « soustrait ». Pour comparer sur la même base, le loyer cumulé (<strong>{fmtMoney(loc.loyerPayeCum)}</strong>) est ici déduit du bénéfice net.
              </div>
            )}

            {/* Point de rentabilité */}
            {anneeRentabilite >= 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
                <span className="font-semibold text-emerald-900">Point de rentabilité : </span>
                <span className="text-emerald-800">Le cashflow mensuel devient positif à partir de l'<strong>année {anneeRentabilite + 1}</strong> ({new Date().getFullYear() + anneeRentabilite}). Avant ce point, vous complémentez chaque mois — après, les loyers couvrent toutes vos dépenses.</span>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                Avec les paramètres actuels, le cashflow reste négatif sur tout l'horizon. Ajustez le loyer perçu, la mise de fonds ou le taux d'intérêt.
              </div>
            )}

            {/* Graphique revenus vs dépenses */}
            <div className="bg-white rounded-lg border border-stone-200 p-5">
              <h3 className="text-base font-bold text-stone-900 mb-1">Loyer perçu vs Dépenses mensuelles</h3>
              <p className="text-xs text-stone-500 mb-4">Les barres oranges montrent l'hypothèque + charges; la barre verte = loyer net. L'écart se réduit avec le temps grâce à l'indexation des loyers.</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={depensesParAn.filter((_, i) => i % 5 === 0 || i === depensesParAn.length - 1)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="annee" stroke="#78716c" tick={{ fontSize: 11 }} tickFormatter={v => `An ${v}`} />
                  <YAxis stroke="#78716c" tick={{ fontSize: 11 }} tickFormatter={v => `${v} $`} />
                  <Tooltip formatter={(v, name) => [`${Math.round(v).toLocaleString('fr-CA')} $/mois`, name]} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Hypothèque" stackId="dep" fill="#fca5a5" />
                  <Bar dataKey="Charges" stackId="dep" fill="#fcd34d" />
                  <Bar dataKey="Loyer perçu (net)" fill="#6ee7b7" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {mode === 'avance' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                <p className="text-stone-700 mb-2"><strong>Stratégies fiscales pour réduire l'impôt de sortie :</strong></p>
                <ul className="list-disc list-inside space-y-1 text-xs text-stone-600">
                  <li><strong>Ne jamais vendre :</strong> transmettre aux héritiers</li>
                  <li><strong>Changement d'usage :</strong> habiter les dernières années (règle +1)</li>
                  <li><strong>Détention en société :</strong> report via roulement S.85</li>
                  <li><strong>Pertes en capital reportées :</strong> compenser avec des pertes accumulées</li>
                </ul>
                <p className="text-xs text-stone-500 mt-2 italic">Consultez un comptable fiscaliste avant toute décision.</p>
              </div>
            )}
          </div>
          );
        })()}

        {/* ===== Bourse ===== */}
        {activeTab === 'bourse' && (
          <div className="space-y-6">
            {mode === 'avance' && (
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-stone-500">Comparaison loyer :</span>
                <button
                  onClick={() => setLocLoyerDeduit(false)}
                  className={`px-3 py-1 rounded-l-full text-xs font-medium border transition-colors ${!locLoyerDeduit ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}
                >Sans loyer déduit</button>
                <button
                  onClick={() => setLocLoyerDeduit(true)}
                  className={`px-3 py-1 rounded-r-full text-xs font-medium border-t border-b border-r transition-colors ${locLoyerDeduit ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-stone-600 border-stone-300 hover:bg-stone-50'}`}
                >Loyer déduit</button>
              </div>
            )}
            <details className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> Scénario : Je reste locataire et investis en bourse</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-stone-600 space-y-2 border-t border-stone-200">
                <p><strong>Vous êtes le locataire</strong> — vous restez dans un appartement loué ({fmtMoney(h.loyerInitial)}/mois initial, indexé chaque année à {(h.augmLoyer * 100).toFixed(1)} %/an) et investissez en bourse l'argent que vous auriez autrement immobilisé dans un achat.</p>
                <p><strong>Année 1 :</strong> le capital qui aurait servi de mise de fonds + frais ({fmtMoney(rp.coutInitial)}) est investi immédiatement en bourse.</p>
                <p><strong>Années suivantes :</strong> la différence entre le coût total de propriété (versement + charges) et votre loyer est réinvestie chaque année. Si être propriétaire aurait coûté plus cher, cette économie s'accumule en bourse.</p>
                <p><strong>Ordre d'allocation :</strong> CELI d'abord ({fmtMoney(h.celiDisponible)} disponibles + 7 000 $/an — retraits non imposés), puis REER (jusqu'à {fmtMoney(Math.min(33810, h.salaireActuel * 0.18))}/an — déduction maintenant, impôt à la retraite), puis compte non-enregistré (imposé ~{(0.5 * meta.tmiActuel * 100).toFixed(0)} %/an sur rendement).</p>
                <p><strong>Bénéfice net :</strong> portefeuille total net d'impôt (CELI + REER × (1 − TMI retraite) + non-enr.) − capital total investi ({fmtMoney(bourse.investiCum)} cumulé).</p>
              </div>
            </details>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <MoneyCard label="CELI final" value={applyReel(bourse.porteCELI)} color="green" tooltip="Valeur finale du CELI. Croissance entièrement libre d'impôt — les retraits ne sont jamais imposés. C'est le compte le plus avantageux fiscalement." />
              <MoneyCard label="REER (brut avant impôt)" value={applyReel(bourse.porteREER)} color="amber" tooltip="Valeur brute du REER. Ce montant sera imposé au moment des retraits (à votre TMI de retraite). Le REER brut est donc surestimé — multipliez par (1 - TMI retraite) pour l'équivalent net." />
              <MoneyCard label="Loyer payé (vous, cumulé)" value={-applyReel(bourse.loyerPayeCum)} color="red" tooltip={`Pendant ${h.horizon} ans, vous payez ${fmtMoney(h.loyerInitial)}/mois de loyer (initial, indexé à ${(h.augmLoyer * 100).toFixed(1)} %/an). Ce loyer réduit déjà votre investissement annuel — il est intégré dans le calcul via l'économie annuelle (coût de propriété − loyer). Le bénéfice net reflète donc bien cette réalité.`} />
              <MoneyCard
                label={locLoyerDeduit ? 'Bénéfice net' : 'Bénéfice net (sans loyer déduit)'}
                value={locLoyerDeduit ? applyReel(bourse.beneficeNet) : applyReel(bourse.beneficeNet + bourse.loyerPayeCum)}
                color="green" emphasis
                tooltip={locLoyerDeduit
                  ? `Bénéfice net = CELI + REER net d'impôt + Non-enr. − capital investi. Le loyer (${fmtMoney(bourse.loyerPayeCum)} cumulé) réduit déjà chaque année le montant investi.`
                  : `Bénéfice net en ajoutant le loyer cumulé (${fmtMoney(bourse.loyerPayeCum)}) pour comparer sur la même base que « Je loue mon bien ».`}
              />
            </div>
            <div className="bg-white rounded-lg border border-stone-200 p-6">
              <h3 className="text-lg font-bold text-stone-900 mb-4">Croissance du portefeuille</h3>
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={bourse.timeseries} margin={{ bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="annee" stroke="#78716c" />
                  <YAxis stroke="#78716c" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Legend wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="porteCELI" name="CELI" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="porteREER" name="REER" stroke="#b45309" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="porteNonEnr" name="Non-enr." stroke="#7c2d12" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="porteTotal" name="Total" stroke="#1c1917" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ===== SENSIBILITÉ ===== */}
        {activeTab === 'sensibilite' && (
          <div className="space-y-6">
            <details className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> À propos de l'analyse de sensibilité</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-stone-600 space-y-2 border-t border-stone-200">
                <p>Ce tableau montre pour quelle stratégie (Résidence principale ou Bourse) le bénéfice net est supérieur, selon <strong>toutes les combinaisons</strong> d'appréciation immobilière et de rendement boursier.</p>
                <p>C'est la question centrale : est-ce que l'immobilier ou la bourse gagne ? La réponse dépend des hypothèses — c'est précisément ce que cet outil visualise.</p>
              </div>
            </details>
            <div className="bg-white rounded-lg border border-stone-200 p-6">
              <h3 className="text-lg font-bold text-stone-900 mb-1">Analyse de sensibilité</h3>
              <p className="text-sm text-stone-600 mb-1">
                Ce tableau compare le <strong>bénéfice net final</strong> entre <strong>Résidence principale</strong> et <strong>Bourse</strong> (locataire + ETF) pour toutes les combinaisons de deux hypothèses clés :
              </p>
              <ul className="text-xs text-stone-500 mb-3 list-disc list-inside space-y-0.5">
                <li><strong>Colonnes</strong> — Appréciation immobilière annuelle (de 1 % à 5,5 %)</li>
                <li><strong>Lignes</strong> — Rendement boursier annuel (de 4 % à 10 %)</li>
                <li>Couleur verte → la résidence principale gagne · Couleur ambrée → la bourse gagne · Plus foncé = écart plus grand</li>
              </ul>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-xs text-stone-500">Rendement bourse \ Appréciation immo</th>
                      {sensibiliteData.apprecs.map(a => (
                        <th key={a} className="p-2 text-center text-xs text-stone-600">{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensibiliteData.data.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2 text-xs font-semibold text-stone-700">{row.rendement}</td>
                        {sensibiliteData.apprecs.map(a => {
                          const cell = row[a];
                          const intensity = Math.min(1, cell.ecart / 500000);
                          const bg = cell.gagnant === 'Bourse'
                            ? `rgba(180, 83, 9, ${0.15 + intensity * 0.5})`
                            : `rgba(5, 150, 105, ${0.15 + intensity * 0.5})`;
                          return (
                            <td key={a} className="p-2 text-center text-xs" style={{ backgroundColor: bg }}>
                              <div className="font-bold">{cell.gagnant}</div>
                              <div className="text-[10px] opacity-70">+{fmtMoney(cell.ecart)}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-stone-500">
                <span className="inline-block w-3 h-3 bg-emerald-600 mr-1 align-middle" /> Résidence gagne ·
                <span className="inline-block w-3 h-3 bg-amber-700 mr-1 ml-3 align-middle" /> Bourse gagne
              </p>
            </div>
          </div>
        )}

        {/* ===== STRESS TESTS ===== */}
        {activeTab === 'stress' && (
          <div className="space-y-6">
            <details className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> À propos des stress tests</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-stone-600 space-y-2 border-t border-stone-200">
                <p>Les stress tests simulent un <strong>choc économique ponctuel</strong> sur une année : krach immobilier, effondrement boursier, ou renouvellement hypothécaire à taux élevé.</p>
                <p>Ils ne prédisent pas l'avenir, mais révèlent quelle stratégie résiste mieux à une crise. Activez les stress tests puis comparez les bénéfices nets de chaque scénario.</p>
              </div>
            </details>
            <div className="bg-white rounded-lg border border-stone-200 p-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={h.stressAppliquer} onChange={(e) => update('stressAppliquer')(e.target.checked)} className="w-5 h-5 accent-red-700" />
                <Tooltip2 text="Les stress tests simulent un choc économique sur une année donnée : krach immobilier (ex : -15 % à -40 %), effondrement boursier (ex : -30 % comme 2008), ou renouvellement hypothécaire à taux plus élevé. Ils ne prédisent pas l'avenir, mais révèlent quelle stratégie résiste mieux à une crise.">
                  <span className="font-bold text-stone-900">Activer les stress tests</span>
                </Tooltip2>
              </label>
              {h.stressAppliquer && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-stone-200">
                  <Slider label="Année du choc" value={h.stressAnnee} onChange={update('stressAnnee')} min={1} max={h.horizon} step={1} help="Année où le marché plonge" />
                  <Slider label="Choc sur l'immobilier" value={h.stressImmo} onChange={update('stressImmo')} min={-0.4} max={0} step={0.05} format="pct" help="Ex : -15 % en 1 an" />
                  <Slider label="Choc sur la bourse" value={h.stressBourse} onChange={update('stressBourse')} min={-0.5} max={0} step={0.05} format="pct" help="Ex : -30 % comme 2008" />
                  <Slider label="Taux hypo au renouvellement an 5" value={h.stressTauxRenouv} onChange={update('stressTauxRenouv')} min={0.03} max={0.12} step={0.005} format="pct" help="Si vous devez renouveler à un taux plus élevé" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <MoneyCard label="Résidence" value={applyReel(rp.beneficeNet)} color={h.stressAppliquer ? 'red' : 'stone'} />
              <MoneyCard label="Duplex" value={applyReel(duplex.beneficeNet)} color={h.stressAppliquer ? 'red' : 'stone'} />
              <MoneyCard label="Locatif" value={applyReel(loc.beneficeNet)} color={h.stressAppliquer ? 'red' : 'stone'} />
              <MoneyCard label="Bourse" value={applyReel(bourse.beneficeNet)} color={h.stressAppliquer ? 'red' : 'stone'} emphasis />
            </div>
            <div className="bg-stone-100 rounded-lg p-4 text-xs text-stone-600 italic">
              Les stress tests ne prédisent pas l'avenir — ils révèlent la robustesse de chaque stratégie face à un événement défavorable. Un portefeuille diversifié en bourse rebondit historiquement en 3-5 ans, l'immobilier en 5-10 ans selon les cycles.
            </div>
          </div>
        )}

        {/* ===== DÉCAISSEMENT RETRAITE ===== */}
        {activeTab === 'retraite' && (
          <div className="space-y-6">
            {!decaissementData ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-sm">
                <p className="font-semibold text-amber-900 mb-2">L'horizon de simulation n'atteint pas votre âge de retraite</p>
                <p className="text-amber-800">
                  Avec un horizon de <strong>{h.horizon} ans</strong> depuis {h.ageActuel} ans, vous aurez <strong>{h.ageActuel + h.horizon} ans</strong> en fin de simulation — avant votre retraite prévue à {h.ageRetraite} ans.
                </p>
                <p className="text-amber-700 mt-3">Pour utiliser cette section, vous pouvez :</p>
                <ul className="list-disc list-inside text-amber-700 mt-1 space-y-1">
                  <li>Augmenter l'horizon d'analyse dans le slider en haut (actuellement {h.horizon} ans → besoin d'au moins {h.ageRetraite - h.ageActuel + 1} ans)</li>
                  <li>Réduire l'âge de retraite dans <button onClick={() => setActiveTab('profil')} className="underline font-medium">Mes infos</button> (actuellement {h.ageRetraite} ans)</li>
                </ul>
              </div>
            ) : (
            <>
            <div className="bg-white rounded-lg border border-stone-200 p-6">
              <h3 className="text-lg font-bold text-stone-900 mb-1">Décaissement Bourse (VEQT)</h3>
              <p className="text-sm text-stone-500 mb-4">
                Si vous prenez votre retraite à {h.ageRetraite} ans et que votre espérance de vie est 90 ans, vous aurez {decaissementData.anneesRetraite} ans de retraite à financer.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-amber-50 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wider text-stone-500">Portefeuille total net</div>
                  <div className="text-2xl font-bold text-amber-900 mt-1">{fmtMoney(applyReel(bourse.porteNetApresImpot))}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wider text-stone-500">Retrait annuel sur {decaissementData.anneesRetraite} ans</div>
                  <div className="text-2xl font-bold text-emerald-800 mt-1">{fmtMoney(applyReel(decaissementData.retraitAnnuel))}</div>
                </div>
                <div className="bg-stone-100 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wider text-stone-500">Retrait mensuel</div>
                  <div className="text-2xl font-bold text-stone-900 mt-1">{fmtMoney(applyReel(decaissementData.retraitMensuel))}</div>
                </div>
              </div>
              <p className="text-xs text-stone-500 italic mb-0">
                Calcul simple (étalé linéairement sans rendement résiduel). Une règle plus sophistiquée (règle des 4 %) donnerait {fmtMoney(applyReel(bourse.porteNetApresImpot * 0.04))}/an à vie.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-stone-200 p-6">
              <h3 className="text-lg font-bold text-stone-900 mb-1">Revenu mensuel disponible à la retraite — par stratégie</h3>
              <p className="text-sm text-stone-500 mb-4">
                Retraite à {h.ageRetraite} ans · espérance de vie 90 ans · {decaissementData.anneesRetraite} ans de décaissement.
              </p>
              {/* Grille des 4 scénarios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* Bourse */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Bourse (VEQT)</div>
                  <div className="text-2xl font-bold text-emerald-800">{fmtMoney(applyReel(decaissementData.retraitMensuel))}<span className="text-sm font-normal text-stone-500 ml-1">/mois</span></div>
                  <div className="text-xs text-stone-400 mt-1">Portefeuille net {fmtMoney(applyReel(bourse.porteNetApresImpot))} ÷ {decaissementData.anneesRetraite} ans · ou {fmtMoney(applyReel(bourse.porteNetApresImpot * 0.04 / 12))}/mois à vie (règle 4 %)</div>
                </div>
                {/* Résidence principale */}
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Résidence principale (vendue)</div>
                  <div className="text-2xl font-bold text-stone-800">{fmtMoney(applyReel(rp.beneficeNet) / decaissementData.anneesRetraite / 12)}<span className="text-sm font-normal text-stone-500 ml-1">/mois</span></div>
                  <div className="text-xs text-stone-400 mt-1">Bénéfice net {fmtMoney(applyReel(rp.beneficeNet))} ÷ {decaissementData.anneesRetraite} ans. Nécessite de vendre et reinvestir.</div>
                </div>
                {/* Multiplex */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Multiplex (loyers, an {Math.min(h.horizon, h.amortissement)}+)</div>
                  {(() => {
                    const lastIdx = duplex.timeseries.length - 1;
                    const cashflowPostRemb = (duplex.timeseries[Math.min(h.amortissement, lastIdx)]?.cashflow || duplex.timeseries[lastIdx]?.cashflow || 0);
                    return (
                      <>
                        <div className={`text-2xl font-bold ${cashflowPostRemb >= 0 ? 'text-blue-800' : 'text-red-700'}`}>{fmtMoney(applyReel(cashflowPostRemb) / 12)}<span className="text-sm font-normal text-stone-500 ml-1">/mois</span></div>
                        <div className="text-xs text-stone-400 mt-1">Cashflow net locatif après impôt · hypothèque {cashflowPostRemb >= 0 ? 'remboursée' : 'non encore remboursée'}.</div>
                      </>
                    );
                  })()}
                </div>
                {/* Locatif pur */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">Je loue mon bien (loyers, an {Math.min(h.horizon, h.amortissement)}+)</div>
                  {(() => {
                    const lastIdx = loc.timeseries.length - 1;
                    const cashflowPostRemb = (loc.timeseries[Math.min(h.amortissement, lastIdx)]?.cashflow || loc.timeseries[lastIdx]?.cashflow || 0);
                    return (
                      <>
                        <div className={`text-2xl font-bold ${cashflowPostRemb >= 0 ? 'text-amber-800' : 'text-red-700'}`}>{fmtMoney(applyReel(cashflowPostRemb) / 12)}<span className="text-sm font-normal text-stone-500 ml-1">/mois</span></div>
                        <div className="text-xs text-stone-400 mt-1">Cashflow net locatif après impôt · hypothèque {cashflowPostRemb >= 0 ? 'remboursée' : 'non encore remboursée'}.</div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <p className="text-xs text-stone-500 italic">
                Calcul linéaire pour Bourse et RP (sans rendement résiduel). Les revenus locatifs (Multiplex et Locatif) continuent à vie tant que vous gardez le bien. La règle des 4 % pour la Bourse est une approximation courante pour un retrait à vie sans épuiser le capital.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-sm">
              <p className="text-stone-700 font-semibold mb-2">Ordre de décaissement optimal :</p>
              <ol className="list-decimal list-inside space-y-1 text-stone-600 text-xs">
                <li><strong>Compte non-enregistré d'abord</strong> : déjà imposé au fil des ans, retraits non imposés</li>
                <li><strong>REER ensuite</strong> (converti en FERR à 71 ans au plus tard) : taxé au TMI plus bas de la retraite</li>
                <li><strong>CELI en dernier</strong> : maximise la croissance à l'abri de l'impôt</li>
              </ol>
            </div>
            </>
            )}
          </div>
        )}

        {/* ===== FACTEURS NON FINANCIERS ===== */}
        {activeTab === 'nonfin' && (
          <div className="space-y-4">
            <details className="bg-stone-50 border border-stone-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> Ce que les chiffres ne capturent pas</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-stone-600 space-y-2 border-t border-stone-200">
                <p>Le modèle financier optimise le bénéfice net à la revente, mais une décision d'investissement comporte aussi des dimensions non quantifiables : qualité de vie, flexibilité, stress, temps, ancrage communautaire.</p>
                <p>Ce tableau compare ces facteurs pour les 4 stratégies — ils peuvent être déterminants selon votre situation personnelle.</p>
              </div>
            </details>
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <div className="bg-stone-100 p-4 border-b">
                <h3 className="font-bold text-lg text-stone-900">Facteurs non financiers</h3>
                <p className="text-xs text-stone-500 mt-1">Ce que les chiffres ne capturent pas, mais qui pèse dans une décision de vie.</p>
              </div>
              <div className="divide-y divide-stone-200">
                {[
                  { cat: 'Temps', rp: '~5 h/an (entretien occasionnel)', duplex: '50-150 h/an (gestion locataires, réparations)', loc: '50-150 h/an (idem + déplacements)', bourse: '~2 h/an (vérification annuelle d\'un ETF)' },
                  { cat: 'Flexibilité géographique', rp: 'Faible : vendre prend 3-6 mois', duplex: 'Très faible : vendre ou gérer à distance difficile', loc: 'Faible : idem', bourse: 'Très élevée : vente en 2 jours' },
                  { cat: 'Stress', rp: 'Modéré : rénovations, voisinage', duplex: 'Élevé : locataires, retards de paiement, conflits', loc: 'Élevé : idem', bourse: 'Modéré : volatilité, corrections boursières' },
                  { cat: 'Diversification', rp: 'Actif unique concentré sur 1 quartier', duplex: 'Actif unique (+ locataires dépendants)', loc: 'Actif unique', bourse: 'ETF indiciel = 500+ entreprises, plusieurs secteurs' },
                  { cat: 'Ancrage communautaire', rp: 'Fort (vous êtes propriétaire d\'un lieu)', duplex: 'Fort + relations locataires', loc: 'Variable', bourse: 'Nul (abstrait)' },
                  { cat: 'Protection contre inflation', rp: 'Bonne (le bien et les coûts grimpent ensemble)', duplex: 'Très bonne (loyers s\'ajustent)', loc: 'Très bonne', bourse: 'Variable selon l\'inflation vs taux' },
                  { cat: 'Effet de levier', rp: 'Élevé (20 % contrôle 100 %)', duplex: 'Très élevé', loc: 'Élevé', bourse: 'Aucun (sauf marge, risqué)' },
                ].map((row, i) => (
                  <div key={i} className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                    <div className="font-semibold text-stone-900">{row.cat}</div>
                    <div className="text-stone-600"><span className="text-[10px] uppercase text-stone-400">RP</span><br/>{row.rp}</div>
                    <div className="text-stone-600"><span className="text-[10px] uppercase text-stone-400">Duplex</span><br/>{row.duplex}</div>
                    <div className="text-stone-600"><span className="text-[10px] uppercase text-stone-400">Locatif</span><br/>{row.loc}</div>
                    <div className="text-stone-600"><span className="text-[10px] uppercase text-stone-400">Bourse</span><br/>{row.bourse}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== PARAMÈTRES ===== */}
        {activeTab === 'params' && (
          <div className="space-y-5">
            <details className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-amber-900 hover:bg-amber-100 transition-colors flex items-center justify-between">
                <span className="flex items-center gap-2"><IconInfo size={14} /> À propos de ces paramètres</span>
                <IconChevron size={13} />
              </summary>
              <div className="px-4 pb-4 pt-2 text-xs text-amber-900 space-y-2 border-t border-amber-200">
                {mode === 'debutant'
                  ? <><p>Ces paramètres contrôlent les hypothèses du modèle. Les valeurs par défaut reflètent les moyennes de l'Île de Montréal — ajustez selon votre situation réelle.</p>
                     <p>En mode Avancé, vous accédez aux paramètres complets : frais d'acquisition détaillés, fiscalité avancée, taux de vacance, etc.</p></>
                  : <><p>Tous les paramètres du modèle. Sources officielles : APCIQ, SCHL, Revenu Québec, ARC. Les valeurs par défaut sont calibrées pour le marché de l'Île de Montréal 2026.</p>
                     <p>Les modifications s'appliquent instantanément à tous les scénarios et graphiques.</p></>
                }
              </div>
            </details>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Immobilier — visible tous modes */}
            <section className="bg-white rounded-lg border border-stone-200 p-5">
              <h3 className="font-semibold text-base text-stone-900 mb-4 pb-2 border-b border-stone-200">Bien immobilier</h3>
              <Slider label="Prix du bien" value={h.prix} onChange={update('prix')} min={200000} max={800000} step={10000} format="money" help={`Mise de fonds : ${Math.round(h.prix * h.miseFondsPct / 1000)}k $ · Versement/mois : ${Math.round(rp.versementMens).toLocaleString('fr-CA')} $`} />
              <Slider label="Mise de fonds" value={h.miseFondsPct} onChange={update('miseFondsPct')} min={0.05} max={0.50} step={0.01} format="pct" help={`= ${fmtMoney(h.prix * h.miseFondsPct)} · Minimum légal : 5 % (assurance SCHL requise sous 20 %)`} />
              <Slider label="Taux hypothécaire" value={h.tauxHypo} onChange={update('tauxHypo')} min={0.02} max={0.08} step={0.0025} format="pct" help="Taux annuel. Typiquement fixé 5 ans puis renouvelé." />
              <Slider label="Appréciation annuelle immo" value={h.apprec} onChange={update('apprec')} min={0.00} max={0.07} step={0.005} format="pct" sourceKey="apprecImmo" help="Montréal historique : ~3-4 %/an long terme" />
            </section>

            {/* Marché — visible tous modes */}
            <section className="bg-white rounded-lg border border-stone-200 p-5">
              <h3 className="font-semibold text-base text-stone-900 mb-4 pb-2 border-b border-stone-200">Marché et loyers</h3>
              <Slider label="Rendement bourse annuel" value={h.rendement} onChange={update('rendement')} min={0.03} max={0.12} step={0.0025} format="pct" sourceKey="sp500" help="VEQT (Vanguard All-Equity ETF, actions mondiales diversifiées) historique ~7-8 % nominal. S&P 500 US ~9-10 % — on utilise 7,5 % comme base canadienne réaliste." />
              <Slider label="Loyer mensuel que vous paieriez (si locataire)" value={h.loyerInitial} onChange={update('loyerInitial')} min={800} max={4000} step={50} format="money" sourceKey="loyerMtl" help="Scénario Bourse uniquement — loyer que vous paieriez si vous restiez locataire. Ce montant augmente chaque année selon le taux d'augmentation ci-dessous." />
              <Slider label="Loyer mensuel perçu par logement loué (propriétaire-bailleur)" value={h.loyerPercuInitial} onChange={update('loyerPercuInitial')} min={800} max={3500} step={50} format="money" help="Scénarios Multiplex et Je loue mon bien. Ce montant de départ augmente chaque année selon le taux d'augmentation ci-dessous." />
              {mode === 'avance' && (
                <Slider label="Nombre de logements loués (Multiplex)" value={h.nbLogementsLoues} onChange={update('nbLogementsLoues')} min={1} max={5} step={1} help="1 = duplex, 2 = triplex, 3 = quadruplex, etc. Chaque logement loué ajoute environ 80 % du prix de base à la valeur de l'immeuble." />
              )}
              <Slider label="Augmentation annuelle du loyer" value={h.augmLoyer} onChange={update('augmLoyer')} min={0} max={0.08} step={0.005} format="pct" sourceKey="talAjustement" help="S'applique aux deux loyers ci-dessus : loyer locataire (Bourse) ET loyer perçu (Multiplex/Locatif). Moyen TAL ~4 %, SCHL Montréal +7,2 % en 2025." />
              {mode === 'avance' && (
                <>
                  <Slider label="Vacance + impayés" value={h.vacancePct} onChange={update('vacancePct')} min={0} max={0.15} step={0.01} format="pct" help="% du temps sans locataire. Standard prudent : 5 %." />
                  <Slider label="Frais de gestion locative" value={h.gestionPct} onChange={update('gestionPct')} min={0} max={0.10} step={0.005} format="pct" help="Si vous mandatez un gestionnaire (typ. 8-10 % des loyers)." />
                </>
              )}
            </section>

            {/* Coûts récurrents — visible tous modes */}
            <section className="bg-white rounded-lg border border-stone-200 p-5">
              <h3 className="font-semibold text-base text-stone-900 mb-4 pb-2 border-b border-stone-200">Charges annuelles</h3>
              <Slider label="Frais de condo/mois" value={h.condoMens} onChange={update('condoMens')} min={0} max={800} step={25} format="money" help="Frais de copropriété mensuels. 0 si maison." />
              <Slider label="Assurance habitation propriétaire/mois" value={h.assurMens} onChange={update('assurMens')} min={20} max={200} step={5} format="money" help="Assurance du propriétaire : appliquée dans Résidence principale (×1), Multiplex (×1,3) et Je loue mon bien (×1,3). Le scénario Bourse utilise un champ séparé (assurance locataire, beaucoup moins élevée)." />
              <Slider label="Entretien annuel" value={h.entretienPct} onChange={update('entretienPct')} min={0} max={0.03} step={0.0025} format="pct" help="Règle du pouce : 1 %/an de la valeur du bien. Inclut petites réparations." />
              {mode === 'avance' && (
                <>
                  <Slider label="Inflation coûts généraux" value={h.inflationCouts} onChange={update('inflationCouts')} min={0} max={0.05} step={0.0025} format="pct" sourceKey="taxesMunicipales" />
                  <Slider label="Inflation assurance habitation" value={h.inflationAssur} onChange={update('inflationAssur')} min={0} max={0.12} step={0.005} format="pct" sourceKey="assurance" help="+7,3 % en 2024, +5,3 % en 2025 au Canada" />
                </>
              )}
            </section>

            {mode === 'avance' && (
              <>
                <section className="bg-white rounded-lg border border-stone-200 p-5">
                  <h3 className="font-semibold text-base text-stone-900 mb-4 pb-2 border-b border-stone-200">Frais d'acquisition</h3>
                  <p className="text-xs text-stone-500 mb-3">Ces frais s'ajoutent à la mise de fonds et sont payés à l'achat. Ils s'appliquent à tous les scénarios immobiliers.</p>
                  <Slider label="Frais de notaire" value={h.notaire} onChange={update('notaire')} min={1000} max={5000} step={100} format="money" help="Montréal : ~2 000–3 500 $ pour un achat standard (acte de vente + hypothèque)." />
                  <Slider label="Inspection préachat" value={h.inspection} onChange={update('inspection')} min={300} max={1200} step={50} format="money" help="Standard Montréal : 500–800 $. Fortement recommandé — peut révéler des défauts majeurs." />
                  <Slider label="Frais divers / réserve" value={h.divers} onChange={update('divers')} min={0} max={15000} step={500} format="money" help="Déménagement, petits travaux, ajustements de taxes, urgences en début de propriété. Prévoir 3 000–7 000 $." />
                </section>

                <section className="bg-white rounded-lg border border-stone-200 p-5">
                  <h3 className="font-semibold text-base text-stone-900 mb-4 pb-2 border-b border-stone-200">Vente & financement</h3>
                  <Slider label="Amortissement (années)" value={h.amortissement} onChange={update('amortissement')} min={15} max={30} step={1} help="Standard : 25 ans. Jusqu'à 30 ans pour certains acheteurs." />
                  <Slider label="Mise de fonds locatif" value={h.miseFondsLocPct} onChange={update('miseFondsLocPct')} min={0.20} max={0.35} step={0.01} format="pct" help="Minimum légal pour un bien locatif : 20 %." />
                  <Slider label="Taux hypo locatif" value={h.tauxHypoLoc} onChange={update('tauxHypoLoc')} min={0.025} max={0.085} step={0.0025} format="pct" help="Généralement +0,5 % vs résidence principale." />
                  <div className="mt-3 pt-3 border-t border-stone-200">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Multiplex (config distincte)</p>
                    <Slider label="Mise de fonds multiplex" value={h.miseFondsMultiplexPct} onChange={update('miseFondsMultiplexPct')} min={0.10} max={0.35} step={0.01} format="pct" help="Le multiplex peut être financé avec moins de 20 % si vous habitez sur place (résidence principale)." />
                    <Slider label="Taux hypo multiplex" value={h.tauxHypoMultiplex} onChange={update('tauxHypoMultiplex')} min={0.025} max={0.085} step={0.0025} format="pct" help="Souvent comparable au taux résidence principale si vous habitez sur place." />
                    <p className="text-xs text-stone-400 mt-1 italic">Prix multiplex calculé : {fmtMoney(h.prix * (1 + 0.8 * h.nbLogementsLoues))} · Mise de fonds : {fmtMoney(h.prix * (1 + 0.8 * h.nbLogementsLoues) * h.miseFondsMultiplexPct)}</p>
                  </div>
                  <Slider label="Commission vente" value={h.commVente} onChange={update('commVente')} min={0} max={0.07} step={0.005} format="pct" help="Commission du courtier à la revente (~4-5 %)." />
                  <Slider label="Inflation générale ($ réels)" value={h.inflationGen} onChange={update('inflationGen')} min={0.01} max={0.05} step={0.0025} format="pct" help="Cible Banque du Canada : 2 %. Utilisé pour convertir $ futurs en $ 2026." />
                </section>

                <section className="bg-stone-50 rounded-lg border border-stone-200 p-5">
                  <h3 className="font-semibold text-base text-stone-900 mb-1 pb-2 border-b border-stone-200">Valeurs calculées</h3>
                  <p className="text-xs text-stone-500 mb-3 italic">Calculées automatiquement — survolez pour voir la formule.</p>
                  <div className="space-y-2 text-sm font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600 font-sans text-xs">
                        <Tooltip2 text={`Taxe de mutation (taxe de bienvenue) — Québec 2026 : 0,5 % jusqu'à 58 900 $, puis 1 % jusqu'à 294 600 $, puis 1,5 % au-delà. Calculée sur ${fmtMoney(h.prix)}. Payée une seule fois à l'achat.`}>Taxe de bienvenue</Tooltip2>
                      </span>
                      <span className="tabular-nums">{fmtMoney(derives.taxeBienvenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600 font-sans text-xs">
                        <Tooltip2 text={`Taxe municipale annuelle estimée — Formule : 0,65 % × ${fmtMoney(h.prix)} + 100 $. Varie selon la ville et l'évaluation foncière. Augmente ~2-4 %/an en ligne avec l'inflation des coûts.`}>Taxe municipale/an</Tooltip2>
                      </span>
                      <span className="tabular-nums">{fmtMoney(derives.taxeMuniAn)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600 font-sans text-xs">
                        <Tooltip2 text={`Taxe scolaire annuelle estimée — Formule : 0,09152 % × (${fmtMoney(h.prix)} − 25 000 $). Taux scolaire moyen Île de Montréal 2025-2026.`}>Taxe scolaire/an</Tooltip2>
                      </span>
                      <span className="tabular-nums">{fmtMoney(derives.taxeScolaireAn)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600 font-sans text-xs">
                        <Tooltip2 text={`Versement hypothécaire mensuel — Formule : r × P / (1 − (1+r)^−n), où r = taux/12 = ${(h.tauxHypo / 12 * 100).toFixed(3)} %, P = emprunt ${fmtMoney(h.prix * (1 - h.miseFondsPct))}, n = ${h.amortissement * 12} mois. Comprend capital + intérêts uniquement.`}>Versement hypo/mois</Tooltip2>
                      </span>
                      <span className="tabular-nums">{fmtMoney(derives.versementMens)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600 font-sans text-xs">
                        <Tooltip2 text={`Coût initial total pour acheter — Mise de fonds (${fmtMoney(h.prix * h.miseFondsPct)}) + taxe de bienvenue (${fmtMoney(derives.taxeBienvenue)}) + notaire (${fmtMoney(h.notaire)}) + inspection (${fmtMoney(h.inspection)}) + divers (${fmtMoney(h.divers)}). C'est le capital de départ comparé entre toutes les stratégies.`}>Coût initial RP</Tooltip2>
                      </span>
                      <span className="tabular-nums">{fmtMoney(rp.coutInitial)}</span>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
          </div>
        )}
      </main>

      {/* ===== FAQ MODAL ===== */}
      {showFAQ && (
        <div className="fixed inset-0 bg-stone-900/75 z-50 flex items-center justify-center p-4" onClick={() => setShowFAQ(false)}>
          <div className="bg-stone-50 max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-stone-900 text-stone-100 p-4 flex justify-between items-center">
              <h2 className="font-bold text-lg">Foire aux questions</h2>
              <button onClick={() => setShowFAQ(false)} className="text-stone-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-1">
              {FAQ.map((f, i) => (
                <details key={i} className="border border-stone-200 rounded-lg overflow-hidden">
                  <summary className="px-4 py-3 cursor-pointer font-medium text-stone-800 hover:bg-stone-100 transition-colors text-sm">
                    {f.q}
                  </summary>
                  <div className="px-4 py-3 text-sm text-stone-600 bg-white border-t border-stone-100">
                    {f.r}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== CGU MODAL ===== */}
      {showCGU && (
        <div className="fixed inset-0 bg-stone-900/75 z-50 flex items-center justify-center p-4" onClick={() => setShowCGU(false)}>
          <div className="bg-stone-50 max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-stone-900 text-stone-100 p-4 flex justify-between items-center">
              <h2 className="font-bold text-lg">Conditions d'utilisation</h2>
              <button onClick={() => setShowCGU(false)} className="text-stone-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-5 text-sm text-stone-700">
              <section>
                <h3 className="font-semibold text-stone-900 mb-2">Nature de l'outil</h3>
                <p>Ce simulateur est un outil éducatif à but non commercial, conçu pour illustrer les compromis financiers entre différentes stratégies d'investissement dans le marché de l'Île de Montréal. Il ne constitue pas et ne remplace pas un conseil financier, fiscal, juridique ou immobilier professionnel.</p>
              </section>
              <section>
                <h3 className="font-semibold text-stone-900 mb-2">Limitation de responsabilité</h3>
                <p>Les projections produites par cet outil sont basées sur des hypothèses simplificatrices et des données historiques. Les performances passées ne garantissent pas les rendements futurs. Toute décision d'investissement prise sur la base de cet outil est faite sous la seule responsabilité de l'utilisateur.</p>
              </section>
              <section>
                <h3 className="font-semibold text-stone-900 mb-2">Sources des données</h3>
                <p>Les hypothèses par défaut s'appuient sur des sources officielles : APCIQ, SCHL, Revenu Québec, ARC, TAL. Ces données sont actualisées ponctuellement et peuvent ne pas refléter les conditions de marché actuelles.</p>
              </section>
              <section>
                <h3 className="font-semibold text-stone-900 mb-2">Protection des données personnelles</h3>
                <p>Cet outil ne collecte, ne transmet et ne stocke aucune donnée personnelle sur des serveurs externes. Toutes les données saisies restent localement dans votre navigateur (localStorage) et ne sont jamais envoyées à un tiers.</p>
              </section>
              <section>
                <h3 className="font-semibold text-stone-900 mb-2">Juridiction</h3>
                <p>Cet outil est développé en conformité avec la réalité fiscale et réglementaire du Québec (Canada). Il n'est pas adapté pour d'autres provinces ou pays.</p>
              </section>
              <section>
                <h3 className="font-semibold text-stone-900 mb-2">Recommandation</h3>
                <p>Avant toute décision d'investissement immobilier ou financier, nous vous recommandons de consulter un conseiller financier agréé (CFA), un planificateur financier (Pl. Fin.) ou un comptable (CPA) autorisé au Québec.</p>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODALE D'INTRODUCTION ===== */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: darkMode ? '#2a2726' : '#fafaf9' }}>

            {/* En-tête */}
            <div className="px-6 pt-6 pb-5" style={{ background: 'linear-gradient(135deg, #292524 0%, #44403c 100%)' }}>
              <div className="flex items-center gap-3 mb-3">
                <LogoStocksStone size={34} />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: '#a8a29e' }}>Île de Montréal · 2026</div>
                  <div className="font-bold text-lg leading-tight" style={{ fontFamily: 'Georgia, serif', color: '#fff' }}>
                    Stock <span className="font-light text-base" style={{ fontFamily: 'system-ui, sans-serif', color: '#a8a29e' }}>or</span> Stone
                  </div>
                </div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#d4cfc8' }}>
                Comparez l'achat immobilier et l'investissement en bourse selon votre situation réelle — avec la fiscalité québécoise 2026.
              </p>
            </div>

            {/* Formulaire */}
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Âge */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Votre âge</label>
                  <input
                    type="text" inputMode="numeric"
                    value={introAgeStr}
                    onChange={e => {
                      setIntroAgeStr(e.target.value);
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 1) setRawH(prev => ({ ...prev, ageActuel: v }));
                    }}
                    onBlur={() => {
                      const v = parseInt(introAgeStr);
                      const clamped = isNaN(v) ? rawH.ageActuel : Math.max(18, Math.min(75, v));
                      setRawH(prev => ({ ...prev, ageActuel: clamped }));
                      setIntroAgeStr(String(clamped));
                    }}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </div>
                {/* Année arrivée Canada */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Année d'arrivée au Canada</label>
                  <input
                    type="text" inputMode="numeric"
                    value={introAnneeStr}
                    onChange={e => {
                      setIntroAnneeStr(e.target.value);
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 1000) setRawH(prev => ({ ...prev, anneeArriveeCanada: v }));
                    }}
                    onBlur={() => {
                      const v = parseInt(introAnneeStr);
                      const clamped = isNaN(v) ? rawH.anneeArriveeCanada : Math.max(1990, Math.min(2026, v));
                      setRawH(prev => ({ ...prev, anneeArriveeCanada: clamped }));
                      setIntroAnneeStr(String(clamped));
                    }}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </div>
              </div>

              {/* Capital disponible */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Capital disponible à investir</label>
                <div className="relative">
                  <input
                    type="number" min={20000} max={400000} step={5000}
                    value={Math.round(rawH.prix * rawH.miseFondsPct)}
                    onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0) setRawH(prev => ({ ...prev, prix: Math.round(v / prev.miseFondsPct) })); }}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 pr-6"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">$</span>
                </div>
                <div className="text-[10px] text-stone-600 mt-0.5">Mise de fonds ou épargne mobilisable → bien immobilier équivalent : {Math.round(rawH.prix).toLocaleString('fr-CA')} $</div>
              </div>

              {/* Mini-aperçu bourse vs RP */}
              {(() => {
                const vals = [
                  { label: 'Résidence principale', value: rp.beneficeNet, color: '#78716c' },
                  { label: 'Bourse (VEQT)', value: bourse.beneficeNet, color: '#059669' },
                ];
                const maxVal = Math.max(...vals.map(v => Math.abs(v.value)), 1);
                return (
                  <div className="bg-stone-50 rounded-xl border border-stone-200 px-4 pt-3 pb-2">
                    <div className="space-y-2">
                      {vals.map(v => (
                        <div key={v.label}>
                          <div className="flex justify-between text-[10px] text-stone-600 mb-0.5">
                            <span>{v.label}</span>
                            <span className="font-mono font-semibold" style={{ color: v.color }}>{fmtMoney(v.value)}</span>
                          </div>
                          <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (v.value / maxVal) * 100)}%`, background: v.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-stone-600 mt-2 text-center">Bénéfice net estimé sur {h.horizon} ans après revente · résultats indicatifs</p>
                  </div>
                );
              })()}

              <button
                onClick={() => { localStorage.setItem('imtl_seen', '1'); setShowOnboarding(false); setActiveTab('comparison'); }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-colors mt-1"
                style={{ background: '#1c1917', color: 'white' }}
                onMouseEnter={e => e.currentTarget.style.background = '#292524'}
                onMouseLeave={e => e.currentTarget.style.background = '#1c1917'}
              >
                Voir mes résultats →
              </button>
              <button
                onClick={() => { localStorage.setItem('imtl_seen', '1'); setShowOnboarding(false); }}
                className="w-full text-center text-xs text-stone-400 hover:text-stone-600 transition-colors py-1"
              >
                Passer et explorer librement
              </button>
              <p className="text-[10px] text-stone-400 text-center">Aucune donnée collectée · tout reste dans votre navigateur</p>
            </div>
          </div>
        </div>
      )}

      {/* ===== Footer ===== */}
      <footer className="border-t border-stone-200 bg-stone-50 mt-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-4">
          {/* Sources et méthodologie — contrôlé (se ferme au changement d'onglet) */}
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setShowSources(v => !v)}
              className="w-full px-4 py-3 font-semibold text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-between"
            >
              <span>Sources et méthodologie</span>
              <IconChevron size={13} className={showSources ? 'rotate-180' : ''} />
            </button>
            {showSources && (
              <ul className="px-4 pb-4 pt-2 space-y-2 text-stone-500 border-t border-stone-100">
                {Object.entries(SOURCES).map(([k, s]) => (
                  <li key={k}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-stone-600 hover:underline">{s.label}</a> — <span className="italic">{s.note}</span></li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-amber-900">Avertissement</p>
            <p className="text-sm text-amber-800 mt-1">
              Outil éducatif uniquement. Ne constitue pas un conseil financier, fiscal ou juridique. Les projections à long terme sont par nature incertaines. Consultez un professionnel qualifié avant toute décision d'investissement.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <button onClick={() => setShowCGU(true)} className="text-xs text-stone-500 hover:text-stone-700 underline">Conditions d'utilisation</button>
            <button onClick={() => setShowFAQ(true)} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 underline"><IconQuestion size={11} /> FAQ</button>
            <span className="text-xs text-stone-400">·</span>
            <span className="text-xs text-stone-400">Données : Île de Montréal · Fiscalité Québec 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
