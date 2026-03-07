import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false }))
      .finally(() => setLoading(false));
  }, []);

  const register = async (nickName, nickNameConfirm, ticketNumber, ticketNumberConfirm) => {
    const data = await api.register(nickName, nickNameConfirm, ticketNumber, ticketNumberConfirm);
    setAuth({ authenticated: true, role: 'participant', name: data.name });
    return data;
  };

  const login = async (nickName, ticketNumber) => {
    const data = await api.login(nickName, ticketNumber);
    setAuth({ authenticated: true, role: 'participant', name: data.name });
    return data;
  };

  const adminLogin = async (username, password) => {
    await api.adminLogin(username, password);
    setAuth({ authenticated: true, role: 'admin' });
  };

  const logout = async () => {
    await api.logout();
    setAuth({ authenticated: false });
  };

  return (
    <AuthContext.Provider value={{ auth, loading, register, login, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
