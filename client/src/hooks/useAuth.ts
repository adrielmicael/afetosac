import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../services/api';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const useAuth = () => {
  const navigate = useNavigate();
  const { setAuth, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const login = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      const { user, token } = response.data;
      setAuth(user, token);
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout(); // revoga a sessão no servidor
    } catch {
      // segue com o logout local mesmo se a chamada falhar
    } finally {
      logout();
      navigate('/login');
      toast.success('Logout realizado');
    }
  };

  return {
    register,
    handleSubmit,
    errors,
    isLoading,
    login,
    logout: handleLogout,
  };
};
