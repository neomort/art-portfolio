import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { ReceiptText, Archive, X, RefreshCw, Trash2, CreditCard } from 'lucide-react';

const TooltipDebugger: React.FC = () => {
  const [containerStyles, setContainerStyles] = useState<Record<string, string[]>>({});
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Function to check if an element or its parents have overflow properties
  const checkOverflowStyles = (element: HTMLElement | null, path: string[] = []): void => {
    if (!element) return;
    
    const styles = window.getComputedStyle(element);
    const overflow = styles.overflow;
    const overflowX = styles.overflowX;
    const overflowY = styles.overflowY;
    const position = styles.position;
    const zIndex = styles.zIndex;
    
    const elementClass = element.className || 'no-class';
    const elementType = element.tagName.toLowerCase();
    
    const elementPath = `${elementType}${element.id ? `#${element.id}` : ''}${
      typeof elementClass === 'string' ? `.${elementClass.split(' ')[0]}` : ''
    }`;
    
    const newPath = [...path, elementPath];
    
    // Check if any overflow property is not 'visible'
    if (
      overflow !== 'visible' || 
      overflowX !== 'visible' || 
      overflowY !== 'visible' ||
      position === 'relative' ||
      position === 'absolute'
    ) {
      setContainerStyles(prev => ({
        ...prev,
        [newPath.join(' > ')]: [
          `overflow: ${overflow}`,
          `overflow-x: ${overflowX}`,
          `overflow-y: ${overflowY}`,
          `position: ${position}`,
          `z-index: ${zIndex}`
        ]
      }));
    }
    
    // Continue checking parent elements
    if (element.parentElement) {
      checkOverflowStyles(element.parentElement, newPath);
    }
  };

  const handleButtonHover = (buttonId: string) => {
    setHoveredButton(buttonId);
    
    // Find the button element
    const buttonElement = document.getElementById(buttonId);
    if (buttonElement) {
      // Find the tooltip element (next sibling after the icon)
      const tooltipElement = buttonElement.querySelector('.tooltip-test');
      
      // Reset previous styles
      setContainerStyles({});
      
      // Check styles for the tooltip and its parents
      if (tooltipElement) {
        checkOverflowStyles(tooltipElement as HTMLElement);
      }
      
      // no-op: we no longer track selected element id
    }
  };

  const handleButtonLeave = () => {
    setHoveredButton(null);
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Tooltip Debug Test</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-700 mb-4">
              Hover over each button to test its tooltip. The debug info will show which containers might be clipping the tooltip.
            </p>
            
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="inline-block overflow-visible">
                <Button
                  id="test-button-1"
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 relative group z-10"
                  onMouseEnter={() => handleButtonHover('test-button-1')}
                  onMouseLeave={handleButtonLeave}
                >
                  <ReceiptText className="h-5 w-5" />
                  <div className="absolute w-full h-10 bottom-full left-0 z-10"></div>
                  <span className={`tooltip-test absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-50 pointer-events-none ${hoveredButton === 'test-button-1' ? 'opacity-100' : 'opacity-0'}`}>
                    Test Tooltip 1 (Approve booking)
                  </span>
                </Button>
              </div>
              
              <div className="inline-block overflow-visible">
                <Button
                  id="test-button-2"
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 relative group z-10"
                  onMouseEnter={() => handleButtonHover('test-button-2')}
                  onMouseLeave={handleButtonLeave}
                >
                  <Archive className="h-5 w-5" />
                  <div className="absolute w-full h-10 bottom-full left-0 z-10"></div>
                  <span className={`tooltip-test absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-50 pointer-events-none ${hoveredButton === 'test-button-2' ? 'opacity-100' : 'opacity-0'}`}>
                    Test Tooltip 2 (Archive inquiry)
                  </span>
                </Button>
              </div>
              
              <div className="inline-block overflow-visible">
                <Button
                  id="test-button-3"
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 relative group z-10"
                  onMouseEnter={() => handleButtonHover('test-button-3')}
                  onMouseLeave={handleButtonLeave}
                >
                  <X className="h-5 w-5" />
                  <div className="absolute w-full h-10 bottom-full left-0 z-10"></div>
                  <span className={`tooltip-test absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-50 pointer-events-none ${hoveredButton === 'test-button-3' ? 'opacity-100' : 'opacity-0'}`}>
                    Test Tooltip 3 (Close inquiry)
                  </span>
                </Button>
              </div>
              
              <div className="inline-block overflow-visible">
                <Button
                  id="test-button-4"
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 relative group z-10"
                  onMouseEnter={() => handleButtonHover('test-button-4')}
                  onMouseLeave={handleButtonLeave}
                >
                  <RefreshCw className="h-5 w-5" />
                  <div className="absolute w-full h-10 bottom-full left-0 z-10"></div>
                  <span className={`tooltip-test absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-50 pointer-events-none ${hoveredButton === 'test-button-4' ? 'opacity-100' : 'opacity-0'}`}>
                    Test Tooltip 4 (Reopen inquiry)
                  </span>
                </Button>
              </div>
              
              <div className="inline-block overflow-visible">
                <Button
                  id="test-button-5"
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 relative group z-10"
                  onMouseEnter={() => handleButtonHover('test-button-5')}
                  onMouseLeave={handleButtonLeave}
                >
                  <Trash2 className="h-5 w-5" />
                  <div className="absolute w-full h-10 bottom-full left-0 z-10"></div>
                  <span className={`tooltip-test absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-50 pointer-events-none ${hoveredButton === 'test-button-5' ? 'opacity-100' : 'opacity-0'}`}>
                    Test Tooltip 5 (Delete thread)
                  </span>
                </Button>
              </div>
              
              <div className="inline-block overflow-visible">
                <Button
                  id="test-button-6"
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 relative group z-10"
                  onMouseEnter={() => handleButtonHover('test-button-6')}
                  onMouseLeave={handleButtonLeave}
                >
                  <CreditCard className="h-5 w-5 text-maroon-600" />
                  <div className="absolute w-full h-10 bottom-full left-0 z-10"></div>
                  <span className={`tooltip-test absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap z-50 pointer-events-none ${hoveredButton === 'test-button-6' ? 'opacity-100' : 'opacity-0'}`}>
                    Test Tooltip 6 (Make payment)
                  </span>
                </Button>
              </div>
            </div>
            
            {hoveredButton && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-medium text-blue-800 mb-2">Currently hovering: {hoveredButton}</p>
                <p className="text-sm text-blue-700">
                  If the tooltip is clipped, one of these containers likely has overflow constraints:
                </p>
              </div>
            )}
            
            {Object.keys(containerStyles).length > 0 && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-medium text-yellow-800 mb-2">Container Styles That May Cause Clipping:</h3>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {Object.entries(containerStyles).map(([path, styles]) => (
                    <div key={path} className="p-2 bg-white rounded border border-yellow-100">
                      <p className="text-sm font-medium text-yellow-800">{path}</p>
                      <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                        {styles.map((style, index) => (
                          <li key={index} className={style.includes('overflow') && !style.includes('visible') ? 'font-bold text-red-600' : ''}>
                            {style}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-medium text-green-800 mb-2">Recommended CSS Fixes:</h3>
            <ul className="text-sm text-green-700 space-y-2">
              <li>
                <code className="bg-white px-2 py-1 rounded">overflow-visible</code> - Add to all parent containers
              </li>
              <li>
                <code className="bg-white px-2 py-1 rounded">z-index: 50</code> - Add to tooltips to ensure they appear above other elements
              </li>
              <li>
                <code className="bg-white px-2 py-1 rounded">position: relative</code> - Ensure parent containers have proper positioning
              </li>
              <li>
                <code className="bg-white px-2 py-1 rounded">pointer-events: none</code> - Add to tooltips so they don't interfere with hover
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TooltipDebugger;