# Docker Security Configuration

## 🔒 Security Overview

This document outlines the security configurations and best practices implemented in the Open Search MCP Docker deployment to ensure a secure containerized environment.

## 🛡️ Container Security Features

### 1. Non-Root User Execution

All containers run as non-root user (UID 1000) to minimize privilege escalation risks:

```yaml
user: "1000:1000"
```

### 2. Read-Only Filesystem

Containers use read-only filesystems where possible:

```yaml
read_only: true
tmpfs:
  - /tmp:noexec,nosuid,size=100m
  - /var/run:noexec,nosuid,size=100m
```

### 3. Security Options

Enhanced security options are applied to all containers:

```yaml
security_opt:
  - no-new-privileges:true
```

### 4. Resource Limits

Memory and CPU limits prevent resource exhaustion attacks:

```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
    reservations:
      memory: 256M
      cpus: '0.25'
```

## 🔐 Secrets Management

### Environment Variables

All sensitive data is managed through environment variables with validation:

```yaml
environment:
  - SEARXNG_SECRET=${SEARXNG_SECRET:?SEARXNG_SECRET is required}
  - GRAFANA_PASSWORD=${GRAFANA_PASSWORD:?GRAFANA_PASSWORD is required}
  - REDIS_PASSWORD=${REDIS_PASSWORD:-}
```

### Secret Generation

Generate secure secrets using OpenSSL:

```bash
# Generate session secret (32 bytes hex)
openssl rand -hex 32

# Generate JWT secret (64 bytes base64)
openssl rand -base64 64

# Generate encryption key (32 bytes hex)
openssl rand -hex 32
```

## 🌐 Network Security

### Isolated Networks

Services communicate over isolated Docker networks:

```yaml
networks:
  searx-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### Port Exposure

Only necessary ports are exposed to the host:

```yaml
ports:
  - "8080:80"    # Load balancer only
  - "9090:9090"  # Prometheus (internal monitoring)
  - "3001:3000"  # Grafana (internal monitoring)
```

### Internal Communication

Services communicate internally without exposing ports:

```yaml
# Redis master - no external ports
redis-master:
  # ... no ports section
  networks:
    - searx-network
```

## 🔍 Monitoring and Logging

### Health Checks

All services include health checks for monitoring:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/stats"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Security Logging

Security events are logged for monitoring:

- Container start/stop events
- Health check failures
- Network access attempts
- Resource limit violations

### Log Security

Logs are configured to avoid sensitive data exposure:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
    labels: "service,version"
```

## 🚨 Security Monitoring

### Prometheus Metrics

Security-related metrics are collected:

- Container resource usage
- Network connection counts
- Failed health checks
- Error rates

### Grafana Dashboards

Security dashboards monitor:

- System resource usage
- Container security events
- Network traffic patterns
- Error and failure rates

### Alerting Rules

Alerts are configured for:

- High resource usage
- Container failures
- Network anomalies
- Security violations

## 🔧 Security Configuration Checklist

### Pre-Deployment

- [ ] All secrets are generated and stored securely
- [ ] Environment variables are configured
- [ ] Network configuration is reviewed
- [ ] Resource limits are set appropriately
- [ ] Health checks are configured
- [ ] Logging is configured securely

### Post-Deployment

- [ ] Container security options are verified
- [ ] Network isolation is confirmed
- [ ] Health checks are functioning
- [ ] Monitoring is operational
- [ ] Logs are being collected
- [ ] Alerts are configured

### Regular Maintenance

- [ ] Secrets are rotated quarterly
- [ ] Container images are updated monthly
- [ ] Security logs are reviewed weekly
- [ ] Resource usage is monitored
- [ ] Backup procedures are tested

## 🛠️ Security Commands

### Container Security Verification

```bash
# Check container user
docker exec searx-node-1 whoami

# Verify read-only filesystem
docker exec searx-node-1 touch /test-file 2>&1 || echo "Read-only confirmed"

# Check security options
docker inspect searx-node-1 | jq '.[0].HostConfig.SecurityOpt'

# Verify resource limits
docker stats --no-stream
```

### Network Security Testing

```bash
# Test network isolation
docker exec searx-node-1 ping searx-node-2

# Check exposed ports
docker port searx-loadbalancer

# Verify internal communication
docker exec searx-node-1 curl -f http://redis-master:6379/ping
```

### Security Scanning

```bash
# Scan container images for vulnerabilities
docker scout cves searxng/searxng:latest

# Check for security updates
docker scout recommendations searxng/searxng:latest

# Audit container configuration
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image searxng/searxng:latest
```

## 🚫 Security Anti-Patterns

### What NOT to Do

- **Never run containers as root** unless absolutely necessary
- **Don't expose unnecessary ports** to the host system
- **Avoid using default passwords** in any configuration
- **Don't store secrets in images** or configuration files
- **Never disable security features** for convenience
- **Don't ignore security warnings** from scanners
- **Avoid overly permissive network** configurations

## 📚 Security Resources

### Documentation

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Container Security Guide](https://kubernetes.io/docs/concepts/security/)
- [OWASP Container Security](https://owasp.org/www-project-container-security/)

### Tools

- **Docker Scout**: Container vulnerability scanning
- **Trivy**: Comprehensive security scanner
- **Falco**: Runtime security monitoring
- **Anchore**: Container security analysis

## 🔄 Security Updates

This security configuration is reviewed and updated:

- **Monthly**: Security patches and updates
- **Quarterly**: Configuration review and improvements
- **After Incidents**: Updates based on security events
- **Technology Changes**: Updates for new Docker features

## 📞 Security Contacts

For Docker security issues:

- **Security Team**: security@your-domain.com
- **DevOps Team**: devops@your-domain.com
- **Emergency**: Use GitHub Security Advisory

---

**Last Updated**: [Current Date]
**Version**: 1.0
**Next Review**: [Date + 1 month]
