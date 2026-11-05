package com.flashops.api.web;

import com.flashops.api.admin.AdministrationService;
import com.flashops.api.auth.AuthService;
import com.flashops.api.web.dto.AuthDtos;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private final AuthService authService;
  private final AdministrationService administrationService;

  public AuthController(AuthService authService, AdministrationService administrationService) {
    this.authService = authService;
    this.administrationService = administrationService;
  }

  @PostMapping({"/login", "/login/"})
  public AuthDtos.LoginResponse login(@Valid @RequestBody AuthDtos.LoginRequest req) {
    try {
      AuthDtos.LoginResponse res = authService.login(req.email(), req.password());
      administrationService.logLoginSuccess(res.user().id(), req.email());
      return res;
    } catch (ResponseStatusException ex) {
      if (ex.getStatusCode() == HttpStatus.UNAUTHORIZED) {
        administrationService.logLoginFailure(req.email());
      }
      throw ex;
    }
  }

  @PostMapping({"/refresh", "/refresh/"})
  public AuthDtos.RefreshResponse refresh(@Valid @RequestBody AuthDtos.RefreshRequest req) {
    return new AuthDtos.RefreshResponse(authService.refresh(req.refreshToken()));
  }

  @GetMapping("/me")
  public AuthDtos.MeResponse me() {
    int userId = AuthSupport.currentUserId();
    return new AuthDtos.MeResponse(authService.me(userId));
  }

  @PostMapping({"/password", "/password/"})
  public Map<String, Object> changePassword(@RequestBody Map<String, Object> body) {
    int userId = AuthSupport.currentUserId();
    authService.changePassword(
        userId, firstText(body, "current_password", "currentPassword"), firstText(body, "new_password", "newPassword"));
    return Map.of(
        "message", "password updated",
        "logout_required", true,
        "sessions_revoked", true);
  }

  private static String firstText(Map<String, ?> body, String... keys) {
    if (body == null || keys == null) {
      return null;
    }
    for (String key : keys) {
      Object value = body.get(key);
      if (value == null) {
        continue;
      }
      String text = String.valueOf(value);
      if (!text.isBlank() && !"null".equals(text)) {
        return text;
      }
    }
    return null;
  }

  @PatchMapping({"/profile", "/profile/"})
  public AuthDtos.MeResponse updateProfile(@Valid @RequestBody AuthDtos.UpdateProfileRequest req) {
    int userId = AuthSupport.currentUserId();
    return new AuthDtos.MeResponse(authService.updateProfile(userId, req.email(), req.fullName()));
  }

  @PostMapping(
      value = {"/profile-photo", "/profile-photo/"},
      consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public AuthDtos.MeResponse uploadProfilePhoto(@RequestParam("file") MultipartFile file) {
    int userId = AuthSupport.currentUserId();
    return new AuthDtos.MeResponse(authService.uploadProfilePhoto(userId, file));
  }

  @DeleteMapping({"/profile-photo", "/profile-photo/"})
  public AuthDtos.MeResponse deleteProfilePhoto() {
    int userId = AuthSupport.currentUserId();
    return new AuthDtos.MeResponse(authService.deleteProfilePhoto(userId));
  }

  @GetMapping(value = {"/profile-photo/{userId}", "/profile-photo/{userId}/"}, produces = MediaType.IMAGE_JPEG_VALUE)
  public ResponseEntity<byte[]> profilePhoto(@PathVariable int userId) {
    int requesterId = AuthSupport.currentUserId();
    byte[] bytes = authService.readProfilePhoto(requesterId, userId);
    return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(bytes);
  }
}
