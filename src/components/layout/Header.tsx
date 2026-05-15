import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Menu, X, Shield, User } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import Logo from './Logo';

const Header: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const { user, signOut, checkSessionStatus, isImpersonating } = useAuth();
  const navigate = useNavigate();

  // Call checkSessionStatus when the component mounts
  React.useEffect(() => {
    if (user) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('Header mounted with user, calling checkSessionStatus');
      }
      checkSessionStatus().catch(error => {
        // eslint-disable-next-line no-console
        console.error('Error in checkSessionStatus on mount:', error);
      });
    }
  }, [user, checkSessionStatus]);

  // Handle scroll events
  React.useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      setIsScrolled(offset > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Add click handler to refresh session when user interacts with header
  const handleUserInteraction = async (e: React.MouseEvent) => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('Header click detected', { 
        user: !!user,
        target: e.target,
        currentTarget: e.currentTarget,
        eventPhase: e.eventPhase 
      });
    }
    
    if (user) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('User is authenticated, calling checkSessionStatus');
      }
      try {
        await checkSessionStatus();
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('checkSessionStatus completed successfully');
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error in checkSessionStatus:', error);
      }
    } else {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('No user, skipping checkSessionStatus');
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsOpen(false);
  };

  return (
    <header
      data-testid="header"
      onClick={handleUserInteraction}
      className={`fixed top-0 left-0 right-0 transition-all duration-300 font-display tracking-tight bg-white shadow-md z-50 ${
        isScrolled ? 'py-2' : 'py-4'
      }`}
      style={{ top: isImpersonating ? '56px' : '0px' }}
    >
      <div data-testid="header-inner" className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center font-display text-2xl tracking-tight text-maroon-900">
            <Logo />
          </Link>

          {/* Desktop Navigation */}
          <nav className="header-desktop-nav items-center space-x-6 font-display text-lg text-black" style={{zIndex: 99999}}>
            
            {(user as any)?.is_admin && (
              <Link to="/admin">
                <Button 
                  variant="ghost"
                  className="flex items-center text-maroon-800 bg-blue-100 hover:bg-blue-200 border border-blue-300"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  <span>Admin</span>
                </Button>
              </Link>
            )}
            
            {user ? (
              <div className="relative group">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex items-center text-gray-700 hover:text-maroon-700 hover:bg-maroon-50"
                >
                  <User className="h-4 w-4 mr-1.5" />
                  <span>Account</span>
                </Button>
                <div className="absolute right-0 w-48 bg-white rounded-md shadow-lg py-1 z-[60] mt-1 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150 transform">
                  <div className="absolute h-2 -top-2 left-0 right-0"></div>
                  <Link 
                    to="/dashboard" 
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Dashboard
                  </Link>
                  <Link 
                    to="/favorites" 
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Favorites
                  </Link>
                  <Link 
                    to="/messages" 
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Messages
                  </Link>
                  <Link 
                    to="/calendar" 
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Calendar
                  </Link>
                  <Link 
                    to="/profile" 
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Profile
                  </Link>
                  <Button 
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-gray-700 hover:bg-gray-100"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <Link 
                  to="/signin" 
                  className="text-sm font-medium text-gray-700 hover:text-maroon-700 px-2 py-1 hover:bg-maroon-50 rounded transition-colors"
                >
                  Sign in
                </Link>
                <span className="text-gray-300">|</span>
                <Link 
                  to="/signup" 
                  className="text-sm font-medium text-gray-700 hover:text-maroon-700 px-2 py-1 hover:bg-maroon-50 rounded transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
            
            {/* Add Artwork button - always visible */}
            <Link to="/add-artwork">
              <Button
                variant="primary"
                size="sm"
                className="flex items-center font-display text-base font-semibold tracking-tight"
              >
                <Building2 className="h-3.5 w-3.5 mr-1" />
                <span>Add Artwork</span>
              </Button>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <Button 
            variant="ghost"
            className="md:hidden p-1"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div data-testid="mobile-menu" className="md:hidden bg-white shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {(user as any)?.is_admin && (
              <Link 
                to="/admin" 
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-maroon-800 hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
              >
                Admin
              </Link>
            )}
            {user ? (
              <div className="space-y-1">
                <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                  <Button 
                    variant="ghost"
                    className="w-full justify-start text-gray-700 hover:bg-gray-100"
                  >
                    Dashboard
                  </Button>
                </Link>
                <Link to="/favorites" onClick={() => setIsOpen(false)}>
                  <Button 
                    variant="ghost"
                    className="w-full justify-start text-gray-700 hover:bg-gray-100"
                  >
                    Favorites
                  </Button>
                </Link>
                <Link to="/messages" onClick={() => setIsOpen(false)}>
                  <Button 
                    variant="ghost"
                    className="w-full justify-start text-gray-700 hover:bg-gray-100"
                  >
                    Messages
                  </Button>
                </Link>
                <Link to="/calendar" onClick={() => setIsOpen(false)}>
                  <Button 
                    variant="ghost"
                    className="w-full justify-start text-gray-700 hover:bg-gray-100"
                  >
                    Calendar
                  </Button>
                </Link>
                <Link to="/profile" onClick={() => setIsOpen(false)}>
                  <Button 
                    variant="ghost"
                    className="w-full justify-start text-gray-700 hover:bg-gray-100"
                  >
                    Profile
                  </Button>
                </Link>
                <Button 
                  variant="ghost"
                  className="w-full justify-start text-gray-700 hover:bg-gray-100"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Link to="/signin" onClick={() => setIsOpen(false)}>
                <Button 
                  variant="ghost"
                  className="w-full justify-start text-gray-700 hover:bg-gray-100"
                >
                  Sign In
                </Button>
              </Link>
            )}
            
            {/* Add Artwork button - always visible in mobile */}
            <div className="pt-2">
              <Link to="/add-artwork" onClick={() => setIsOpen(false)}>
                <Button
                  variant="primary"
                  className="w-full justify-center"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Add Artwork
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;