package com.flashops.api.web.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;

public final class AuthDtos {

  private AuthDtos() {}

  public record LoginRequest(String email, String password) {}

  public record ChangePasswordRequest(
      @JsonProperty("current_password") String currentPassword,
      @JsonProperty("new_password") String newPassword) {}

  public record UpdateProfileRequest(
      String email, @JsonProperty("full_name") String fullName) {}

  public record RefreshRequest(@JsonProperty("refresh_token") String refreshToken) {}

  public record TokenPair(
      @JsonProperty("access_token") String accessToken,
      @JsonProperty("refresh_token") String refreshToken) {}

  public record LoginResponse(UserView user, TokenPair tokens) {}

  public record RefreshResponse(TokenPair tokens) {}

  public record MeResponse(UserView user) {}

  public record RoleView(Short id, String code, String label) {}

  public record PermissionView(Integer id, String code, String label, String module) {}

  public record UserView(
      Integer id,
      String email,
      @JsonProperty("full_name") String fullName,
      RoleView role,
      List<PermissionView> permissions,
      @JsonProperty("permission_codes") List<String> permissionCodes,
      @JsonProperty("is_active") boolean isActive,
      @JsonProperty("last_login_at") Instant lastLoginAt,
      @JsonProperty("has_profile_photo") boolean hasProfilePhoto,
      @JsonProperty("profile_photo_updated_at") Instant profilePhotoUpdatedAt,
      @JsonProperty("agence_id") Integer agenceId,
      @JsonProperty("responsable_zone_id") Integer responsableZoneId,
      @JsonProperty("allowed_agence_ids") List<Integer> allowedAgenceIds,
      @JsonProperty("allowed_zone_ids") List<Integer> allowedZoneIds) {}
}
