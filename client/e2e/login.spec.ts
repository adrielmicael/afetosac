import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('deve exibir página de login', async ({ page }) => {
    await expect(page).toHaveTitle(/Afeto SAC/);
    await expect(page.getByRole('heading', { name: 'Afeto SAC' })).toBeVisible();
    await expect(page.getByPlaceholder(/seu@email.com/)).toBeVisible();
    await expect(page.getByPlaceholder(/••••••/)).toBeVisible();
  });

  test('deve fazer login com credenciais válidas', async ({ page }) => {
    await page.getByPlaceholder(/seu@email.com/).fill('admin@afeto.com');
    await page.getByPlaceholder(/••••••/).fill('admin123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Verificar redirecionamento para dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.getByPlaceholder(/seu@email.com/).fill('invalid@test.com');
    await page.getByPlaceholder(/••••••/).fill('wrongpassword');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Verificar mensagem de erro
    await expect(page.getByText(/Erro ao fazer login/)).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('deve redirecionar usuário logado do login para dashboard', async ({ page }) => {
    // Login primeiro
    await page.getByPlaceholder(/seu@email.com/).fill('admin@afeto.com');
    await page.getByPlaceholder(/••••••/).fill('admin123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL('/');

    // Tentar acessar login novamente
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });
});
