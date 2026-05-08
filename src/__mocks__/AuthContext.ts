type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: jest.Mock<Promise<void>, [string, string]>;
  signOut: jest.Mock<Promise<void>, []>;
  register: jest.Mock<Promise<void>, [any]>;
  checkSessionStatus: jest.Mock<Promise<void>, []>;
};

const createMockAuthContext = (): AuthContextType => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
  register: jest.fn().mockResolvedValue(undefined),
  checkSessionStatus: jest.fn().mockResolvedValue(undefined),
});

const mockAuthContext = createMockAuthContext();

const useAuth = jest.fn(() => mockAuthContext);

const setMockUser = (user: User | null) => {
  mockAuthContext.user = user;
  mockAuthContext.isAuthenticated = !!user;
};

const resetMocks = () => {
  const newMock = createMockAuthContext();
  
  // Keep the current user and auth state
  newMock.user = mockAuthContext.user;
  newMock.isAuthenticated = mockAuthContext.isAuthenticated;
  
  // Apply the new mock
  Object.assign(mockAuthContext, newMock);
};

export { useAuth, setMockUser, resetMocks };

export default {
  useAuth,
  setMockUser,
  resetMocks,
};
