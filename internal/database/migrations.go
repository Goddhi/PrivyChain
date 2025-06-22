package database

import (
	"fmt"
	"time"

	"github.com/goddhi/privychain/internal/models"
	"github.com/goddhi/privychain/pkg/logger"
	"gorm.io/gorm"
)

type Migration struct {
	ID          uint      `gorm:"primaryKey"`
	Version     string    `gorm:"uniqueIndex;not null"`
	Description string    `gorm:"not null"`
	Applied     bool      `gorm:"default:false"`
	AppliedAt   time.Time
	RolledBack  bool      `gorm:"default:false"`
	RolledBackAt *time.Time
}

// MigrationFunc represents a migration function
type MigrationFunc func(*gorm.DB) error

// MigrationDefinition defines a single migration
type MigrationDefinition struct {
	Version     string
	Description string
	Up          MigrationFunc
	Down        MigrationFunc
}

var migrations = []MigrationDefinition{
	{
		Version:     "001_initial_schema",
		Description: "Create initial tables for file records, encryption keys, and access grants",
		Up:          migration001Up,
		Down:        migration001Down,
	},
	{
		Version:     "002_add_indexes",
		Description: "Add database indexes for performance optimization",
		Up:          migration002Up,
		Down:        migration002Down,
	},
	{
		Version:     "003_add_user_profiles",
		Description: "Add user profile and reputation features",
		Up:          migration003Up,
		Down:        migration003Down,
	},
	{
		Version:     "004_add_analytics",
		Description: "Add analytics and metrics tables",
		Up:          migration004Up,
		Down:        migration004Down,
	},
}

// Migrate runs all pending migrations
func Migrate(db *gorm.DB) error {
	// Create migrations table if it doesn't exist
	if err := db.AutoMigrate(&Migration{}); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	logger.Log.Info("Starting database migrations...")

	for _, migration := range migrations {
		if err := runMigration(db, migration); err != nil {
			return fmt.Errorf("failed to run migration %s: %w", migration.Version, err)
		}
	}

	logger.Log.Info("Database migrations completed successfully")
	return nil
}

// Rollback rolls back the last migration
func Rollback(db *gorm.DB) error {
	var lastMigration Migration
	if err := db.Where("applied = ? AND rolled_back = ?", true, false).
		Order("applied_at DESC").
		First(&lastMigration).Error; err != nil {
		return fmt.Errorf("no migrations to rollback: %w", err)
	}

	// Find migration definition
	var migrationDef *MigrationDefinition
	for _, m := range migrations {
		if m.Version == lastMigration.Version {
			migrationDef = &m
			break
		}
	}

	if migrationDef == nil {
		return fmt.Errorf("migration definition not found for version %s", lastMigration.Version)
	}

	logger.Log.Info("Rolling back migration: " + migrationDef.Description)

	// Run rollback
	if err := migrationDef.Down(db); err != nil {
		return fmt.Errorf("failed to rollback migration: %w", err)
	}

	// Update migration record
	now := time.Now()
	lastMigration.RolledBack = true
	lastMigration.RolledBackAt = &now

	if err := db.Save(&lastMigration).Error; err != nil {
		return fmt.Errorf("failed to update migration record: %w", err)
	}

	logger.Log.Info("Migration rolled back successfully: " + lastMigration.Version)
	return nil
}

// GetMigrationStatus returns the status of all migrations
func GetMigrationStatus(db *gorm.DB) ([]Migration, error) {
	var migrations []Migration
	if err := db.Order("version").Find(&migrations).Error; err != nil {
		return nil, err
	}
	return migrations, nil
}

