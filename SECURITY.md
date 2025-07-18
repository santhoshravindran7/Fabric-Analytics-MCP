# Security Policy

## Reporting Security Vulnerabilities

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do NOT create a public GitHub issue for security vulnerabilities.**

Instead, please report security issues by:

1. **GitHub Security Advisory** (Preferred)
   - Go to the repository's Security tab
   - Click "Report a vulnerability"
   - Provide detailed information about the vulnerability

2. **Email** (Alternative)
   - Send details to: [santhosh.ravindran@microsoft.com]
   - Include steps to reproduce the vulnerability
   - Provide any proof-of-concept code if applicable

### What to Include

When reporting a security vulnerability, please include:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** assessment
- **Suggested fix** (if you have one)
- **Your contact information** for follow-up

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Development**: Timeline depends on severity
- **Public Disclosure**: After fix is available

## Security Best Practices

### For Users

- **Never commit authentication tokens** to version control
- **Use environment variables** for sensitive configuration
- **Regularly rotate** your Microsoft Fabric tokens
- **Follow principle of least privilege** for API access
- **Keep dependencies updated** to latest secure versions

### For Contributors

- **Review code** for potential security issues
- **Validate all inputs** and sanitize outputs
- **Use secure coding practices** for authentication
- **Never log sensitive information** like tokens
- **Test security-related changes** thoroughly

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | ✅ Yes             |
| < 1.0   | ❌ No              |

## Security Features

This project includes several security features:

- **Input validation** using Zod schemas
- **Token sanitization** in logs and error messages
- **Secure authentication** patterns
- **No hardcoded credentials** in source code
- **Comprehensive .gitignore** for sensitive files

## Dependencies

We regularly monitor and update dependencies for security vulnerabilities using:

- GitHub Dependabot alerts
- npm audit
- Regular security reviews

## Contact

For any security-related questions or concerns, please use the reporting channels mentioned above.

---

**Thank you for helping keep our project secure!**
