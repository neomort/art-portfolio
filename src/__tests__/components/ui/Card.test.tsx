import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../../components/ui/card';

describe('Card Components', () => {
  describe('Card', () => {
    it('renders with default classes and custom className', () => {
      render(<Card className="custom-class" data-testid="card" />);
      const card = screen.getByTestId('card');
      
      expect(card).toHaveClass('rounded-2xl border-2 border-maroon-100 bg-white');
      expect(card).toHaveClass('custom-class');
    });

    it('forwards ref to the div element', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Card ref={ref} data-testid="card" />);
      
      expect(ref.current).toBeInTheDocument();
      expect(ref.current?.tagName).toBe('DIV');
    });
  });

  describe('CardHeader', () => {
    it('renders with default classes and children', () => {
      render(
        <CardHeader data-testid="card-header">
          <div>Test Header</div>
        </CardHeader>
      );
      
      const header = screen.getByTestId('card-header');
      expect(header).toHaveClass('flex flex-col space-y-1.5 p-6');
      expect(header).toContainHTML('<div>Test Header</div>');
    });
  });

  describe('CardTitle', () => {
    it('renders with default classes and content', () => {
      render(<CardTitle data-testid="card-title">Test Title</CardTitle>);
      
      const title = screen.getByTestId('card-title');
      expect(title).toHaveClass('text-2xl font-bold leading-tight tracking-tight text-maroon-800 font-display');
      expect(title).toHaveTextContent('Test Title');
      expect(title.tagName).toBe('H3');
    });
  });

  describe('CardDescription', () => {
    it('renders with default classes and content', () => {
      render(<CardDescription data-testid="card-desc">Test Description</CardDescription>);
      
      const desc = screen.getByTestId('card-desc');
      expect(desc).toHaveClass('text-sm text-maroon-500');
      expect(desc).toHaveTextContent('Test Description');
    });
  });

  describe('CardContent', () => {
    it('renders with default classes and children', () => {
      render(
        <CardContent data-testid="card-content">
          <div>Test Content</div>
        </CardContent>
      );
      
      const content = screen.getByTestId('card-content');
      expect(content).toHaveClass('p-6 pt-0');
      expect(content).toContainHTML('<div>Test Content</div>');
    });
  });

  describe('CardFooter', () => {
    it('renders with default classes and children', () => {
      render(
        <CardFooter data-testid="card-footer">
          <button>Action</button>
        </CardFooter>
      );
      
      const footer = screen.getByTestId('card-footer');
      expect(footer).toHaveClass('flex items-center p-6 pt-0');
      expect(footer).toContainHTML('<button>Action</button>');
    });
  });

  it('composes all card components together correctly', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle data-testid="title">Card Title</CardTitle>
          <CardDescription data-testid="desc">Card Description</CardDescription>
        </CardHeader>
        <CardContent data-testid="content">
          <p>Card content goes here</p>
        </CardContent>
        <CardFooter data-testid="footer">
          <button>Action</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByTestId('title')).toHaveTextContent('Card Title');
    expect(screen.getByTestId('desc')).toHaveTextContent('Card Description');
    expect(screen.getByTestId('content')).toHaveTextContent('Card content goes here');
    expect(screen.getByTestId('footer')).toContainHTML('<button>Action</button>');
  });
});
