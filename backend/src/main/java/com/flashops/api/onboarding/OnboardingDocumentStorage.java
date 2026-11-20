package com.flashops.api.onboarding;

import com.flashops.api.config.FlashOpsProperties;
import java.nio.file.Path;
import org.springframework.stereotype.Component;

/** Point d'extension pour le futur endpoint multipart des pièces de candidature. */
@Component
public class OnboardingDocumentStorage {
  private final Path root;

  public OnboardingDocumentStorage(FlashOpsProperties properties) {
    String configured =
        properties.storage() == null ? null : properties.storage().documentsDir();
    this.root = Path.of(configured == null || configured.isBlank() ? "data/documents" : configured);
  }

  public Path root() {
    return root;
  }
}
