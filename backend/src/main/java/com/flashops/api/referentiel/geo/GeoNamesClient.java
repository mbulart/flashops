package com.flashops.api.referentiel.geo;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.flashops.api.config.FlashOpsProperties;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Component
public class GeoNamesClient {

  private final RestClient rest;
  private final FlashOpsProperties props;

  public GeoNamesClient(RestClient geoNamesRestClient, FlashOpsProperties props) {
    this.rest = geoNamesRestClient;
    this.props = props;
  }

  public List<GeoPlace> children(long geonameId) {
    requireUsername();
    ChildrenResponse body =
        rest.get()
            .uri(
                uri ->
                    uri.path("/childrenJSON")
                        .queryParam("geonameId", geonameId)
                        .queryParam("username", props.geonames().username())
                        .build())
            .retrieve()
            .body(ChildrenResponse.class);
    if (body == null || body.geonames() == null) {
      return List.of();
    }
    return body.geonames();
  }

  public GeoPlace getPlace(long geonameId) {
    requireUsername();
    GeoPlace body =
        rest.get()
            .uri(
                uri ->
                    uri.path("/getJSON")
                        .queryParam("geonameId", geonameId)
                        .queryParam("username", props.geonames().username())
                        .queryParam("lang", "fr")
                        .build())
            .retrieve()
            .body(GeoPlace.class);
    if (body == null || body.geonameId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "geonames_unavailable");
    }
    return body;
  }

  private void requireUsername() {
    String user = props.geonames().username();
    if (user == null || user.isBlank()) {
      throw new ResponseStatusException(
          HttpStatus.SERVICE_UNAVAILABLE, "GEONAMES_USERNAME non configuré");
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ChildrenResponse(List<GeoPlace> geonames) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record GeoPlace(
      @JsonProperty("geonameId") Long geonameId,
      String name,
      String toponymName,
      String countryCode,
      String fcode,
      String fcl,
      String lat,
      String lng,
      @JsonProperty("adminCode1") String adminCode1,
      @JsonProperty("adminCode2") String adminCode2) {

    public String displayName() {
      if (name != null && !name.isBlank()) {
        return name.trim();
      }
      return toponymName == null ? "" : toponymName.trim();
    }

    public Double latitude() {
      return parseCoord(lat);
    }

    public Double longitude() {
      return parseCoord(lng);
    }

    private static Double parseCoord(String raw) {
      if (raw == null || raw.isBlank()) {
        return null;
      }
      try {
        return Double.parseDouble(raw);
      } catch (NumberFormatException e) {
        return null;
      }
    }
  }
}
