package com.flashops.api.pilotage;

import java.util.List;
import java.util.Optional;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PilotageMetaRepository {

  private final JdbcTemplate jdbc;

  public PilotageMetaRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<PilotageMetaSnapshot> loadSnapshot() {
    try {
      List<String> devises =
          jdbc.query(
              """
              SELECT DISTINCT upper(btrim(d.code)) AS code
              FROM pilotage.agg_operation_jour AS g
              JOIN pilotage.dim_devise AS d ON d.devise_id = g.devise_id
              WHERE d.devise_id <> 0
                AND btrim(d.code) <> ''
                AND btrim(d.code) ~ '^[A-Za-z]{3}$'
              ORDER BY code
              """,
              (rs, rowNum) -> rs.getString("code"));

      String minJour =
          jdbc.queryForObject(
              "SELECT coalesce(min(jour)::text, '') FROM pilotage.agg_operation_jour", String.class);
      String maxJour =
          jdbc.queryForObject(
              "SELECT coalesce(max(jour)::text, '') FROM pilotage.agg_operation_jour", String.class);

      if (devises.isEmpty()) {
        devises = List.of("CDF", "USD");
      }
      String from = minJour == null || minJour.isBlank() ? null : minJour;
      String to = maxJour == null || maxJour.isBlank() ? null : maxJour;
      return Optional.of(new PilotageMetaSnapshot(devises, from, to));
    } catch (DataAccessException ex) {
      return Optional.empty();
    }
  }

  public record PilotageMetaSnapshot(List<String> devises, String dataFrom, String dataTo) {}
}
