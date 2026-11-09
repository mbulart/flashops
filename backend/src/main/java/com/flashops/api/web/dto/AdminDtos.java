package com.flashops.api.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class AdminDtos {

  private AdminDtos() {}

  public record PermissionRow(
      Integer id, String code, String label, String module) {}

  public record RoleRow(Short id, String code, String label, List<PermissionRow> permissions) {}

  public record AdminUserRow(
      Integer id,
      String email,
      @JsonProperty("full_name") String fullName,
      AuthDtos.RoleView role,
      @JsonProperty("is_active") boolean isActive,
      @JsonProperty("last_login_at") Instant lastLoginAt,
      @JsonProperty("agence_id") Integer agenceId,
      @JsonProperty("responsable_zone_id") Integer responsableZoneId) {}

  public record AdminUserInput(
      String email,
      @JsonProperty("full_name") String fullName,
      @JsonProperty("role_id") Short roleId,
      @JsonProperty("is_active") boolean isActive,
      String password,
      @JsonProperty("agence_id") Integer agenceId,
      @JsonProperty("responsable_zone_id") Integer responsableZoneId) {}

  public record RolePermissionsInput(@JsonProperty("permission_ids") List<Integer> permissionIds) {}

  public record AppSettingsView(
      @JsonProperty("app_name") String appName,
      @JsonProperty("app_short_name") String appShortName,
      @JsonProperty("app_url") String appUrl,
      @JsonProperty("logo_light") String logoLight,
      @JsonProperty("logo_dark") String logoDark,
      String favicon,
      @JsonProperty("default_language") String defaultLanguage,
      @JsonProperty("timezone") String timezone,
      @JsonProperty("smtp_host") String smtpHost,
      @JsonProperty("smtp_port") int smtpPort,
      @JsonProperty("smtp_username") String smtpUsername,
      @JsonProperty("smtp_password_configured") boolean smtpPasswordConfigured,
      @JsonProperty("smtp_encryption") String smtpEncryption,
      @JsonProperty("smtp_from_email") String smtpFromEmail,
      @JsonProperty("smtp_from_name") String smtpFromName,
      @JsonProperty("smtp_test_to") String smtpTestTo,
      @JsonProperty("taux_change_usd_cdf") BigDecimal tauxChangeUsdCdf) {}

  public record AppSettingsUpdate(
      @JsonProperty("app_name") String appName,
      @JsonProperty("app_short_name") String appShortName,
      @JsonProperty("app_url") String appUrl,
      @JsonProperty("logo_light") String logoLight,
      @JsonProperty("logo_dark") String logoDark,
      String favicon,
      @JsonProperty("default_language") String defaultLanguage,
      @JsonProperty("timezone") String timezone,
      @JsonProperty("smtp_host") String smtpHost,
      @JsonProperty("smtp_port") int smtpPort,
      @JsonProperty("smtp_username") String smtpUsername,
      @JsonProperty("smtp_password") String smtpPassword,
      @JsonProperty("smtp_encryption") String smtpEncryption,
      @JsonProperty("smtp_from_email") String smtpFromEmail,
      @JsonProperty("smtp_from_name") String smtpFromName,
      @JsonProperty("smtp_test_to") String smtpTestTo,
      @JsonProperty("taux_change_usd_cdf") BigDecimal tauxChangeUsdCdf) {}

  public record SmtpTestRequest(String to) {}

  public record ActionUserBrief(
      Integer id, String email, @JsonProperty("full_name") String fullName) {}

  public record ActionRow(
      Long id,
      @JsonProperty("action_code") String actionCode,
      String module,
      String label,
      ActionUserBrief user,
      @JsonProperty("created_at") Instant createdAt) {}

  public record ActionDetailRow(
      Long id,
      @JsonProperty("action_code") String actionCode,
      String module,
      String label,
      ActionUserBrief user,
      JsonNode details,
      @JsonProperty("ip_address") String ipAddress,
      @JsonProperty("user_agent") String userAgent,
      @JsonProperty("created_at") Instant createdAt) {}

  public record PagedActions(
      List<ActionRow> items,
      long total,
      int page,
      @JsonProperty("page_size") int pageSize) {}
}
