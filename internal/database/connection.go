package database

import (
	"fmt"
	"log"
	"time"

	"github.com/goddhi/privychain/pkg/logger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormLogger "gorm.io/gorm/logger"
)

type Database struct {
	DB *gorm.DB
}

// Connect establishes database connection
func Connect(databaseURL string) (*gorm.DB, error) {
	config := &gorm.Config{
		Logger: gormLogger.New(
			log.New(logger.GetWriter(), "\r\n", log.LstdFlags),
			gormLogger.Config{
				SlowThreshold:             time.Second,
				LogLevel:                  gormLogger.Info,
				IgnoreRecordNotFoundError: true,
				Colorful:                  false,
			},
		),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	db, err := gorm.Open(postgres.Open(databaseURL), config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get underlying sql.DB to configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// Configure connection pool
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Test the connection
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	logger.Log.Info("Database connection established successfully")
	return db, nil
}

// Close closes the database connection
func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// HealthCheck checks if database is accessible
func HealthCheck(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}

// GetStats returns database connection statistics
func GetStats(db *gorm.DB) map[string]interface{} {
	sqlDB, err := db.DB()
	if err != nil {
		return map[string]interface{}{
			"error": err.Error(),
		}
	}

	stats := sqlDB.Stats()
	return map[string]interface{}{
		"max_open_connections": stats.MaxOpenConnections,
		"open_connections":     stats.OpenConnections,
		"in_use":              stats.InUse,
		"idle":                stats.Idle,
		"wait_count":          stats.WaitCount,
		"wait_duration":       stats.WaitDuration.String(),
		"max_idle_closed":     stats.MaxIdleClosed,
		"max_idle_time_closed": stats.MaxIdleTimeClosed,
		"max_lifetime_closed":  stats.MaxLifetimeClosed,
	}
}

// Transaction helpers
func WithTransaction(db *gorm.DB, fn func(*gorm.DB) error) error {
	tx := db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

// Batch operations
func BatchInsert(db *gorm.DB, records interface{}, batchSize int) error {
	return db.CreateInBatches(records, batchSize).Error
}

func BatchUpdate(db *gorm.DB, model interface{}, updates map[string]interface{}, conditions ...interface{}) error {
	query := db.Model(model)
	for i := 0; i < len(conditions); i += 2 {
		if i+1 < len(conditions) {
			query = query.Where(conditions[i], conditions[i+1])
		}
	}
	return query.Updates(updates).Error
}

// Advanced query helpers
func Paginate(page, pageSize int) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if page <= 0 {
			page = 1
		}

		switch {
		case pageSize > 100:
			pageSize = 100
		case pageSize <= 0:
			pageSize = 20
		}

		offset := (page - 1) * pageSize
		return db.Offset(offset).Limit(pageSize)
	}
}

func FilterByDateRange(field string, start, end time.Time) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if !start.IsZero() && !end.IsZero() {
			return db.Where(field+" BETWEEN ? AND ?", start, end)
		} else if !start.IsZero() {
			return db.Where(field+" >= ?", start)
		} else if !end.IsZero() {
			return db.Where(field+" <= ?", end)
		}
		return db
	}
}

func Search(fields []string, query string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if query == "" {
			return db
		}

		searchQuery := ""
		args := make([]interface{}, 0, len(fields))

		for i, field := range fields {
			if i > 0 {
				searchQuery += " OR "
			}
			searchQuery += field + " ILIKE ?"
			args = append(args, "%"+query+"%")
		}

		return db.Where(searchQuery, args...)
	}
}

// Database metrics and monitoring
type Metrics struct {
	TotalQueries     int64         `json:"total_queries"`
	SlowQueries      int64         `json:"slow_queries"`
	AverageQueryTime time.Duration `json:"average_query_time"`
	ConnectionsUsed  int           `json:"connections_used"`
	LastQueryTime    time.Time     `json:"last_query_time"`
}

func GetMetrics(db *gorm.DB) *Metrics {
	sqlDB, err := db.DB()
	if err != nil {
		return &Metrics{}
	}

	stats := sqlDB.Stats()
	
	return &Metrics{
		ConnectionsUsed: stats.OpenConnections,
		LastQueryTime:   time.Now(),
	}
}

// Migration helpers
func IsTableExists(db *gorm.DB, tableName string) bool {
	var count int64
	db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = ?", tableName).Scan(&count)
	return count > 0
}

func CreateTableIfNotExists(db *gorm.DB, model interface{}) error {
	return db.AutoMigrate(model)
}

// Backup and restore helpers
func CreateBackup(db *gorm.DB, backupPath string) error {
	// Implementation would depend on specific database backup strategy
	// This is a placeholder for backup functionality
	logger.Log.Info("Creating database backup to: " + backupPath)
	return nil
}

func RestoreBackup(db *gorm.DB, backupPath string) error {
	// Implementation would depend on specific database restore strategy
	// This is a placeholder for restore functionality
	logger.Log.Info("Restoring database from: " + backupPath)
	return nil
}

// Database maintenance
func AnalyzeTables(db *gorm.DB, tables []string) error {
	for _, table := range tables {
		if err := db.Exec("ANALYZE " + table).Error; err != nil {
			logger.Log.Error("Failed to analyze table " + table + ": " + err.Error())
			return err
		}
	}
	return nil
}

func VacuumTables(db *gorm.DB, tables []string) error {
	for _, table := range tables {
		if err := db.Exec("VACUUM " + table).Error; err != nil {
			logger.Log.Error("Failed to vacuum table " + table + ": " + err.Error())
			return err
		}
	}
	return nil
}

// Connection pool monitoring
func MonitorConnectionPool(db *gorm.DB, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			stats := GetStats(db)
			logger.Log.Info(fmt.Sprintf("DB Pool Stats: %+v", stats))
		}
	}()
}