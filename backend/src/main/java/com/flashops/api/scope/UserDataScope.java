package com.flashops.api.scope;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Périmètre données d’un utilisateur (agence / zone). */
public record UserDataScope(
    boolean unrestricted,
    List<Integer> allowedAgenceIds,
    List<Integer> allowedZoneIds) {

  private static final int NONE = -1;

  public static UserDataScope all() {
    return new UserDataScope(true, List.of(), List.of());
  }

  public static UserDataScope none() {
    return new UserDataScope(false, List.of(NONE), List.of(NONE));
  }

  public static UserDataScope restricted(List<Integer> agenceIds, List<Integer> zoneIds) {
    List<Integer> agences =
        agenceIds == null || agenceIds.isEmpty() ? List.of(NONE) : List.copyOf(agenceIds);
    List<Integer> zones = zoneIds == null ? List.of() : List.copyOf(zoneIds);
    return new UserDataScope(false, agences, zones);
  }

  public boolean allowsAgence(int agenceId) {
    if (unrestricted) {
      return true;
    }
    return allowedAgenceIds.contains(agenceId);
  }

  /**
   * Intersection du filtre demandé avec le périmètre. Si le résultat est vide pour un user
   * restreint, renvoie un sentinelle qui ne matche aucune agence.
   */
  public List<Integer> intersectAgences(List<Integer> requested) {
    if (unrestricted) {
      return requested == null ? List.of() : List.copyOf(requested);
    }
    if (allowedAgenceIds.isEmpty() || (allowedAgenceIds.size() == 1 && allowedAgenceIds.get(0) == NONE)) {
      return List.of(NONE);
    }
    if (requested == null || requested.isEmpty()) {
      return allowedAgenceIds;
    }
    Set<Integer> allowed = new HashSet<>(allowedAgenceIds);
    List<Integer> out = new ArrayList<>();
    for (Integer id : requested) {
      if (id != null && allowed.contains(id)) {
        out.add(id);
      }
    }
    return out.isEmpty() ? List.of(NONE) : List.copyOf(out);
  }

  public List<Integer> intersectZones(List<Integer> requested) {
    if (unrestricted || allowedZoneIds.isEmpty()) {
      return requested == null ? List.of() : List.copyOf(requested);
    }
    if (requested == null || requested.isEmpty()) {
      return allowedZoneIds;
    }
    Set<Integer> allowed = new HashSet<>(allowedZoneIds);
    List<Integer> out = new ArrayList<>();
    for (Integer id : requested) {
      if (id != null && allowed.contains(id)) {
        out.add(id);
      }
    }
    return out.isEmpty() ? List.of(NONE) : List.copyOf(out);
  }
}