// runMigration executes a single migration
func runMigration(db *gorm.DB, migration MigrationDefinition) error {
	// Check if migration already applied
	var existingMigration Migration
	err := db.Where("version = ?", migration.Version).First(&existingMigration).Error
	
	if err == nil && existingMigration.Applied && !existingMigration.RolledBack {
		logger.Log.Info("Migration already applied: " + migration.Version)
		return nil
	}

	logger.Log.Info("Applying migration: " + migration.Description)

	// Run migration in transaction
	return WithTransaction(db, func(tx *gorm.DB) error {
		// Execute migration
		if err := migration.Up(tx); err != nil {
			return err
		}

		// Record migration
		migrationRecord := Migration{
			Version:     migration.Version,
			Description: migration.Description,
			Applied:     true,
			AppliedAt:   time.Now(),
		}

		if err == gorm.ErrRecordNotFound {
			// Create new record
			return tx.Create(&migrationRecord).Error
		} else {
			// Update existing record
			existingMigration.Applied = true
			existingMigration.AppliedAt = time.Now()
			existingMigration.RolledBack = false
			existingMigration.RolledBackAt = nil
			return tx.Save(&existingMigration).Error
		}
	})
}

// Migration 001: Initial schema
func migration001Up(db *gorm.DB) error {
	// Auto-migrate core models
	return db.AutoMigrate(
		&models.FileRecord{},
		&models.EncryptionKey{},
		&models.AccessGrant{},
	)
}

func migration001Down(db *gorm.DB) error {
	return db.Migrator().DropTable(
		&models.AccessGrant{},
		&models.EncryptionKey{},
		&models.FileRecord{},
	)
}

// Migration 002: Add indexes
func migration002Up(db *gorm.DB) error {
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_file_records_uploader_addr ON file_records(uploader_addr)",
		"CREATE INDEX IF NOT EXISTS idx_file_records_status ON file_records(status)",
		"CREATE INDEX IF NOT EXISTS idx_file_records_created_at ON file_records(created_at)",
		"CREATE INDEX IF NOT EXISTS idx_file_records_is_encrypted ON file_records(is_encrypted)",
		"CREATE INDEX IF NOT EXISTS idx_access_grants_cid ON access_grants(cid)",
		"CREATE INDEX IF NOT EXISTS idx_access_grants_grantee_addr ON access_grants(grantee_addr)",
		"CREATE INDEX IF NOT EXISTS idx_access_grants_expires_at ON access_grants(expires_at)",
		"CREATE INDEX IF NOT EXISTS idx_encryption_keys_user_address ON encryption_keys(user_address)",
	}

	for _, indexSQL := range indexes {
		if err := db.Exec(indexSQL).Error; err != nil {
			return err
		}
	}

	return nil
}

func migration002Down(db *gorm.DB) error {
	indexes := []string{
		"DROP INDEX IF EXISTS idx_file_records_uploader_addr",
		"DROP INDEX IF EXISTS idx_file_records_status",
		"DROP INDEX IF EXISTS idx_file_records_created_at",
		"DROP INDEX IF EXISTS idx_file_records_is_encrypted",
		"DROP INDEX IF EXISTS idx_access_grants_cid",
		"DROP INDEX IF EXISTS idx_access_grants_grantee_addr",
		"DROP INDEX IF EXISTS idx_access_grants_expires_at",
		"DROP INDEX IF EXISTS idx_encryption_keys_user_address",
	}

	for _, indexSQL := range indexes {
		if err := db.Exec(indexSQL).Error; err != nil {
			return err
		}
	}

	return nil
}

// Migration 003: Add user profiles
func migration003Up(db *gorm.DB) error {
	// Add new columns to file_records
	if !db.Migrator().HasColumn(&models.FileRecord{}, "access_count") {
		if err := db.Migrator().AddColumn(&models.FileRecord{}, "access_count"); err != nil {
			return err
		}
	}

	if !db.Migrator().HasColumn(&models.FileRecord{}, "download_count") {
		if err := db.Migrator().AddColumn(&models.FileRecord{}, "download_count"); err != nil {
			return err
		}
	}

	// Create user profiles table
	type UserProfile struct {
		ID               uint      `gorm:"primaryKey"`
		UserAddress      string    `gorm:"uniqueIndex;not null"`
		TotalFiles       int64     `gorm:"default:0"`
		TotalSize        int64     `gorm:"default:0"`
		EncryptedFiles   int64     `gorm:"default:0"`
		RewardsEarned    int64     `gorm:"default:0"`
		ReputationScore  int64     `gorm:"default:0"`
		IsVerified       bool      `gorm:"default:false"`
		JoinedAt         time.Time
		LastActivityAt   time.Time
		CreatedAt        time.Time
		UpdatedAt        time.Time
	}

	return db.AutoMigrate(&UserProfile{})
}

