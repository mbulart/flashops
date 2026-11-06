package com.flashops.api.repository;

import com.flashops.api.domain.Permission;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PermissionRepository extends JpaRepository<Permission, Integer> {

  @Query(
      value =
          """
          SELECT p.* FROM permissions p
          JOIN roles_permissions rp ON rp.permission_id = p.id
          WHERE rp.role_id = :roleId
          ORDER BY p.code
          """,
      nativeQuery = true)
  List<Permission> findByRoleId(@Param("roleId") Short roleId);

  List<Permission> findAllByOrderByModuleAscCodeAsc();

  @Query(
      value =
          """
          SELECT DISTINCT p.code
          FROM permissions p
          WHERE p.id IN (
            SELECT rp.permission_id
            FROM roles_permissions rp
            INNER JOIN utilisateurs u ON u.role_id = rp.role_id
            WHERE u.id = :userId
            UNION
            SELECT up.permission_id
            FROM utilisateurs_permissions up
            WHERE up.utilisateur_id = :userId
          )
          ORDER BY p.code
          """,
      nativeQuery = true)
  List<String> findCodesForUser(@Param("userId") int userId);
}
