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
    /**
     * Tranche d'âge de la dernière transaction (jours). Ex. 7 → dernière TX il y a 7 à 15 j.
     * Bornes : 3→[3,7), 7→[7,15), 15→[15,30), 30→[30,60), 60→[60,90), 90→[90,+∞).
     */
    Integer inactiveSinceDays,
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
