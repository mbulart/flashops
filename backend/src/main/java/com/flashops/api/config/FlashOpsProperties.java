package com.flashops.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "flashops")
public record FlashOpsProperties(
    Jwt jwt,
    Cors cors,
    Admin admin,
    Storage storage,
    Geonames geonames) {

  public record Jwt(String secret, int accessTtlMinutes, int refreshTtlHours) {}

  public record Cors(String allowedOrigins) {}

  public record Admin(String email, String password, String fullName) {}

  public record Storage(String avatarsDir) {}

  public record Geonames(String username) {}
}
