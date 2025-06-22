package logger

import (
	"io"
	"log"
	"os"
)

// Logger provides simple logging functionality
type Logger struct {
	debug *log.Logger
	info  *log.Logger
	warn  *log.Logger
	error *log.Logger
}

// Global logger instance
var Log *Logger

// Init initializes the global logger
func Init() {
	Log = NewLogger()
}

// NewLogger creates a new logger instance
func NewLogger() *Logger {
	return &Logger{
		debug: log.New(os.Stdout, "DEBUG: ", log.Ldate|log.Ltime|log.Lshortfile),
		info:  log.New(os.Stdout, "INFO: ", log.Ldate|log.Ltime|log.Lshortfile),
		warn:  log.New(os.Stdout, "WARN: ", log.Ldate|log.Ltime|log.Lshortfile),
		error: log.New(os.Stderr, "ERROR: ", log.Ldate|log.Ltime|log.Lshortfile),
	}
}

// Debug logs a debug message
func (l *Logger) Debug(message string) {
	l.debug.Println(message)
}

// Info logs an info message
func (l *Logger) Info(message string) {
	l.info.Println(message)
}

// Warn logs a warning message
func (l *Logger) Warn(message string) {
	l.warn.Println(message)
}

// Error logs an error message
func (l *Logger) Error(message string) {
	l.error.Println(message)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(message string) {
	l.error.Println(message)
	os.Exit(1)
}

// GetWriter returns the writer for a specific log level
func GetWriter() io.Writer {
	return os.Stdout
}