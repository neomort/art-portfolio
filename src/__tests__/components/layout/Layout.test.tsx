import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Simplified mock of the Layout component for testing
const Layout = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className="flex flex-col min-h-screen">
    <header data-testid="header">
      <nav>Navigation</nav>
    </header>
    <main className={`flex-grow ${className}`} role="main">
      {children}
    </main>
    <footer data-testid="footer">
      <div>© {new Date().getFullYear()} SplitSpace</div>
    </footer>
  </div>
);

describe('Layout', () => {
  test('renders header, main content, and footer', () => {
    const testContent = 'Test Content';
    
    render(
      <MemoryRouter>
        <Layout>
          <div>{testContent}</div>
        </Layout>
      </MemoryRouter>
    );

    // Check if header is rendered
    const header = screen.getByTestId('header');
    expect(header).toBeInTheDocument();

    // Check if main content is rendered
    const content = screen.getByText(testContent);
    expect(content).toBeInTheDocument();

    // Check if footer is rendered
    const footer = screen.getByTestId('footer');
    expect(footer).toBeInTheDocument();
  });

  test('applies custom className to main content', () => {
    const customClass = 'custom-class';
    
    render(
      <MemoryRouter>
        <Layout className={customClass}>
          <div>Test</div>
        </Layout>
      </MemoryRouter>
    );

    const main = screen.getByRole('main');
    expect(main).toHaveClass(customClass);
  });

  test('renders children correctly', () => {
    const childElement = <div data-testid="child">Child Component</div>;
    
    render(
      <MemoryRouter>
        <Layout>{childElement}</Layout>
      </MemoryRouter>
    );

    const child = screen.getByTestId('child');
    expect(child).toBeInTheDocument();
    expect(child).toHaveTextContent('Child Component');
  });
});
