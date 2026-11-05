-- Villes présentes sur les agences, communes officielles de ces villes,
-- puis nettoyage des libellés stockés sur pilotage.dim_agence.
-- Les villes déjà chargées (codes GeoNames LUB, KIN-VILLE, …) sont réutilisées.
-- Une commune qui n'appartient pas à la ville est vidée, pas réaffectée.

CREATE OR REPLACE FUNCTION pg_temp.fold_lieu(source text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT regexp_replace(
        translate(
            upper(btrim(coalesce(source, ''))),
            'ÀÁÂÄÃÅÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÇ',
            'AAAAAAEEEEIIIIOOOOOUUUUC'
        ),
        '[^A-Z0-9]+',
        '',
        'g'
    )
$$;

UPDATE communes AS c
SET code = 'IBANDA'
FROM villes AS v
WHERE c.ville_id = v.id
  AND pg_temp.fold_lieu(v.libelle) = 'BUKAVU'
  AND c.code = 'IBERA';

UPDATE communes AS c
SET code = 'RWASHI',
    libelle = 'Rwashi'
FROM villes AS v
WHERE c.ville_id = v.id
  AND pg_temp.fold_lieu(v.libelle) = 'LUBUMBASHI'
  AND c.code = 'RUASHI';

UPDATE communes AS c
SET libelle = 'Ndjili'
FROM villes AS v
WHERE c.ville_id = v.id
  AND pg_temp.fold_lieu(v.libelle) = 'KINSHASA'
  AND c.code = 'NDJILI'
  AND c.libelle IS DISTINCT FROM 'Ndjili';

DELETE FROM communes AS c
USING villes AS v
WHERE c.ville_id = v.id
  AND (
        (pg_temp.fold_lieu(v.libelle) = 'BUKAVU' AND c.code = 'BUKAVU')
        OR (pg_temp.fold_lieu(v.libelle) = 'GOMA' AND c.code = 'GOMA-NORD')
      );

INSERT INTO villes (province_id, code, libelle, source)
SELECT p.id, v.code, v.libelle, 'seed'
FROM (VALUES
    ('NORD-KIVU', 'BEN', 'Beni'),
    ('MANIEMA', 'KINDU', 'Kindu'),
    ('KONGO-CENTRAL', 'BANGU', 'Bangu'),
    ('KONGO-CENTRAL', 'MUA', 'Muanda'),
    ('KONGO-CENTRAL', 'LUFU', 'Lufu'),
    ('EQUATEUR', 'MBA', 'Mbandaka')
) AS v(province_code, code, libelle)
JOIN provinces AS p ON p.code = v.province_code
WHERE NOT EXISTS (
    SELECT 1
    FROM villes AS x
    WHERE x.province_id = p.id
      AND pg_temp.fold_lieu(x.libelle) = pg_temp.fold_lieu(v.libelle)
);

INSERT INTO communes (ville_id, code, libelle, source)
SELECT v.id, c.code, c.libelle, 'seed'
FROM (VALUES
    ('KINSHASA', 'Kinshasa', 'BANDALUNGWA', 'Bandalungwa'),
    ('KINSHASA', 'Kinshasa', 'BARUMBU', 'Barumbu'),
    ('KINSHASA', 'Kinshasa', 'BUMBU', 'Bumbu'),
    ('KINSHASA', 'Kinshasa', 'GOMBE', 'Gombe'),
    ('KINSHASA', 'Kinshasa', 'KALAMU', 'Kalamu'),
    ('KINSHASA', 'Kinshasa', 'KASA-VUBU', 'Kasa-Vubu'),
    ('KINSHASA', 'Kinshasa', 'KIMBANSEKE', 'Kimbanseke'),
    ('KINSHASA', 'Kinshasa', 'KINSHASA', 'Kinshasa'),
    ('KINSHASA', 'Kinshasa', 'KINTAMBO', 'Kintambo'),
    ('KINSHASA', 'Kinshasa', 'KISENSO', 'Kisenso'),
    ('KINSHASA', 'Kinshasa', 'LEMBA', 'Lemba'),
    ('KINSHASA', 'Kinshasa', 'LIMETE', 'Limete'),
    ('KINSHASA', 'Kinshasa', 'LINGWALA', 'Lingwala'),
    ('KINSHASA', 'Kinshasa', 'MAKALA', 'Makala'),
    ('KINSHASA', 'Kinshasa', 'MALUKU', 'Maluku'),
    ('KINSHASA', 'Kinshasa', 'MASINA', 'Masina'),
    ('KINSHASA', 'Kinshasa', 'MATETE', 'Matete'),
    ('KINSHASA', 'Kinshasa', 'MONT-NGAFULA', 'Mont-Ngafula'),
    ('KINSHASA', 'Kinshasa', 'NDJILI', 'Ndjili'),
    ('KINSHASA', 'Kinshasa', 'NGABA', 'Ngaba'),
    ('KINSHASA', 'Kinshasa', 'NGALIEMA', 'Ngaliema'),
    ('KINSHASA', 'Kinshasa', 'NGIRI-NGIRI', 'Ngiri-Ngiri'),
    ('KINSHASA', 'Kinshasa', 'NSELE', 'Nsele'),
    ('KINSHASA', 'Kinshasa', 'SELEMBAO', 'Selembao'),
    ('HAUT-KATANGA', 'Lubumbashi', 'ANNEXE', 'Annexe'),
    ('HAUT-KATANGA', 'Lubumbashi', 'KAMALONDO', 'Kamalondo'),
    ('HAUT-KATANGA', 'Lubumbashi', 'KAMPEMBA', 'Kampemba'),
    ('HAUT-KATANGA', 'Lubumbashi', 'KATUBA', 'Katuba'),
    ('HAUT-KATANGA', 'Lubumbashi', 'KENYA', 'Kenya'),
    ('HAUT-KATANGA', 'Lubumbashi', 'LUBUMBASHI', 'Lubumbashi'),
    ('HAUT-KATANGA', 'Lubumbashi', 'RWASHI', 'Rwashi'),
    ('HAUT-KATANGA', 'Likasi', 'KIKULA', 'Kikula'),
    ('HAUT-KATANGA', 'Likasi', 'LIKASI', 'Likasi'),
    ('HAUT-KATANGA', 'Likasi', 'PANDA', 'Panda'),
    ('HAUT-KATANGA', 'Likasi', 'SHITURU', 'Shituru'),
    ('LUALABA', 'Kolwezi', 'DILALA', 'Dilala'),
    ('LUALABA', 'Kolwezi', 'MANIKA', 'Manika'),
    ('KASAI-ORIENTAL', 'Mbuji-Mayi', 'BIPEMBA', 'Bipemba'),
    ('KASAI-ORIENTAL', 'Mbuji-Mayi', 'DIBINDI', 'Dibindi'),
    ('KASAI-ORIENTAL', 'Mbuji-Mayi', 'DIULU', 'Diulu'),
    ('KASAI-ORIENTAL', 'Mbuji-Mayi', 'KANSHI', 'Kanshi'),
    ('KASAI-ORIENTAL', 'Mbuji-Mayi', 'MUYA', 'Muya'),
    ('KASAI-CENTRAL', 'Kananga', 'KANANGA', 'Kananga'),
    ('KASAI-CENTRAL', 'Kananga', 'KATOKA', 'Katoka'),
    ('KASAI-CENTRAL', 'Kananga', 'LUKONGA', 'Lukonga'),
    ('KASAI-CENTRAL', 'Kananga', 'NDESHA', 'Ndesha'),
    ('KASAI-CENTRAL', 'Kananga', 'NGANZA', 'Nganza'),
    ('TSHOPO', 'Kisangani', 'KABONDO', 'Kabondo'),
    ('TSHOPO', 'Kisangani', 'KISANGANI', 'Kisangani'),
    ('TSHOPO', 'Kisangani', 'LUBUNGA', 'Lubunga'),
    ('TSHOPO', 'Kisangani', 'MAKISO', 'Makiso'),
    ('TSHOPO', 'Kisangani', 'MANGOBO', 'Mangobo'),
    ('TSHOPO', 'Kisangani', 'TSHOPO', 'Tshopo'),
    ('NORD-KIVU', 'Goma', 'GOMA', 'Goma'),
    ('NORD-KIVU', 'Goma', 'KARISIMBI', 'Karisimbi'),
    ('NORD-KIVU', 'Beni', 'BEU', 'Beu'),
    ('NORD-KIVU', 'Beni', 'BUNGULU', 'Bungulu'),
    ('NORD-KIVU', 'Beni', 'MULEKERA', 'Mulekera'),
    ('NORD-KIVU', 'Beni', 'RUWENZORI', 'Ruwenzori'),
    ('NORD-KIVU', 'Butembo', 'BULENGERA', 'Bulengera'),
    ('NORD-KIVU', 'Butembo', 'KIMEMI', 'Kimemi'),
    ('NORD-KIVU', 'Butembo', 'MUSUSA', 'Mususa'),
    ('NORD-KIVU', 'Butembo', 'VULAMBA', 'Vulamba'),
    ('SUD-KIVU', 'Bukavu', 'BAGIRA', 'Bagira'),
    ('SUD-KIVU', 'Bukavu', 'IBANDA', 'Ibanda'),
    ('SUD-KIVU', 'Bukavu', 'KADUTU', 'Kadutu'),
    ('SUD-KIVU', 'Uvira', 'KALUNDU', 'Kalundu'),
    ('SUD-KIVU', 'Uvira', 'KAVIMVIRA', 'Kavimvira'),
    ('SUD-KIVU', 'Uvira', 'MULONGWE', 'Mulongwe'),
    ('ITURI', 'Bunia', 'MBUNYA', 'Mbunya'),
    ('ITURI', 'Bunia', 'NYAKASANZA', 'Nyakasanza'),
    ('ITURI', 'Bunia', 'SHARI', 'Shari'),
    ('MANIEMA', 'Kindu', 'ALUNGULI', 'Alunguli'),
    ('MANIEMA', 'Kindu', 'KASUKU', 'Kasuku'),
    ('MANIEMA', 'Kindu', 'MIKELENGE', 'Mikelenge'),
    ('KONGO-CENTRAL', 'Matadi', 'MATADI', 'Matadi'),
    ('KONGO-CENTRAL', 'Matadi', 'MVUZI', 'Mvuzi'),
    ('KONGO-CENTRAL', 'Matadi', 'NZANZA', 'Nzanza'),
    ('KONGO-CENTRAL', 'Boma', 'KABONDO', 'Kabondo'),
    ('KONGO-CENTRAL', 'Boma', 'KALAMU', 'Kalamu'),
    ('KONGO-CENTRAL', 'Boma', 'NZADI', 'Nzadi'),
    ('KONGO-CENTRAL', 'Bangu', 'KIMPESE', 'Kimpese'),
    ('KONGO-CENTRAL', 'Bangu', 'LUKALA', 'Lukala'),
    ('KONGO-CENTRAL', 'Bangu', 'VAMPA', 'Vampa'),
    ('KONGO-CENTRAL', 'Muanda', 'MAMPUTU', 'Mamputu'),
    ('KONGO-CENTRAL', 'Muanda', 'MUANDA', 'Muanda'),
    ('EQUATEUR', 'Mbandaka', 'MBANDAKA', 'Mbandaka'),
    ('EQUATEUR', 'Mbandaka', 'WANGATA', 'Wangata')
) AS c(province_code, ville_libelle, code, libelle)
JOIN provinces AS p ON p.code = c.province_code
JOIN villes AS v
    ON v.province_id = p.id
   AND pg_temp.fold_lieu(v.libelle) = pg_temp.fold_lieu(c.ville_libelle)
WHERE NOT EXISTS (
    SELECT 1
    FROM communes AS x
    WHERE x.ville_id = v.id
      AND pg_temp.fold_lieu(x.libelle) = pg_temp.fold_lieu(c.libelle)
);

-- Alias qui ne se déduisent pas du libellé officiel.
UPDATE pilotage.dim_agence AS d
SET ville = NULLIF(m.ville, ''),
    commune = NULLIF(m.commune, '')
FROM (VALUES
    ('KIMPESE', 'BASCONGO', 'Bangu', 'Kimpese'),
    ('KINSHASA', 'KIMBASEKE', 'Kinshasa', 'Kimbanseke'),
    ('LUBUMBASHI', 'KAPEMBA', 'Lubumbashi', 'Kampemba'),
    ('LUBUMBASHI', 'RUASHI', 'Lubumbashi', 'Rwashi'),
    ('LUBUMBASHI', 'QMAKUTANO', 'Lubumbashi', 'Kenya'),
    ('LUBUMBASHI', 'ANNEXELUBUMBASHI', 'Lubumbashi', 'Annexe'),
    ('MOANDA', '', 'Muanda', ''),
    ('EST', 'EST', '', '')
) AS m(raw_ville, raw_commune, ville, commune)
WHERE d.agence_id <> 0
  AND pg_temp.fold_lieu(d.ville) = m.raw_ville
  AND pg_temp.fold_lieu(d.commune) = m.raw_commune;

UPDATE pilotage.dim_agence AS d
SET ville = v.libelle
FROM villes AS v
JOIN provinces AS p ON p.id = v.province_id
JOIN pays AS y ON y.id = p.pays_id AND y.code_iso = 'CD'
WHERE d.agence_id <> 0
  AND pg_temp.fold_lieu(d.ville) = pg_temp.fold_lieu(v.libelle)
  AND d.ville IS DISTINCT FROM v.libelle;

UPDATE pilotage.dim_agence AS d
SET commune = c.libelle
FROM villes AS v
JOIN provinces AS p ON p.id = v.province_id
JOIN pays AS y ON y.id = p.pays_id AND y.code_iso = 'CD'
JOIN communes AS c ON c.ville_id = v.id
WHERE d.agence_id <> 0
  AND pg_temp.fold_lieu(d.ville) = pg_temp.fold_lieu(v.libelle)
  AND pg_temp.fold_lieu(d.commune) = pg_temp.fold_lieu(c.libelle)
  AND d.commune IS DISTINCT FROM c.libelle;

UPDATE pilotage.dim_agence AS d
SET commune = NULL
WHERE d.agence_id <> 0
  AND btrim(coalesce(d.commune, '')) <> ''
  AND EXISTS (
      SELECT 1
      FROM villes AS v
      JOIN provinces AS p ON p.id = v.province_id
      JOIN pays AS y ON y.id = p.pays_id AND y.code_iso = 'CD'
      WHERE pg_temp.fold_lieu(v.libelle) = pg_temp.fold_lieu(d.ville)
  )
  AND NOT EXISTS (
      SELECT 1
      FROM villes AS v
      JOIN provinces AS p ON p.id = v.province_id
      JOIN pays AS y ON y.id = p.pays_id AND y.code_iso = 'CD'
      JOIN communes AS c ON c.ville_id = v.id
      WHERE pg_temp.fold_lieu(v.libelle) = pg_temp.fold_lieu(d.ville)
        AND pg_temp.fold_lieu(c.libelle) = pg_temp.fold_lieu(d.commune)
  );
