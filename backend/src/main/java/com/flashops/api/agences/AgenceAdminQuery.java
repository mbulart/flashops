package com.flashops.api.agences;

import java.util.List;

/** Filtres liste agences (pagination backend). */
public record AgenceAdminQuery(
    String q,
    String identifiant,
    List<Integer> regionIds,
    Integer zoneId,
    String ville,
    String commune,
    String province,
    String pays,
    List<String> categories,
    Integer activityDays,
    /**
     * Âge mini de la dernière transaction (jours).
     * Bornes presets : 3→[3,7), 7→[7,15), 15→[15,30), 30→[30,60), 60→[60,90), 90→[90,+∞).
     * Autre valeur (saisie libre) → dernière TX il y a au moins N jours (sans borne max).
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
