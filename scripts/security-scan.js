#!/usr/bin/env node

/**
 * Security Scanning Script
 * 
 * Performs comprehensive security scanning including:
 * - Dependency vulnerability scanning
 * - Code security analysis
 * - Configuration security checks
 * - Docker image scanning
 * - API key validation
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * Security scan results
 */
class SecurityScanResults {
  constructor() {
    this.results = {
      dependencies: { status: 'pending', vulnerabilities: [], summary: '' },
      codeAnalysis: { status: 'pending', issues: [], summary: '' },
      configuration: { status: 'pending', issues: [], summary: '' },
      docker: { status: 'pending', vulnerabilities: [], summary: '' },
      apiKeys: { status: 'pending', issues: [], summary: '' },
      overall: { status: 'pending', score: 0, recommendations: [] }
    };
  }

  updateResult(category, status, data = {}) {
    this.results[category] = { status, ...data };
  }

  generateReport() {
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      projectName: 'open-search-mcp',
      version: this.getProjectVersion(),
      results: this.results,
      summary: this.generateSummary()
    };

    return report;
  }

  getProjectVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  generateSummary() {
    const categories = Object.keys(this.results).filter(key => key !== 'overall');
    const passed = categories.filter(cat => this.results[cat].status === 'passed').length;
    const failed = categories.filter(cat => this.results[cat].status === 'failed').length;
    const warnings = categories.filter(cat => this.results[cat].status === 'warning').length;

    return {
      totalChecks: categories.length,
      passed,
      failed,
      warnings,
      overallStatus: failed > 0 ? 'failed' : warnings > 0 ? 'warning' : 'passed'
    };
  }
}

/**
 * Security Scanner Class
 */
