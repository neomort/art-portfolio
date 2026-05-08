# Testing Components with Vite Features in Jest

This document outlines the approach for testing components that use Vite-specific features (like `import.meta`) in a Jest environment.

## The Challenge

Components that use Vite features such as `import.meta.env` don't work out of the box with Jest, as Jest runs in a Node.js environment that doesn't understand these Vite-specific features.

## Solution: Test Wrapper Pattern

We've adopted a test wrapper pattern that allows us to test the behavior of components without directly importing the Vite-dependent components.

### Key Aspects of the Approach

1. **Isolation**: Create test versions of components that mimic the behavior of the real components but don't use Vite-specific features.

2. **Behavioral Testing**: Focus on testing the component's behavior rather than its implementation details.

3. **Dependency Mocking**: Mock all external dependencies to create a controlled test environment.

### Example: PaymentFormWrapper Test

See `src/__tests__/components/payment/PaymentFormWrapper.enhanced.test.tsx` for a complete example.

Key patterns used:

```typescript
// 1. Mock external dependencies
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => <div>{children}</div>,
  // ... other mocks
}));

// 2. Test the component's behavior
describe('Component Behavior', () => {
  it('should handle successful operations', () => {
    // Test the happy path
  });

  it('should handle errors', () => {
    // Test error scenarios
  });
});
```

## When to Use This Approach

Use this pattern when:
- Testing components that use Vite features not supported in Jest
- You need to test component behavior without the complexity of Vite's build process
- You want to keep tests fast and isolated

## Limitations

- The test components are simplified versions and may not catch all implementation-specific issues
- Changes to the actual component's API need to be reflected in the test wrappers

## Future Improvements

Consider migrating to Vitest for a more seamless testing experience with Vite projects. Vitest provides better compatibility with Vite features and a similar API to Jest.

## Running Tests

```bash
# Run all tests
npm test

# Run a specific test file
npm test -- path/to/test/file.test.tsx
```
