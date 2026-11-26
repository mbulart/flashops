package com.flashops.api.onboarding;

import com.flashops.api.config.FlashOpsProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class OnboardingDocumentStorage {
  private final Path root;

  public OnboardingDocumentStorage(FlashOpsProperties properties) {
    String configured =
        properties.storage() == null ? null : properties.storage().documentsDir();
    this.root =
        Path.of(configured == null || configured.isBlank() ? "data/documents" : configured)
            .toAbsolutePath()
            .normalize();
  }

  public String save(long candidatureId, String typeCode, String extension, InputStream data)
      throws IOException {
    Path dir = root.resolve("candidatures").resolve(Long.toString(candidatureId));
    Files.createDirectories(dir);
    String name = typeCode + "-" + UUID.randomUUID() + "." + extension.toLowerCase(Locale.ROOT);
    Path target = dir.resolve(name).normalize();
    if (!target.startsWith(root)) {
      throw new IOException("chemin invalide");
    }
    Files.copy(data, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
    return root.relativize(target).toString().replace('\\', '/');
  }

  public Optional<Path> resolveExisting(String relative) {
    if (relative == null || relative.isBlank() || relative.contains("..")) {
      return Optional.empty();
    }
    Path path = root.resolve(relative).normalize();
    if (!path.startsWith(root) || !Files.isRegularFile(path)) {
      return Optional.empty();
    }
    return Optional.of(path);
  }

  public void deleteQuietly(String relative) {
    resolveExisting(relative)
        .ifPresent(
            path -> {
              try {
                Files.deleteIfExists(path);
              } catch (IOException ignored) {
                /* le fichier pourra être repris plus tard */
              }
            });
  }
}
