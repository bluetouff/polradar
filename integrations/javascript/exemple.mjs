// SPDX-License-Identifier: MIT
import { rechercherMesures } from './polradar.mjs';
const edition = await rechercherMesures(process.argv[2] ?? 'chiffrement');
console.log(JSON.stringify(edition, null, 2));
