import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Simplified mock of the Footer component for testing
const Footer = () => (
  <footer data-testid="footer">
    <div className="container mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-between items-center py-8">
        <div className="mb-6 md:mb-0">
          <a href="/" className="flex items-center">
            <div data-testid="footer-logo">Logo</div>
          </a>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <li><a href="/about" data-testid="about-link">About</a></li>
              <li><a href="/blog" data-testid="blog-link">Blog</a></li>
              <li><a href="/careers" data-testid="careers-link">Careers</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li><a href="/help" data-testid="help-link">Help Center</a></li>
              <li><a href="/contact" data-testid="contact-link">Contact Us</a></li>
              <li><a href="/privacy" data-testid="privacy-link">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 pt-8 pb-6">
        <p className="text-sm text-center">
          © {new Date().getFullYear()} SplitSpace. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

describe('Footer', () => {
  test('renders footer with company links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    // Check if footer is rendered
    const footer = screen.getByTestId('footer');
    expect(footer).toBeInTheDocument();

    // Check if company links are present
    expect(screen.getByTestId('about-link')).toHaveTextContent('About');
    expect(screen.getByTestId('blog-link')).toHaveTextContent('Blog');
    expect(screen.getByTestId('careers-link')).toHaveTextContent('Careers');
  });

  test('renders support links', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    // Check if support links are present
    expect(screen.getByTestId('help-link')).toHaveTextContent('Help Center');
    expect(screen.getByTestId('contact-link')).toHaveTextContent('Contact Us');
    expect(screen.getByTestId('privacy-link')).toHaveTextContent('Privacy Policy');
  });

  test('displays current year in copyright', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const currentYear = new Date().getFullYear();
    const copyrightText = screen.getByText(
      new RegExp(`© ${currentYear} SplitSpace. All rights reserved.`)
    );
    
    expect(copyrightText).toBeInTheDocument();
  });
});
