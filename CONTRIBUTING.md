# Contributing to Microsoft Fabric Analytics MCP Server

First off, thank you for considering contributing to this project! 🎉

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed and what behavior you expected**
- **Include screenshots or logs if helpful**
- **Specify your environment** (OS, Node.js version, etc.)

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and expected behavior**
- **Explain why this enhancement would be useful**

### 🚀 Pull Requests

Good pull requests (patches, improvements, new features) are a fantastic help. They should remain focused in scope and avoid containing unrelated commits.

**Please ask first** before embarking on any significant pull request (e.g., implementing features, refactoring code), otherwise you risk spending a lot of time working on something that the project's developers might not want to merge into the project.

## Development Setup

1. **Fork and clone the repo**
   ```bash
   git clone https://github.com/santhoshravindran7/Fabric-Analytics-MCP.git
   cd microsoft-fabric-analytics-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests** (if available)
   ```bash
   npm test
   ```

## Development Guidelines

### Code Style

- **TypeScript**: Use TypeScript for all new code
- **Formatting**: Run `npm run format` before committing
- **Linting**: Ensure `npm run lint` passes
- **Comments**: Add JSDoc comments for public APIs

### Commit Messages

Use clear and meaningful commit messages:

```
feat: add new Spark monitoring dashboard
fix: resolve session timeout issue
docs: update API documentation
refactor: improve error handling
test: add unit tests for Livy API
```

### Branch Naming

Use descriptive branch names:
- `feature/add-spark-monitoring`
- `fix/session-timeout`
- `docs/update-readme`
- `refactor/improve-error-handling`

## Project Structure

```
├── src/
│   ├── index.ts              # Main MCP server
│   └── fabric-client.ts      # Microsoft Fabric API client
├── tests/                    # Test files
├── build/                    # Compiled JavaScript
├── docs/                     # Documentation
└── examples/                 # Example scripts
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/specific-test.ts

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- Add tests for new functionality
- Update existing tests when modifying behavior
- Ensure tests pass before submitting PR
- Mock external API calls in tests

### Integration Testing

For testing with real Microsoft Fabric APIs:

1. **Never commit real tokens** to the repository
2. **Use environment variables** for test configuration
3. **Document test setup** in your PR description
4. **Include test results** in your PR if applicable

## Documentation

- **Update README.md** for new features
- **Add JSDoc comments** for new functions/classes
- **Update API documentation** for new endpoints
- **Include examples** for new functionality

## Security Considerations

- **Never commit secrets** or tokens
- **Review security implications** of your changes
- **Follow secure coding practices**
- **Report security issues** privately (see SECURITY.md)

## Review Process

1. **Automated checks** must pass (linting, building, etc.)
2. **Manual review** by maintainers
3. **Testing** of new functionality
4. **Documentation** review
5. **Merge** once approved

## Recognition

Contributors will be recognized in:
- **README.md** contributors section
- **Release notes** for significant contributions
- **GitHub contributors** page

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check existing docs first

## Types of Contributions We're Looking For

- 🐛 **Bug fixes**
- ✨ **New MCP tools** for Microsoft Fabric
- 📚 **Documentation improvements**
- 🧪 **Test coverage** improvements
- 🔧 **Performance optimizations**
- 🎨 **UI/UX improvements** for Claude Desktop integration
- 🌐 **Internationalization** support
- 📦 **Packaging and distribution** improvements

## What We're NOT Looking For

- **Breaking changes** without discussion
- **Large refactors** without approval
- **Unrelated feature creep**
- **Code that doesn't follow project conventions**

---

Thank you for contributing! 🚀

*This contributing guide is inspired by open source best practices and tailored for this MCP server project.*
