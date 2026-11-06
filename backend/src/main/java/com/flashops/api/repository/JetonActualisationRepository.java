package com.flashops.api.repository;

import com.flashops.api.domain.JetonActualisation;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JetonActualisationRepository extends JpaRepository<JetonActualisation, Long> {

  @EntityGraph(attributePaths = {"utilisateur", "utilisateur.role"})
  Optional<JetonActualisation> findByEmpreinteJetonAndRevoqueLeIsNull(String empreinteJeton);

  @Modifying(flushAutomatically = true, clearAutomatically = true)
  @Query(
      """
      UPDATE JetonActualisation j
      SET j.revoqueLe = :revokedAt
      WHERE j.utilisateur.id = :userId AND j.revoqueLe IS NULL
      """)
  int revokeAllActiveByUtilisateurId(
      @Param("userId") int userId, @Param("revokedAt") Instant revokedAt);
}
