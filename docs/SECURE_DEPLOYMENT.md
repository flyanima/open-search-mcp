# Secure Deployment Guide

## 🚀 Production Deployment Security Checklist

This guide provides a comprehensive security checklist and deployment procedures for the Open Search MCP project in production environments.

## 📋 Pre-Deployment Security Checklist

### 1. Code Security ✅

- [ ] All security scans pass (`npm run security:check`)
- [ ] No hardcoded secrets in codebase
- [ ] Input validation implemented for all user inputs
- [ ] Error handling doesn't expose sensitive information
- [ ] Security linting passes (`npm run security:lint`)
- [ ] Dependencies have no high/critical vulnerabilities

### 2. Configuration Security ✅

- [ ] All API keys stored in environment variables
- [ ] Strong secrets generated for all services
- [ ] `.env` files not committed to version control
- [ ] Production configuration reviewed and validated
- [ ] CORS origins restricted to production domains
- [ ] Security headers configured

### 3. Container Security ✅

- [ ] Containers run as non-root user
- [ ] Read-only filesystems enabled where possible
- [ ] Security options applied (`no-new-privileges:true`)
- [ ] Resource limits configured
- [ ] Base images scanned for vulnerabilities
- [ ] Network isolation implemented

### 4. Infrastructure Security ✅

- [ ] TLS certificates valid and properly configured
- [ ] Firewall rules restrict unnecessary access
- [ ] Load balancer security configured
- [ ] Monitoring and alerting operational
- [ ] Backup and recovery procedures tested
- [ ] Log aggregation and security monitoring active

## 🔐 Environment Setup

### 1. Generate Secure Secrets

```bash
# Generate session secret (32 bytes hex)
openssl rand -hex 32

# Generate JWT secret (64 bytes base64)
openssl rand -base64 64

# Generate encryption key (32 bytes hex)
openssl rand -hex 32

# Generate Searx secret (32 bytes hex)
openssl rand -hex 32
```

### 2. Configure Environment Variables

Create production `.env` file:

```bash
# Copy template and fill with real values
cp .env.template .env

# Edit with secure values
nano .env
```

Required production variables:
```bash
# Security
SESSION_SECRET=your_generated_session_secret
JWT_SECRET=your_generated_jwt_secret
ENCRYPTION_KEY=your_generated_encryption_key

# Docker deployment
SEARXNG_SECRET=your_generated_searx_secret
GRAFANA_PASSWORD=your_secure_grafana_password
REDIS_PASSWORD=your_redis_password

# Application
NODE_ENV=production
CORS_ORIGINS=https://yourdomain.com
CSP_ENABLED=true

# API Keys (obtain from respective services)
GOOGLE_API_KEY=your_google_api_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
# ... other API keys
```

### 3. Validate Configuration

```bash
# Run security validation
npm run security:check

# Validate environment
node -e "console.log('Environment check:', process.env.NODE_ENV)"

# Test configuration
npm run config:validate
```

## 🐳 Docker Deployment

### 1. Build and Deploy

```bash
# Build application
npm run build

# Deploy with Docker Compose
docker-compose -f deployment/searx-cluster.yml up -d

# Verify deployment
docker-compose -f deployment/searx-cluster.yml ps
```

### 2. Security Verification

```bash
# Check container security
./scripts/verify-container-security.sh

# Verify network isolation
docker network ls
docker network inspect searx-network

# Check resource limits
docker stats --no-stream
```

### 3. Health Checks

```bash
# Application health
curl -f http://localhost:8080/health

# Prometheus metrics
curl -f http://localhost:9090/metrics

# Grafana dashboard
curl -f http://localhost:3001/api/health
```

## 🔍 Monitoring and Alerting

### 1. Security Monitoring

Configure alerts for:
- Failed authentication attempts
- Rate limit violations
- Container security events
- High error rates
- Unusual network activity
- Resource exhaustion

### 2. Log Monitoring

Monitor logs for:
- Security events
- Error patterns
- Performance issues
- Suspicious activities

```bash
# View security logs
docker logs searx-node-1 | grep -i security

# Monitor error rates
docker logs searx-node-1 | grep -i error | tail -100
```

### 3. Performance Monitoring

Track metrics:
- Response times
- Memory usage
- CPU utilization
- Network traffic
- Database performance

## 🔄 Maintenance Procedures

### 1. Regular Security Tasks

**Daily:**
- Review security logs
- Check system health
- Monitor resource usage

**Weekly:**
- Run security scans
- Review access logs
- Update monitoring dashboards

**Monthly:**
- Update dependencies
- Rotate API keys
- Review security configuration
- Test backup procedures

**Quarterly:**
- Security audit
- Penetration testing
- Disaster recovery testing
- Security training updates

### 2. Automated Maintenance

```bash
# Run automated security maintenance
npm run security:maintenance

# Update dependencies
npm run security:fix

# Generate security report
npm run security:scan
```

### 3. Emergency Procedures

**Security Incident Response:**

1. **Immediate Actions:**
   - Isolate affected systems
   - Preserve evidence
   - Notify security team
   - Document incident

2. **Investigation:**
   - Analyze logs
   - Identify attack vectors
   - Assess damage
   - Collect forensic data

3. **Recovery:**
   - Patch vulnerabilities
   - Restore from backups
   - Update security measures
   - Monitor for reoccurrence

4. **Post-Incident:**
   - Conduct lessons learned
   - Update procedures
   - Improve monitoring
   - Train team members

## 🛡️ Security Best Practices

### 1. Access Control

- Use principle of least privilege
- Implement multi-factor authentication
- Regular access reviews
- Secure key management

### 2. Network Security

- Network segmentation
- Firewall configuration
- VPN for remote access
- Regular security assessments

### 3. Data Protection

- Encryption at rest and in transit
- Secure backup procedures
- Data retention policies
- Privacy compliance

### 4. Incident Response

- Documented procedures
- Regular drills
- Contact information
- Communication plans

## 📞 Security Contacts

**Production Issues:**
- **Security Team**: security@your-domain.com
- **DevOps Team**: devops@your-domain.com
- **On-Call**: +1-XXX-XXX-XXXX

**Emergency Contacts:**
- **Security Incident**: security-incident@your-domain.com
- **System Outage**: ops-emergency@your-domain.com

## 📚 Additional Resources

### Documentation
- [Security Policy](../SECURITY.md)
- [Docker Security](./DOCKER_SECURITY.md)
- [API Documentation](./API_USAGE.md)

### Tools
- [Security Scanner](../scripts/security-scan.js)
- [Maintenance Script](../scripts/security-maintenance.js)
- [Health Check](../scripts/platform-health-check.js)

### External Resources
- [OWASP Security Guidelines](https://owasp.org/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)

---

**Last Updated**: [Current Date]
**Version**: 1.0
**Next Review**: [Date + 1 month]

**Deployment Approval**: ✅ Security Team | ✅ DevOps Team | ✅ Project Lead
