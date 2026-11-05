# Synchronisation GeoNames

Profil générique (tous pays) :

- Enfants du pays : `ADM1*` → **provinces**
- Enfants d'une province : `PPLA*` / `PPLC` → **villes** ; `ADM2*` → **territoires** ; `ADM3*` / `PPL*` → **communes** (si pas de ville/territoire intermédiaire)
- Enfants d'une ville ou d'un territoire : `ADM3*` / `ADM4*` / `PPL*` → **communes**

Profil **RDC (CD)** :

- Même logique avec heuristique sur le libellé (`ville`, `territoire`) pour les divisions administratives congolaises.

Configuration : variable `GEONAMES_USERNAME` (compte gratuit sur https://www.geonames.org/login).
