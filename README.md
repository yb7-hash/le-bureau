# Le Bureau (démo)

Une équipe d'agents IA qui prépare une recherche d'emploi, présentée comme une petite « machine » 3D :
dix agents à leur poste le long d'un tapis roulant de dossiers, un bureau pour le boss qui valide, et une salle de pause.

**Démo en ligne : https://le-bureau-demo.vercel.app**

Toutes les données affichées sont fictives. Cette version ne contient aucune clé, aucune base de données et aucun profil réel.

## Lancer en local
```bash
npm install
npm run dev
```
Puis ouvre http://localhost:3000.

## Stack
Next.js, React, TypeScript, three.js (scène 100 % procédurale : aucun modèle ni image).

## Structure
- `src/components/Factory3D.tsx` : la scène 3D (plaque, tapis, postes, avatars, salle de pause, caméras).
- `src/components/App.tsx` : simulation de la journée, bulles, journal d'activité, file de validation.
- `src/lib/data.ts` : agents, offres et statistiques fictives.

## Principe
Les agents préparent, **l'humain valide**, et rien n'est jamais envoyé sans validation explicite.

---
Démo mise en ligne automatiquement par Vercel à chaque envoi sur la branche `main`.
