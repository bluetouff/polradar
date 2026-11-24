import { aplNumber } from './dossiers-territoriaux';
import {
  communeCode,
  integerLabel,
  percentLabel,
  vacancyLabel,
  readCommune,
} from './communes.mjs';
type Record2022 = ReturnType<typeof readCommune>;
export interface Department {
  code: string;
  name: string;
  value: number | null;
}
export function territoryDepartment(code: string, areas: Department[]) {
  if (!communeCode.test(code)) return undefined;
  const key = /^9[78]/.test(code) ? code.slice(0, 3) : code.slice(0, 2);
  return areas.find((d) => d.code === key);
}
export function localContext(
  health: number | null,
  department: Department | undefined,
  votes: Record2022 | null,
) {
  const sameArea = votes?.[3] ?? null;
  const second = sameArea ? votes?.[2] : null;
  return [
    {
      key: 'access',
      label: 'Généralistes · commune, 2024',
      value: health === null ? 'Non disponible' : aplNumber(health),
      unit: 'consultations accessibles par an et par habitant standardisé',
    },
    {
      key: 'department',
      label: department
        ? 'Généralistes · ' + department.name + ', 2024'
        : 'Généralistes · département, 2024',
      value:
        department?.value == null
          ? 'Non disponible'
          : aplNumber(department.value),
      unit: 'même unité, moyenne pondérée du département',
    },
    {
      key: 'population',
      label: 'Population · recensement 2023',
      value: sameArea ? integerLabel(sameArea[0]) : 'Non disponible',
      unit: 'habitants',
    },
    {
      key: 'vacancy',
      label: 'Logements vacants · recensement 2023',
      value: sameArea
        ? vacancyLabel(sameArea[2], sameArea[1])
        : 'Non disponible',
      unit: 'part du parc de logements',
    },
    {
      key: 'participation',
      label: 'Présidentielle · 24 avril 2022',
      value: second ? percentLabel(second[1], second[0]) : 'Non disponible',
      unit: 'part des inscrits ayant voté au second tour',
    },
  ];
}