func migration003Down(db *gorm.DB) error {
	// Remove columns from file_records
	if db.Migrator().HasColumn(&models.FileRecord{}, "access_count") {
		if err := db.Migrator().DropColumn(&models.FileRecord{}, "access_count"); err != nil {
			return err
		}
	}

	if db.Migrator().HasColumn(&models.FileRecord{}, "download_count") {
		if err := db.Migrator().DropColumn(&models.FileRecord{}, "download_count"); err != nil {
			return err
		}
	}

	// Drop user profiles table
	return db.Migrator().DropTable("user_profiles")
}

// Migration 004: Add analytics
func migration004Up(db *gorm.DB) error {
	// Create analytics tables
	type DailyStats struct {
		ID             uint      `gorm:"primaryKey"`
		Date           time.Time `gorm:"uniqueIndex;not null"`
		FilesUploaded  int64     `gorm:"default:0"`
		StorageAdded   int64     `gorm:"default:0"`
		RewardsIssued  int64     `gorm:"default:0"`
		ActiveUsers    int64     `gorm:"default:0"`
		NewUsers       int64     `gorm:"default:0"`
		CreatedAt      time.Time
		UpdatedAt      time.Time
	}

	type ApiUsage struct {
		ID          uint      `gorm:"primaryKey"`
		UserAddress string    `gorm:"index"`
		Endpoint    string    `gorm:"index"`
		Method      string    `gorm:"index"`
		StatusCode  int       `gorm:"index"`
		ResponseTime int64    // milliseconds
		RequestSize  int64    // bytes
		ResponseSize int64    // bytes
		UserAgent   string
		IPAddress   string    `gorm:"index"`
		CreatedAt   time.Time `gorm:"index"`
	}

	return db.AutoMigrate(&DailyStats{}, &ApiUsage{})
}

func migration004Down(db *gorm.DB) error {
	return db.Migrator().DropTable("daily_stats", "api_usages")
}

// Utility functions for migrations

// CreateConstraint creates a database constraint
func CreateConstraint(db *gorm.DB, table, constraintName, constraintSQL string) error {
	sql := fmt.Sprintf("ALTER TABLE %s ADD CONSTRAINT %s %s", table, constraintName, constraintSQL)
	return db.Exec(sql).Error
}

// DropConstraint drops a database constraint
func DropConstraint(db *gorm.DB, table, constraintName string) error {
	sql := fmt.Sprintf("ALTER TABLE %s DROP CONSTRAINT IF EXISTS %s", table, constraintName)
	return db.Exec(sql).Error
}

// CreateTrigger creates a database trigger
func CreateTrigger(db *gorm.DB, triggerSQL string) error {
	return db.Exec(triggerSQL).Error
}

// DropTrigger drops a database trigger
func DropTrigger(db *gorm.DB, triggerName string) error {
	sql := fmt.Sprintf("DROP TRIGGER IF EXISTS %s", triggerName)
	return db.Exec(sql).Error
}

// SeedData inserts initial data
func SeedData(db *gorm.DB) error {
	logger.Log.Info("Seeding initial data...")

	// Add any initial data here
	// For example, default configuration values, admin users, etc.

	return nil
}

// ValidateSchema validates the current database schema
func ValidateSchema(db *gorm.DB) error {
	// Check if all required tables exist
	requiredTables := []interface{}{
		&models.FileRecord{},
		&models.EncryptionKey{},
		&models.AccessGrant{},
		&Migration{},
	}

	for _, table := range requiredTables {
		if !db.Migrator().HasTable(table) {
			return fmt.Errorf("required table missing: %T", table)
		}
	}

	logger.Log.Info("Database schema validation passed")
	return nil
}