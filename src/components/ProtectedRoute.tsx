import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'Admin' | 'Staff';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  // If not logged in, redirect to login page, saving the location they tried to access
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a role is required (like Admin-only pages) and the user doesn't have it (Staff)
  if (requiredRole && requiredRole === 'Admin' && !isAdmin()) {
    console.warn(`[ProtectedRoute] Unauthorized access attempt to Admin-only route: ${location.pathname}`);
    // Redirect staff back to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
