package com.flashops.api.agences;

import java.util.List;

/** Filtres liste agences (pagination backend). */
public record AgenceAdminQuery(
    String q,
    String identifiant,
    Integer regionId,
    Integer zoneId,
    String ville,
    String commune,
    String province,
    String pays,
    String categorie,
    Integer activityDays,
    /** Nouveau | Actif | Inactif — vide = pas de filtre. */
    List<String> statutActivites,
    String from,
    String to,
    Integer parentAgenceId,
    Boolean sansCoords,
    int page,
    int size,
    /** null = pas de restriction ; sinon filtre `agence_id = ANY(...)`. */
    List<Integer> restrictAgenceIds) {}
