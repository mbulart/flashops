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

  public static Periodes resolve(LocalDate dateReference) {
    if (dateReference == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date_reference requise");
    }
    DayOfWeek dow = dateReference.getDayOfWeek();
    if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "aucune demande opérationnelle le week-end");
    }
    // Colonnes UI : en-têtes J-1 / J-2 inchangés ; les périodes ci-dessous
    // sont déjà dans l’ordre affiché (pivot métier demandé).
    return switch (dow) {
      case MONDAY ->
          // J-1 = vendredi + samedi + dimanche ; J-2 = jeudi
          new Periodes(
              range(dateReference.minusDays(3), dateReference.minusDays(1)),
              single(dateReference.minusDays(4)));
      case TUESDAY ->
          // J-1 = vendredi + samedi + dimanche ; J-2 = lundi
          new Periodes(
              range(dateReference.minusDays(4), dateReference.minusDays(2)),
              single(dateReference.minusDays(1)));
      case WEDNESDAY ->
          // J-1 = lundi ; J-2 = mardi
          new Periodes(single(dateReference.minusDays(2)), single(dateReference.minusDays(1)));
      case THURSDAY ->
          // J-1 = mardi ; J-2 = mercredi
          new Periodes(single(dateReference.minusDays(2)), single(dateReference.minusDays(1)));
      case FRIDAY ->
          // J-1 = mercredi ; J-2 = jeudi
          new Periodes(single(dateReference.minusDays(2)), single(dateReference.minusDays(1)));
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
