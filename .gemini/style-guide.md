# CotA.i Code Review Style Guide

## TypeScript/React Best Practices

### General Guidelines
- Use TypeScript strict mode
- Prefer functional components over class components
- Use proper type definitions instead of `any`
- Follow React Hooks rules (useEffect dependencies, etc.)
- Use proper error handling and loading states

### Code Organization
- Group related imports together
- Use consistent naming conventions (camelCase for variables, PascalCase for components)
- Prefer named exports over default exports for utilities
- Keep components small and focused on single responsibility

### Performance Considerations
- Use React.memo() for expensive re-renders
- Optimize useEffect dependencies
- Avoid inline object/function creation in render
- Use proper key props in lists
- Consider code splitting for large components

### Security Guidelines
- Validate all user inputs
- Sanitize data before displaying
- Use proper authentication checks
- Avoid exposing sensitive data in client-side code
- Use HTTPS for all API calls

### Next.js Specific
- Use Next.js Image component for optimization
- Implement proper SEO meta tags
- Use proper error boundaries
- Follow Next.js routing conventions
- Optimize bundle size

### Firebase/Firestore
- Use proper security rules
- Optimize database queries
- Handle offline scenarios
- Use proper indexing
- Validate data before writing to database

### Testing
- Write unit tests for utility functions
- Test component behavior, not implementation
- Mock external dependencies
- Test error scenarios
- Maintain good test coverage