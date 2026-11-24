import { corpusCounts } from './corpus-counts.mjs';
import { dataset, formatDate } from './data';

const corpus = corpusCounts(dataset);
export const pressDate = formatDate(dataset.meta.corpusUpdated);
export const pressFigures = [
  { value: corpus.proposals, label: 'propositions de campagne ou de parti' },
  {
    value: dataset.candidates.length,
    label: 'dossiers de candidature, retraits compris',
  },
  { value: dataset.sources.length, label: 'références documentaires' },
];
export const pressDescription =
  'Polradar est un site indépendant édité par bluetouff. Il documente la présidentielle française de 2027 à partir des programmes, des scrutins nominatifs, des notices de sondage et des statistiques publiques.';
export const pressAddress = 'admin@toonux.com';
export const partnerMail =
  'mailto:' +
  pressAddress +
  '?subject=' +
  encodeURIComponent('Partenariat média avec Polradar') +
  '&body=' +
  encodeURIComponent(
    'Bonjour,\n\nNotre rédaction : \nSujet et territoire : \nFormat envisagé (graphique, données ou dossier) : \nDate ou rythme de publication : \nContact : \n',
  );
export const correctionMail =
  'mailto:' +
  pressAddress +
  '?subject=' +
  encodeURIComponent('Correction documentaire pour Polradar') +
  '&body=' +
  encodeURIComponent(
    'Bonjour,\n\nLien de la fiche : \nPassage à vérifier : \nDocument ou référence : \n',
  );
export const pressNumber = (n: number) => n.toLocaleString('fr-FR');
