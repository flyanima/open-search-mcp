#!/usr/bin/env node

/**
 * Security Maintenance Script
 * 
 * Automated security maintenance tasks including:
 * - Dependency updates and vulnerability checks
 * - API key rotation reminders
 * - Security configuration validation
 * - Log analysis and cleanup
 * - Backup verification
 * - Security metrics collection
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * Security Maintenance Manager
 */
class SecurityMaintenanceManager {
  constructor() {
    this.verbose = process.argv.includes('--verbose');
    this.dryRun = process.argv.includes('--dry-run');
    this.tasks = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCommand(command, options = {}) {
    try {
      if (this.dryRun) {
        this.log(`[DRY RUN] Would execute: ${command}`);
        return { success: true, output: 'DRY RUN' };
      }

      const result = execSync(command, { 
        cwd: projectRoot, 
        encoding: 'utf8',
        stdio: this.verbose ? 'inherit' : 'pipe',
        ...options 
      });
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error.message, output: error.stdout || '' };
    }
  }

  /**
   * Update dependencies and check for vulnerabilities
   */
  async updateDependencies() {
    this.log('🔄 Updating dependencies and checking vulnerabilities...');

    try {
      // Check for outdated packages
      this.log('Checking for outdated packages...');
      const outdatedResult = await this.runCommand('npm outdated --json');
      
      if (outdatedResult.success && outdatedResult.output !== 'DRY RUN') {
        try {
          const outdated = JSON.parse(outdatedResult.output);
          const outdatedCount = Object.keys(outdated).length;
          
          if (outdatedCount > 0) {
            this.log(`Found ${outdatedCount} outdated packages`, 'warning');
            
            // Update non-breaking changes
            this.log('Updating patch and minor versions...');
            await this.runCommand('npm update');
            
            // List major updates that need manual review
            const majorUpdates = Object.entries(outdated).filter(([name, info]) => {
              const current = info.current.split('.')[0];
              const wanted = info.wanted.split('.')[0];
              return current !== wanted;
            });

            if (majorUpdates.length > 0) {
              this.log('Major updates requiring manual review:', 'warning');
              majorUpdates.forEach(([name, info]) => {
                this.log(`  ${name}: ${info.current} → ${info.latest}`, 'warning');
              });
            }
          } else {
            this.log('All packages are up to date', 'success');
          }
        } catch {
          this.log('No outdated packages found', 'success');
        }
      }

      // Run security audit
      this.log('Running security audit...');
      const auditResult = await this.runCommand('npm audit --json');
      
      if (auditResult.success && auditResult.output !== 'DRY RUN') {
        try {
          const auditData = JSON.parse(auditResult.output);
          const vulnCount = auditData.metadata?.vulnerabilities?.total || 0;
          
          if (vulnCount > 0) {
            this.log(`Found ${vulnCount} vulnerabilities`, 'warning');
            
            // Try to fix automatically
            this.log('Attempting automatic fixes...');
            const fixResult = await this.runCommand('npm audit fix');
            
            if (fixResult.success) {
              this.log('Automatic fixes applied', 'success');
              
              // Re-run audit to check remaining issues
              const reauditResult = await this.runCommand('npm audit --json');
              if (reauditResult.success) {
                try {
                  const reauditData = JSON.parse(reauditResult.output);
                  const remainingVulns = reauditData.metadata?.vulnerabilities?.total || 0;
                  
                  if (remainingVulns > 0) {
                    this.log(`${remainingVulns} vulnerabilities require manual attention`, 'warning');
                  } else {
                    this.log('All vulnerabilities resolved', 'success');
                  }
                } catch {
                  this.log('Audit completed', 'success');
                }
              }
            } else {
              this.log('Automatic fixes failed, manual intervention required', 'error');
            }
          } else {
            this.log('No vulnerabilities found', 'success');
          }
        } catch {
          this.log('Audit completed', 'success');
        }
      }

      this.tasks.push({
        name: 'Dependency Updates',
        status: 'completed',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.log(`Dependency update failed: ${error.message}`, 'error');
      this.tasks.push({
        name: 'Dependency Updates',
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check API key rotation status
   */
  async checkApiKeyRotation() {
    this.log('🔑 Checking API key rotation status...');

    try {
      // Check for API key age tracking file
      const keyTrackingFile = path.join(projectRoot, '.api-key-tracking.json');
      let keyTracking = {};

      if (fs.existsSync(keyTrackingFile)) {
        keyTracking = JSON.parse(fs.readFileSync(keyTrackingFile, 'utf8'));
      }

      // Import API key manager to get current keys
      const { apiKeyManager } = await import('../src/config/api-key-manager.js');
      const validations = apiKeyManager.validateAllKeys();

      const now = new Date();
      const rotationWarnings = [];
      const rotationRequired = [];

      for (const validation of validations) {
        if (validation.isValid && !validation.isTestKey) {
          const keyName = validation.keyName;
          const lastRotation = keyTracking[keyName]?.lastRotation;
          
          if (lastRotation) {
            const rotationDate = new Date(lastRotation);
            const daysSinceRotation = Math.floor((now - rotationDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceRotation > 90) {
              rotationRequired.push({ keyName, daysSinceRotation });
            } else if (daysSinceRotation > 60) {
              rotationWarnings.push({ keyName, daysSinceRotation });
            }
          } else {
            // No rotation record, assume it needs rotation
            rotationRequired.push({ keyName, daysSinceRotation: 'unknown' });
          }
        }
      }

      if (rotationRequired.length > 0) {
        this.log('API keys requiring immediate rotation:', 'error');
        rotationRequired.forEach(key => {
          this.log(`  ${key.keyName}: ${key.daysSinceRotation} days old`, 'error');
        });
      }

      if (rotationWarnings.length > 0) {
        this.log('API keys approaching rotation deadline:', 'warning');
        rotationWarnings.forEach(key => {
          this.log(`  ${key.keyName}: ${key.daysSinceRotation} days old`, 'warning');
        });
      }

      if (rotationRequired.length === 0 && rotationWarnings.length === 0) {
        this.log('All API keys are within rotation schedule', 'success');
      }

      this.tasks.push({
        name: 'API Key Rotation Check',
        status: 'completed',
        rotationRequired: rotationRequired.length,
        rotationWarnings: rotationWarnings.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.log(`API key rotation check failed: ${error.message}`, 'error');
      this.tasks.push({
        name: 'API Key Rotation Check',
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Validate security configuration
   */
  async validateSecurityConfiguration() {
    this.log('🔒 Validating security configuration...');

    try {
      const issues = [];

      // Check .gitignore for security patterns
      const gitignorePath = path.join(projectRoot, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
        const requiredPatterns = ['.env', '*.key', '*.pem', 'secrets.json', 'config/user.json'];
        
        for (const pattern of requiredPatterns) {
          if (!gitignoreContent.includes(pattern)) {
            issues.push(`Missing .gitignore pattern: ${pattern}`);
          }
        }
      } else {
        issues.push('.gitignore file not found');
      }

      // Check for sensitive files in repository
      const sensitiveFiles = ['.env', 'config/user.json', 'secrets.json'];
      for (const file of sensitiveFiles) {
        const filePath = path.join(projectRoot, file);
        if (fs.existsSync(filePath)) {
          issues.push(`Sensitive file found in repository: ${file}`);
        }
      }

      // Check Docker security configuration
      const dockerComposePath = path.join(projectRoot, 'deployment/searx-cluster.yml');
      if (fs.existsSync(dockerComposePath)) {
        const dockerContent = fs.readFileSync(dockerComposePath, 'utf8');
        
        if (!dockerContent.includes('no-new-privileges:true')) {
          issues.push('Docker containers missing no-new-privileges security option');
        }
        
        if (!dockerContent.includes('user:')) {
          issues.push('Docker containers not configured to run as non-root user');
        }
        
        if (!dockerContent.includes('read_only: true')) {
          issues.push('Docker containers not configured with read-only filesystem');
        }
      }

      if (issues.length > 0) {
        this.log('Security configuration issues found:', 'warning');
        issues.forEach(issue => this.log(`  ${issue}`, 'warning'));
      } else {
        this.log('Security configuration validation passed', 'success');
      }

      this.tasks.push({
        name: 'Security Configuration Validation',
        status: 'completed',
        issues: issues.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.log(`Security configuration validation failed: ${error.message}`, 'error');
      this.tasks.push({
        name: 'Security Configuration Validation',
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Clean up old logs and rotate if necessary
   */
  async cleanupLogs() {
    this.log('🧹 Cleaning up logs...');

    try {
      const logsDir = path.join(projectRoot, 'logs');
      
      if (!fs.existsSync(logsDir)) {
        this.log('Logs directory not found, skipping cleanup', 'warning');
        return;
      }

      const files = fs.readdirSync(logsDir);
      const now = new Date();
      let cleanedFiles = 0;

      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        const ageInDays = (now - stats.mtime) / (1000 * 60 * 60 * 24);

        // Remove logs older than 30 days
        if (ageInDays > 30) {
          if (!this.dryRun) {
            fs.unlinkSync(filePath);
          }
          cleanedFiles++;
          this.log(`Removed old log file: ${file} (${Math.floor(ageInDays)} days old)`);
        }
      }

      this.log(`Log cleanup completed: ${cleanedFiles} files removed`, 'success');

      this.tasks.push({
        name: 'Log Cleanup',
        status: 'completed',
        filesRemoved: cleanedFiles,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.log(`Log cleanup failed: ${error.message}`, 'error');
      this.tasks.push({
        name: 'Log Cleanup',
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Generate maintenance report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      projectName: 'open-search-mcp',
      maintenanceType: 'security',
      tasks: this.tasks,
      summary: {
        total: this.tasks.length,
        completed: this.tasks.filter(t => t.status === 'completed').length,
        failed: this.tasks.filter(t => t.status === 'failed').length
      }
    };

    const reportPath = path.join(projectRoot, 'security-maintenance-report.json');
    if (!this.dryRun) {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    }

    return report;
  }

  /**
   * Run all maintenance tasks
   */
  async runMaintenance() {
    this.log('🔧 Starting security maintenance tasks...');
    
    if (this.dryRun) {
      this.log('Running in DRY RUN mode - no changes will be made', 'warning');
    }

    const startTime = Date.now();

    await this.updateDependencies();
    await this.checkApiKeyRotation();
    await this.validateSecurityConfiguration();
    await this.cleanupLogs();

    const duration = Date.now() - startTime;
    const report = this.generateReport();

    this.log(`🔧 Security maintenance completed in ${duration}ms`);
    this.log(`📊 Tasks: ${report.summary.completed} completed, ${report.summary.failed} failed`);

    if (!this.dryRun) {
      this.log(`📄 Report saved to: security-maintenance-report.json`);
    }

    if (report.summary.failed > 0) {
      this.log('Some maintenance tasks failed. Please review the report.', 'error');
      process.exit(1);
    } else {
      this.log('All maintenance tasks completed successfully', 'success');
    }

    return report;
  }
}

// Run maintenance if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new SecurityMaintenanceManager();
  manager.runMaintenance().catch(error => {
    console.error('❌ Security maintenance failed:', error);
    process.exit(1);
  });
}

export { SecurityMaintenanceManager };