class SecurityScanner {
  constructor() {
    this.results = new SecurityScanResults();
    this.verbose = process.argv.includes('--verbose');
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCommand(command, options = {}) {
    try {
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
   * Scan dependencies for vulnerabilities
   */
  async scanDependencies() {
    this.log('Scanning dependencies for vulnerabilities...');

    try {
      // Run npm audit
      const auditResult = await this.runCommand('npm audit --json');
      
      if (auditResult.success) {
        const auditData = JSON.parse(auditResult.output);
        const vulnerabilities = auditData.vulnerabilities || {};
        const vulnCount = Object.keys(vulnerabilities).length;

        if (vulnCount === 0) {
          this.results.updateResult('dependencies', 'passed', {
            vulnerabilities: [],
            summary: 'No vulnerabilities found in dependencies'
          });
          this.log('Dependencies scan: PASSED', 'success');
        } else {
          const highSeverity = Object.values(vulnerabilities).filter(v => v.severity === 'high' || v.severity === 'critical').length;
          
          this.results.updateResult('dependencies', highSeverity > 0 ? 'failed' : 'warning', {
            vulnerabilities: Object.entries(vulnerabilities).map(([name, data]) => ({
              name,
              severity: data.severity,
              via: data.via
            })),
            summary: `Found ${vulnCount} vulnerabilities (${highSeverity} high/critical)`
          });
          
          this.log(`Dependencies scan: ${highSeverity > 0 ? 'FAILED' : 'WARNING'} - ${vulnCount} vulnerabilities`, highSeverity > 0 ? 'error' : 'warning');
        }
      } else {
        this.results.updateResult('dependencies', 'failed', {
          vulnerabilities: [],
          summary: 'Failed to run dependency scan'
        });
        this.log('Dependencies scan: FAILED - Could not run npm audit', 'error');
      }
    } catch (error) {
      this.results.updateResult('dependencies', 'failed', {
        vulnerabilities: [],
        summary: `Scan error: ${error.message}`
      });
      this.log(`Dependencies scan: ERROR - ${error.message}`, 'error');
    }
  }

  /**
   * Analyze code for security issues
   */
  async analyzeCode() {
    this.log('Analyzing code for security issues...');

    const issues = [];

    try {
      // Check for hardcoded secrets
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/gi,
        /password\s*[:=]\s*['"][^'"]{4,}['"]/gi,
        /secret\s*[:=]\s*['"][^'"]{8,}['"]/gi,
        /token\s*[:=]\s*['"][^'"]{16,}['"]/gi,
      ];

      const codeFiles = this.getCodeFiles();
      
      for (const file of codeFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        for (const pattern of secretPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            issues.push({
              file: path.relative(projectRoot, file),
              type: 'hardcoded-secret',
              severity: 'high',
              matches: matches.length
            });
          }
        }

        // Check for dangerous functions
        const dangerousFunctions = [
          /eval\s*\(/g,
          /Function\s*\(/g,
          /setTimeout\s*\(\s*['"][^'"]*['"]/g,
          /setInterval\s*\(\s*['"][^'"]*['"]/g,
        ];

        for (const pattern of dangerousFunctions) {
          const matches = content.match(pattern);
          if (matches) {
            issues.push({
              file: path.relative(projectRoot, file),
              type: 'dangerous-function',
              severity: 'medium',
              matches: matches.length
            });
          }
        }
      }

      const highIssues = issues.filter(i => i.severity === 'high').length;
      const status = highIssues > 0 ? 'failed' : issues.length > 0 ? 'warning' : 'passed';

      this.results.updateResult('codeAnalysis', status, {
        issues,
        summary: `Found ${issues.length} code security issues (${highIssues} high severity)`
      });

      this.log(`Code analysis: ${status.toUpperCase()} - ${issues.length} issues found`, 
        status === 'failed' ? 'error' : status === 'warning' ? 'warning' : 'success');

    } catch (error) {
      this.results.updateResult('codeAnalysis', 'failed', {
        issues: [],
        summary: `Analysis error: ${error.message}`
      });
      this.log(`Code analysis: ERROR - ${error.message}`, 'error');
    }
  }

  /**
   * Check configuration security
   */
  async checkConfiguration() {
    this.log('Checking configuration security...');

    const issues = [];

    try {
      // Check .env files
      const envFiles = ['.env', '.env.local', '.env.production'];
      for (const envFile of envFiles) {
        const envPath = path.join(projectRoot, envFile);
        if (fs.existsSync(envPath)) {
          issues.push({
            file: envFile,
            type: 'env-file-exists',
            severity: 'high',
            message: 'Environment file should not be committed to version control'
          });
        }
      }

      // Check for default passwords in config files
      const configFiles = this.getConfigFiles();
      for (const file of configFiles) {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('admin') && content.includes('password')) {
          issues.push({
            file: path.relative(projectRoot, file),
            type: 'default-password',
            severity: 'high',
            message: 'Potential default password found'
          });
        }

        if (content.includes('your_') && content.includes('_here')) {
          issues.push({
            file: path.relative(projectRoot, file),
            type: 'placeholder-config',
            severity: 'medium',
            message: 'Placeholder configuration values found'
          });
        }
      }

      const highIssues = issues.filter(i => i.severity === 'high').length;
      const status = highIssues > 0 ? 'failed' : issues.length > 0 ? 'warning' : 'passed';

      this.results.updateResult('configuration', status, {
        issues,
        summary: `Found ${issues.length} configuration issues (${highIssues} high severity)`
      });

      this.log(`Configuration check: ${status.toUpperCase()} - ${issues.length} issues found`,
        status === 'failed' ? 'error' : status === 'warning' ? 'warning' : 'success');

    } catch (error) {
      this.results.updateResult('configuration', 'failed', {
        issues: [],
        summary: `Configuration check error: ${error.message}`
      });
      this.log(`Configuration check: ERROR - ${error.message}`, 'error');
    }
  }

  /**
   * Scan Docker images for vulnerabilities
   */
  async scanDocker() {
    this.log('Scanning Docker images...');

    try {
      // Check if Docker is available
      const dockerCheck = await this.runCommand('docker --version');
      if (!dockerCheck.success) {
        this.results.updateResult('docker', 'warning', {
          vulnerabilities: [],
          summary: 'Docker not available for scanning'
        });
        this.log('Docker scan: SKIPPED - Docker not available', 'warning');
        return;
      }

      // Scan base images used in docker-compose
      const images = ['searxng/searxng:latest', 'nginx:alpine', 'redis:7-alpine', 'prom/prometheus:latest'];
      const vulnerabilities = [];

      for (const image of images) {
        this.log(`Scanning Docker image: ${image}`);
        
        // Try to use docker scout if available
        const scoutResult = await this.runCommand(`docker scout cves ${image} --format json`);
        if (scoutResult.success) {
          try {
            const scoutData = JSON.parse(scoutResult.output);
            if (scoutData.vulnerabilities) {
              vulnerabilities.push({
                image,
                vulnerabilities: scoutData.vulnerabilities.length,
                critical: scoutData.vulnerabilities.filter(v => v.severity === 'critical').length
              });
            }
          } catch {
            // Scout output might not be JSON, continue
          }
        }
      }

      const criticalVulns = vulnerabilities.reduce((sum, img) => sum + (img.critical || 0), 0);
      const status = criticalVulns > 0 ? 'failed' : vulnerabilities.length > 0 ? 'warning' : 'passed';

      this.results.updateResult('docker', status, {
        vulnerabilities,
        summary: `Scanned ${images.length} images, found ${criticalVulns} critical vulnerabilities`
      });

      this.log(`Docker scan: ${status.toUpperCase()} - ${criticalVulns} critical vulnerabilities`,
        status === 'failed' ? 'error' : status === 'warning' ? 'warning' : 'success');

    } catch (error) {
      this.results.updateResult('docker', 'failed', {
        vulnerabilities: [],
        summary: `Docker scan error: ${error.message}`
      });
      this.log(`Docker scan: ERROR - ${error.message}`, 'error');
    }
  }

  /**
   * Validate API key configuration
   */
  async validateApiKeys() {
    this.log('Validating API key configuration...');

    try {
      // Import API key manager
      const { apiKeyManager } = await import('../src/config/api-key-manager.js');
      const validations = apiKeyManager.validateAllKeys();
      
      const issues = validations.filter(v => !v.isValid || v.isTestKey);
      const testKeys = validations.filter(v => v.isTestKey).length;
      const missingKeys = validations.filter(v => !v.isValid && v.source === 'missing').length;

      const status = testKeys > 0 ? 'warning' : missingKeys > 0 ? 'warning' : 'passed';

      this.results.updateResult('apiKeys', status, {
        issues: issues.map(i => ({
          keyName: i.keyName,
          issue: i.isTestKey ? 'test-key' : 'missing-key',
          severity: i.isTestKey ? 'medium' : 'low'
        })),
        summary: `${testKeys} test keys, ${missingKeys} missing keys out of ${validations.length} total`
      });

      this.log(`API keys validation: ${status.toUpperCase()} - ${issues.length} issues found`,
        status === 'failed' ? 'error' : status === 'warning' ? 'warning' : 'success');

    } catch (error) {
      this.results.updateResult('apiKeys', 'failed', {
        issues: [],
        summary: `API key validation error: ${error.message}`
      });
      this.log(`API keys validation: ERROR - ${error.message}`, 'error');
    }
  }

  /**
   * Get all code files for analysis
   */
  getCodeFiles() {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx'];
    
    const scanDir = (dir) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDir(fullPath);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };

    scanDir(path.join(projectRoot, 'src'));
    return files;
  }

  /**
   * Get all configuration files
   */
  getConfigFiles() {
    const files = [];
    const configDirs = ['config', 'deployment'];
    const extensions = ['.json', '.yml', '.yaml', '.env', '.conf'];

    for (const dir of configDirs) {
      const dirPath = path.join(projectRoot, dir);
      if (fs.existsSync(dirPath)) {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const fullPath = path.join(dirPath, item);
          if (fs.statSync(fullPath).isFile() && extensions.some(ext => item.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    }

    return files;
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const results = this.results.results;

    // Dependency recommendations
    if (results.dependencies.status === 'failed') {
      recommendations.push({
        category: 'dependencies',
        priority: 'high',
        action: 'Run `npm audit fix` to automatically fix vulnerabilities',
        description: 'Critical vulnerabilities found in dependencies'
      });
    }

    // Code analysis recommendations
    if (results.codeAnalysis.status === 'failed') {
      recommendations.push({
        category: 'code',
        priority: 'high',
        action: 'Remove hardcoded secrets and use environment variables',
        description: 'Hardcoded secrets detected in source code'
      });
    }

    // Configuration recommendations
    if (results.configuration.status === 'failed') {
      recommendations.push({
        category: 'configuration',
        priority: 'high',
        action: 'Remove .env files from version control and use .env.template',
        description: 'Environment files should not be committed'
      });
    }

    // Docker recommendations
    if (results.docker.status === 'failed') {
      recommendations.push({
        category: 'docker',
        priority: 'medium',
        action: 'Update Docker images to latest versions',
        description: 'Critical vulnerabilities found in Docker images'
      });
    }

    // API key recommendations
    if (results.apiKeys.status === 'warning') {
      recommendations.push({
        category: 'api-keys',
        priority: 'medium',
        action: 'Replace test/placeholder API keys with real ones',
        description: 'Test API keys detected in configuration'
      });
    }

    return recommendations;
  }

  /**
   * Run complete security scan
   */
  async runScan() {
    this.log('🔒 Starting comprehensive security scan...');

    const startTime = Date.now();

    await this.scanDependencies();
    await this.analyzeCode();
    await this.checkConfiguration();
    await this.scanDocker();
    await this.validateApiKeys();

    const duration = Date.now() - startTime;
    const recommendations = this.generateRecommendations();

    // Update overall results with recommendations
    this.results.updateResult('overall', this.results.generateSummary().overallStatus, {
      score: this.calculateSecurityScore(),
      recommendations
    });

    const report = this.results.generateReport();

    // Save report
    const reportPath = path.join(projectRoot, 'security-scan-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.log(`🔒 Security scan completed in ${duration}ms`);
    this.log(`📊 Report saved to: ${reportPath}`);

    // Print summary
    const summary = report.summary;
    this.log(`📈 Summary: ${summary.passed} passed, ${summary.warnings} warnings, ${summary.failed} failed`);
    this.log(`🎯 Security Score: ${report.results.overall.score}/100`);

    // Print recommendations
    if (recommendations.length > 0) {
      this.log('📋 Security Recommendations:');
      recommendations.forEach((rec, index) => {
        this.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.action}`);
      });
    }

    if (summary.overallStatus === 'failed') {
      this.log('❌ Overall status: FAILED - Critical security issues found', 'error');
      process.exit(1);
    } else if (summary.overallStatus === 'warning') {
      this.log('⚠️ Overall status: WARNING - Security issues need attention', 'warning');
    } else {
      this.log('✅ Overall status: PASSED - No critical security issues', 'success');
    }

    return report;
  }

  /**
   * Calculate overall security score
   */
  calculateSecurityScore() {
    const results = this.results.results;
    const categories = ['dependencies', 'codeAnalysis', 'configuration', 'docker', 'apiKeys'];

    let score = 0;
    const weights = {
      dependencies: 25,
      codeAnalysis: 25,
      configuration: 20,
      docker: 15,
      apiKeys: 15
    };

    for (const category of categories) {
      const result = results[category];
      let categoryScore = 0;

      if (result.status === 'passed') {
        categoryScore = 100;
      } else if (result.status === 'warning') {
        categoryScore = 60;
      } else if (result.status === 'failed') {
        categoryScore = 0;
      }

      score += (categoryScore * weights[category]) / 100;
    }

    return Math.round(score);
  }
}

// Run scan if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scanner = new SecurityScanner();
  scanner.runScan().catch(error => {
    console.error('❌ Security scan failed:', error);
    process.exit(1);
  });
}

export { SecurityScanner };
