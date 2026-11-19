package com.flashops.api.approvisionnement;

import java.time.DayOfWeek;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Règles métier J-1 / J-2 pour l’Approvisionnement VAS. */
public final class ApprovisionnementPeriodes {

  private ApprovisionnementPeriodes() {}

  public record Periode(LocalDate debut, LocalDate fin) {}

  public record Periodes(Periode j1, Periode j2) {}

  /**
   * Diviseur de la moyenne (consommation J-1 + J-2).
   * Lundi / mardi : les périodes couvrent 4 jours → ÷4 ; autres jours ouvrés → ÷2.
   */
  public static int diviseurMoyenne(LocalDate dateReference) {
    if (dateReference == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date_reference requise");
    }
    DayOfWeek dow = dateReference.getDayOfWeek();
    if (dow == DayOfWeek.MONDAY || dow == DayOfWeek.TUESDAY) {
      return 4;
    }
    return 2;
  }

  public static Periodes resolve(LocalDate dateReference) {
    if (dateReference == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date_reference requise");
    }
    DayOfWeek dow = dateReference.getDayOfWeek();
    if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "aucune demande opérationnelle le week-end");
    }
    // J-1 = période la plus récente avant la date de référence ; J-2 = période précédente.
    return switch (dow) {
      case MONDAY ->
          // J-1 = vendredi + samedi + dimanche ; J-2 = jeudi
          new Periodes(
              range(dateReference.minusDays(3), dateReference.minusDays(1)),
              single(dateReference.minusDays(4)));
      case TUESDAY ->
          // J-1 = lundi ; J-2 = vendredi + samedi + dimanche
          new Periodes(
              single(dateReference.minusDays(1)),
              range(dateReference.minusDays(4), dateReference.minusDays(2)));
      case WEDNESDAY ->
          // J-1 = mardi ; J-2 = lundi
          new Periodes(single(dateReference.minusDays(1)), single(dateReference.minusDays(2)));
      case THURSDAY ->
          // J-1 = mercredi ; J-2 = mardi
          new Periodes(single(dateReference.minusDays(1)), single(dateReference.minusDays(2)));
      case FRIDAY ->
          // J-1 = jeudi ; J-2 = mercredi
          new Periodes(single(dateReference.minusDays(1)), single(dateReference.minusDays(2)));
      default ->
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "jour de référence invalide");
    };
  }

  private static Periode single(LocalDate day) {
    return new Periode(day, day);
  }

  private static Periode range(LocalDate debut, LocalDate fin) {
    return new Periode(debut, fin);
  }
}
