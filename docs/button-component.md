# Button Component Documentation

## Overview

The `Button` component (`components/ui/button.tsx`) provides a consistent and accessible way to create interactive elements throughout the SplitSpace application. This documentation covers all available variants, sizes, and usage guidelines. 

## Variants

### Primary
- **Purpose**: Primary call-to-action buttons
- **Usage**: Use for the most important action on a page
- **Example**: "Make Payment", "Submit Inquiry", "List Your Space"
- **Visual**: Coral background (`#EA6C56`) with white text

```tsx
<Button variant="primary">Primary Action</Button>
```

### Secondary
- **Purpose**: Secondary actions that are still important
- **Usage**: Use for alternative actions when there's a primary action present
- **Example**: "Cancel", "Back", alternative options
- **Visual**: Light grey background with dark text

```tsx
<Button variant="secondary">Secondary Action</Button>
```

### Outline
- **Purpose**: Less prominent actions that still need visibility
- **Usage**: Use for secondary actions that need to be less prominent than primary buttons
- **Example**: "View Details", "Learn More"
- **Visual**: Transparent background with peach border (`#FFD2B3`) and dark text

```tsx
<Button variant="outline">Learn More</Button>
```

### Ghost
- **Purpose**: Minimal, subtle actions
- **Usage**: Use for icon buttons or actions that should be less prominent
- **Example**: Mobile menu toggle, close buttons
- **Visual**: No background or border, text color changes on hover

```tsx
<Button variant="ghost">
  <MenuIcon className="h-6 w-6" />
</Button>
```

### Link
- **Purpose**: Navigation or inline actions
- **Usage**: Use for actions that navigate or open links
- **Example**: "Forgot password?", "Read more"
- **Visual**: Styled as a text link with underline on hover

```tsx
<Button variant="link">View all messages</Button>
```

### Danger
- **Purpose**: Destructive or warning actions
- **Usage**: Use for actions that have destructive consequences
- **Example**: "Delete account", "Cancel subscription"
- **Visual**: Red background with white text

```tsx
<Button variant="danger">Delete</Button>
```

## Sizes

### Small (`sm`)
```tsx
<Button size="sm">Small Button</Button>
```

### Default (medium)
```tsx
<Button>Medium Button</Button>
```

### Large (`lg`)
```tsx
<Button size="lg">Large Button</Button>
```

## States

### Loading State
```tsx
<Button isLoading={true}>Loading...</Button>
```

### Disabled State
```tsx
<Button disabled>Disabled Button</Button>
```

## Best Practices

1. **One Primary Action Per View**
   - Each view should have only one primary button that represents the main action
   - All other actions should use secondary, outline, or ghost variants

2. **Button Text**
   - Use clear, action-oriented text (e.g., "Save Changes" instead of "OK")
   - Keep button text concise (1-3 words)
   - Use sentence case for button labels

3. **Button Placement**
   - Primary actions should be visually prominent and easy to find
   - Place buttons in consistent locations across the application
   - For forms, place the primary action on the right and secondary actions on the left

4. **Accessibility**
   - Always provide meaningful text for screen readers
   - Ensure sufficient color contrast for all states
   - Include proper ARIA attributes when needed

## Visual Reference

For a live demonstration of all button variants and states, visit the Button Gallery debug page at `/debug/buttons` when running the development server.

## Implementation Notes

- The Button component is built on top of Radix UI's primitive
- All standard HTML button attributes are supported
- The component includes proper TypeScript types for all props
- Icons can be added using the `icon` prop or as children

## Troubleshooting

If a button doesn't look correct:
1. Verify you're using the correct variant
2. Check for any conflicting CSS classes
3. Ensure you're importing from `components/ui/button`
4. Check the Button Gallery for reference implementation
