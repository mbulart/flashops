package com.flashops.api.onboarding;

import com.flashops.api.config.FlashOpsProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.altcha.altcha.Altcha;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OnboardingCaptchaService {
  private static final int MAX_CHALLENGES_PER_MINUTE = 30;
  private static final int GRANT_USES = 24;
  private static final long GRANT_TTL_MS = 4 * 60_000L;
  private static final long USED_TTL_MS = 15 * 60_000L;

  private final String secret;
  private final ConcurrentHashMap<String, Deque<Long>> challenges = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, Long> usedPayloads = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, Grant> grants = new ConcurrentHashMap<>();

  public OnboardingCaptchaService(FlashOpsProperties properties) {
    String configured = properties.captcha() == null ? null : properties.captcha().hmacSecret();
    if (configured == null || configured.isBlank()) {
      throw new IllegalStateException("FLASHOPS_CAPTCHA_SECRET manquant");
    }
    this.secret = configured;
  }

  public Map<String, Object> challenge(String ip) {
    limit(ip);
    try {
      Altcha.Challenge created =
          Altcha.createChallenge(
              new Altcha.ChallengeOptions()
                  .setMaxNumber(100_000L)
                  .setHmacKey(secret)
                  .setExpiresInSeconds(600));
      Map<String, Object> body = new LinkedHashMap<>();
      body.put("algorithm", created.algorithm);
      body.put("challenge", created.challenge);
      body.put("maxnumber", created.maxnumber);
      body.put("salt", created.salt);
      body.put("signature", created.signature);
      return body;
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "vérification indisponible");
    }
  }

  public String issueGrant(String payload) {
    if (payload == null || payload.isBlank() || payload.length() > 8_000) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "vérification refusée");
    }
    String value = payload.trim();
    boolean ok;
    try {
      ok = Altcha.verifySolution(value, secret, true);
    } catch (Exception ex) {
      ok = false;
    }
    if (!ok) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "vérification refusée");
    }
    long now = System.currentTimeMillis();
    purge(now);
    String hash = sha256(value);
    if (usedPayloads.putIfAbsent(hash, now + USED_TTL_MS) != null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "vérification déjà utilisée");
    }
    String token = UUID.randomUUID().toString();
    grants.put(token, new Grant(now + GRANT_TTL_MS));
    return token;
  }

  public void authorizeCreate(String token) {
    Grant grant = live(token);
    if (grant.candidatureId != null) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "vérification déjà utilisée");
    }
    use(grant);
  }

  public void bind(String token, long candidatureId) {
    Grant grant = grants.get(token);
    if (grant == null || grant.expiresAt < System.currentTimeMillis()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "vérification requise");
    }
    if (grant.candidatureId != null && grant.candidatureId != candidatureId) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "vérification invalide");
    }
    grant.candidatureId = candidatureId;
  }

  public void authorize(String token, long candidatureId) {
    Grant grant = live(token);
    if (grant.candidatureId == null) {
      grant.candidatureId = candidatureId;
    } else if (grant.candidatureId != candidatureId) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "vérification invalide");
    }
    use(grant);
  }

  private Grant live(String token) {
    purge(System.currentTimeMillis());
    if (token == null || token.isBlank()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "vérification requise");
    }
    Grant grant = grants.get(token.trim());
    if (grant == null || grant.expiresAt < System.currentTimeMillis()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "vérification requise");
    }
    return grant;
  }

  private static void use(Grant grant) {
    if (grant.remaining.decrementAndGet() < 0) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "vérification expirée");
    }
  }

  private void limit(String ip) {
    long now = System.currentTimeMillis();
    String key = ip == null || ip.isBlank() ? "inconnu" : ip;
    Deque<Long> hits = challenges.computeIfAbsent(key, ignored -> new ArrayDeque<>());
    synchronized (hits) {
      while (!hits.isEmpty() && hits.peekFirst() < now - 60_000L) hits.removeFirst();
      if (hits.size() >= MAX_CHALLENGES_PER_MINUTE) {
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "trop de vérifications");
      }
      hits.addLast(now);
    }
  }

  private void purge(long now) {
    usedPayloads.entrySet().removeIf(entry -> entry.getValue() < now);
    grants.entrySet().removeIf(entry -> entry.getValue().expiresAt < now);
  }

  private static String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "vérification indisponible");
    }
  }

  private static final class Grant {
    private final long expiresAt;
    private final AtomicInteger remaining = new AtomicInteger(GRANT_USES);
    private volatile Long candidatureId;

    private Grant(long expiresAt) {
      this.expiresAt = expiresAt;
    }
  }
}
