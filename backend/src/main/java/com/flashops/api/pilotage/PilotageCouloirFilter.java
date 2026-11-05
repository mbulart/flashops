package com.flashops.api.pilotage;

import java.util.ArrayList;
import java.util.List;

/** Codes UI {@code paysOrigineId|paysDestinationId} → prédicat SQL. */
final class PilotageCouloirFilter {

  private PilotageCouloirFilter() {}

  static void appendPairs(String alias, List<String> codes, StringBuilder sql, List<Object> args) {
    var pairs = new ArrayList<int[]>();
    if (codes != null) {
      for (String code : codes) {
        int[] pair = parse(code);
        if (pair != null) {
          pairs.add(pair);
        }
      }
    }
    if (pairs.isEmpty()) {
      sql.append(" AND 1 = 0");
      return;
    }
    sql.append(" AND (");
    for (int i = 0; i < pairs.size(); i++) {
      if (i > 0) {
        sql.append(" OR ");
      }
      sql.append("(")
          .append(alias)
          .append(".pays_origine_id = ? AND ")
          .append(alias)
          .append(".pays_destination_id = ?)");
      args.add(pairs.get(i)[0]);
      args.add(pairs.get(i)[1]);
    }
    sql.append(")");
  }

  private static int[] parse(String code) {
    if (code == null) {
      return null;
    }
    String[] parts = code.split("\\|", -1);
    if (parts.length != 2) {
      return null;
    }
    try {
      int origine = Integer.parseInt(parts[0].trim());
      int destination = Integer.parseInt(parts[1].trim());
      if (origine <= 0 || destination <= 0) {
        return null;
      }
      return new int[] {origine, destination};
    } catch (NumberFormatException ex) {
      return null;
    }
  }
}
